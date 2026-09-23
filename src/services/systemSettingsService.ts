import { supabase } from './supabaseClient';
import { db } from './storage';
import { MissingMunicipalityError } from './municipalityScope';

export interface SystemSettingsCategory {
  category: string;
  settings: Record<string, any>;
}

export const DEFAULT_SETTINGS: Record<string, Record<string, any>> = {
  GERAL: {
    municipalityName: 'Santa Cruz do Sul',
    ibgeCode: '4316808',
    stateUf: 'RS',
    healthSecretaryName: 'Secretaria Municipal de Saúde',
    cnesCode: '2234567',
    contactEmail: 'vigilancia.endemias@santacruz.rs.gov.br',
    contactPhone: '(51) 3715-9500',
    logoUrl: '',
    showCoatOfArms: true,
  },
  TERRITORIO: {
    maxPropertiesPerBlock: 35,
    autoNumberQuarters: true,
    requireCoordinatesForProperties: true,
  },
  CICLOS: {
    standardCoverageTarget: 85,
    cyclesPerYear: 6,
    cycleDurationWeeks: 8,
  },
  LIRAA: {
    lowRiskThreshold: 1.0,
    mediumRiskThreshold: 3.9,
    sampleSizePercentage: 20,
    minStratumProperties: 9000,
  },
  RISCO: {
    fociWeight: 35,
    densityWeight: 25,
    sinanWeight: 20,
    recurrenceWeight: 10,
    strategicPointsWeight: 10,
  },
  ALERTAS: {
    criticalBreedingSitesThreshold: 3,
    delayedBlockadeHoursThreshold: 48,
    lowStockDaysThreshold: 15,
    strategicPointOverdueDays: 14,
  },
  ESTOQUE: {
    minimumSafetyStockBatches: 2,
    productExpiryAlertDays: 45,
  },
  PWA: {
    syncIntervalMinutes: 15,
    maxOfflinePropertiesDownload: 500,
    minGpsAccuracyMeters: 25,
  },
  MAPA: {
    defaultLayer: 'RISK_HEATMAP',
    defaultZoom: 13,
    centerLatitude: -29.718,
    centerLongitude: -52.428,
  },
  RELATORIOS: {
    institutionalFooter: 'Sistema Oficial de Vigilância Entomológica e Controle Vetorial - Endemias GOV / SUS',
    defaultTechnicalLead: 'Coordenação Municipal de Vigilância em Saúde',
  },
  INTEGRACOES: {
    sinanIntegrationEnabled: true,
    esusSyncEnabled: true,
    webhookUrl: '',
  },
  SISTEMA: {
    maintenanceMode: false,
    auditRetentionMonths: 24,
    automaticDailyBackup: true,
  },
};

