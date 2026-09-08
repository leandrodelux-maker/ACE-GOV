import { supabase } from './supabaseClient';
import { stockService } from './stockService';

export interface VectorControlOperation {
  id: string;
  municipality_id: string;
  type: 'tratamento_focal' | 'tratamento_perifocal' | 'bloqueio' | 'nebulizacao' | 'fumace' | 'outro';
  disease: string;
  neighborhood_id?: string;
  sector_id?: string;
  radius_meters: number;
  start_date: string;
  end_date?: string;
  status: 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA' | 'SUSPENSA';
  responsible_user_id?: string;
  notes?: string;
  case_id?: string;
  neighborhood?: { name: string };
  case?: { notification_number: string; disease: string };
  metrics?: {
    plannedProperties: number;
    completedProperties: number;
    coveragePercentage: number;
    closedCount: number;
    refusalCount: number;
    chemicalUsedCount: number;
  };
}

export interface ChemicalApplication {
  id?: string;
  operation_id: string;
  property_id?: string;
  agent_id?: string;
  product_id: string;
  batch_id: string;
  application_type: 'FOCAL' | 'PERIFOCAL' | 'NEBULIZACAO_COSTAL' | 'UBV_PESADO';
  quantity: number;
  unit: string;
  application_date: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  product?: { name: string };
  batch?: { batch_number: string };
}

const DEFAULT_MUN_ID = '00000000-0000-0000-0000-000000000001';

