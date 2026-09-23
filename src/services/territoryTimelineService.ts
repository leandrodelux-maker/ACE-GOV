import { supabase } from './supabaseClient';
import { AGENT_EMBED, agentName, formatAddress } from './schemaHelpers';

export interface TimelineEvent {
  id: string;
  type: 'visita' | 'foco' | 'denuncia' | 'caso' | 'bloqueio' | 'ovitrampa' | 'pe' | 'ordem_servico';
  title: string;
  timestamp: string;
  dateFormatted: string;
  categoryLabel: string;
  status: 'sucesso' | 'alerta' | 'pendente' | 'informativo';
  description: string;
  agentName?: string;
  metadata?: Record<string, any>;
}

export interface TerritoryHistoryResult {
  targetType: 'property' | 'neighborhood';
  targetTitle: string;
  targetSubtitle: string;
  events: TimelineEvent[];
  summary: {
    totalVisits: number;
    totalFoci: number;
    totalComplaints: number;
    totalBlockades: number;
  };
}

const fmtDate = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('pt-BR');
const isWorked = (r?: string) => (r || '').toLowerCase() === 'trabalhado';
const RESULT_LABEL: Record<string, string> = { trabalhado: 'Trabalhado', fechado: 'Fechado', recusa: 'Recusa', desabitado: 'Desabitado' };

/** Eventos de visita (fonte: visits + visit_deposits, gravados pela RPC oficial). */
function visitEvents(visits: any[]): { events: TimelineEvent[]; foci: number } {
  const events: TimelineEvent[] = [];
  let foci = 0;
  visits.forEach((v) => {
    const positives = (v.visit_deposits || []).filter((d: any) => d.positive || d.larvae_found);
    const result = (v.result || '').toLowerCase();
    if (positives.length > 0) foci += positives.length;
    const depositTypes = [...new Set(positives.map((d: any) => d.deposit_type).filter(Boolean))].join(', ');
    events.push({
      id: `visit-${v.id}`,
      type: positives.length > 0 ? 'foco' : 'visita',
      title: positives.length > 0
        ? `Visita com ${positives.length} depósito(s) positivo(s)`
        : `Visita — ${RESULT_LABEL[result] || v.result || 'resultado não informado'}`,
      timestamp: v.visit_date || v.created_at,
      dateFormatted: fmtDate(v.visit_date || v.created_at),
      categoryLabel: positives.length > 0 ? 'Foco' : 'Visita domiciliar',
      status: positives.length > 0 ? 'alerta' : isWorked(v.result) ? 'sucesso' : 'pendente',
      description: [
        positives.length > 0 ? `Tipos de depósito positivos: ${depositTypes || 'não informado'}.` : null,
        v.properties ? formatAddress(v.properties) : null,
        v.notes || null,
      ].filter(Boolean).join(' ') || 'Sem observações registradas.',
      agentName: agentName(v.agents),
    });
  });
  return { events, foci };
}

const VISIT_SELECT = `id, visit_date, result, notes, created_at, visit_deposits(deposit_type, positive, larvae_found), agents(${AGENT_EMBED})`;

