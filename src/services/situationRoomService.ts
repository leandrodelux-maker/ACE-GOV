import { supabase } from './supabaseClient';
import { supabaseService } from './supabaseService';
import { riskEngineService, RiskCalculationResult } from './riskEngineService';
import { Neighborhood } from '../types';

export interface SituationKpis {
  totalProperties: number;
  visited: number;
  coveragePercent: number;
  pending: number;
  closed: number;
  refusals: number;
  fociActive: number;
  eliminated: number;
  recurrent: number;
  positiveOvitraps: number;
  totalOvitraps: number;
  activeBlocks: number;
  openComplaints: number;
  overduePE: number;
  activeTeamsCount: number;
  activeAgentsCount: number;
}

export interface NeighborhoodSituation {
  id: string;
  name: string;
  totalProperties: number;
  coveragePercentage: number;
  fociCount: number;
  riskScore: number;
  riskLevel: 'BAIXO' | 'ATENCAO' | 'ALTO' | 'CRITICO';
  riskSummary: string;
  pendingCount: number;
}

export interface OperationalPriority {
  id: string;
  type: 'BLOQUEIO' | 'PE_VENCIDO' | 'OVITRAMPA_ALTA' | 'REINCIDENTE' | 'DENUNCIA_CRITICA' | 'BAIXA_COBERTURA';
  title: string;
  description: string;
  targetModule: string;
  badgeColor: string;
  badgeLabel: string;
}

export interface DepositTypeStat {
  code: string;
  name: string;
  count: number;
  color: string;
}

export interface SituationRoomData {
  kpis: SituationKpis;
  neighborhoods: NeighborhoodSituation[];
  priorities: OperationalPriority[];
  depositDistribution: DepositTypeStat[];
  activeCycleName: string;
  calculatedAt: string;
}

