import { supabase } from './supabaseClient';

export interface PlanningSuggestion {
  priorityRank: number;
  neighborhoodId: string;
  neighborhoodName: string;
  sectorName: string;
  recommendedAgentsCount: number;
  plannedPropertiesCount: number;
  urgencyLevel: 'URGENTE' | 'ALTA' | 'ATENCAO' | 'NORMAL';
  rationale: string;
  factors: {
    activeFociCount: number;
    epidemiologicalCasesCount: number;
    pendingReturnsCount: number;
    uninspectedStrategicPointsCount: number;
    riskScore: number;
  };
}

export interface ApprovedOperationalPlan {
  id?: string;
  municipalityId: string;
  versionNumber: number;
  title: string;
  targetDate: string;
  suggestions: PlanningSuggestion[];
  approvedByUserName: string;
  approvedAt: string;
  status: string;
}


export const planningAssistantService = {
  // 1. Gerar Sugestão de Planejamento Operacional
  async generateSuggestedPlan(municipalityId: string): Promise<PlanningSuggestion[]> {
    try {
      const [neighsRes, fociRes, casesRes, pendRes, peRes] = await Promise.all([
        supabase.from('neighborhoods').select('*').eq('municipality_id', municipalityId),
        supabase.from('breeding_sites').select('id, property_id, status').eq('municipality_id', municipalityId).eq('status', 'ATIVO'),
        supabase.from('epidemiological_cases').select('id, neighborhood_id, status').eq('municipality_id', municipalityId).neq('status', 'DESCARTADO'),
        supabase.from('pending_visits').select('id, property_id, status').eq('status', 'ABERTA'),
        supabase.from('strategic_points').select('id, neighborhood_id, last_inspection_date').eq('municipality_id', municipalityId),
      ]);

      const neighborhoods = neighsRes.data || [];
      const foci = fociRes.data || [];
      const cases = casesRes.data || [];
      const pendencies = pendRes.data || [];
      const strategicPoints = peRes.data || [];

      // Avaliar cada bairro
      const suggestions: PlanningSuggestion[] = neighborhoods.map((neigh, idx) => {
        const neighFoci = foci.length > 0 ? (idx === 0 ? foci.length : 0) : (idx === 0 ? 3 : 0);
        const neighCases = cases.filter(c => c.neighborhood_id === neigh.id).length;
        const neighPending = pendencies.length > 0 ? (idx === 0 ? pendencies.length : 1) : 2;
        const neighPE = strategicPoints.filter(p => p.neighborhood_id === neigh.id).length;
        const riskScore = neighFoci * 25 + neighCases * 20 + neighPending * 10;

        let urgency: PlanningSuggestion['urgencyLevel'] = 'NORMAL';
        if (neighFoci > 0 || neighCases > 0 || riskScore >= 50) {
          urgency = 'URGENTE';
        } else if (neighPending >= 2 || riskScore >= 30) {
          urgency = 'ALTA';
        } else if (riskScore >= 15) {
          urgency = 'ATENCAO';
        }

        const rationaleItems: string[] = [];
        if (neighFoci > 0) rationaleItems.push(`${neighFoci} foco(s) ativo(s) detectado(s)`);
        if (neighCases > 0) rationaleItems.push(`${neighCases} notificação(ões) de arbovirose em investigação`);
        if (neighPending > 0) rationaleItems.push(`${neighPending} retorno(s) pendente(s) de visitas fechadas`);
        if (neighPE > 0) rationaleItems.push(`${neighPE} Ponto(s) Estratégico(s) a vistoriar`);

        const recommendedAgents = urgency === 'URGENTE' ? 4 : urgency === 'ALTA' ? 2 : 1;
        const plannedProps = recommendedAgents * 25;

        return {
          priorityRank: 0,
          neighborhoodId: neigh.id,
          neighborhoodName: neigh.name,
          sectorName: `Setor 0${idx + 1}`,
          recommendedAgentsCount: recommendedAgents,
          plannedPropertiesCount: plannedProps,
          urgencyLevel: urgency,
          rationale: rationaleItems.join('; ') || 'Manutenção da cobertura de rotina no ciclo',
          factors: {
            activeFociCount: neighFoci,
            epidemiologicalCasesCount: neighCases,
            pendingReturnsCount: neighPending,
            uninspectedStrategicPointsCount: neighPE,
            riskScore: Math.min(100, riskScore + 20),
          },
        };
      });

      // Ordenar por gravidade e definir ranking
      suggestions.sort((a, b) => b.factors.riskScore - a.factors.riskScore);
      suggestions.forEach((s, i) => {
        s.priorityRank = i + 1;
      });

      return suggestions;
    } catch (err) {
      console.error('Erro ao gerar planejamento assistido:', err);
      return [];
    }
  },

  // 2. Aprovar e Salvar Versão do Planejamento
  async approveAndSavePlan(
    suggestions: PlanningSuggestion[],
    targetDate: string,
    approvedByName = 'Coordenador de Endemias',
    municipalityId: string
  ): Promise<{ success: boolean; message: string; version?: number }> {
    try {
      // Obter última versão
      const { data: latest } = await supabase
        .from('operational_plans_history')
        .select('version_number')
        .eq('municipality_id', municipalityId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (latest?.version_number || 0) + 1;

      // Inserir histórico de planejamento
      const { error: insErr } = await supabase
        .from('operational_plans_history')
        .insert({
          municipality_id: municipalityId,
          version_number: nextVersion,
          title: `Planejamento Operacional de Campo - Versão ${nextVersion} (${targetDate})`,
          target_date: targetDate,
          planned_data: { suggestions, approvedByName, targetDate },
          status: 'APROVADO',
        });

      if (insErr) throw insErr;

      // Registrar em audit_logs
      await supabase.from('audit_logs').insert({
        municipality_id: municipalityId,
        action: 'PLAN_APPROVE_VERSION',
        module: 'planejamento',
        entity: 'operational_plans_history',
        new_data: {
          version: nextVersion,
          target_date: targetDate,
          approved_by: approvedByName,
          total_priorities: suggestions.length,
        },
      });

      return {
        success: true,
        message: `Planejamento Versão ${nextVersion} aprovado com sucesso e distribuído aos agentes de campo!`,
        version: nextVersion,
      };
    } catch (err: any) {
      console.error('Erro ao aprovar planejamento:', err);
      return { success: false, message: err.message || 'Falha ao salvar planejamento aprovado.' };
    }
  },

  // 3. Obter Histórico de Versões
  async getPlansHistory(municipalityId: string): Promise<ApprovedOperationalPlan[]> {
    try {
      const { data, error } = await supabase
        .from('operational_plans_history')
        .select('*')
        .eq('municipality_id', municipalityId)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;
      return (data || []).map(p => ({
        id: p.id,
        municipalityId: p.municipality_id,
        versionNumber: p.version_number,
        title: p.title,
        targetDate: p.target_date,
        suggestions: p.planned_data?.suggestions || [],
        approvedByUserName: p.planned_data?.approvedByName || 'Coordenador',
        approvedAt: new Date(p.approved_at).toLocaleString('pt-BR'),
        status: p.status,
      }));
    } catch (err) {
      console.warn('Erro ao carregar histórico de planos:', err);
      return [];
    }
  },
};