export const territoryTimelineService = {
  /**
   * Linha do tempo de um imóvel: visitas (com focos) e denúncias no mesmo endereço.
   */
  async getPropertyTimeline(propertyId: string, municipalityId: string): Promise<TerritoryHistoryResult> {
    const { data: prop } = await supabase
      .from('properties')
      .select('property_code, street, number, complement, neighborhood_id, neighborhoods(name)')
      .eq('id', propertyId)
      .eq('municipality_id', municipalityId)
      .maybeSingle();

    const { data: visits } = await supabase
      .from('visits')
      .select(VISIT_SELECT)
      .eq('property_id', propertyId)
      .eq('municipality_id', municipalityId)
      .is('deleted_at', null)
      .order('visit_date', { ascending: false })
      .limit(100);

    // Denúncias não têm vínculo com o imóvel: associa pelo mesmo logradouro e número
    let complaints: any[] = [];
    if (prop?.street) {
      let q = supabase
        .from('complaints')
        .select('id, protocol, problem_type, status, created_at, description')
        .eq('municipality_id', municipalityId)
        .ilike('street', prop.street);
      if (prop.number) q = q.eq('number', prop.number);
      complaints = (await q.limit(50)).data || [];
    }

    const { events, foci } = visitEvents(visits || []);
    complaints.forEach((c) =>
      events.push({
        id: `complaint-${c.id}`,
        type: 'denuncia',
        title: `Denúncia — protocolo ${c.protocol}`,
        timestamp: c.created_at,
        dateFormatted: fmtDate(c.created_at),
        categoryLabel: 'Denúncia',
        status: ['RESOLVIDA', 'ARQUIVADA'].includes((c.status || '').toUpperCase()) ? 'sucesso' : 'pendente',
        description: c.description || `Situação: ${c.status}.`,
      })
    );
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      targetType: 'property',
      targetTitle: prop ? formatAddress(prop) || 'Imóvel' : 'Imóvel não encontrado',
      targetSubtitle: prop ? `${prop.property_code || 'Sem código'} · ${(prop.neighborhoods as any)?.name || 'Bairro não informado'}` : 'Cadastro territorial',
      events,
      summary: { totalVisits: visits?.length || 0, totalFoci: foci, totalComplaints: complaints.length, totalBlockades: 0 },
    };
  },

  /**
   * Linha do tempo de um bairro: visitas com foco e operações de bloqueio.
   */
  async getNeighborhoodTimeline(neighborhoodId: string, municipalityId: string): Promise<TerritoryHistoryResult> {
    const [neighRes, visitsRes, blockadesRes, complaintsRes] = await Promise.all([
      supabase.from('neighborhoods').select('name, zones(name)').eq('id', neighborhoodId).eq('municipality_id', municipalityId).maybeSingle(),
      supabase
        .from('visits')
        .select(`${VISIT_SELECT}, properties!inner(street, number, neighborhood_id)`)
        .eq('municipality_id', municipalityId)
        .eq('properties.neighborhood_id', neighborhoodId)
        .is('deleted_at', null)
        .order('visit_date', { ascending: false })
        .limit(60),
      supabase
        .from('blockade_operations')
        .select('id, code, disease, started_at, ended_at, status, planned_properties, completed_properties')
        .eq('municipality_id', municipalityId)
        .eq('neighborhood_id', neighborhoodId),
      supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId).eq('neighborhood_id', neighborhoodId),
    ]);
    const neigh = neighRes.data as any;
    const visits = visitsRes.data || [];
    const blockades = blockadesRes.data || [];

    // No bairro, a linha do tempo mostra apenas as visitas com foco (as de rotina são muitas)
    const { events: visitEvts, foci } = visitEvents(visits);
    const events = visitEvts.filter((e) => e.type === 'foco');
    blockades.forEach((b: any) =>
      events.push({
        id: `block-${b.id}`,
        type: 'bloqueio',
        title: `Bloqueio ${b.code || ''}${b.disease ? ` — ${b.disease}` : ''}`.trim(),
        timestamp: b.started_at || b.ended_at || new Date(0).toISOString(),
        dateFormatted: b.started_at ? fmtDate(b.started_at) : 'Data não informada',
        categoryLabel: 'Bloqueio de transmissão',
        status: (b.status || '').toUpperCase() === 'CONCLUIDO' ? 'sucesso' : 'alerta',
        description: `${b.completed_properties ?? 0} de ${b.planned_properties ?? 0} imóveis programados concluídos.`,
      })
    );
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      targetType: 'neighborhood',
      targetTitle: neigh ? `Bairro ${neigh.name}` : 'Bairro não encontrado',
      targetSubtitle: neigh?.zones?.name ? `Zona ${neigh.zones.name} · histórico territorial` : 'Histórico territorial',
      events,
      summary: { totalVisits: visits.length, totalFoci: foci, totalComplaints: complaintsRes.count ?? 0, totalBlockades: blockades.length },
    };
  },
};
