import { supabase } from './supabaseClient';
import { auditLogService } from './auditLogService';
import { AGENT_EMBED, PENDING_STATUSES, agentName, formatAddress } from './schemaHelpers';
import { requireMunicipalityId } from './municipalityScope';

export interface FieldSupervision {
  id: string;
  municipalityId: string;
  supervisorId: string;
  supervisorName?: string;
  agentId: string;
  agentName?: string;
  date: string;
  propertyId?: string;
  propertyAddress?: string;
  activityType: string;
  result: 'conforme' | 'orientacao' | 'inconsistencia' | 'retorno';
  notes?: string;
  createdAt: string;
}

export interface SupervisorAgentSummary {
  id: string;
  name: string;
  registrationNumber?: string;
  phone?: string;
  /** em_campo = registrou visita hoje; sem_visita_hoje = nenhum registro hoje */
  status: 'em_campo' | 'sem_visita_hoje';
  visitsToday: number;
  pendingReturns: number;
  /** Horário da última visita registrada hoje (null = nenhuma) */
  lastVisitAt: string | null;
}

/** Indicadores do dia. null = não foi possível obter o dado. */
export interface SupervisorDashboardData {
  agentsInField: number | null;
  agentsWithoutVisitToday: number | null;
  visitsToday: number | null;
  pendingReturns: number | null;
  openOrdersCount: number | null;
  criticalAlertsCount: number | null;
  error?: string;
}

export const supervisorService = {
  /**
   * Indicadores operacionais do dia no município (sem valores substitutos).
   */
  async getSupervisorDashboard(municipalityId: string): Promise<SupervisorDashboardData> {
    const munId = requireMunicipalityId(municipalityId);
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const [visitsRes, agentsRes, pendingsRes, ordersRes, alertsRes] = await Promise.all([
        supabase.from('visits').select('agent_id').eq('municipality_id', munId).eq('visit_date', todayStr).is('deleted_at', null),
        supabase.from('agents').select('id', { count: 'exact', head: true }).eq('municipality_id', munId).eq('active', true),
        supabase
          .from('pending_visits')
          .select('id, properties!inner(municipality_id)', { count: 'exact', head: true })
          .eq('properties.municipality_id', munId)
          .in('status', PENDING_STATUSES),
        supabase
          .from('work_orders')
          .select('id', { count: 'exact', head: true })
          .eq('municipality_id', munId)
          .in('status', ['aberta', 'atribuida', 'em_execucao']),
        supabase
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .eq('municipality_id', munId)
          .eq('severity', 'CRITICO')
          .eq('acknowledged', false),
      ]);

      const agentsInField = visitsRes.error ? null : new Set((visitsRes.data || []).map((v: any) => v.agent_id).filter(Boolean)).size;
      const activeAgents = agentsRes.error ? null : agentsRes.count ?? 0;

      return {
        agentsInField,
        agentsWithoutVisitToday: agentsInField === null || activeAgents === null ? null : Math.max(0, activeAgents - agentsInField),
        visitsToday: visitsRes.error ? null : (visitsRes.data || []).length,
        pendingReturns: pendingsRes.error ? null : pendingsRes.count ?? 0,
        openOrdersCount: ordersRes.error ? null : ordersRes.count ?? 0,
        criticalAlertsCount: alertsRes.error ? null : alertsRes.count ?? 0,
      };
    } catch (err: any) {
      console.error('Erro no dashboard do supervisor:', err);
      return {
        agentsInField: null,
        agentsWithoutVisitToday: null,
        visitsToday: null,
        pendingReturns: null,
        openOrdersCount: null,
        criticalAlertsCount: null,
        error: err?.message || 'Falha ao carregar indicadores.',
      };
    }
  },

  /**
   * Agentes ativos do município com registros de hoje (sem rastreamento de localização).
   */
  async getTeamAgents(municipalityId: string): Promise<SupervisorAgentSummary[]> {
    const munId = requireMunicipalityId(municipalityId);
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const [agentsRes, visitsRes, pendingRes] = await Promise.all([
        supabase
          .from('agents')
          .select('id, employee_number, profiles(full_name, phone)')
          .eq('municipality_id', munId)
          .eq('active', true),
        supabase
          .from('visits')
          .select('agent_id, created_at')
          .eq('municipality_id', munId)
          .eq('visit_date', todayStr)
          .is('deleted_at', null),
        supabase
          .from('pending_visits')
          .select('responsible_agent_id, assigned_agent_id, properties!inner(municipality_id)')
          .eq('properties.municipality_id', munId)
          .in('status', PENDING_STATUSES),
      ]);

      if (agentsRes.error || !agentsRes.data) return [];
      const visits = visitsRes.data || [];
      const pending = pendingRes.data || [];

      return agentsRes.data.map((a: any) => {
        const own = visits.filter((v: any) => v.agent_id === a.id);
        const last = own.map((v: any) => v.created_at).filter(Boolean).sort().pop() ?? null;
        return {
          id: a.id,
          name: a.profiles?.full_name || 'Agente sem perfil vinculado',
          registrationNumber: a.employee_number || undefined,
          phone: a.profiles?.phone || undefined,
          status: own.length > 0 ? 'em_campo' : 'sem_visita_hoje',
          visitsToday: own.length,
          pendingReturns: pending.filter((p: any) => p.responsible_agent_id === a.id || p.assigned_agent_id === a.id).length,
          lastVisitAt: last,
        } as SupervisorAgentSummary;
      });
    } catch (err) {
      console.error('Erro ao listar equipe de agentes:', err);
      return [];
    }
  },

  /**
   * Registrar supervisão de campo
   */
  async registerSupervision(supervision: {
    municipalityId: string;
    supervisorId: string;
    agentId: string;
    propertyId?: string;
    activityType: string;
    result: 'conforme' | 'orientacao' | 'inconsistencia' | 'retorno';
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const municipalityId = requireMunicipalityId(supervision.municipalityId);
      const todayStr = new Date().toISOString().split('T')[0];

      const { error } = await supabase.from('field_supervisions').insert({
        municipality_id: municipalityId,
        supervisor_id: supervision.supervisorId,
        agent_id: supervision.agentId,
        date: todayStr,
        property_id: supervision.propertyId,
        activity_type: supervision.activityType,
        result: supervision.result,
        notes: supervision.notes,
      });

      if (error) throw error;

      await auditLogService.log({
        municipalityId: municipalityId,
        action: 'REGISTRAR_SUPERVISAO',
        module: 'supervisao',
        entity: 'field_supervisions',
        newData: { descricao: `Supervisão de campo registrada para o agente. Resultado: ${supervision.result}.` },
      });

      return { success: true };
    } catch (err: any) {
      console.error('Erro ao registrar supervisão:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Listar supervisões de campo realizadas
   */
  async getSupervisions(municipalityId: string): Promise<FieldSupervision[]> {
    try {
      const { data, error } = await supabase
        .from('field_supervisions')
        .select(`
          *,
          supervisor:supervisor_id (full_name),
          agent:agent_id (${AGENT_EMBED}),
          property:property_id (street, number, complement)
        `)
        .eq('municipality_id', municipalityId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((s: any) => ({
        id: s.id,
        municipalityId: s.municipality_id,
        supervisorId: s.supervisor_id,
        supervisorName: s.supervisor?.full_name,
        agentId: s.agent_id,
        agentName: agentName(s.agent),
        date: s.date,
        propertyId: s.property_id,
        propertyAddress: formatAddress(s.property),
        activityType: s.activity_type,
        result: s.result,
        notes: s.notes,
        createdAt: s.created_at,
      }));
    } catch {
      return [];
    }
  },
};
