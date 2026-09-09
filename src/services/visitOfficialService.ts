import { supabase } from './supabaseClient';

export interface OfficialDepositInput {
  deposit_type: 'A1' | 'A2' | 'B' | 'C' | 'D1' | 'D2' | 'E' | string;
  quantity: number;
  has_water: boolean;
  inspected: boolean;
  positive: boolean;
  larvae_found: boolean;
  eliminated: boolean;
  treated: boolean;
  treatment_product?: string;
  batch_id?: string;
  product_quantity?: number;
  sample_collected?: boolean;
  sample_code?: string;
  notes?: string;
}

export interface OfficialActionInput {
  action_type:
    | 'eliminacao_mecanica'
    | 'orientacao_morador'
    | 'tratamento'
    | 'coleta_amostra'
    | 'retorno_necessario'
    | 'encaminhamento_supervisor'
    | 'outras';
  quantity: number;
  notes?: string;
}

export interface OfficialVisitPayload {
  id?: string; // UUID gerado pelo cliente para idempotência
  municipality_id?: string;
  cycle_id?: string;
  property_id: string;
  agent_id: string;
  team_id?: string;
  visit_date?: string; // YYYY-MM-DD
  started_at: string; // ISO String
  finished_at: string; // ISO String
  visit_type: 'rotina' | 'delimitacao_foco' | 'ponto_estrategico' | 'pesquisa_vetorial' | 'bloqueio' | 'liraa' | string;
  result:
    | 'trabalhado'
    | 'fechado'
    | 'recusa'
    | 'desocupado'
    | 'terreno_baldio'
    | 'demolido'
    | 'nao_localizado'
    | 'outro';
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy?: number | null;
  residents_present: boolean;
  notes?: string;
  offline_created?: boolean;
  deposits: OfficialDepositInput[];
  actions: OfficialActionInput[];
  pendency_info?: {
    next_return_date?: string;
    notes?: string;
  };
}

// Depósitos padrão conforme Ministério da Saúde
export const DEPOSIT_CATEGORIES = [
  { code: 'A1', label: 'A1 - Caixa d’água elevada / cisterna superior', desc: 'Reservatório elevado de abastecimento de água potável' },
  { code: 'A2', label: 'A2 - Depósito no nível do solo / poço / tambor', desc: 'Armazenamento doméstico de água a nível do chão' },
  { code: 'B', label: 'B - Vasos, pratos, pingadeiras, bebedouros', desc: 'Pequenos recipientes móveis de uso doméstico' },
  { code: 'C', label: 'C - Depósitos fixos (calhas, lajes, ralos)', desc: 'Estruturas prediais fixas com retenção de água pluvial' },
  { code: 'D1', label: 'D1 - Pneus e outros materiais rodantes', desc: 'Pneumáticos em borracharias, quintais ou oficinas' },
  { code: 'D2', label: 'D2 - Lixo, entulhos, latas e garrafas descartáveis', desc: 'Resíduos sólidos inservíveis a céu aberto' },
  { code: 'E', label: 'E - Criadouros naturais (ocos de árvore, bromélias)', desc: 'Vegetação ou cavidades naturais com acúmulo de água' },
];

export const CONDUCT_OPTIONS = [
  { value: 'eliminacao_mecanica', label: 'Eliminação mecânica do criadouro' },
  { value: 'orientacao_morador', label: 'Orientação educativa ao morador' },
  { value: 'tratamento', label: 'Aplicação de larvicida / químico' },
  { value: 'coleta_amostra', label: 'Coleta de larvas / ninfas para laboratório' },
  { value: 'retorno_necessario', label: 'Agendamento de retorno (pendência)' },
  { value: 'encaminhamento_supervisor', label: 'Encaminhamento ao Supervisor de Área' },
  { value: 'outras', label: 'Outras ações complementares' },
];

export const visitOfficialService = {
  // 1. Enviar Ficha Oficial da Visita com Garantia Transacional (RPC)
  async submitOfficialVisit(payload: OfficialVisitPayload): Promise<{ success: boolean; visit_id?: string; duplicated?: boolean; message: string }> {
    try {
      // Gerar UUID de idempotência se não existir
      const clientGeneratedId = payload.id || crypto.randomUUID();

      const rpcPayload = {
        ...payload,
        id: clientGeneratedId,
      };

      const { data, error } = await supabase.rpc('submit_official_visit', {
        payload: rpcPayload,
      });

      if (error) throw error;

      return {
        success: data?.success ?? true,
        visit_id: data?.visit_id || clientGeneratedId,
        duplicated: data?.duplicated ?? false,
        message: data?.message || 'Visita oficial registrada com sucesso!',
      };
    } catch (err: any) {
      console.error('Erro na submissão da ficha oficial da visita:', err);
      return {
        success: false,
        message: err.message || 'Falha ao registrar visita oficial.',
      };
    }
  },

  // 2. Carregar Depósitos e Condutas de uma Visita Realizada
  async getVisitDetails(visitId: string) {
    try {
      const [depositsRes, actionsRes] = await Promise.all([
        supabase.from('visit_deposits').select('*').eq('visit_id', visitId),
        supabase.from('visit_actions').select('*').eq('visit_id', visitId),
      ]);

      return {
        deposits: depositsRes.data || [],
        actions: actionsRes.data || [],
      };
    } catch (err) {
      console.error('Erro ao buscar detalhes da visita:', err);
      return { deposits: [], actions: [] };
    }
  },
};
