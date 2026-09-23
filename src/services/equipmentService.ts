import { supabase } from './supabaseClient';
import { AGENT_EMBED, agentName } from './schemaHelpers';
import { alertsService } from './alertsService';

export type EquipmentCategory =
  | 'bomba_costal'
  | 'nebulizador'
  | 'pulverizador'
  | 'tablet'
  | 'smartphone'
  | 'GPS'
  | 'microscopio'
  | 'armadilha'
  | 'veiculo_operacional'
  | 'EPI'
  | 'outros';

export type EquipmentStatus = 'disponivel' | 'em_uso' | 'manutencao' | 'danificado' | 'baixado';
export type MovementType = 'entrega' | 'devolucao' | 'transferencia' | 'manutencao' | 'baixa';
export type MaintenanceType = 'preventiva' | 'corretiva' | 'calibracao';

export interface EquipmentItem {
  id: string;
  municipalityId: string;
  code: string;
  name: string;
  category: EquipmentCategory;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  status: EquipmentStatus;
  assignedToAgentId?: string;
  assignedToAgentName?: string;
  assignedToTeamId?: string;
  assignedToTeamName?: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentMovement {
  id: string;
  equipmentId: string;
  movementType: MovementType;
  fromUserId?: string;
  fromUserName?: string;
  toUserId?: string;
  toUserName?: string;
  date: string;
  notes?: string;
  registeredBy?: string;
}

export interface EquipmentMaintenance {
  id: string;
  equipmentId: string;
  maintenanceType: MaintenanceType;
  description: string;
  provider?: string;
  cost?: number;
  sentAt: string;
  returnedAt?: string;
  nextMaintenance?: string;
  status: 'em_manutencao' | 'concluida' | 'cancelada';
  createdAt: string;
}

export interface EquipmentAlert {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  type: 'VENCIDA' | 'PROXIMA' | 'DANIFICADO' | 'NAO_DEVOLVIDO';
  message: string;
  dueDate?: string;
}


export const equipmentService = {
  /**
   * Buscar todos os equipamentos com detalhes dos responsáveis e filtros
   */
  async getEquipments(
    municipalityId: string,
    filters?: { category?: string; status?: string; search?: string }
  ): Promise<EquipmentItem[]> {
    try {
      let query = supabase
        .from('equipment')
        .select(`
          *,
          agents:assigned_to_agent_id (${AGENT_EMBED}),
          teams:assigned_to_team_id (name)
        `)
        .eq('municipality_id', municipalityId)
        .order('created_at', { ascending: false });

      if (filters?.category && filters.category !== 'todos') {
        query = query.or(`category.eq.${filters.category},type.eq.${filters.category}`);
      }
      if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data) return [];

      let list = data.map((item: any) => ({
        id: item.id,
        municipalityId: item.municipality_id,
        code: item.code || `EQP-${item.id.substring(0, 5).toUpperCase()}`,
        name: item.name,
        category: (item.category || item.type || 'outros') as EquipmentCategory,
        brand: item.brand,
        model: item.model,
        serialNumber: item.serial_number,
        purchaseDate: item.purchase_date,
        status: (item.status || 'disponivel') as EquipmentStatus,
        assignedToAgentId: item.assigned_to_agent_id,
        assignedToAgentName: agentName(item.agents),
        assignedToTeamId: item.assigned_to_team_id,
        assignedToTeamName: item.teams?.name,
        lastMaintenance: item.last_maintenance,
        nextMaintenance: item.next_maintenance,
        notes: item.notes,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));

      if (filters?.search) {
        const s = filters.search.toLowerCase();
        list = list.filter(
          e =>
            e.name.toLowerCase().includes(s) ||
            e.code.toLowerCase().includes(s) ||
            (e.serialNumber && e.serialNumber.toLowerCase().includes(s))
        );
      }

      return list;
    } catch (err) {
      console.error('Erro ao buscar equipamentos:', err);
      return [];
    }
  },

  /**
   * Buscar alertas operacionais de equipamentos
   */
  async getEquipmentAlerts(municipalityId: string): Promise<EquipmentAlert[]> {
    try {
      const items = await this.getEquipments(municipalityId);
      const alerts: EquipmentAlert[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const in15Days = new Date();
      in15Days.setDate(today.getDate() + 15);

      for (const eq of items) {
        if (eq.status === 'danificado') {
          alerts.push({
            id: `dan-${eq.id}`,
            equipmentId: eq.id,
            equipmentCode: eq.code,
            equipmentName: eq.name,
            type: 'DANIFICADO',
            message: `Equipamento ${eq.name} (${eq.code}) reportado como danificado. Requer vistoria.`,
          });
        }

        if (eq.nextMaintenance) {
          const mDate = new Date(eq.nextMaintenance);
          mDate.setHours(0, 0, 0, 0);

          if (mDate < today && eq.status !== 'manutencao') {
            alerts.push({
              id: `venc-${eq.id}`,
              equipmentId: eq.id,
              equipmentCode: eq.code,
              equipmentName: eq.name,
              type: 'VENCIDA',
              message: `Manutenção preventiva do equipamento ${eq.code} vencida desde ${mDate.toLocaleDateString('pt-BR')}.`,
              dueDate: eq.nextMaintenance,
            });
          } else if (mDate >= today && mDate <= in15Days && eq.status !== 'manutencao') {
            alerts.push({
              id: `prox-${eq.id}`,
              equipmentId: eq.id,
              equipmentCode: eq.code,
              equipmentName: eq.name,
              type: 'PROXIMA',
              message: `Manutenção preventiva prevista para ${mDate.toLocaleDateString('pt-BR')} (nos próximos dias).`,
              dueDate: eq.nextMaintenance,
            });
          }
        }
      }

      return alerts;
    } catch (err) {
      console.error('Erro ao calcular alertas de equipamentos:', err);
      return [];
    }
  },

  /**
   * Criar ou atualizar equipamento
   */
  async saveEquipment(
    item: Partial<EquipmentItem>,
    municipalityId: string
  ): Promise<{ success: boolean; data?: EquipmentItem; error?: string }> {
    try {
      const now = new Date().toISOString();
      const munId = item.municipalityId || municipalityId;

      if (item.id) {
        const { data, error } = await supabase
          .from('equipment')
          .update({
            code: item.code,
            name: item.name,
            category: item.category,
            type: item.category,
            brand: item.brand,
            model: item.model,
            serial_number: item.serialNumber,
            purchase_date: item.purchaseDate,
            status: item.status,
            assigned_to_agent_id: item.assignedToAgentId,
            assigned_to_team_id: item.assignedToTeamId,
            last_maintenance: item.lastMaintenance,
            next_maintenance: item.nextMaintenance,
            notes: item.notes,
            updated_at: now,
          })
          .eq('id', item.id)
          .select()
          .single();

        if (error) throw error;
        return { success: true, data: data as any };
      } else {
        const code = item.code || `EQP-${Math.floor(1000 + Math.random() * 9000)}`;
        const { data, error } = await supabase
          .from('equipment')
          .insert({
            municipality_id: munId,
            code,
            name: item.name,
            category: item.category || 'outros',
            type: item.category || 'outros',
            brand: item.brand,
            model: item.model,
            serial_number: item.serialNumber,
            purchase_date: item.purchaseDate,
            status: item.status || 'disponivel',
            assigned_to_agent_id: item.assignedToAgentId,
            assigned_to_team_id: item.assignedToTeamId,
            last_maintenance: item.lastMaintenance,
            next_maintenance: item.nextMaintenance,
            notes: item.notes,
          })
          .select()
          .single();

        if (error) throw error;
        return { success: true, data: data as any };
      }
    } catch (err: any) {
      console.error('Erro ao salvar equipamento:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Registrar transferência / movimentação de equipamento
   */
  async registerMovement(params: {
    equipmentId: string;
    movementType: MovementType;
    toUserId?: string;
    fromUserId?: string;
    notes?: string;
    newStatus?: EquipmentStatus;
    registeredBy?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Inserir movimentação
      const { error: movErr } = await supabase.from('equipment_movements').insert({
        equipment_id: params.equipmentId,
        movement_type: params.movementType,
        from_user_id: params.fromUserId,
        to_user_id: params.toUserId,
        notes: params.notes,
        registered_by: params.registeredBy,
      });
      if (movErr) throw movErr;

      // 2. Atualizar status e posse no equipamento
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (params.newStatus) {
        updateData.status = params.newStatus;
      } else {
        if (params.movementType === 'entrega') updateData.status = 'em_uso';
        if (params.movementType === 'devolucao') updateData.status = 'disponivel';
        if (params.movementType === 'manutencao') updateData.status = 'manutencao';
        if (params.movementType === 'baixa') updateData.status = 'baixado';
      }

      if (params.toUserId && params.movementType === 'entrega') {
        updateData.assigned_to_agent_id = params.toUserId;
      } else if (params.movementType === 'devolucao' || params.movementType === 'baixa') {
        updateData.assigned_to_agent_id = null;
      }

      await supabase.from('equipment').update(updateData).eq('id', params.equipmentId);

      return { success: true };
    } catch (err: any) {
      console.error('Erro ao registrar movimentação:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Registrar ou concluir manutenção
   */
  async recordMaintenance(params: {
    equipmentId: string;
    maintenanceType: MaintenanceType;
    description: string;
    provider?: string;
    cost?: number;
    sentAt: string;
    returnedAt?: string;
    nextMaintenance?: string;
    status: 'em_manutencao' | 'concluida' | 'cancelada';
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('equipment_maintenance').insert({
        equipment_id: params.equipmentId,
        maintenance_type: params.maintenanceType,
        description: params.description,
        provider: params.provider,
        cost: params.cost,
        sent_at: params.sentAt,
        returned_at: params.returnedAt,
        next_maintenance: params.nextMaintenance,
        status: params.status,
      });

      if (error) throw error;

      // Atualizar o equipamento
      const eqUpdate: any = {
        updated_at: new Date().toISOString(),
      };
      if (params.status === 'em_manutencao') {
        eqUpdate.status = 'manutencao';
      } else if (params.status === 'concluida') {
        eqUpdate.status = 'disponivel';
        eqUpdate.last_maintenance = params.returnedAt || new Date().toISOString().split('T')[0];
        if (params.nextMaintenance) eqUpdate.next_maintenance = params.nextMaintenance;
      }

      await supabase.from('equipment').update(eqUpdate).eq('id', params.equipmentId);

      return { success: true };
    } catch (err: any) {
      console.error('Erro ao registrar manutenção:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Buscar histórico de manutenções e movimentações de um equipamento
   */
  async getEquipmentHistory(equipmentId: string) {
    try {
      const [movementsRes, maintenanceRes] = await Promise.all([
        supabase
          .from('equipment_movements')
          .select(`
            *,
            from_profile:from_user_id (full_name),
            to_profile:to_user_id (full_name),
            reg_profile:registered_by (full_name)
          `)
          .eq('equipment_id', equipmentId)
          .order('date', { ascending: false }),
        supabase
          .from('equipment_maintenance')
          .select('*')
          .eq('equipment_id', equipmentId)
          .order('sent_at', { ascending: false }),
      ]);

      return {
        movements: movementsRes.data || [],
        maintenance: maintenanceRes.data || [],
      };
    } catch (err) {
      console.error('Erro ao buscar histórico do equipamento:', err);
      return { movements: [], maintenance: [] };
    }
  },
};
