import { supabase } from './supabaseClient';

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

export const territoryTimelineService = {
  /**
   * Constrói a linha do tempo cronológica de um Imóvel específico
   */
  async getPropertyTimeline(propertyId: string, municipalityId: string): Promise<TerritoryHistoryResult> {
    // 1. Dados do imóvel
    const { data: prop } = await supabase
      .from('properties')
      .select('code, address, number, complement, neighborhoods(name)')
      .eq('id', propertyId)
      .single();

    const title = prop ? `${prop.address}, ${prop.number || 'S/N'}` : 'Imóvel';
    const subtitle = prop?.neighborhoods ? `Bairro: ${(prop.neighborhoods as any).name}` : 'Cadastro Territorial';

    // 2. Visitas no imóvel
    const { data: visits } = await supabase
      .from('property_visits')
      .select('id, visit_date, status, has_larvae, larvae_species, treatment_type, agent_name, created_at')
      .eq('property_id', propertyId)
      .order('visit_date', { ascending: false });

    // 3. Denúncias associadas ao imóvel ou endereço
    const { data: complaints } = await supabase
      .from('complaints')
      .select('id, protocol, problem_type, status, created_at, description')
      .eq('property_id', propertyId);

    const events: TimelineEvent[] = [];
    let fociCount = 0;

    (visits || []).forEach(v => {
      const isPositive = v.has_larvae;
      if (isPositive) fociCount++;

      events.push({
        id: `visit-${v.id}`,
        type: isPositive ? 'foco' : 'visita',
        title: isPositive ? 'Foco de Larvas Identificado no Imóvel' : `Visita de Rotina - ${v.status?.toUpperCase() || 'REALIZADA'}`,
        timestamp: v.visit_date || v.created_at,
        dateFormatted: new Date(v.visit_date || v.created_at).toLocaleDateString('pt-BR'),
        categoryLabel: isPositive ? 'Foco Positivo' : 'Inspeção Domiciliar',
        status: isPositive ? 'alerta' : v.status === 'fechado' ? 'pendente' : 'sucesso',
        description: isPositive
          ? `Presença de larvas identificada. Espécie: ${v.larvae_species || 'Aedes aegypti'}. Tratamento: ${v.treatment_type || 'Eliminação mecânica'}.`
          : `Inspeção vetorial conduzida. Imóvel cadastrado no ciclo regular de combate.`,
        agentName: v.agent_name || 'Agente ACE'
      });
    });

    (complaints || []).forEach(c => {
      events.push({
        id: `complaint-${c.id}`,
        type: 'denuncia',
        title: `Denúncia Cidadã: Protocolo ${c.protocol}`,
        timestamp: c.created_at,
        dateFormatted: new Date(c.created_at).toLocaleDateString('pt-BR'),
        categoryLabel: 'Denúncia',
        status: c.status === 'concluida' ? 'sucesso' : 'pendente',
        description: c.description || `Denúncia de criadouros potenciais registrada com status: ${c.status}.`
      });
    });

    // Ordenar cronologicamente decrescente
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      targetType: 'property',
      targetTitle: title,
      targetSubtitle: subtitle,
      events,
      summary: {
        totalVisits: visits?.length || 0,
        totalFoci: fociCount,
        totalComplaints: complaints?.length || 0,
        totalBlockades: 0
      }
    };
  },

  /**
   * Constrói a linha do tempo cronológica de um Bairro
   */
  async getNeighborhoodTimeline(neighborhoodId: string, municipalityId: string): Promise<TerritoryHistoryResult> {
    const { data: neigh } = await supabase
      .from('neighborhoods')
      .select('name, zone')
      .eq('id', neighborhoodId)
      .single();

    const title = neigh ? `Bairro ${neigh.name}` : 'Bairro';
    const subtitle = neigh?.zone ? `Zona ${neigh.zone} - Histórico Territorial Consolidado` : 'Histórico Territorial';

    // 1. Visitas no bairro
    const { data: visits } = await supabase
      .from('property_visits')
      .select('id, visit_date, status, has_larvae, agent_name, created_at')
      .eq('neighborhood_id', neighborhoodId)
      .order('visit_date', { ascending: false })
      .limit(30);

    // 2. Bloqueios químicos no bairro
    const { data: blocks } = await supabase
      .from('chemical_blockades')
      .select('id, code, start_date, end_date, status, target_properties, treated_properties')
      .eq('neighborhood_id', neighborhoodId);

    const events: TimelineEvent[] = [];
    let fociCount = 0;

    (visits || []).forEach(v => {
      if (v.has_larvae) {
        fociCount++;
        events.push({
          id: `visit-foci-${v.id}`,
          type: 'foco',
          title: 'Detecção de Foco Larvário em Imóvel',
          timestamp: v.visit_date || v.created_at,
          dateFormatted: new Date(v.visit_date || v.created_at).toLocaleDateString('pt-BR'),
          categoryLabel: 'Foco Larvário',
          status: 'alerta',
          description: 'Criadouro positivo com tratamento focal realizado pelo agente em campo.',
          agentName: v.agent_name
        });
      }
    });

    (blocks || []).forEach(b => {
      events.push({
        id: `block-${b.id}`,
        type: 'bloqueio',
        title: `Operação de Bloqueio Químico: ${b.code || 'UBV'}`,
        timestamp: b.start_date || new Date().toISOString(),
        dateFormatted: new Date(b.start_date || new Date()).toLocaleDateString('pt-BR'),
        categoryLabel: 'Controle Vetorial Químico',
        status: b.status === 'concluido' ? 'sucesso' : 'alerta',
        description: `Aplicação de inseticida espacial/focal realizada em ${b.treated_properties || 0} de ${b.target_properties || 0} imóveis programados.`
      });
    });

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      targetType: 'neighborhood',
      targetTitle: title,
      targetSubtitle: subtitle,
      events,
      summary: {
        totalVisits: visits?.length || 0,
        totalFoci: fociCount,
        totalComplaints: 0,
        totalBlockades: blocks?.length || 0
      }
    };
  }
};
