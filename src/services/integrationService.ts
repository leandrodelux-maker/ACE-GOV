import { supabase } from './supabaseClient';

export type IntegrationProvider =
  | 'esus_aps'
  | 'sinan'
  | 'gal'
  | 'sivep'
  | 'cnes'
  | 'ibge'
  | 'estadual';

export type IntegrationType = 'api_rest' | 'csv_import' | 'xlsx_import' | 'etl_sync';
export type IntegrationStatus = 'ativo' | 'inativo' | 'em_erro';

export interface IntegrationConfigItem {
  id: string;
  municipalityId: string;
  provider: IntegrationProvider;
  name: string;
  description: string;
  integrationType: IntegrationType;
  status: IntegrationStatus;
  lastSync?: string;
  lastSuccess?: string;
  lastError?: string;
  totalRecordsProcessed?: number;
  configuration?: Record<string, any>;
}

export interface IntegrationJobItem {
  id: string;
  municipalityId: string;
  integrationId?: string;
  provider: string;
  startedAt: string;
  finishedAt?: string;
  recordsRead: number;
  recordsCreated: number;
  recordsUpdated: number;
  errors: number;
  status: 'em_andamento' | 'sucesso' | 'erro' | 'parcial';
  logDetails?: Record<string, any>;
}


export const OFFICIAL_PROVIDERS: Array<{
  provider: IntegrationProvider;
  name: string;
  description: string;
  type: IntegrationType;
  officialDocUrl: string;
}> = [
  {
    provider: 'esus_aps',
    name: 'e-SUS APS (Atenção Primária à Saúde)',
    description: 'Integração de microáreas, cadastros domiciliares de ACS e alertas com a atenção básica via Thrift / REST.',
    type: 'api_rest',
    officialDocUrl: 'https://sisaps.saude.gov.br/esus/',
  },
  {
    provider: 'sinan',
    name: 'SINAN (Sistema de Informação de Agravos de Notificação)',
    description: 'Sincronização bidirecional de notificações de Dengue, Chikungunya, Zika e Febre Amarela.',
    type: 'csv_import',
    officialDocUrl: 'https://portalsinan.saude.gov.br/',
  },
  {
    provider: 'gal',
    name: 'GAL (Gerenciador de Ambiente Laboratorial)',
    description: 'Recepção de laudos sorológicos e moleculares (RT-PCR, NS1, IgM) emitidos pelos LACENs.',
    type: 'api_rest',
    officialDocUrl: 'https://gal.saude.gov.br/',
  },
  {
    provider: 'sivep',
    name: 'SIVEP (Vigilância Epidemiológica / Malária)',
    description: 'Módulo de vigilância integrada de vetores e casos de malária e leishmanioses.',
    type: 'api_rest',
    officialDocUrl: 'https://sivep.saude.gov.br/',
  },
  {
    provider: 'cnes',
    name: 'CNES (Cadastro Nacional de Estabelecimentos de Saúde)',
    description: 'Atualização periódica dos estabelecimentos de saúde, hospitais, UBS e pontos estratégicos.',
    type: 'api_rest',
    officialDocUrl: 'https://cnes.datasus.gov.br/',
  },
  {
    provider: 'ibge',
    name: 'IBGE (Malha Censitária e Território)',
    description: 'Importação oficial de setores censitários, contagem populacional e coordenadas de quadras.',
    type: 'api_rest',
    officialDocUrl: 'https://servicodados.ibge.gov.br/api/docs/',
  },
  {
    provider: 'estadual',
    name: 'Sistema de Vigilância Estadual (SES)',
    description: 'Envio consolidado de dados de LIRAa e bloqueios vetoriais para a Secretaria Estadual de Saúde.',
    type: 'etl_sync',
    officialDocUrl: 'https://saude.gov.br/',
  },
];