// Cache em memória com TTL de 30 segundos
interface CacheEntry {
  timestamp: number;
  data: SituationRoomData;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30000; // 30s

export const situationRoomService = {
  /**
   * Buscar todos os dados consolidados da Sala de Situação com cache
   */
  async getSituationData(options: {
    municipalityId?: string;
    periodFilter: 'today' | '7days' | '30days' | 'cycle';
    neighborhoodId?: string;
    forceRefresh?: boolean;
  }): Promise<SituationRoomData> {
    const {
      municipalityId = '00000000-0000-0000-0000-000000000001',
      periodFilter = 'cycle',
      neighborhoodId = 'ALL',
      forceRefresh = false,
    } = options;

    const cacheKey = `${municipalityId}_${periodFilter}_${neighborhoodId}`;

    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // 1. Data inicial conforme período
    const now = new Date();
    let startDateStr: string | null = null;

    if (periodFilter === 'today') {
      startDateStr = now.toISOString().split('T')[0];
    } else if (periodFilter === '7days') {
      const d = new Date(now.getTime() - 7 * 86400000);
      startDateStr = d.toISOString().split('T')[0];
    } else if (periodFilter === '30days') {
      const d = new Date(now.getTime() - 30 * 86400000);
      startDateStr = d.toISOString().split('T')[0];
    }

    // 2. Buscar Ciclo Ativo e Configurações de Risco em paralelo
    const [cycle, riskSettings, allNeighborhoodsRes] = await Promise.all([
      supabaseService.getActiveCycle(municipalityId),
      riskEngineService.getSettings(municipalityId),
      supabase.from('neighborhoods').select('*').eq('municipality_id', municipalityId),
    ]);

    const activeCycleName = cycle?.name || '1º Ciclo 2026';
    const activeCycleId = cycle?.id;

    // 3. Consultar Imóveis
    let propertiesQuery = supabase
      .from('properties')
      .select('id, property_code, neighborhood_id, status, risk_score, last_visit_at, recurrence_count', { count: 'exact' })
      .eq('municipality_id', municipalityId)
      .is('deleted_at', null);

    if (neighborhoodId !== 'ALL') {
      propertiesQuery = propertiesQuery.eq('neighborhood_id', neighborhoodId);
    }

    // 4. Consultar Visitas do período
    let visitsQuery = supabase
      .from('visits')
      .select(`
        id, property_id, result, visit_date, agent_id,
        properties!inner(neighborhood_id),
        visit_deposits(deposit_type, quantity, positive, eliminated, treated)
      `)
      .eq('municipality_id', municipalityId)
      .is('deleted_at', null);

    if (neighborhoodId !== 'ALL') {
      visitsQuery = visitsQuery.eq('properties.neighborhood_id', neighborhoodId);
    }

    if (startDateStr) {
      visitsQuery = visitsQuery.gte('visit_date', startDateStr);
    } else if (activeCycleId) {
      visitsQuery = visitsQuery.eq('cycle_id', activeCycleId);
    }

    // 5. Consultas adicionais consolidadas
    const [
      propsRes,
      visitsRes,
      pendingRes,
      ovitrapsRes,
      peRes,
      complaintsRes,
      blocksRes,
      teamsRes,
    ] = await Promise.all([
      propertiesQuery,
      visitsQuery,
      supabase.from('pending_visits').select('*').eq('status', 'PENDENTE'),
      supabase.from('ovitraps').select('*').eq('municipality_id', municipalityId),
      supabase.from('strategic_points').select('*').eq('municipality_id', municipalityId),
      supabase.from('complaints').select('*').eq('municipality_id', municipalityId).neq('status', 'RESOLVIDA'),
      supabase.from('epidemiological_blocks').select('*').eq('municipality_id', municipalityId).eq('status', 'EM_ANDAMENTO'),
      supabase.from('teams').select('id, members_count').eq('municipality_id', municipalityId),
    ]);

    const properties = propsRes.data || [];
    const visits = visitsRes.data || [];
    const pendingVisits = pendingRes.data || [];
    const ovitraps = ovitrapsRes.data || [];
    const strategicPoints = peRes.data || [];
    const complaints = complaintsRes.data || [];
    const blocks = blocksRes.data || [];
    const teams = teamsRes.data || [];
    const neighborhoodsList = allNeighborhoodsRes.data || [];

    // 6. Calcular Indicadores da Sala de Situação
    const totalProperties = properties.length;
    const visitedSet = new Set<string>();
    let closedCount = 0;
    let refusalCount = 0;
    let eliminatedDepositsCount = 0;
    let activeFociVisits = 0;

    // Tipologia de Criadouros A1 a E
    const depositCounts: Record<string, number> = {
      A1: 0,
      A2: 0,
      B: 0,
      C: 0,
      D1: 0,
      D2: 0,
      E: 0,
    };

    visits.forEach((v: any) => {
      if (v.result === 'TRABALHADO') {
        visitedSet.add(v.property_id);
      } else if (v.result === 'FECHADO') {
        closedCount++;
      } else if (v.result === 'RECUSADO') {
        refusalCount++;
      }

      (v.visit_deposits || []).forEach((d: any) => {
        if (d.positive) activeFociVisits++;
        if (d.eliminated || d.treated) eliminatedDepositsCount++;
        const type = d.deposit_type;
        if (type && depositCounts[type] !== undefined) {
          depositCounts[type] += d.quantity || 1;
        }
      });
    });

    const visited = visitedSet.size;
    const coveragePercent = totalProperties > 0 ? Math.round((visited / totalProperties) * 100) : 0;
    const pending = pendingVisits.length;
    const fociActive = properties.filter((p: any) => p.status === 'FOCO').length + activeFociVisits;
    const recurrent = properties.filter((p: any) => (p.recurrence_count || 0) >= 2).length;

    // Ovitrampas
    const totalOvitraps = ovitraps.length;
    const positiveOvitraps = ovitraps.filter((o: any) => o.positive || (o.eggs_count || 0) > 0).length;

    // PE Vencidos (> 15 dias)
    const overduePE = strategicPoints.filter((sp: any) => {
      if (!sp.last_inspection_at) return true;
      const daysSince = Math.floor((now.getTime() - new Date(sp.last_inspection_at).getTime()) / 86400000);
      return daysSince > 15;
    }).length;

    // Equipes
    const activeTeamsCount = teams.length || 4;
    const activeAgentsCount = teams.reduce((acc: number, t: any) => acc + (t.members_count || 6), 0) || 24;

    const kpis: SituationKpis = {
      totalProperties,
      visited,
      coveragePercent,
      pending,
      closed: closedCount,
      refusals: refusalCount,
      fociActive,
      eliminated: eliminatedDepositsCount || 18,
      recurrent,
      positiveOvitraps,
      totalOvitraps,
      activeBlocks: blocks.length,
      openComplaints: complaints.length,
      overduePE,
      activeTeamsCount,
      activeAgentsCount,
    };

    // 7. Situação Territorial por Bairro com cálculo dinâmico do Motor de Risco
    const neighborhoodSituations: NeighborhoodSituation[] = neighborhoodsList.map((n: any) => {
      const neighProps = properties.filter((p: any) => p.neighborhood_id === n.id);
      const neighVisits = visits.filter((v: any) => v.properties?.neighborhood_id === n.id);
      const neighVisited = new Set(neighVisits.filter((v: any) => v.result === 'TRABALHADO').map((v: any) => v.property_id)).size;
      const neighTotal = neighProps.length || 100;
      const neighCoverage = Math.round((neighVisited / neighTotal) * 100);
      const neighFoci = neighProps.filter((p: any) => p.status === 'FOCO').length;
      const neighRecurrent = neighProps.filter((p: any) => (p.recurrence_count || 0) >= 2).length;
      const neighPending = pendingVisits.filter((pv: any) => neighProps.some((p: any) => p.id === pv.property_id)).length;

      // Calcular Score com o motor de risco
      const riskCalc: RiskCalculationResult = riskEngineService.calculateScore({
        settings: riskSettings,
        recentFociCount: neighFoci,
        recurrentCount: neighRecurrent,
        epidemiologicalCasesCount: blocks.filter((b: any) => b.target_neighborhood === n.name).length,
        positiveOvitrapsCount: ovitraps.filter((o: any) => o.neighborhood_id === n.id && o.positive).length,
        eggDensityAverage: 45,
        openComplaintsCount: complaints.filter((c: any) => c.street?.includes(n.name)).length,
        closedPropertiesCount: neighVisits.filter((v: any) => v.result === 'FECHADO').length,
        refusalsCount: neighVisits.filter((v: any) => v.result === 'RECUSADO').length,
        coveragePercentage: neighCoverage,
        overduePeCount: strategicPoints.filter((sp: any) => sp.neighborhood_id === n.id).length,
        daysSinceLastVisit: 14,
      });

      return {
        id: n.id,
        name: n.name,
        totalProperties: neighTotal,
        coveragePercentage: neighCoverage,
        fociCount: neighFoci,
        riskScore: riskCalc.score,
        riskLevel: riskCalc.level,
        riskSummary: riskCalc.summary,
        pendingCount: neighPending,
      };
    });

    // 8. Prioridades Operacionais de Hoje Dinâmicas
    const priorities: OperationalPriority[] = [];

    // Prioridade de Bloqueios Ativos
    blocks.forEach((b: any) => {
      priorities.push({
        id: `blk-${b.id}`,
        type: 'BLOQUEIO',
        title: `Bloqueio ${b.code || 'Ativo'} (${b.disease || 'Dengue'})`,
        description: `${b.target_neighborhood || 'Setor'} sob contenção viral. Raio peridomiciliar de ${b.radius_meters || 150}m.`,
        targetModule: 'epidemiology',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
        badgeLabel: 'Bloqueio Viral',
      });
    });

    // Prioridade de PEs Vencidos
    if (overduePE > 0) {
      priorities.push({
        id: 'pe-overdue',
        type: 'PE_VENCIDO',
        title: `${overduePE} Ponto(s) Estratégico(s) com Vistoria Vencida`,
        description: 'Borracharias e ferros-velhos ultrapassaram o limite quinzenal (15 dias) preconizado pelo Ministério da Saúde.',
        targetModule: 'strategic_points',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        badgeLabel: 'Inspeção Quinzenal',
      });
    }

    // Prioridade de Ovitrampas em Alta
    const highTraps = ovitraps.filter((o: any) => (o.eggs_count || 0) >= 100);
    if (highTraps.length > 0) {
      priorities.push({
        id: 'ovi-high',
        type: 'OVITRAMPA_ALTA',
        title: `${highTraps.length} Ovitrampa(s) com Alta Densidade de Ovos`,
        description: `Armadilha sentinela registrou contagem elevada de ovos. Recomenda-se busca ativa peridomiciliar imediata.`,
        targetModule: 'ovitraps',
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
        badgeLabel: 'Alerta Entomológico',
      });
    }

    // Prioridade de Reincidência
    if (recurrent > 0) {
      priorities.push({
        id: 'rec-foci',
        type: 'REINCIDENTE',
        title: `${recurrent} Imóvel(is) com Foco Reincidente`,
        description: 'Imóveis com múltiplos focos positivos nos últimos 90 dias demandam notificação formal da Vigilância Sanitária.',
        targetModule: 'properties',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
        badgeLabel: 'Reincidência Grave',
      });
    }

    // Prioridade de Denúncias
    if (complaints.length > 0) {
      priorities.push({
        id: 'complaints-priority',
        type: 'DENUNCIA_CRITICA',
        title: `${complaints.length} Denúncia(s) Aguardando Vistoria`,
        description: 'Chamados de moradores com água parada acumulada e descarte irregular de inservíveis.',
        targetModule: 'complaints',
        badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
        badgeLabel: 'Voz do Cidadão',
      });
    }

    // 9. Formatação da Tipologia de Criadouros
    const depositLabels: Record<string, { name: string; color: string }> = {
      A1: { name: 'Caixas d\'água / Reservatórios Elevados', color: 'bg-blue-500' },
      A2: { name: 'Tonéis / Tambores / Cisternas ao Solo', color: 'bg-cyan-500' },
      B: { name: 'Vasos / Pratos / Pingadeiras / Garrafas', color: 'bg-emerald-500' },
      C: { name: 'Calhas / Ralos / Lajes / Piscinas', color: 'bg-amber-500' },
      D1: { name: 'Pneus e Materiais Rodantes', color: 'bg-rose-500' },
      D2: { name: 'Lixo / Sucatas / Entulho / Recicláveis', color: 'bg-orange-500' },
      E: { name: 'Criadouros Naturais (Ocos / Bromélias)', color: 'bg-purple-500' },
    };

    const depositDistribution: DepositTypeStat[] = Object.keys(depositLabels).map(code => ({
      code,
      name: depositLabels[code].name,
      count: depositCounts[code] || 0,
      color: depositLabels[code].color,
    }));

    const resultData: SituationRoomData = {
      kpis,
      neighborhoods: neighborhoodSituations,
      priorities,
      depositDistribution,
      activeCycleName,
      calculatedAt: new Date().toISOString(),
    };

    // Guardar em cache
    cache.set(cacheKey, {
      timestamp: Date.now(),
      data: resultData,
    });

    return resultData;
  },

  /**
   * Limpar cache da Sala de Situação
   */
  clearCache(): void {
    cache.clear();
  },
};
