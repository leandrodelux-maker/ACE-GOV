import { requireMunicipalityId } from './municipalityScope';
import { supabase } from './supabaseClient';
import {
  Municipality,
  Neighborhood,
  Property,
  Visit,
  FieldCycle,
  Ovitrap,
  StrategicPoint,
  SpecialProperty,
  CitizenComplaint,
  Alert,
} from '../types';

/**
 * Serviço de integração e substituição progressiva de dados mockados por dados reais do Supabase/PostgreSQL
 */
/** Coordenada opcional: vazio/ inválido => null (nunca 0 nem posição padrão). */
function toNullableCoord(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const supabaseService = {
  /**
   * ID do cadastro de agente (tabela agents) do perfil autenticado.
   * visits/ovitrap_installations/ovitrap_collections.agent_id referenciam agents(id),
   * não profiles(id). Guardado no aparelho para uso offline. null = perfil sem cadastro de agente.
   */
  async getAgentIdForProfile(profileId: string, municipalityId: string): Promise<string | null> {
    const cacheKey = `endemias_agent_id_${profileId}`;
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('id')
        .eq('profile_id', profileId)
        .eq('municipality_id', requireMunicipalityId(municipalityId))
        .eq('active', true)
        .limit(1)
        .maybeSingle();
      if (!error) {
        try {
          if (data?.id) localStorage.setItem(cacheKey, data.id);
          else localStorage.removeItem(cacheKey);
        } catch {
          /* armazenamento indisponível */
        }
        return data?.id ?? null;
      }
    } catch {
      /* sem conexão: usa o cache */
    }
    try {
      return localStorage.getItem(cacheKey);
    } catch {
      return null;
    }
  },

  /**
   * Bairros do município com contagens REAIS (imóveis, focos, setores, quadras).
   * Indicadores sem fonte no banco (risco, cobertura, responsáveis) ficam ausentes
   * — a interface deve exibir "Sem dados" nesses casos. Retorna null em erro.
   */
  async getNeighborhoods(municipalityId: string): Promise<Neighborhood[] | null> {
    try {
      const munId = requireMunicipalityId(municipalityId);
      const [neighRes, propsRes, sectorsRes, blocksRes] = await Promise.all([
        supabase.from('neighborhoods').select('*').eq('municipality_id', munId).order('name'),
        supabase
          .from('properties')
          .select('neighborhood_id, status')
          .eq('municipality_id', munId)
          .is('deleted_at', null),
        supabase.from('sectors').select('id, neighborhood_id').eq('municipality_id', munId),
        supabase.from('blocks').select('id, sector_id').eq('municipality_id', munId),
      ]);

      if (neighRes.error || !neighRes.data) return null;

      const props = propsRes.data || [];
      const sectors = sectorsRes.data || [];
      const blocks = blocksRes.data || [];
      const sectorNeighborhood = new Map(sectors.map((sc: any) => [sc.id, sc.neighborhood_id]));

      return neighRes.data.map((n: any) => {
        const neighProps = props.filter((p: any) => p.neighborhood_id === n.id);
        return {
          id: n.id,
          municipalityId: n.municipality_id,
          zoneId: n.zone_id || '',
          name: n.name,
          estimatedPopulation: typeof n.population === 'number' && n.population > 0 ? n.population : undefined,
          totalProperties: propsRes.error ? undefined : neighProps.length,
          totalSectors: sectorsRes.error ? undefined : sectors.filter((sc: any) => sc.neighborhood_id === n.id).length,
          totalBlocks: blocksRes.error
            ? undefined
            : blocks.filter((b: any) => sectorNeighborhood.get(b.sector_id) === n.id).length,
          responsibleAgents: [],
          fociCount: propsRes.error ? undefined : neighProps.filter((p: any) => p.status === 'FOCO').length,
        } as Neighborhood;
      });
    } catch {
      return null;
    }
  },

  /**
   * Ciclo de campo em andamento. Apenas campos existentes no banco; progresso
   * (visitados, focos, cobertura) deve ser calculado a partir das visitas.
   */
  async getActiveCycle(municipalityId: string): Promise<FieldCycle | null> {
    try {
      const { data, error } = await supabase
        .from('field_cycles')
        .select('*')
        .eq('municipality_id', requireMunicipalityId(municipalityId))
        .eq('status', 'EM_ANDAMENTO')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        municipalityId: data.municipality_id,
        name: data.name,
        year: data.year,
        number: data.cycle_number,
        startDate: data.start_date,
        endDate: data.end_date,
        totalTargetProperties: data.target_properties ?? undefined,
        status: data.status,
      } as FieldCycle;
    } catch {
      return null;
    }
  },

  /**
   * Inserir Visita no Supabase com sincronização PWA
   */
  async insertVisit(visit: Visit): Promise<boolean> {
    try {
      const { error } = await supabase.from('visits').insert({
        id: visit.id.length === 36 ? visit.id : undefined,
        municipality_id: visit.municipalityId,
        cycle_id: visit.cycleId,
        property_id: visit.propertyId,
        visit_date: visit.date,
        started_at: `${visit.date}T${visit.time}:00Z`,
        finished_at: new Date().toISOString(),
        visit_type: 'ROTINA',
        result: visit.situation,
        latitude: visit.latitude,
        longitude: visit.longitude,
        residents_present: visit.situation === 'TRABALHADO',
        notes: visit.conduct,
        status: 'CONCLUIDA',
        offline_created: visit.syncStatus === 'PENDING',
        synced_at: new Date().toISOString(),
      });

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Inserir Denúncia de Foco no Supabase
   */
  async insertComplaint(complaint: CitizenComplaint): Promise<boolean> {
    try {
      const { error } = await supabase.from('complaints').insert({
        id: complaint.id.length === 36 ? complaint.id : undefined,
        municipality_id: complaint.municipalityId,
        protocol: complaint.protocol,
        complainant_name: complaint.citizenName,
        complainant_phone: complaint.citizenPhone,
        anonymous: !complaint.citizenName,
        description: complaint.description,
        street: complaint.address,
        latitude: complaint.latitude,
        longitude: complaint.longitude,
        priority: 'MEDIA',
        status: 'RECEBIDA',
      });

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Buscar Denúncias Reais do Supabase
   */
  async getComplaints(municipalityId: string): Promise<CitizenComplaint[] | null> {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('municipality_id', municipalityId)
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) return null;

      return data.map((c: any) => ({
        id: c.id,
        protocol: c.protocol,
        municipalityId: c.municipality_id,
        type: 'POSSIVEL_FOCO',
        description: c.description,
        address: c.street,
        neighborhood: 'Centro',
        latitude: c.latitude,
        longitude: c.longitude,
        citizenName: c.complainant_name,
        citizenPhone: c.complainant_phone,
        status: c.status || 'RECEBIDA',
        createdAt: c.created_at,
      }));
    } catch {
      return null;
    }
  },

  /**
   * Buscar Denúncia por Protocolo no Supabase
   */
  async getComplaintByProtocol(protocol: string): Promise<CitizenComplaint | null> {
    try {
      const cleanProtocol = protocol.trim().toUpperCase();
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .ilike('protocol', cleanProtocol)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        protocol: data.protocol,
        municipalityId: data.municipality_id,
        type: 'POSSIVEL_FOCO',
        description: data.description,
        address: data.street,
        neighborhood: 'Centro',
        latitude: data.latitude,
        longitude: data.longitude,
        citizenName: data.complainant_name,
        citizenPhone: data.complainant_phone,
        status: data.status || 'RECEBIDA',
        createdAt: data.created_at,
      };
    } catch {
      return null;
    }
  },

  /**
   * Buscar Imóveis com Paginação Server-Side, Filtros e Ordenação
   */
  async getPropertiesPaginated(options: {
    municipalityId: string;
    page: number;
    pageSize: number;
    searchTerm?: string;
    neighborhoodId?: string;
    sectorId?: string;
    microareaId?: string;
    status?: string;
    propertyType?: string;
    orderBy?: string;
    ascending?: boolean;
  }): Promise<{ properties: any[]; totalCount: number }> {
    try {
      const {
        page = 1,
        pageSize = 10,
        searchTerm = '',
        neighborhoodId,
        sectorId,
        microareaId,
        status,
        propertyType,
        orderBy = 'property_code',
        ascending = true,
      } = options;

      let query = supabase
        .from('properties')
        .select('*, neighborhoods(name), sectors(name, code), microareas(name, code), blocks(code)', {
          count: 'exact',
        })
        .eq('municipality_id', requireMunicipalityId(options.municipalityId))
        .is('deleted_at', null);

      if (neighborhoodId && neighborhoodId !== 'ALL') {
        query = query.eq('neighborhood_id', neighborhoodId);
      }
      if (sectorId && sectorId !== 'ALL') {
        query = query.eq('sector_id', sectorId);
      }
      if (microareaId && microareaId !== 'ALL') {
        query = query.eq('microarea_id', microareaId);
      }
      if (status && status !== 'ALL') {
        query = query.eq('status', status);
      }
      if (propertyType && propertyType !== 'ALL') {
        query = query.eq('property_type', propertyType);
      }

      if (searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(
          `property_code.ilike.%${term}%,street.ilike.%${term}%,resident_name.ilike.%${term}%`
        );
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order(orderBy, { ascending })
        .range(from, to);

      if (error) throw error;

      const formatted = (data || []).map((p: any) => ({
        id: p.id,
        code: p.property_code,
        address: `${p.street}, ${p.number}${p.complement ? ` - ${p.complement}` : ''}`,
        street: p.street,
        number: p.number,
        complement: p.complement || '',
        reference: p.reference || '',
        postalCode: p.postal_code || '',
        neighborhood: p.neighborhoods?.name || 'Centro',
        neighborhoodId: p.neighborhood_id,
        sector: p.sectors?.name || 'Setor Geral',
        sectorId: p.sector_id,
        microarea: p.microareas?.name || 'Microárea Geral',
        microareaId: p.microarea_id,
        block: p.blocks?.code || 'QD-01',
        blockId: p.block_id,
        type: p.property_type || 'RESIDENCIA',
        status: p.status || 'NORMAL',
        residentName: p.resident_name || '',
        residentPhone: p.resident_phone || '',
        residentsCount: p.residents_count || 1,
        riskScore: p.risk_score || 0,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        lastVisitAt: p.last_visit_at,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      return {
        properties: formatted,
        totalCount: count || formatted.length,
      };
    } catch {
      return { properties: [], totalCount: 0 };
    }
  },

  /**
   * Criar Novo Imóvel no Supabase
   */
  async createProperty(propertyData: any): Promise<any> {
    try {
      const code = `IMV-${Math.floor(100000 + Math.random() * 900000)}`;

      const { data, error } = await supabase
        .from('properties')
        .insert({
          municipality_id: requireMunicipalityId(propertyData.municipalityId),
          neighborhood_id: propertyData.neighborhoodId,
          sector_id: propertyData.sectorId || null,
          microarea_id: propertyData.microareaId || null,
          block_id: propertyData.blockId || null,
          property_code: propertyData.code || code,
          property_type: propertyData.type || 'RESIDENCIA',
          street: propertyData.street,
          number: propertyData.number,
          complement: propertyData.complement || null,
          reference: propertyData.reference || null,
          postal_code: propertyData.postalCode || null,
          latitude: toNullableCoord(propertyData.latitude),
          longitude: toNullableCoord(propertyData.longitude),
          resident_name: propertyData.residentName || null,
          resident_phone: propertyData.residentPhone || null,
          residents_count: propertyData.residentsCount || 1,
          status: propertyData.status || 'NORMAL',
          risk_score: propertyData.riskScore || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Atualizar Imóvel no Supabase
   */
  async updateProperty(id: string, updates: any): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('properties')
        .update({
          neighborhood_id: updates.neighborhoodId,
          sector_id: updates.sectorId || null,
          microarea_id: updates.microareaId || null,
          block_id: updates.blockId || null,
          property_type: updates.type,
          street: updates.street,
          number: updates.number,
          complement: updates.complement,
          reference: updates.reference,
          postal_code: updates.postalCode,
          latitude: updates.latitude,
          longitude: updates.longitude,
          resident_name: updates.residentName,
          resident_phone: updates.residentPhone,
          residents_count: updates.residentsCount,
          status: updates.status,
          risk_score: updates.riskScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Arquivar Imóvel (Soft Delete)
   */
  async archiveProperty(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('properties')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Obter histórico cronológico e detalhes completos do Imóvel para as abas
   */
  async getPropertyHistory(propertyId: string): Promise<{
    visits: any[];
    breedingSites: any[];
    pendingVisits: any[];
    recurrences: any[];
  }> {
    try {
      const [visitsRes, breedingRes, pendingRes, recurrencesRes] = await Promise.all([
        supabase
          .from('visits')
          .select('*, visit_deposits(*), visit_actions(*)')
          .eq('property_id', propertyId)
          .order('visit_date', { ascending: false }),
        supabase
          .from('breeding_sites')
          .select('*')
          .eq('property_id', propertyId)
          .order('identified_at', { ascending: false }),
        supabase
          .from('pending_visits')
          .select('*')
          .eq('property_id', propertyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('recurrence_records')
          .select('*')
          .eq('property_id', propertyId)
          .order('recurrence_date', { ascending: false }),
      ]);

      return {
        visits: visitsRes.data || [],
        breedingSites: breedingRes.data || [],
        pendingVisits: pendingRes.data || [],
        recurrences: recurrencesRes.data || [],
      };
    } catch {
      return { visits: [], breedingSites: [], pendingVisits: [], recurrences: [] };
    }
  },

  /**
   * Buscar Visitas Reais com Filtros e Relacionamentos
   */
  async getVisits(options: {
    municipalityId: string;
    cycleId?: string;
    searchTerm?: string;
    situation?: string;
    limit?: number;
  }): Promise<Visit[]> {
    try {
      const municipalityId = requireMunicipalityId(options.municipalityId);
      const {
        cycleId,
        searchTerm = '',
        situation = 'ALL',
        limit = 100,
      } = options;

      let query = supabase
        .from('visits')
        .select(`
          *,
          properties (
            id, property_code, street, number, complement, neighborhood_id, neighborhoods (name)
          ),
          agents (
            id, full_name, registration_number
          ),
          visit_deposits (*),
          visit_actions (*)
        `)
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null)
        .order('visit_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (cycleId && cycleId !== 'ALL') {
        query = query.eq('cycle_id', cycleId);
      }

      if (situation && situation !== 'ALL') {
        if (situation === 'FOCO') {
          // Filtrado em memória se possui depósito positivo ou larvas
        } else {
          query = query.eq('result', situation);
        }
      }

      const { data, error } = await query;
      if (error || !data) return [];

      let formatted: Visit[] = data.map((v: any) => {
        const hasFoci = (v.visit_deposits || []).some((d: any) => d.positive || d.larvae_found);
        const hasEliminated = (v.visit_deposits || []).some((d: any) => d.eliminated);
        const inspections = (v.visit_deposits || []).map((d: any) => ({
          category: d.deposit_type as any,
          name: `Depósito ${d.deposit_type}`,
          quantity: d.quantity,
          hasWater: true,
          hasLarvae: !!d.larvae_found,
          isFoci: !!d.positive || !!d.larvae_found,
          actionTaken: (d.eliminated ? 'ELIMINADO' : d.treated ? 'TRATADO' : 'ORIENTADO') as any,
          larvicideUsed: d.treatment_product,
        }));

        const street = v.properties?.street || 'Rua não identificada';
        const num = v.properties?.number || 'S/N';
        const neighborhood = v.properties?.neighborhoods?.name || 'Centro';

        return {
          id: v.id,
          municipalityId: v.municipality_id,
          cycleId: v.cycle_id,
          propertyId: v.property_id,
          propertyCode: v.properties?.property_code || 'Sem código',
          propertyAddress: `${street}, ${num}`,
          propertyType: (v.properties?.property_type || 'RESIDENCIA') as any,
          neighborhood: neighborhood,
          agentId: v.agent_id || '',
          agentName: v.agents?.full_name || 'Agente não informado',
          date: v.visit_date,
          time: v.started_at ? new Date(v.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
          situation: (v.result || 'TRABALHADO') as any,
          inspections: inspections,
          totalDepositsInspected: inspections.reduce((acc: number, i: any) => acc + (i.quantity || 1), 0),
          fociFound: hasFoci,
          fociEliminated: hasEliminated,
          conduct: v.notes || (hasFoci ? 'Foco detectado e tratado com larvicida' : 'Inspeção peridomiciliar de rotina normal'),
          latitude: v.latitude ?? null,
          longitude: v.longitude ?? null,
          syncStatus: (v.offline_created ? 'PENDING' : 'SYNCED') as any,
          createdAt: v.created_at,
        };
      });

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        formatted = formatted.filter(
          v =>
            v.propertyAddress.toLowerCase().includes(term) ||
            v.propertyCode.toLowerCase().includes(term) ||
            v.agentName.toLowerCase().includes(term) ||
            v.neighborhood.toLowerCase().includes(term)
        );
      }

      if (situation === 'FOCO') {
        formatted = formatted.filter(v => v.fociFound);
      }

      return formatted;
    } catch {
      return [];
    }
  },

  /**
   * Transação Operacional: Salvar Visita com Depósitos, Ações e Atualizações de Imóvel e Pendência
   */
  async registerVisitTransaction(payload: {
    municipalityId: string;
    cycleId: string;
    propertyId: string;
    agentId?: string;
    visitDate: string;
    startedAt?: string;
    finishedAt?: string;
    visitType: string;
    result: string; // TRABALHADO, FECHADO, RECUSADO, DESABITADO
    latitude?: number;
    longitude?: number;
    gpsAccuracy?: number;
    notes?: string;
    deposits: Array<{
      depositType: string; // A1, A2, B, C, D1, D2, E
      quantity: number;
      positive?: boolean;
      larvaeFound?: boolean;
      eliminated?: boolean;
      treated?: boolean;
      treatmentProduct?: string;
      notes?: string;
    }>;
    actions?: Array<{
      actionType: string;
      quantity: number;
      notes?: string;
    }>;
  }): Promise<{ success: boolean; visitId?: string; error?: string }> {
    try {
      // 1. Inserir visita
      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .insert({
          municipality_id: payload.municipalityId,
          cycle_id: payload.cycleId,
          property_id: payload.propertyId,
          agent_id: payload.agentId || null,
          visit_date: payload.visitDate,
          started_at: payload.startedAt || new Date().toISOString(),
          finished_at: payload.finishedAt || new Date().toISOString(),
          visit_type: payload.visitType || 'ROTINA',
          result: payload.result,
          latitude: payload.latitude || null,
          longitude: payload.longitude || null,
          gps_accuracy: payload.gpsAccuracy || 5.0,
          residents_present: payload.result === 'TRABALHADO',
          notes: payload.notes || null,
          status: 'CONCLUIDA',
          offline_created: false,
          synced_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (visitError || !visitData) {
        throw new Error(visitError?.message || 'Erro ao registrar visita');
      }

      const visitId = visitData.id;

      // 2. Inserir depósitos se houver
      if (payload.deposits && payload.deposits.length > 0) {
        const depositsRows = payload.deposits.map(d => ({
          visit_id: visitId,
          deposit_type: d.depositType,
          quantity: d.quantity || 1,
          positive: !!d.positive,
          larvae_found: !!d.larvaeFound,
          eliminated: !!d.eliminated,
          treated: !!d.treated,
          treatment_product: d.treatmentProduct || null,
          notes: d.notes || null,
        }));

        await supabase.from('visit_deposits').insert(depositsRows);
      }

      // 3. Inserir ações se houver
      if (payload.actions && payload.actions.length > 0) {
        const actionRows = payload.actions.map(a => ({
          visit_id: visitId,
          action_type: a.actionType,
          quantity: a.quantity || 1,
          notes: a.notes || null,
        }));

        await supabase.from('visit_actions').insert(actionRows);
      }

      // 4. Atualizar last_visit_at do imóvel
      const hasFoci = payload.deposits?.some(d => d.positive || d.larvaeFound);
      const newStatus = hasFoci
        ? 'FOCO'
        : payload.result === 'FECHADO'
        ? 'FECHADO'
        : payload.result === 'RECUSADO'
        ? 'RECUSADO'
        : 'NORMAL';

      await supabase
        .from('properties')
        .update({
          last_visit_at: new Date().toISOString(),
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.propertyId);

      // 5. Gerenciar pendências
      if (payload.result === 'FECHADO' || payload.result === 'RECUSADO') {
        // Criar ou atualizar pendência
        await supabase.from('pending_visits').insert({
          cycle_id: payload.cycleId,
          property_id: payload.propertyId,
          assigned_agent_id: payload.agentId || null,
          reason: payload.result === 'FECHADO' ? 'Morador Ausente / Imóvel Fechado' : 'Recusa de Acesso pelo Morador',
          priority: payload.result === 'RECUSADO' ? 'ALTA' : 'MEDIA',
          status: 'PENDENTE',
        });
      } else if (payload.result === 'TRABALHADO') {
        // Resolver pendência aberta se existia
        await supabase
          .from('pending_visits')
          .update({ status: 'RESOLVIDA', updated_at: new Date().toISOString() })
          .eq('property_id', payload.propertyId)
          .eq('cycle_id', payload.cycleId)
          .eq('status', 'PENDENTE');
      }

      return { success: true, visitId };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao salvar visita' };
    }
  },

  /**
   * Buscar Ciclos do Município
   */
  async getCycles(municipalityId: string): Promise<FieldCycle[]> {
    try {
      const { data, error } = await supabase
        .from('field_cycles')
        .select('*')
        .eq('municipality_id', municipalityId)
        .order('year', { ascending: false })
        .order('cycle_number', { ascending: false });

      if (error || !data) return [];

      // Progresso calculado a partir das visitas registradas em cada ciclo
      const { data: visits } = await supabase
        .from('visits')
        .select('cycle_id, property_id, result, visit_deposits(positive)')
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null);
      const byCycle = new Map<string, any[]>();
      (visits || []).forEach((v: any) => {
        if (!byCycle.has(v.cycle_id)) byCycle.set(v.cycle_id, []);
        byCycle.get(v.cycle_id)!.push(v);
      });
      const res = (v: any) => String(v.result ?? '').toUpperCase();

      return data.map((d: any) => {
        const cv = byCycle.get(d.id) || [];
        const visited = new Set(cv.filter((v) => res(v) === 'TRABALHADO').map((v) => v.property_id)).size;
        const target = typeof d.target_properties === 'number' && d.target_properties > 0 ? d.target_properties : undefined;
        return {
          id: d.id,
          municipalityId: d.municipality_id,
          name: d.name,
          year: d.year,
          number: d.cycle_number,
          startDate: d.start_date,
          endDate: d.end_date,
          goalPercentage: undefined,
          currentCoveragePercentage: target ? Math.round((visited / target) * 1000) / 10 : undefined,
          totalTargetProperties: target,
          visitedProperties: visited,
          fociCount: cv.reduce((acc, v) => acc + (v.visit_deposits || []).filter((dep: any) => dep.positive).length, 0),
          closedCount: cv.filter((v) => res(v) === 'FECHADO').length,
          refusalCount: cv.filter((v) => res(v) === 'RECUSADO').length,
          status: d.status,
        } as FieldCycle;
      });
    } catch {
      return [];
    }
  },

  /**
   * Buscar Ovitrampas com Cálculo de IPO e IDO
   */
  async getOvitraps(municipalityId: string): Promise<{
    ovitraps: Ovitrap[];
    metrics: { ipo: number; ido: number; totalTraps: number; positiveTraps: number; totalEggs: number };
  }> {
    try {
      const { data, error } = await supabase
        .from('ovitraps')
        .select('*, neighborhoods(name)')
        .eq('municipality_id', municipalityId);

      if (error || !data || data.length === 0) {
        return {
          ovitraps: [],
          metrics: { ipo: 0, ido: 0, totalTraps: 0, positiveTraps: 0, totalEggs: 0 },
        };
      }

      let totalEggs = 0;
      let positiveCount = 0;

      const formatted: Ovitrap[] = data.map((t: any) => {
        const eggs = t.eggs_count || 0;
        const isPos = !!t.positive || eggs > 0;
        if (isPos) {
          positiveCount++;
          totalEggs += eggs;
        }

        return {
          id: t.id,
          code: t.code,
          qrCode: t.code,
          municipalityId: t.municipality_id,
          neighborhood: t.neighborhoods?.name || 'Bairro não informado',
          sector: '',
          address: t.address || '',
          latitude: (t.latitude ?? null) as any,
          longitude: (t.longitude ?? null) as any,
          installationDate: t.installed_at || '',
          responsibleAgentId: t.agent_id || '',
          responsibleAgentName: '',
          status: (t.status || 'ATIVA') as any,
          lastCollectionDate: t.last_reading_at || '',
          lastEggCount: eggs,
          isPositive: isPos,
          consecutiveGrowth: false,
          growthAlert: isPos,
          history: [],
        };
      });

      const totalTraps = formatted.length;
      const ipo = totalTraps > 0 ? Number(((positiveCount / totalTraps) * 100).toFixed(1)) : 0;
      const ido = positiveCount > 0 ? Number((totalEggs / positiveCount).toFixed(1)) : 0;

      return {
        ovitraps: formatted,
        metrics: { ipo, ido, totalTraps, positiveTraps: positiveCount, totalEggs },
      };
    } catch {
      return {
        ovitraps: [],
        metrics: { ipo: 0, ido: 0, totalTraps: 0, positiveTraps: 0, totalEggs: 0 },
      };
    }
  },

  /**
   * Buscar Pontos Estratégicos com Alertas Quinzenais (15 dias)
   */
  async getStrategicPoints(municipalityId: string): Promise<StrategicPoint[]> {
    try {
      const { data, error } = await supabase
        .from('strategic_points')
        .select('*, neighborhoods(name)')
        .eq('municipality_id', municipalityId);

      if (error || !data) return [];

      return data.map((sp: any) => {
        // Sem inspeção registrada => vistoria vencida (nunca uma data inventada)
        const lastVisit = sp.last_inspection_at ? new Date(sp.last_inspection_at) : null;
        const daysSince = lastVisit ? Math.floor((Date.now() - lastVisit.getTime()) / 86400000) : null;
        const isDue = daysSince === null || daysSince > 15;

        return {
          id: sp.id,
          municipalityId: sp.municipality_id,
          name: sp.name,
          type: (sp.type || 'FERRO_VELHO') as any,
          contactName: sp.responsible_person || '',
          contactPhone: sp.responsible_phone || '',
          address: sp.address || '',
          neighborhood: sp.neighborhoods?.name || 'Bairro não informado',
          latitude: (sp.latitude ?? null) as any,
          longitude: (sp.longitude ?? null) as any,
          inspectionFrequencyDays: 15,
          responsibleAgentId: sp.agent_id || '',
          responsibleAgentName: '',
          riskLevel: isDue ? 'ALTO' : ((sp.risk_level || 'MEDIO') as any),
          lastInspectionDate: sp.last_inspection_at || '',
          nextInspectionDate: lastVisit ? new Date(lastVisit.getTime() + 15 * 86400000).toISOString().split('T')[0] : '',
          isInspectionOverdue: isDue,
          totalInspections: (sp.total_inspections ?? undefined) as any,
          fociHistoryCount: (sp.foci_history_count ?? undefined) as any,
        };
      });
    } catch {
      return [];
    }
  },

  /**
   * Buscar Imóveis Especiais
   */
  async getSpecialProperties(municipalityId: string): Promise<SpecialProperty[]> {
    try {
      const { data, error } = await supabase
        .from('special_properties')
        .select('*, neighborhoods(name)')
        .eq('municipality_id', municipalityId);

      if (error || !data) return [];

      return data.map((ip: any) => ({
        id: ip.id,
        municipalityId: ip.municipality_id,
        name: ip.name,
        type: (ip.type || 'HOSPITAL_UBS') as any,
        address: ip.address || '',
        neighborhood: ip.neighborhoods?.name || 'Bairro não informado',
        responsiblePerson: ip.responsible_person || '',
        contactPhone: ip.contact_phone || '',
        latitude: (ip.latitude ?? null) as any,
        longitude: (ip.longitude ?? null) as any,
        lastInspectionDate: ip.last_inspection_at || '',
        fociCount: 0,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Buscar Alertas do Município
   */
  async getAlerts(municipalityId: string): Promise<Alert[]> {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('municipality_id', municipalityId)
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) return [];

      return data.map((a: any) => ({
        id: a.id,
        municipalityId: a.municipality_id,
        category: 'ENTOMOLOGICO',
        level: a.severity === 'CRITICA' ? 'CRITICO' : 'ATENCAO',
        title: a.title || 'Alerta Operacional',
        description: a.message || 'Alerta do sistema de vigilância',
        neighborhood: 'Centro',
        resolved: !!a.resolved_at,
        createdAt: a.created_at,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Buscar Setores, Microáreas e Quadras para filtros
   */
  async getTerritoryHierarchy(municipalityId: string): Promise<{
    sectors: any[];
    microareas: any[];
    blocks: any[];
  }> {
    try {
      const [sectorsRes, microRes, blocksRes] = await Promise.all([
        supabase.from('sectors').select('*').eq('municipality_id', municipalityId),
        supabase.from('microareas').select('*').eq('municipality_id', municipalityId),
        supabase.from('blocks').select('*').eq('municipality_id', municipalityId),
      ]);

      return {
        sectors: sectorsRes.data || [],
        microareas: microRes.data || [],
        blocks: blocksRes.data || [],
      };
    } catch {
      return { sectors: [], microareas: [], blocks: [] };
    }
  },

  /**
   * Registrar Inspeção Real de Ponto Estratégico (PE) com persistência em banco
   */
  async registerStrategicPointInspection(payload: {
    strategicPointId: string;
    agentId?: string;
    depositsFound?: number;
    positiveDeposits?: number;
    treatment?: string;
    notes?: string;
  }): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

      // 1. Inserir inspeção
      await supabase.from('strategic_point_inspections').insert({
        strategic_point_id: payload.strategicPointId,
        agent_id: payload.agentId || null,
        inspection_date: today,
        deposits_found: payload.depositsFound ?? 1,
        positive_deposits: payload.positiveDeposits ?? 0,
        treatment: payload.treatment || 'Tratamento focal com larvicida',
        notes: payload.notes || 'Inspeção quinzenal realizada com sucesso.',
      });

      // 2. Atualizar tabela strategic_points
      await supabase
        .from('strategic_points')
        .update({
          last_inspection: today,
          next_inspection: nextDate,
          risk_level: (payload.positiveDeposits ?? 0) > 0 ? 'ALTO' : 'BAIXO',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.strategicPointId);

      return true;
    } catch (err) {
      console.error('Falha ao registrar inspeção de PE:', err);
      return false;
    }
  },

  /**
   * Registrar Inspeção Real de Imóvel Especial (IE) com persistência em banco
   */
  async registerSpecialPropertyInspection(payload: {
    specialPropertyId: string;
    agentId?: string;
    findings?: string;
    actions?: string;
    notes?: string;
  }): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextDate = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

      // 1. Inserir inspeção
      await supabase.from('special_property_inspections').insert({
        special_property_id: payload.specialPropertyId,
        agent_id: payload.agentId || null,
        inspection_date: today,
        findings: payload.findings || 'Inspeção em áreas comuns e reservatórios.',
        actions: payload.actions || 'Orientação técnica e vedação de reservatório.',
        notes: payload.notes || 'Vistoria bimestral realizada conforme protocolo SUS.',
      });

      // 2. Atualizar special_properties
      await supabase
        .from('special_properties')
        .update({
          last_inspection: today,
          next_inspection: nextDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.specialPropertyId);

      return true;
    } catch (err) {
      console.error('Falha ao registrar inspeção de IE:', err);
      return false;
    }
  },

  /**
   * Métricas consolidadas da Central de Território (Cards rápidos)
   */
  async getTerritoryMetrics(municipalityId: string): Promise<{
    neighborhoodsCount: number;
    sectorsCount: number;
    blocksCount: number;
    propertiesCount: number;
    microareasCount: number;
    teamsCount: number;
    agentsCount: number;
    strategicPointsCount: number;
    specialPropertiesCount: number;
  }> {
    try {
      const [
        nRes,
        sRes,
        bRes,
        pRes,
        mRes,
        tRes,
        aRes,
        peRes,
        ieRes,
      ] = await Promise.all([
        supabase.from('neighborhoods').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId),
        supabase.from('sectors').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId),
        supabase.from('blocks').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId),
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId).is('deleted_at', null),
        supabase.from('microareas').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId),
        supabase.from('teams').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId),
        supabase.from('agents').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId).eq('active', true),
        supabase.from('strategic_points').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId),
        supabase.from('special_properties').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId),
      ]);

      return {
        neighborhoodsCount: nRes.count || 0,
        sectorsCount: sRes.count || 0,
        blocksCount: bRes.count || 0,
        propertiesCount: pRes.count || 0,
        microareasCount: mRes.count || 0,
        teamsCount: tRes.count || 0,
        agentsCount: aRes.count || 0,
        strategicPointsCount: peRes.count || 0,
        specialPropertiesCount: ieRes.count || 0,
      };
    } catch (err) {
      console.error('Erro ao buscar métricas territoriais:', err);
      return {
        neighborhoodsCount: 0,
        sectorsCount: 0,
        blocksCount: 0,
        propertiesCount: 0,
        microareasCount: 0,
        teamsCount: 0,
        agentsCount: 0,
        strategicPointsCount: 0,
        specialPropertiesCount: 0,
      };
    }
  },

  /**
   * Buscar Setores com dados do Bairro e contagem de quadras
   */
  async getSectorsWithDetails(municipalityId: string, neighborhoodId?: string): Promise<any[]> {
    try {
      let query = supabase
        .from('sectors')
        .select('*, neighborhoods(name)')
        .eq('municipality_id', municipalityId)
        .order('name');

      if (neighborhoodId && neighborhoodId !== 'ALL') {
        query = query.eq('neighborhood_id', neighborhoodId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },

  /**
   * Buscar Quadras com dados do Setor
   */
  async getBlocksWithDetails(municipalityId: string, sectorId?: string): Promise<any[]> {
    try {
      let query = supabase
        .from('blocks')
        .select('*, sectors(name, code, neighborhood_id, neighborhoods(name))')
        .eq('municipality_id', municipalityId)
        .order('code');

      if (sectorId && sectorId !== 'ALL') {
        query = query.eq('sector_id', sectorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },

  /**
   * Buscar Microáreas detalhadas
   */
  async getMicroareasWithDetails(municipalityId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('microareas')
        .select('*, sectors(name, neighborhoods(name)), agents(employee_number, profiles(full_name))')
        .eq('municipality_id', municipalityId)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },
};


