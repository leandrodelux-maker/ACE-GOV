import { supabase } from './supabaseClient';

export type WorkOrderType =
  | 'vistoria'
  | 'bloqueio'
  | 'denuncia'
  | 'ponto_estrategico'
  | 'imovel_especial'
  | 'reincidencia'
  | 'controle_vetorial'
  | 'levantamento'
  | 'outro';

export type WorkOrderPriority = 'baixa' | 'normal' | 'alta' | 'urgente' | 'critica';
export type WorkOrderStatus = 'aberta' | 'atribuida' | 'em_execucao' | 'concluida' | 'cancelada';

export interface WorkOrderItem {
  id: string;
  municipalityId: string;
  number: string; // OS-END-2026-00001
  type: WorkOrderType;
  title: string;
  description?: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  requestedBy?: string;
  requestedByName?: string;
  assignedTeamId?: string;
  assignedTeamName?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  neighborhoodId?: string;
  neighborhoodName?: string;
  sectorId?: string;
  propertyId?: string;
  propertyAddress?: string;
  plannedDate?: string;
  startedAt?: string;
  completedAt?: string;
  completionResult?: string;
  completionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderFilter {
  type?: string;
  priority?: string;
  status?: string;
  agentId?: string;
  neighborhoodId?: string;
  search?: string;
}

const DEFAULT_MUN_ID = '00000000-0000-0000-0000-000000000001';

export const workOrderService = {
  /**
   * Gera o próximo número oficial de OS sequencial institucional (OS-END-2026-00001)
   */
  async generateOrderNumber(municipalityId = DEFAULT_MUN_ID): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `OS-END-${year}-`;

    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('number')
        .eq('municipality_id', municipalityId)
        .ilike('number', `${prefix}%`)
        .order('number', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return `${prefix}00001`;
      }

      const lastNum = data[0].number;
      const numPart = parseInt(lastNum.replace(prefix, ''), 10);
      const nextVal = isNaN(numPart) ? 1 : numPart + 1;
      return `${prefix}${String(nextVal).padStart(5, '0')}`;
    } catch {
      return `${prefix}00001`;
    }
  },

  /**
   * Buscar Ordens de Serviço com dados relacionados
   */
  async getWorkOrders(
    municipalityId = DEFAULT_MUN_ID,
    filters?: WorkOrderFilter
  ): Promise<WorkOrderItem[]> {
    try {
      let query = supabase
        .from('work_orders')
        .select(`
          *,
          agents:assigned_agent_id (name),
          teams:assigned_team_id (name),
          neighborhoods:neighborhood_id (name),
          properties:property_id (address),
          profiles:requested_by (full_name)
        `)
        .eq('municipality_id', municipalityId)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters?.type && filters.type !== 'todos') {
        query = query.eq('type', filters.type);
      }
      if (filters?.priority && filters.priority !== 'todos') {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.agentId && filters.agentId !== 'todos') {
        query = query.eq('assigned_agent_id', filters.agentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data) return [];

      let list = data.map((d: any) => ({
        id: d.id,
        municipalityId: d.municipality_id,
        number: d.number,
        type: d.type as WorkOrderType,
        title: d.title,
        description: d.description,
        priority: d.priority as WorkOrderPriority,
        status: d.status as WorkOrderStatus,
        requestedBy: d.requested_by,
        requestedByName: d.profiles?.full_name,
        assignedTeamId: d.assigned_team_id,
        assignedTeamName: d.teams?.name,
        assignedAgentId: d.assigned_agent_id,
        assignedAgentName: d.agents?.name,
        neighborhoodId: d.neighborhood_id,
        neighborhoodName: d.neighborhoods?.name,
        sectorId: d.sector_id,
        propertyId: d.property_id,
        propertyAddress: d.properties?.address,
        plannedDate: d.planned_date,
        startedAt: d.started_at,
        completedAt: d.completed_at,
        completionResult: d.completion_result,
        completionNotes: d.completion_notes,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));

      if (filters?.search) {
        const s = filters.search.toLowerCase();
        list = list.filter(
          o =>
            o.number.toLowerCase().includes(s) ||
            o.title.toLowerCase().includes(s) ||
            (o.propertyAddress && o.propertyAddress.toLowerCase().includes(s)) ||
            (o.neighborhoodName && o.neighborhoodName.toLowerCase().includes(s))
        );
      }

      return list;
    } catch (err) {
      console.error('Erro ao buscar ordens de serviço:', err);
      return [];
    }
  },

  /**
   * Criar nova Ordem de Serviço
   */
  async createWorkOrder(params: {
    municipalityId?: string;
    type: WorkOrderType;
    title: string;
    description?: string;
    priority?: WorkOrderPriority;
    requestedBy?: string;
    assignedTeamId?: string;
    assignedAgentId?: string;
    neighborhoodId?: string;
    sectorId?: string;
    propertyId?: string;
    plannedDate?: string;
  }): Promise<{ success: boolean; data?: WorkOrderItem; error?: string }> {
    try {
      const municipalityId = params.municipalityId || DEFAULT_MUN_ID;
      const orderNumber = await this.generateOrderNumber(municipalityId);

      const status: WorkOrderStatus = params.assignedAgentId || params.assignedTeamId ? 'atribuida' : 'aberta';

      const { data, error } = await supabase
        .from('work_orders')
        .insert({
          municipality_id: municipalityId,
          number: orderNumber,
          type: params.type,
          title: params.title,
          description: params.description,
          priority: params.priority || 'normal',
          status,
          requested_by: params.requestedBy,
          assigned_team_id: params.assignedTeamId,
          assigned_agent_id: params.assignedAgentId,
          neighborhood_id: params.neighborhoodId,
          sector_id: params.sectorId,
          property_id: params.propertyId,
          planned_date: params.plannedDate || new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar auditoria
      await supabase.from('audit_logs').insert({
        municipality_id: municipalityId,
        entity_name: 'work_orders',
        entity_id: data.id,
        action: 'CRIAR_ORDEM_SERVICO',
        details: `Criada OS ${orderNumber} do tipo ${params.type} com prioridade ${params.priority || 'normal'}.`,
      });

      return { success: true, data: data as any };
    } catch (err: any) {
      console.error('Erro ao criar ordem de serviço:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Criar Ordem de Serviço automaticamente a partir de gatilhos do sistema
   */
  async createAutoOrderFromTrigger(trigger: {
    source: 'denuncia' | 'foco' | 'caso_sinan' | 'reincidencia' | 'pe_vencido' | 'alerta';
    sourceId: string;
    title: string;
    description: string;
    neighborhoodId?: string;
    propertyId?: string;
    priority?: WorkOrderPriority;
    municipalityId?: string;
  }): Promise<{ success: boolean; orderNumber?: string }> {
    const typeMap: Record<string, WorkOrderType> = {
      denuncia: 'denuncia',
      foco: 'controle_vetorial',
      caso_sinan: 'bloqueio',
      reincidencia: 'reincidencia',
      pe_vencido: 'ponto_estrategico',
      alerta: 'vistoria',
    };

    const res = await this.createWorkOrder({
      municipalityId: trigger.municipalityId,
      type: typeMap[trigger.source] || 'vistoria',
      title: trigger.title,
      description: `[ORIGEM AUTOMÁTICA: ${trigger.source.toUpperCase()}]\n${trigger.description}`,
      priority: trigger.priority || 'alta',
      neighborhoodId: trigger.neighborhoodId,
      propertyId: trigger.propertyId,
    });

    return {
      success: res.success,
      orderNumber: res.data?.number,
    };
  },

  /**
   * Concluir uma Ordem de Serviço
   */
  async completeWorkOrder(params: {
    orderId: string;
    completedByUserId?: string;
    completionResult: string; // Ex: "Bloqueio concluído", "Foco eliminado", "Imóvel fechado"
    completionNotes?: string;
    actionsExecuted?: string[];
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();
      const actionsStr = params.actionsExecuted ? `\n\nAções executadas: ${params.actionsExecuted.join(', ')}` : '';
      const finalNotes = `${params.completionNotes || ''}${actionsStr}`.trim();

      const { error } = await supabase
        .from('work_orders')
        .update({
          status: 'concluida',
          completed_at: now,
          completion_result: params.completionResult,
          completion_notes: finalNotes,
          updated_at: now,
        })
        .eq('id', params.orderId);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        entity_name: 'work_orders',
        entity_id: params.orderId,
        action: 'CONCLUIR_ORDEM_SERVICO',
        details: `OS concluída com resultado: "${params.completionResult}".`,
      });

      return { success: true };
    } catch (err: any) {
      console.error('Erro ao concluir OS:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Atribuir ou redistribuir agente/equipe a uma OS
   */
  async assignWorkOrder(params: {
    orderId: string;
    agentId?: string;
    teamId?: string;
    plannedDate?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({
          assigned_agent_id: params.agentId || null,
          assigned_team_id: params.teamId || null,
          planned_date: params.plannedDate,
          status: 'atribuida',
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.orderId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
