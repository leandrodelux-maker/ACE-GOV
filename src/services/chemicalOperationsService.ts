import { supabase } from './supabaseClient';
import { stockService } from './stockService';

export interface ChemicalOperation {
  id: string;
  municipality_id: string;
  type: 'tratamento_focal' | 'tratamento_perifocal' | 'ubv_costal' | 'ubv_veicular' | 'nebulizacao' | 'outro';
  disease: string;
  neighborhood_id?: string;
  sector_id?: string;
  radius_meters: number;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  status: 'planejada' | 'em_andamento' | 'concluida' | 'cancelada';
  responsible_user_id?: string;
  equipment_type?: 'ubv_costal' | 'ubv_veicular' | 'nebulizador' | 'termonebulizador' | 'pulverizador_manual';
  operational_conditions?: string; // Vento, temperatura, umidade
  route_distance_km?: number;
  execution_time_minutes?: number;
  worked_area_hectares?: number;
  product_consumed_liters?: number;
  cancellation_reason?: 'chuva' | 'vento' | 'equipamento' | 'produto' | 'equipe' | 'outro';
  batch_id?: string;
  target_properties_count?: number;
  visited_properties_count?: number;
  worked_properties_count?: number;
  closed_properties_count?: number;
  refusal_properties_count?: number;
  focus_found_count?: number;
  notes?: string;
  created_at: string;
  // Relacionamentos
  neighborhood?: { id: string; name: string };
  sector?: { id: string; name: string; code: string };
  batch?: { id: string; batch_number: string; expiration_date: string; current_quantity: number; product?: { name: string; unit: string } };
}

const DEFAULT_MUN_ID = '00000000-0000-0000-0000-000000000001';

export const chemicalOperationsService = {
  // 1. Listar Operações Químicas com Métricas Reais
  async getOperations(municipalityId = DEFAULT_MUN_ID): Promise<ChemicalOperation[]> {
    try {
      const { data, error } = await supabase
        .from('vector_control_operations')
        .select(`
          *,
          neighborhood:neighborhoods(id, name),
          sector:sectors(id, name, code),
          batch:product_batches(
            id, batch_number, expiration_date, current_quantity,
            product:products(name, unit)
          )
        `)
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return (data as any) || [];
    } catch (err) {
      console.error('Erro ao listar operações químicas:', err);
      return [];
    }
  },

  // 2. Criar Nova Operação Química vinculada ao Lote e Estoque
  async createOperation(payload: {
    type: string;
    disease: string;
    neighborhood_id?: string;
    sector_id?: string;
    start_date: string;
    start_time?: string;
    end_time?: string;
    equipment_type?: string;
    operational_conditions?: string;
    batch_id: string; // Vínculo de lote obrigatório
    product_consumed_liters: number;
    route_distance_km?: number;
    execution_time_minutes?: number;
    worked_area_hectares?: number;
    target_properties_count?: number;
    worked_properties_count?: number;
    notes?: string;
    municipality_id?: string;
  }): Promise<{ success: boolean; operation_id?: string; message: string }> {
    try {
      const munId = payload.municipality_id || DEFAULT_MUN_ID;

      // 1. Validar saldo do lote no estoque
      const { data: batch, error: bErr } = await supabase
        .from('product_batches')
        .select('id, current_quantity, product_id, batch_number, products(name)')
        .eq('id', payload.batch_id)
        .single();

      if (bErr || !batch) {
        return { success: false, message: 'Lote de produto selecionado não foi encontrado no estoque.' };
      }

      if (Number(batch.current_quantity) < payload.product_consumed_liters) {
        return {
          success: false,
          message: `Saldo insuficiente no lote ${batch.batch_number}! Disponível: ${batch.current_quantity}, Requerido: ${payload.product_consumed_liters}. Saldo negativo não é permitido.`,
        };
      }

      // 2. Inserir operação química
      const { data: op, error: opErr } = await supabase
        .from('vector_control_operations')
        .insert({
          municipality_id: munId,
          type: payload.type,
          disease: payload.disease,
          neighborhood_id: payload.neighborhood_id,
          sector_id: payload.sector_id,
          radius_meters: 150,
          start_date: payload.start_date,
          start_time: payload.start_time,
          end_time: payload.end_time,
          equipment_type: payload.equipment_type || 'ubv_costal',
          operational_conditions: payload.operational_conditions,
          batch_id: payload.batch_id,
          product_consumed_liters: payload.product_consumed_liters,
          route_distance_km: payload.route_distance_km || 0,
          execution_time_minutes: payload.execution_time_minutes || 0,
          worked_area_hectares: payload.worked_area_hectares || 0,
          target_properties_count: payload.target_properties_count || 0,
          worked_properties_count: payload.worked_properties_count || 0,
          status: 'em_andamento',
          notes: payload.notes,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (opErr) throw opErr;

      // 3. Dar baixa automática de estoque vinculada a esta operação química
      if (payload.product_consumed_liters > 0) {
        await supabase.from('stock_movements').insert({
          municipality_id: munId,
          product_id: batch.product_id,
          batch_id: payload.batch_id,
          operation_id: op.id,
          movement_type: 'uso_operacao',
          quantity: payload.product_consumed_liters,
          notes: `Aplicação química (${payload.type}) - Operação ${op.id.substring(0, 8)}`,
          created_at: new Date().toISOString(),
        });
      }

      return { success: true, operation_id: op.id, message: 'Operação química iniciada com baixa de estoque registrada!' };
    } catch (err: any) {
      console.error('Erro ao criar operação química:', err);
      return { success: false, message: err.message || 'Falha ao registrar operação química.' };
    }
  },

  // 3. Finalizar Operação Química com métricas reais de execução
  async completeOperation(id: string, metrics: {
    worked_properties_count: number;
    closed_properties_count: number;
    refusal_properties_count: number;
    focus_found_count: number;
    notes?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('vector_control_operations')
        .update({
          status: 'concluida',
          worked_properties_count: metrics.worked_properties_count,
          closed_properties_count: metrics.closed_properties_count,
          refusal_properties_count: metrics.refusal_properties_count,
          focus_found_count: metrics.focus_found_count,
          visited_properties_count: metrics.worked_properties_count + metrics.closed_properties_count + metrics.refusal_properties_count,
          notes: metrics.notes,
          end_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return { success: true, message: 'Operação química concluída com sucesso!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha ao concluir operação química.' };
    }
  },

  // 4. Cancelar / Interromper Operação com motivo registrado
  async cancelOperation(id: string, payload: {
    cancellation_reason: 'chuva' | 'vento' | 'equipamento' | 'produto' | 'equipe' | 'outro';
    notes?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('vector_control_operations')
        .update({
          status: 'cancelada',
          cancellation_reason: payload.cancellation_reason,
          notes: payload.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return { success: true, message: `Operação cancelada por motivo: ${payload.cancellation_reason}.` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha ao cancelar operação química.' };
    }
  },
};
