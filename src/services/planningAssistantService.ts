import { supabase } from './supabaseClient';
import { ACTIVE_FOCUS_STATUSES, PENDING_STATUSES, isInspectionOverdue } from './schemaHelpers';

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
      const since = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
      const [neighsRes, sectorsRes, fociRes, casesRes, pendRes, peRes] = await Promise.all([
        supabase.from('neighborhoods').select('id, name').eq('municipality_id', municipalityId),
        supabase.from('sectors').select('name, neighborhood_id').eq('municipality_id', municipalityId),
        // Criadouros ativos (a RPC grava 'ativo'); bairro vem do imóvel
        supabase
          .from('breeding_sites')
          .select('id, properties(neighborhood_id)')
          .eq('municipality_id', municipalityId)
          .in('status', ACTIVE_FOCUS_STATUSES),
        supabase
          .from('epidemiological_cases')
          .select('id, neighborhood_id')
          .eq('municipality_id', municipalityId)
          .is('deleted_at', null)
          .neq('status', 'DESCARTADO')
          .gte('notification_date', since),
        // pending_visits não tem municipality_id: filtra pelo imóvel
        supabase
          .from('pending_visits')
          .select('id, properties!inner(municipality_id, neighborhood_id)')
          .eq('properties.municipality_id', municipalityId)
          .in('status', PENDING_STATUSES),
        supabase
          .from('strategic_points')
          .select('id, last_inspection, next_inspection, inspection_frequency_days, properties(neighborhood_id)')
          .eq('municipality_id', municipalityId)
          .eq('active', true)
          .is('deleted_at', null),
      ]);
      const failed = [neighsRes, sectorsRes, fociRes, casesRes, pendRes, peRes].find((r) => r.error);
      if (failed?.error) throw failed.error;

      const countBy = (rows: any[], nid: (r: any) => string | undefined) => {
        const m = new Map<string, number>();
        rows.forEach((r) => { const k = nid(r); if (k) m.set(k, (m.get(k) || 0) + 1); });
        return m;
      };
      const fociBy = countBy(fociRes.data || [], (r) => r.properties?.neighborhood_id);
      const casesBy = countBy(casesRes.data || [], (r) => r.neighborhood_id);
      const pendingBy = countBy(pendRes.data || [], (r) => r.properties?.neighborhood_id);
      const peBy = countBy((peRes.data || []).filter((p: any) => isInspectionOverdue(p)), (r) => r.properties?.neighborhood_id);

      // Pontuação heurística documentada (sem valores de base): foco 25, caso 20, pendência 10, PE vencido 5
      const suggestions: PlanningSuggestion[] = (neighsRes.data || []).map((neigh: any) => {
        const neighFoci = fociBy.get(neigh.id) || 0;
        const neighCases = casesBy.get(neigh.id) || 0;
        const neighPending = pendingBy.get(neigh.id) || 0;
        const neighPE = peBy.get(neigh.id) || 0;
        const riskScore = Math.min(100, neighFoci * 25 + neighCases * 20 + neighPending * 10 + neighPE * 5);

        let urgency: PlanningSuggestion['urgencyLevel'] = 'NORMAL';
        if (neighFoci > 0 || neighCases > 0 || riskScore >= 50) urgency = 'URGENTE';
        else if (neighPending >= 2 || riskScore >= 30) urgency = 'ALTA';
        else if (riskScore >= 15) urgency = 'ATENCAO';

        const rationaleItems: string[] = [];
        if (neighFoci > 0) rationaleItems.push(`${neighFoci} foco(s) ativo(s) registrado(s)`);
        if (neighCases > 0) rationaleItems.push(`${neighCases} caso(s) notificado(s) nos últimos 60 dias`);
        if (neighPending > 0) rationaleItems.push(`${neighPending} visita(s) pendente(s) de retorno`);
        if (neighPE > 0) rationaleItems.push(`${neighPE} ponto(s) estratégico(s) com vistoria vencida`);

        // Sugestão de dimensionamento: referência de 25 imóveis por agente/dia
        const recommendedAgents = urgency === 'URGENTE' ? 4 : urgency === 'ALTA' ? 2 : 1;
        const sectorNames = (sectorsRes.data || []).filter((s: any) => s.neighborhood_id === neigh.id).map((s: any) => s.name);

        return {
          priorityRank: 0,
          neighborhoodId: neigh.id,
          neighborhoodName: neigh.name,
          sectorName: sectorNames.length ? sectorNames.join(', ') : 'Setores não cadastrados',
          recommendedAgentsCount: recommendedAgents,
          plannedPropertiesCount: recommendedAgents * 25,
          urgencyLevel: urgency,
          rationale: rationaleItems.join('; ') || 'Sem focos, casos ou pendências registrados: manter a rotina do ciclo.',
          factors: {
            activeFociCount: neighFoci,
            epidemiologicalCasesCount: neighCases,
            pendingReturnsCount: neighPending,
            uninspectedStrategicPointsCount: neighPE,
            riskScore,
          },
        };
      });

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