export const integrationService = {
  /**
   * Buscar integrações configuradas no município
   */
  async getIntegrations(municipalityId: string): Promise<IntegrationConfigItem[]> {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('municipality_id', municipalityId);

      if (error) throw error;

      // Unir catálogo oficial com estado salvo no banco
      return OFFICIAL_PROVIDERS.map(prov => {
        const saved = (data || []).find((d: any) => d.provider === prov.provider);
        return {
          id: saved ? saved.id : `prov-${prov.provider}`,
          municipalityId,
          provider: prov.provider,
          name: prov.name,
          description: prov.description,
          integrationType: saved ? saved.integration_type : prov.type,
          status: saved ? saved.status : 'inativo',
          lastSync: saved?.last_sync,
          lastSuccess: saved?.last_success,
          lastError: saved?.last_error,
          configuration: saved?.configuration,
        };
      });
    } catch (err) {
      console.error('Erro ao buscar integrações:', err);
      return OFFICIAL_PROVIDERS.map(prov => ({
        id: `prov-${prov.provider}`,
        municipalityId,
        provider: prov.provider,
        name: prov.name,
        description: prov.description,
        integrationType: prov.type,
        status: 'inativo',
      }));
    }
  },

  /**
   * Salvar ou alternar status de integração governamental
   */
  async updateIntegrationStatus(
    provider: IntegrationProvider,
    status: IntegrationStatus,
    municipalityId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();
      const { data: existing } = await supabase
        .from('integrations')
        .select('id')
        .eq('municipality_id', municipalityId)
        .eq('provider', provider)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('integrations')
          .update({ status, updated_at: now })
          .eq('id', existing.id);
      } else {
        const provMeta = OFFICIAL_PROVIDERS.find(p => p.provider === provider);
        await supabase.from('integrations').insert({
          municipality_id: municipalityId,
          provider,
          integration_type: provMeta?.type || 'api_rest',
          status,
          configuration: {},
        });
      }

      await supabase.from('audit_logs').insert({
        municipality_id: municipalityId,
        entity_name: 'integrations',
        action: 'ALTERAR_STATUS_INTEGRACAO',
        details: `Integração ${provider} alterada para ${status}.`,
      });

      return { success: true };
    } catch (err: any) {
      console.error('Erro ao atualizar integração:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Executar sincronização com o sistema externo.
   *
   * Nenhum conector externo (e-SUS, SINAN, GAL, SIVEP, CNES, IBGE...) está
   * implementado nesta aplicação: não há cliente HTTP, credenciais nem contrato
   * de API configurados. A versão anterior SIMULAVA a execução (contagens
   * aleatórias gravadas como "sucesso"); agora a operação é recusada sem gravar
   * nada, para não registrar sincronizações que não aconteceram.
   */
  async runIntegrationJob(
    provider: IntegrationProvider,
    municipalityId: string
  ): Promise<{ success: boolean; job?: IntegrationJobItem; error?: string }> {
    void municipalityId;
    return {
      success: false,
      error: `Integração com ${provider} indisponível: o conector não está implementado neste ambiente. Nenhum dado foi sincronizado. Use Administração > Importação de Dados para cargas por arquivo (CSV).`,
    };
  },

  /**
   * Buscar histórico de jobs de sincronização
   */
  async getIntegrationJobs(municipalityId: string): Promise<IntegrationJobItem[]> {
    try {
      const { data, error } = await supabase
        .from('integration_jobs')
        .select('*')
        .eq('municipality_id', municipalityId)
        .order('started_at', { ascending: false })
        .limit(30);

      if (error || !data) return [];

      return data.map((d: any) => ({
        id: d.id,
        municipalityId: d.municipality_id,
        integrationId: d.integration_id,
        provider: d.provider,
        startedAt: d.started_at,
        finishedAt: d.finished_at,
        recordsRead: d.records_read,
        recordsCreated: d.records_created,
        recordsUpdated: d.records_updated,
        errors: d.errors,
        status: d.status,
        logDetails: d.log_details,
      }));
    } catch {
      return [];
    }
  },
};
