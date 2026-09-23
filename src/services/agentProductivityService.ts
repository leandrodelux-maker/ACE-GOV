import { supabase } from './supabaseClient';
import { requireMunicipalityId } from './municipalityScope';
import { supabaseService } from './supabaseService';

/**
 * Produtividade dos ACE calculada exclusivamente a partir dos registros do
 * município (agents, teams, visits, visit_deposits, pending_visits).
 * Período: ciclo de campo em andamento; sem ciclo, últimos 30 dias.
 */

export interface AgentProductivityMetric {
  agentId: string;
  agentName: string;
  agentCode: string;
  teamId: string | null;
  teamName: string;
  totalVisits: number;
  workedProperties: number;
  closedProperties: number;
  refusedProperties: number;
  pendingReturns: number;
  fociFound: number;
  fociEliminated: number;
  workDays: number;
  /** null quando o agente não tem dias com visita no período */
  dailyAverage: number | null;
  workloadStatus: 'REGULAR' | 'COM_PENDENCIAS' | 'SEM_VISITAS';
}

export interface TeamProductivityMetric {
  teamId: string;
  teamName: string;
  supervisorName: string | null;
  agentsCount: number;
  totalVisits: number;
  workedProperties: number;
  pendingCount: number;
  fociCount: number;
}

export interface ProductivityReport {
  agents: AgentProductivityMetric[];
  teams: TeamProductivityMetric[];
  periodLabel: string;
  error?: string;
}

const norm = (v: unknown) => String(v ?? '').toUpperCase();

export const agentProductivityService = {
  async getProductivity(municipalityId: string): Promise<ProductivityReport> {
    const munId = requireMunicipalityId(municipalityId);
    const cycle = await supabaseService.getActiveCycle(munId);
    const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const periodLabel = cycle ? `Ciclo em andamento: ${cycle.name}` : 'Últimos 30 dias (nenhum ciclo em andamento)';

    let visitsQuery = supabase
      .from('visits')
      .select('agent_id, result, visit_date, visit_deposits(positive, eliminated, treated)')
      .eq('municipality_id', munId)
      .is('deleted_at', null);
    visitsQuery = cycle ? visitsQuery.eq('cycle_id', cycle.id) : visitsQuery.gte('visit_date', since);

    const [agentsRes, teamsRes, visitsRes, pendingRes] = await Promise.all([
      supabase
        .from('agents')
        .select('id, employee_number, team_id, profiles(full_name)')
        .eq('municipality_id', munId)
        .eq('active', true),
      supabase.from('teams').select('id, name, supervisor:profiles(full_name)').eq('municipality_id', munId),
      visitsQuery,
      supabase
        .from('pending_visits')
        .select('assigned_agent_id, responsible_agent_id, status, properties!inner(municipality_id)')
        .eq('properties.municipality_id', munId)
        .in('status', ['PENDENTE', 'ABERTA']),
    ]);

    const firstError = [agentsRes, visitsRes].find((r) => r.error)?.error;
    if (firstError) {
      return { agents: [], teams: [], periodLabel, error: firstError.message };
    }

    const teamsList = teamsRes.data || [];
    const teamName = new Map<string, string>(teamsList.map((t: any) => [t.id, t.name]));
    const visits = visitsRes.data || [];
    const pending = pendingRes.data || [];

    const agents: AgentProductivityMetric[] = (agentsRes.data || []).map((a: any) => {
      const own = visits.filter((v: any) => v.agent_id === a.id);
      const worked = own.filter((v: any) => norm(v.result) === 'TRABALHADO').length;
      const closed = own.filter((v: any) => norm(v.result) === 'FECHADO').length;
      const refused = own.filter((v: any) => norm(v.result) === 'RECUSADO').length;
      const deposits = own.flatMap((v: any) => v.visit_deposits || []);
      const fociFound = deposits.filter((d: any) => d.positive).length;
      const fociEliminated = deposits.filter((d: any) => d.positive && (d.eliminated || d.treated)).length;
      const workDays = new Set(own.map((v: any) => v.visit_date)).size;
      const pendingReturns = pending.filter(
        (p: any) => p.responsible_agent_id === a.id || p.assigned_agent_id === a.id
      ).length;

      return {
        agentId: a.id,
        agentName: a.profiles?.full_name || 'Agente sem perfil vinculado',
        agentCode: a.employee_number || '',
        teamId: a.team_id ?? null,
        teamName: (a.team_id && teamName.get(a.team_id)) || 'Sem equipe',
        totalVisits: own.length,
        workedProperties: worked,
        closedProperties: closed,
        refusedProperties: refused,
        pendingReturns,
        fociFound,
        fociEliminated,
        workDays,
        dailyAverage: workDays > 0 ? Number((worked / workDays).toFixed(1)) : null,
        workloadStatus: own.length === 0 ? 'SEM_VISITAS' : pendingReturns > 0 ? 'COM_PENDENCIAS' : 'REGULAR',
      };
    });

    const teams: TeamProductivityMetric[] = teamsList.map((t: any) => {
      const members = agents.filter((a) => a.teamId === t.id);
      return {
        teamId: t.id,
        teamName: t.name,
        supervisorName: t.supervisor?.full_name ?? null,
        agentsCount: members.length,
        totalVisits: members.reduce((acc, a) => acc + a.totalVisits, 0),
        workedProperties: members.reduce((acc, a) => acc + a.workedProperties, 0),
        pendingCount: members.reduce((acc, a) => acc + a.pendingReturns, 0),
        fociCount: members.reduce((acc, a) => acc + a.fociFound, 0),
      };
    });

    return { agents, teams, periodLabel };
  },
};
