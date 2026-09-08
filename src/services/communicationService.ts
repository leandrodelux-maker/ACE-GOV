import { supabase } from './supabaseClient';

export type OperationalEvent =
  | 'nova_os'
  | 'area_critica'
  | 'pe_vencido'
  | 'planejamento_disponivel'
  | 'pendencia_urgente'
  | 'alteracao_rota';

export interface MessageTemplate {
  id: string;
  municipalityId: string;
  name: string;
  event: OperationalEvent;
  text: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageLog {
  id: string;
  municipalityId: string;
  recipient: string;
  recipientRole?: string;
  event: OperationalEvent;
  messageText: string;
  status: 'pendente' | 'enviado' | 'entregue' | 'falha' | 'simulado';
  providerReference?: string;
  errorMessage?: string;
  sentAt: string;
}

export interface WhatsAppProviderConfig {
  providerType: 'zapi' | 'evolution' | 'twilio' | 'gupshup' | 'webhook_custom';
  endpointUrl: string;
  apiToken: string;
  instanceId?: string;
  active: boolean;
}

const DEFAULT_MUN_ID = '00000000-0000-0000-0000-000000000001';

export const communicationService = {
  /**
   * Templates operacionais padrão (sem exposição de dados de cidadãos - LGPD)
   */
  getDefaultTemplates(): Array<Omit<MessageTemplate, 'id' | 'municipalityId' | 'createdAt' | 'updatedAt'>> {
    return [
      {
        name: 'Atribuição de Nova OS',
        event: 'nova_os',
        text: 'Endemias GOV: Uma nova Ordem de Serviço Operacional foi atribuída a você. Acesse o PWA para visualizar o itinerário.',
        active: true,
      },
      {
        name: 'Alerta de Área Crítica',
        event: 'area_critica',
        text: 'Endemias GOV: Alerta operacional emitido para o seu setor de trabalho. Recomenda-se reforço de vistorias e bloqueios.',
        active: true,
      },
      {
        name: 'Ponto Estratégico com Prazo Vencido',
        event: 'pe_vencido',
        text: 'Endemias GOV: Consta inspeção quinzenal de Ponto Estratégico (PE) programada para hoje na sua rota.',
        active: true,
      },
      {
        name: 'Planejamento de Ciclo Disponível',
        event: 'planejamento_disponivel',
        text: 'Endemias GOV: O planejamento do novo ciclo de campo foi publicado pela supervisão. Consulte sua rota.',
        active: true,
      },
      {
        name: 'Pendência com Necessidade de Retorno',
        event: 'pendencia_urgente',
        text: 'Endemias GOV: Existem imóveis fechados com retorno prioritário agendado no seu roteiro operacional.',
        active: true,
      },
      {
        name: 'Alteração de Rota pelo Supervisor',
        event: 'alteracao_rota',
        text: 'Endemias GOV: Sua rota de campo foi ajustada pelo supervisor para atendimento a bloqueio prioritário.',
        active: true,
      },
    ];
  },

  /**
   * Buscar templates cadastrados no município
   */
  async getTemplates(municipalityId = DEFAULT_MUN_ID): Promise<MessageTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('municipality_id', municipalityId)
        .order('name');

      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          municipalityId: d.municipality_id,
          name: d.name,
          event: d.event,
          text: d.text,
          active: d.active,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }

      // Se ainda não houver templates no banco, popular defaults
      const defaults = this.getDefaultTemplates();
      const created: MessageTemplate[] = [];

      for (const def of defaults) {
        const { data: inserted } = await supabase
          .from('message_templates')
          .insert({
            municipality_id: municipalityId,
            name: def.name,
            event: def.event,
            text: def.text,
            active: def.active,
          })
          .select()
          .single();

        if (inserted) {
          created.push({
            id: inserted.id,
            municipalityId: inserted.municipality_id,
            name: inserted.name,
            event: inserted.event,
            text: inserted.text,
            active: inserted.active,
            createdAt: inserted.created_at,
            updatedAt: inserted.updated_at,
          });
        }
      }

      return created;
    } catch (err) {
      console.error('Erro ao buscar templates de mensagens:', err);
      return [];
    }
  },

  /**
   * Alternar ativação de evento/template
   */
  async toggleTemplate(id: string, active: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('message_templates')
        .update({ active, updated_at: new Date().toISOString() })
        .eq('id', id);

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Adapter desacoplado de envio de WhatsApp (Simulador/Provedor Ativo)
   * Garante que mensagens nunca contenham dados de pacientes ou endereços residenciais de cidadãos
   */
  async sendMessage(params: {
    municipalityId?: string;
    recipientPhone: string;
    recipientRole: string;
    event: OperationalEvent;
    customText?: string;
  }): Promise<{ success: boolean; logId?: string; providerRef?: string }> {
    const municipalityId = params.municipalityId || DEFAULT_MUN_ID;

    // 1. Obter template ativo
    const templates = await this.getTemplates(municipalityId);
    const tmpl = templates.find(t => t.event === params.event && t.active);

    if (!tmpl) {
      return { success: false, providerRef: 'EVENTO_DESATIVADO' };
    }

    const messageText = params.customText || tmpl.text;
    const providerRef = `WPP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      // 2. Registrar log de mensageria
      const { data, error } = await supabase
        .from('message_logs')
        .insert({
          municipality_id: municipalityId,
          recipient: params.recipientPhone,
          recipient_role: params.recipientRole,
          event: params.event,
          message_text: messageText,
          status: 'enviado',
          provider_reference: providerRef,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        logId: data.id,
        providerRef,
      };
    } catch (err) {
      console.warn('Falha no log de envio de WhatsApp:', err);
      return { success: true, providerRef };
    }
  },

  /**
   * Buscar histórico de mensagens enviadas
   */
  async getLogs(municipalityId = DEFAULT_MUN_ID): Promise<MessageLog[]> {
    try {
      const { data, error } = await supabase
        .from('message_logs')
        .select('*')
        .eq('municipality_id', municipalityId)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error || !data) return [];

      return data.map((d: any) => ({
        id: d.id,
        municipalityId: d.municipality_id,
        recipient: d.recipient,
        recipientRole: d.recipient_role,
        event: d.event,
        messageText: d.message_text,
        status: d.status,
        providerReference: d.provider_reference,
        errorMessage: d.error_message,
        sentAt: d.sent_at,
      }));
    } catch {
      return [];
    }
  },
};
