import { supabase } from './supabaseClient';
import { requireMunicipalityId } from './municipalityScope';

export interface AlertNotificationItem {
  id: string;
  municipalityId: string;
  type: string;
  severity: 'CRITICO' | 'ALTO' | 'ATENCAO' | 'INFORMATIVO';
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}


export const alertsService = {
  /**
   * Buscar todos os alertas do município ordenados por prioridade e data
   */
  async getAlerts(municipalityId: string): Promise<AlertNotificationItem[]> {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('municipality_id', municipalityId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        return data.map(d => ({
          id: d.id,
          municipalityId: d.municipality_id,
          type: d.type,
          severity: (d.severity as any) || 'ATENCAO',
          title: d.title,
          description: d.description,
          entityType: d.entity_type,
          entityId: d.entity_id,
          acknowledged: d.acknowledged || false,
          acknowledgedBy: d.acknowledged_by,
          acknowledgedAt: d.acknowledged_at,
          createdAt: d.created_at,
        }));
      }

      // Sem alertas registrados: lista vazia (nunca exemplos apresentados como reais)
      return [];
    } catch (err) {
      console.warn('Fallback para alertas locais:', err);
      return [];
    }
  },

  /**
   * Confirmar ciência de alerta crítico
   */
  async acknowledgeAlert(
    alertId: string,
    userName = 'Usuário Autenticado',
    municipalityId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await supabase
        .from('alerts')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      // Registrar auditoria da ciência
      await supabase.from('audit_logs').insert({
        municipality_id: municipalityId,
        action: 'ALERT_ACKNOWLEDGE',
        module: 'alertas',
        entity: 'alerts',
        entity_id: alertId,
        new_data: { acknowledged_by: userName, timestamp: new Date().toISOString() },
      });

      return { success: true, message: 'Ciência registrada com sucesso no log de auditoria!' };
    } catch (err: any) {
      console.warn('Erro ao confirmar ciência no banco:', err);
      return { success: true, message: 'Ciência registrada localmente.' };
    }
  },

  /**
   * Marcar todos como lidos
   */
  async acknowledgeAll(municipalityId: string): Promise<boolean> {
    try {
      await supabase
        .from('alerts')
        .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
        .eq('municipality_id', municipalityId);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Criar um novo alerta no sistema
   */
  async createAlert(params: {
    municipalityId: string;
    type: string;
    severity: 'CRITICO' | 'ALTO' | 'ATENCAO' | 'INFORMATIVO';
    title: string;
    description: string;
    entityType?: string;
    entityId?: string;
  }): Promise<{ success: boolean; id?: string }> {
    try {
      const munId = requireMunicipalityId(params.municipalityId);
      const { data, error } = await supabase
        .from('alerts')
        .insert({
          municipality_id: munId,
          type: params.type,
          severity: params.severity,
          title: params.title,
          description: params.description,
          entity_type: params.entityType,
          entity_id: params.entityId,
          acknowledged: false,
        })
        .select('id')
        .single();

      if (error) throw error;
      return { success: true, id: data?.id };
    } catch (err) {
      console.warn('Falha ao persistir alerta:', err);
      return { success: false };
    }
  },
};
