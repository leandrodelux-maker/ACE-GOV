import { supabase } from './supabaseClient';

export interface PendingVisitItem {
  id: string;
  cycle_id?: string;
  property_id: string;
  assigned_agent_id?: string;
  responsible_agent_id?: string;
  recovery_team_id?: string;
  reason: 'fechado' | 'recusa' | 'desocupado' | 'nao_localizado' | string;
  priority: 'alta' | 'media' | 'baixa';
  deadline?: string;
  attempt_count: number;
  first_attempt_date: string;
  last_attempt_date: string;
  next_return_date?: string;
  status: 'pendente' | 'recuperado' | 'cancelado';
  recovered_at?: string;
  recovered_by_visit_id?: string;
  notes?: string;
  created_at: string;
  // Relacionamentos
  property?: {
    id: string;
    property_code: string;
    property_type: string;
    street: string;
    number: string;
    complement?: string;
    reference?: string;
    latitude?: number;
    longitude?: number;
    neighborhood?: { name: string };
    sector?: { name: string; code: string };
    block?: { code: string };
  };
  assigned_agent?: { id: string; name: string };
  responsible_agent?: { id: string; name: string };
  cycle?: { id: string; name: string; year: number; cycle_number: number };
}

export interface PendencyIndicators {
  totalCycleClosed: number;
  totalCycleRefusals: number;
  totalRecovered: number;
  stillPending: number;
  recoveryRate: number;
  criticalPendingCount: number; // Imóveis com >= 3 tentativas
}

const DEFAULT_MUN_ID = '00000000-0000-0000-0000-000000000001';