export const vectorControlService = {
  // 1. Listar Operações de Controle Vetorial
  async getOperations(municipalityId = DEFAULT_MUN_ID): Promise<VectorControlOperation[]> {
    try {
      const { data, error } = await supabase
        .from('vector_control_operations')
        .select(`
          *,
          neighborhood:neighborhoods(name),
          case:epidemiological_cases(notification_number, disease)
        `)
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null)
        .order('start_date', { ascending: false });

      if (error) throw error;
      if (!data) return [];

      // Carregar métricas das propriedades trabalhadas
      const operations: VectorControlOperation[] = [];

      for (const op of data) {
        const { data: props } = await supabase
          .from('vector_control_properties')
          .select('status, refusal, closed')
          .eq('operation_id', op.id);

        const { data: apps } = await supabase
          .from('chemical_applications')
          .select('id')
          .eq('operation_id', op.id);

        const propList = props || [];
        const completed = propList.filter(p => !p.closed && !p.refusal).length;
        const planned = Math.max(propList.length, op.radius_meters === 150 ? 120 : 250);
        const closed = propList.filter(p => p.closed).length;
        const refusals = propList.filter(p => p.refusal).length;
        const coverage = planned > 0 ? Number(((completed / planned) * 100).toFixed(1)) : 0;

        operations.push({
          ...op,
          metrics: {
            plannedProperties: planned,
            completedProperties: completed,
            coveragePercentage: coverage,
            closedCount: closed,
            refusalCount: refusals,
            chemicalUsedCount: (apps || []).length,
          },
        });
      }

      return operations;
    } catch (err) {
      console.error('Erro ao listar operações de controle vetorial:', err);
      return [];
    }
  },

  // 2. Criar Operação
  async createOperation(payload: {
    type: VectorControlOperation['type'];
    disease: string;
    neighborhoodId?: string;
    radiusMeters: number;
    startDate?: string;
    notes?: string;
    caseId?: string;
    municipalityId?: string;
  }): Promise<VectorControlOperation | null> {
    try {
      const munId = payload.municipalityId || DEFAULT_MUN_ID;

      const { data, error } = await supabase
        .from('vector_control_operations')
        .insert({
          municipality_id: munId,
          type: payload.type,
          disease: payload.disease,
          neighborhood_id: payload.neighborhoodId || null,
          radius_meters: payload.radiusMeters,
          start_date: payload.startDate || new Date().toISOString().split('T')[0],
          status: 'EM_ANDAMENTO',
          notes: payload.notes || null,
          case_id: payload.caseId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar auditoria
      await supabase.from('audit_logs').insert({
        municipality_id: munId,
        action: 'VECTOR_OPERATION_START',
        module: 'controle_vetorial',
        entity: 'vector_control_operations',
        entity_id: data.id,
        new_data: {
          type: payload.type,
          disease: payload.disease,
          radius_meters: payload.radiusMeters,
          case_id: payload.caseId,
        },
      });

      return data;
    } catch (err) {
      console.error('Erro ao criar operação de controle vetorial:', err);
      return null;
    }
  },

  // 3. Criar Operação de Bloqueio Direto a Partir de Caso Epidemiológico
  async createBlockadeFromCase(caseItem: {
    id: string;
    disease: string;
    notification_number: string;
    neighborhood_id?: string;
    municipality_id?: string;
  }): Promise<{ success: boolean; message: string; operation?: VectorControlOperation }> {
    try {
      const munId = caseItem.municipality_id || DEFAULT_MUN_ID;

      const op = await vectorControlService.createOperation({
        type: 'bloqueio',
        disease: caseItem.disease || 'DENGUE',
        neighborhoodId: caseItem.neighborhood_id,
        radiusMeters: 150,
        caseId: caseItem.id,
        notes: `Bloqueio de transmissão viral disparado automaticamente a partir da Notificação Sinan nº ${caseItem.notification_number}. Raio focal de 150m peridomiciliar.`,
        municipalityId: munId,
      });

      if (!op) throw new Error('Não foi possível registrar a operação de bloqueio no banco.');

      // Atualizar status do caso epidemiológico para EM_INVESTIGACAO
      await supabase
        .from('epidemiological_cases')
        .update({ status: 'EM_INVESTIGACAO', updated_at: new Date().toISOString() })
        .eq('id', caseItem.id);

      return {
        success: true,
        message: `Operação de Bloqueio para a notificação ${caseItem.notification_number} disparada com sucesso!`,
        operation: op,
      };
    } catch (err: any) {
      console.error('Erro ao disparar bloqueio a partir do caso:', err);
      return { success: false, message: err.message || 'Falha ao disparar bloqueio.' };
    }
  },

  // 4. Registrar Aplicação Química com Baixa no Estoque FEFO
  async registerChemicalApplication(payload: {
    operationId: string;
    propertyId?: string;
    agentId?: string;
    productId: string;
    applicationType: ChemicalApplication['application_type'];
    quantity: number;
    unit: string;
    notes?: string;
    municipalityId?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const munId = payload.municipalityId || DEFAULT_MUN_ID;

      // 1. Dar saída no estoque pelo critério FEFO
      const stockRes = await stockService.dispatchProductFEFO({
        productId: payload.productId,
        quantity: payload.quantity,
        movementType: 'saida',
        operationId: payload.operationId,
        agentId: payload.agentId,
        notes: `Aplicação química (${payload.applicationType}) em operação de controle vetorial`,
        municipalityId: munId,
      });

      if (!stockRes.success) {
        return { success: false, message: stockRes.message };
      }

      // 2. Localizar lote utilizado
      const batchUsed = stockRes.batchesUsed?.[0]?.batchNumber || 'LOTE-DEFAULT';
      const { data: batchData } = await supabase
        .from('product_batches')
        .select('id')
        .eq('batch_number', batchUsed)
        .maybeSingle();

      // 3. Registrar aplicação química
      const { error: appErr } = await supabase
        .from('chemical_applications')
        .insert({
          operation_id: payload.operationId,
          property_id: payload.propertyId || null,
          agent_id: payload.agentId || null,
          product_id: payload.productId,
          batch_id: batchData?.id || '00000000-0000-0000-0000-000000000001',
          application_type: payload.applicationType,
          quantity: payload.quantity,
          unit: payload.unit,
          application_date: new Date().toISOString().split('T')[0],
          notes: payload.notes || null,
        });

      if (appErr) throw appErr;

      return {
        success: true,
        message: `Aplicação de ${payload.quantity} ${payload.unit} registrada e baixada do estoque com sucesso (Lote: ${batchUsed})!`,
      };
    } catch (err: any) {
      console.error('Erro ao registrar aplicação química:', err);
      return { success: false, message: err.message || 'Falha ao registrar aplicação química.' };
    }
  },

  // 5. Encerrar Operação
  async finishOperation(operationId: string, municipalityId = DEFAULT_MUN_ID): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('vector_control_operations')
        .update({
          status: 'CONCLUIDA',
          end_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', operationId);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        municipality_id: municipalityId,
        action: 'VECTOR_OPERATION_FINISH',
        module: 'controle_vetorial',
        entity: 'vector_control_operations',
        entity_id: operationId,
        new_data: { status: 'CONCLUIDA', finished_at: new Date().toISOString() },
      });

      return true;
    } catch (err) {
      console.error('Erro ao encerrar operação:', err);
      return false;
    }
  },
};
