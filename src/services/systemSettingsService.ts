import { supabase } from './supabaseClient';

export interface SystemSettingsCategory {
  category: string;
  settings: Record<string, any>;
}

const DEFAULT_MUN_ID = '00000000-0000-0000-0000-000000000001';

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
  // Obter todas as configurações de uma categoria
  async getCategorySettings(category: string, municipalityId = DEFAULT_MUN_ID): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('municipality_id', municipalityId)
        .eq('category', category);

      if (error) throw error;

      const defaults = DEFAULT_SETTINGS[category] || {};
      if (!data || data.length === 0) {
        return defaults;
      }

      const merged = { ...defaults };
      data.forEach(item => {
        const key = item.key || item.setting_key;
        const val = item.value !== undefined ? item.value : item.setting_value;
        if (key && val !== undefined) {
          merged[key] = val;
        }
      });
      return merged;
    } catch (err) {
      console.warn(`Fallback para configurações locais (${category}):`, err);
      return DEFAULT_SETTINGS[category] || {};
    }
  },

  // Salvar uma categoria inteira
  async saveCategorySettings(
    category: string,
    settings: Record<string, any>,
    municipalityId = DEFAULT_MUN_ID
  ): Promise<{ success: boolean; message: string }> {
    try {
      const entries = Object.entries(settings);
      for (const [key, value] of entries) {
        // Tenta buscar se já existe
        const { data: existing } = await supabase
          .from('system_settings')
          .select('id')
          .eq('municipality_id', municipalityId)
          .eq('category', category)
          .eq('key', key)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('system_settings')
            .update({
              value,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('system_settings').insert({
            municipality_id: municipalityId,
            category,
            key,
            value,
          });
        }
      }

      // Salvar em cache local de contingência
      localStorage.setItem(`endemias_settings_${category}`, JSON.stringify(settings));

      return { success: true, message: `Configurações de ${category} salvas com sucesso!` };
    } catch (err: any) {
      console.error(`Erro ao salvar configurações de ${category}:`, err);
      return { success: false, message: err.message || 'Falha ao gravar no banco.' };
    }
  },
};