export const pendencyManagementService = {
  // 1. Obter Indicadores Reais de Pendências
  async getIndicators(cycleId?: string): Promise<PendencyIndicators> {
    try {
      let query = supabase.from('pending_visits').select('*');
      if (cycleId) {
        query = query.eq('cycle_id', cycleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      const list = data || [];

      const closed = list.filter(p => p.reason === 'fechado').length;
      const refusals = list.filter(p => p.reason === 'recusa').length;
      const recovered = list.filter(p => p.status === 'recuperado' || p.recovered_at != null).length;
      const stillPending = list.filter(p => p.status !== 'recuperado' && !p.recovered_at).length;
      const total = list.length;
      const recoveryRate = total > 0 ? Number(((recovered / total) * 100).toFixed(1)) : 0;
      const critical = list.filter(p => p.status !== 'recuperado' && (p.attempt_count || 1) >= 3).length;

      return {
        totalCycleClosed: closed,
        totalCycleRefusals: refusals,
        totalRecovered: recovered,
        stillPending: stillPending,
        recoveryRate: recoveryRate,
        criticalPendingCount: critical,
      };
    } catch (err) {
      console.error('Erro ao calcular indicadores de pendências:', err);
      return {
        totalCycleClosed: 0,
        totalCycleRefusals: 0,
        totalRecovered: 0,
        stillPending: 0,
        recoveryRate: 0,
        criticalPendingCount: 0,
      };
    }
  },

  // 2. Listar Pendências com Filtros Detalhados
  async getPendingVisits(params: {
    filterType?: 'todos' | 'fechados' | 'recusas' | 'retornos' | 'nao_localizados' | 'criticas' | 'recuperados';
    cycleId?: string;
    agentId?: string;
    neighborhoodId?: string;
    limit?: number;
  }): Promise<PendingVisitItem[]> {
    try {
      let query = supabase
        .from('pending_visits')
        .select(`
          *,
          property:properties(
            id, property_code, property_type, street, number, complement, reference, latitude, longitude,
            neighborhood:neighborhoods(name),
            sector:sectors(name, code),
            block:blocks(code)
          ),
          assigned_agent:agents!pending_visits_assigned_agent_id_fkey(id, name),
          responsible_agent:agents!pending_visits_responsible_agent_id_fkey(id, name),
          cycle:cycles(id, name, year, cycle_number)
        `)
        .order('last_attempt_date', { ascending: false })
        .limit(params.limit || 150);

      if (params.cycleId) query = query.eq('cycle_id', params.cycleId);
      if (params.agentId) query = query.or(`assigned_agent_id.eq.${params.agentId},responsible_agent_id.eq.${params.agentId}`);

      // Filtros de estado / motivo
      if (params.filterType === 'fechados') {
        query = query.eq('reason', 'fechado').neq('status', 'recuperado');
      } else if (params.filterType === 'recusas') {
        query = query.eq('reason', 'recusa').neq('status', 'recuperado');
      } else if (params.filterType === 'retornos') {
        query = query.neq('status', 'recuperado').not('next_return_date', 'is', null);
      } else if (params.filterType === 'nao_localizados') {
        query = query.eq('reason', 'nao_localizado').neq('status', 'recuperado');
      } else if (params.filterType === 'criticas') {
        query = query.gte('attempt_count', 3).neq('status', 'recuperado');
      } else if (params.filterType === 'recuperados') {
        query = query.eq('status', 'recuperado');
      } else {
        query = query.neq('status', 'recuperado');
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any) || [];
    } catch (err) {
      console.error('Erro ao buscar pendências de campo:', err);
      return [];
    }
  },

  // 3. Atribuir Pendência a um Agente ou Equipe de Recuperação
  async reassignPendency(pendencyId: string, payload: {
    agentId?: string;
    teamId?: string;
    notes?: string;
    nextReturnDate?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const updates: any = {
        updated_at: new Date().toISOString(),
      };
      if (payload.agentId) updates.responsible_agent_id = payload.agentId;
      if (payload.teamId) updates.recovery_team_id = payload.teamId;
      if (payload.nextReturnDate) updates.next_return_date = payload.nextReturnDate;
      if (payload.notes) updates.notes = payload.notes;

      const { error } = await supabase
        .from('pending_visits')
        .update(updates)
        .eq('id', pendencyId);

      if (error) throw error;
      return { success: true, message: 'Pendência reatribuída com sucesso!' };
    } catch (err: any) {
      console.error('Erro ao reatribuir pendência:', err);
      return { success: false, message: err.message || 'Falha ao reatribuir pendência.' };
    }
  },

  // 4. Agendar Próxima Tentativa de Retorno
  async scheduleReturn(pendencyId: string, nextReturnDate: string, notes?: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('pending_visits')
        .update({
          next_return_date: nextReturnDate,
          notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendencyId);

      if (error) throw error;
      return { success: true, message: 'Data de retorno agendada com sucesso!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha ao agendar retorno.' };
    }
  },

  // 5. Gerar Roteiro de Recuperação de Fechados / Pendências
  async generateRecoveryRoute(params: {
    sectorId?: string;
    neighborhoodId?: string;
    agentId?: string;
    maxProperties?: number;
  }): Promise<PendingVisitItem[]> {
    try {
      let query = supabase
        .from('pending_visits')
        .select(`
          *,
          property:properties(
            id, property_code, property_type, street, number, complement, reference, latitude, longitude,
            neighborhood:neighborhoods(name),
            sector:sectors(name, code),
            block:blocks(code)
          ),
          assigned_agent:agents!pending_visits_assigned_agent_id_fkey(id, name),
          responsible_agent:agents!pending_visits_responsible_agent_id_fkey(id, name)
        `)
        .neq('status', 'recuperado')
        .order('attempt_count', { ascending: false })
        .order('next_return_date', { ascending: true })
        .limit(params.maxProperties || 50);

      if (params.agentId) {
        query = query.or(`responsible_agent_id.eq.${params.agentId},assigned_agent_id.eq.${params.agentId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any) || [];
    } catch (err) {
      console.error('Erro ao gerar roteiro de recuperação:', err);
      return [];
    }
  },
};