export const systemSettingsService = {
  /**
   * Identifica o municipality_id efetivo:
   * Prioridade: parâmetro fornecido > município do perfil da sessão autenticada.
   * Sem nenhum dos dois, a operação é bloqueada (nunca usa outro município).
   */
  async getEffectiveMunicipalityId(providedId?: string): Promise<string> {
    if (providedId) {
      return providedId;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('municipality_id')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();

        if (profile?.municipality_id) {
          return profile.municipality_id;
        }
      }

    } catch (e) {
      console.warn('[systemSettingsService] Erro ao resolver município efetivo:', e);
    }
    throw new MissingMunicipalityError();
  },

  // Obter todas as configurações de uma categoria
  async getCategorySettings(category: string, municipalityId?: string): Promise<Record<string, any>> {
    try {
      const targetMunId = await this.getEffectiveMunicipalityId(municipalityId);

      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .eq('municipality_id', targetMunId)
        .eq('category', category);

      if (error) {
        console.warn(`[systemSettingsService] Erro ao consultar configurações no banco (${category}):`, error);
      }

      const defaults = DEFAULT_SETTINGS[category] || {};
      const merged: Record<string, any> = { ...defaults };

      // Se for categoria GERAL, sincroniza com os dados oficiais da tabela municipalities
      if (category === 'GERAL') {
        try {
          const { data: munData } = await supabase
            .from('municipalities')
            .select('name, ibge_code, state, logo_url')
            .eq('id', targetMunId)
            .maybeSingle();

          if (munData) {
            if (munData.name) merged.municipalityName = munData.name;
            if (munData.ibge_code) merged.ibgeCode = munData.ibge_code;
            if (munData.state) merged.stateUf = munData.state;
            if (munData.logo_url) merged.logoUrl = munData.logo_url;
          }
        } catch (mErr) {
          console.warn('[systemSettingsService] Aviso ao carregar dados de municipalities:', mErr);
        }
      }

      if (data && data.length > 0) {
        data.forEach(item => {
          const key = item.setting_key;
          const val = item.setting_value;
          if (key && val !== undefined) {
            merged[key] = val;
          }
        });
      }

      // Snapshot em cache local
      try {
        localStorage.setItem(`endemias_settings_${category}`, JSON.stringify(merged));
      } catch {}

      return merged;
    } catch (err) {
      console.warn(`Fallback para configurações locais (${category}):`, err);
      try {
        const cached = localStorage.getItem(`endemias_settings_${category}`);
        if (cached) {
          return { ...(DEFAULT_SETTINGS[category] || {}), ...JSON.parse(cached) };
        }
      } catch {}
      return DEFAULT_SETTINGS[category] || {};
    }
  },

  // Salvar uma categoria inteira
  async saveCategorySettings(
    category: string,
    settings: Record<string, any>,
    municipalityId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const targetMunId = await this.getEffectiveMunicipalityId(municipalityId);

      // 1. Se for categoria GERAL, atualiza também a tabela oficial de municipalities
      if (category === 'GERAL') {
        try {
          const munUpdates: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (settings.municipalityName) munUpdates.name = String(settings.municipalityName).trim();
          if (settings.ibgeCode) munUpdates.ibge_code = String(settings.ibgeCode).trim();
          if (settings.stateUf) munUpdates.state = String(settings.stateUf).trim().toUpperCase();
          if (settings.logoUrl !== undefined) munUpdates.logo_url = settings.logoUrl;

          const { error: munErr } = await supabase
            .from('municipalities')
            .update(munUpdates)
            .eq('id', targetMunId);

          if (munErr) {
            console.warn('[systemSettingsService] Aviso ao atualizar tabela municipalities:', munErr);
          } else {
            // Atualiza o storage local para propagar para toda a UI imediatamente
            db.updateMunicipality({
              name: settings.municipalityName,
              ibgeCode: settings.ibgeCode,
              state: settings.stateUf,
              healthSecretaryName: settings.healthSecretaryName,
            });
          }
        } catch (mErr) {
          console.warn('[systemSettingsService] Falha ao atualizar entidade municipal:', mErr);
        }
      }

      // 2. Prepara os registros para a tabela system_settings com as colunas corretas do Postgres
      const now = new Date().toISOString();
      const rows = Object.entries(settings).map(([key, value]) => ({
        municipality_id: targetMunId,
        category,
        setting_key: key,
        setting_value: value,
        updated_at: now,
      }));

      // 3. Upsert atômico respeitando a chave única (municipality_id, setting_key)
      const { error: upsertError } = await supabase
        .from('system_settings')
        .upsert(rows, { onConflict: 'municipality_id, setting_key' });

      if (upsertError) {
        console.error(`[systemSettingsService] Erro no upsert de ${category}:`, upsertError);
        throw new Error(upsertError.message || 'Falha ao salvar no PostgreSQL via Supabase.');
      }

      // 4. Salvar em cache local de contingência (PWA / offline-first)
      try {
        localStorage.setItem(`endemias_settings_${category}`, JSON.stringify(settings));
      } catch {}

      // 5. Registra trilha de auditoria
      try {
        db.addAuditLog('EDICAO', 'Configurações do Sistema', `Parâmetros da categoria "${category}" atualizados.`);
      } catch {}

      return { 
        success: true, 
        message: `Configurações de "${category}" salvas e aplicadas com sucesso no banco de dados!` 
      };
    } catch (err: any) {
      console.error(`Erro ao salvar configurações de ${category}:`, err);
      // Salva localmente em caso de emergência para não perder o trabalho do operador
      try {
        localStorage.setItem(`endemias_settings_${category}`, JSON.stringify(settings));
      } catch {}
      return { 
        success: false, 
        message: err.message || 'Falha ao gravar no banco de dados. Verifique a conexão ou permissões.' 
      };
    }
  },
};
