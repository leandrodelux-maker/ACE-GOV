import { supabase } from './supabaseClient';
import { agentProductivityService } from './agentProductivityService';
import { OperationalLoadAgent } from '../types';
import { requireMunicipalityId } from './municipalityScope';

export interface TeamEntity {
  id: string;
  name: string;
  code?: string;
  supervisor_id?: string;
  supervisor_name?: string;
  active: boolean;
  member_count?: number;
  created_at?: string;
}

export interface AgentEntity {
  id: string;
  name: string;
  email?: string;
  team_id?: string;
  team_name?: string;
  employee_number?: string;
  active: boolean;
  ruralArea?: boolean;
}


export const teamService = {
  async getTeams(municipalityId: string): Promise<TeamEntity[]> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          code,
          supervisor_id,
          active,
          created_at,
          profiles:supervisor_id(full_name)
        `)
        .eq('municipality_id', municipalityId)
        .order('name');

      if (error) {
        console.warn('Erro ao carregar equipes:', error.message);
        return [];
      }
      if (!data || data.length === 0) return [];

      // Buscar membros para contar por equipe
      const { data: members } = await supabase
        .from('agents')
        .select('team_id')
        .eq('municipality_id', municipalityId)
        .eq('active', true);

      const countMap: Record<string, number> = {};
      (members || []).forEach((m: any) => {
        if (m.team_id) countMap[m.team_id] = (countMap[m.team_id] || 0) + 1;
      });

      return data.map((t: any) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        supervisor_id: t.supervisor_id,
        supervisor_name: t.profiles?.full_name || 'Não designado',
        active: t.active,
        member_count: countMap[t.id] || 0,
        created_at: t.created_at,
      }));
    } catch {
      return [];
    }
  },

  async createTeam(team: { name: string; code?: string; supervisor_id?: string; municipality_id: string }): Promise<boolean> {
    try {
      const { error } = await supabase.from('teams').insert({
        name: team.name,
        code: team.code || `EQ-${Date.now().toString().slice(-4)}`,
        supervisor_id: team.supervisor_id || null,
        municipality_id: requireMunicipalityId(team.municipality_id),
        active: true,
      });
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Carga operacional por agente, a partir de registros reais do município:
   * visitas e pendências (produtividade), denúncias abertas, ordens de serviço
   * abertas e bloqueios em andamento atribuídos ao agente.
   *
   * Índice de carga (0–100, heurística indicativa, sem valor-base):
   *   pendências × 4 + denúncias × 6 + ordens de serviço × 5 + bloqueios × 15
   */
  async getOperationalLoad(municipalityId: string): Promise<OperationalLoadAgent[]> {
    const munId = requireMunicipalityId(municipalityId);
    try {
      const [report, complaintsRes, ordersRes, blocksRes] = await Promise.all([
        agentProductivityService.getProductivity(munId),
        supabase
          .from('complaints')
          .select('assigned_agent_id')
          .eq('municipality_id', munId)
          .neq('status', 'RESOLVIDA')
          .not('assigned_agent_id', 'is', null),
        supabase
          .from('work_orders')
          .select('assigned_agent_id')
          .eq('municipality_id', munId)
          .in('status', ['aberta', 'atribuida', 'em_execucao'])
          .not('assigned_agent_id', 'is', null),
        supabase
          .from('blockade_operation_agents')
          .select('agent_id, blockade_operations!inner(status, municipality_id)')
          .eq('blockade_operations.municipality_id', munId)
          .eq('blockade_operations.status', 'EM_ANDAMENTO'),
      ]);
      if (report.error) return [];

      const countBy = (rows: any[] | null, key: string, id: string) => (rows || []).filter((r: any) => r[key] === id).length;

      return report.agents.map((a) => {
        const complaintsAssigned = countBy(complaintsRes.data, 'assigned_agent_id', a.agentId);
        const openOrders = countBy(ordersRes.data, 'assigned_agent_id', a.agentId);
        const blocksAssigned = countBy(blocksRes.data, 'agent_id', a.agentId);
        const load = Math.min(100, a.pendingReturns * 4 + complaintsAssigned * 6 + openOrders * 5 + blocksAssigned * 15);
        return {
          agentId: a.agentId,
          agentName: a.agentName,
          teamName: a.teamName,
          totalVisits: a.totalVisits,
          coveragePercentage: null,
          pendingReturns: a.pendingReturns,
          fociFound: a.fociFound,
          blocksAssigned,
          complaintsAssigned,
          strategicPointsAssigned: 0,
          ruralArea: false,
          operationalLoadIndex: load,
          loadCategory: load >= 75 ? 'SOBRECARREGADA' : load >= 50 ? 'MODERADA' : 'EQUILIBRADA',
        };
      });
    } catch (err) {
      console.warn('Erro ao calcular carga operacional:', err);
      return [];
    }
  },
};
