import { supabase } from './supabaseClient';

export interface RiskFactor {
  name: string;
  category: string;
  points: number;
  weight: number;
  description: string;
}

export interface RiskCalculationResult {
  score: number; // 0 a 100
  level: 'BAIXO' | 'ATENCAO' | 'ALTO' | 'CRITICO';
  color: string;
  factors: RiskFactor[];
  summary: string;
  calculatedAt: string;
}

export interface RiskSettings {
  weightRecentFoci: number;
  weightRecurrence: number;
  weightEpidemiologicalCases: number;
  weightOvitraps: number;
  weightEggDensity: number;
  weightComplaints: number;
  weightClosedProperties: number;
  weightRefusals: number;
  weightLowCoverage: number;
  weightOverduePe: number;
  weightDaysWithoutVisit: number;
}

export const riskEngineService = {
  /**
   * Buscar pesos vigentes na tabela risk_settings
   */
  async getSettings(municipalityId = '00000000-0000-0000-0000-000000000001'): Promise<RiskSettings> {
    try {
      const { data, error } = await supabase
        .from('risk_settings')
        .select('*')
        .eq('municipality_id', municipalityId)
        .maybeSingle();

      if (error || !data) {
        // Valores default caso não configurado
        return {
          weightRecentFoci: 25,
          weightRecurrence: 20,
          weightEpidemiologicalCases: 15,
          weightOvitraps: 10,
          weightEggDensity: 5,
          weightComplaints: 5,
          weightClosedProperties: 5,
          weightRefusals: 5,
          weightLowCoverage: 5,
          weightOverduePe: 5,
          weightDaysWithoutVisit: 5,
        };
      }

      return {
        weightRecentFoci: Number(data.weight_recent_foci) || 25,
        weightRecurrence: Number(data.weight_recurrence) || 20,
        weightEpidemiologicalCases: Number(data.weight_epidemiological_cases) || 15,
        weightOvitraps: Number(data.weight_ovitraps) || 10,
        weightEggDensity: Number(data.weight_egg_density) || 5,
        weightComplaints: Number(data.weight_complaints) || 5,
        weightClosedProperties: Number(data.weight_closed_properties) || 5,
        weightRefusals: Number(data.weight_refusals) || 5,
        weightLowCoverage: Number(data.weight_low_coverage) || 5,
        weightOverduePe: Number(data.weight_overdue_pe) || 5,
        weightDaysWithoutVisit: Number(data.weight_days_without_visit) || 5,
      };
    } catch {
      return {
        weightRecentFoci: 25,
        weightRecurrence: 20,
        weightEpidemiologicalCases: 15,
        weightOvitraps: 10,
        weightEggDensity: 5,
        weightComplaints: 5,
        weightClosedProperties: 5,
        weightRefusals: 5,
        weightLowCoverage: 5,
        weightOverduePe: 5,
        weightDaysWithoutVisit: 5,
      };
    }
  },

  /**
   * Atualizar pesos configuráveis no banco
   */
  async updateSettings(municipalityId: string, settings: Partial<RiskSettings>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('risk_settings')
        .upsert({
          municipality_id: municipalityId,
          weight_recent_foci: settings.weightRecentFoci,
          weight_recurrence: settings.weightRecurrence,
          weight_epidemiological_cases: settings.weightEpidemiologicalCases,
          weight_ovitraps: settings.weightOvitraps,
          weight_egg_density: settings.weightEggDensity,
          weight_complaints: settings.weightComplaints,
          weight_closed_properties: settings.weightClosedProperties,
          weight_refusals: settings.weightRefusals,
          weight_low_coverage: settings.weightLowCoverage,
          weight_overdue_pe: settings.weightOverduePe,
          weight_days_without_visit: settings.weightDaysWithoutVisit,
          updated_at: new Date().toISOString(),
        });

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Calcular Motor de Risco Territorial (Bairro, Setor ou Imóvel)
   */
  calculateScore(params: {
    settings: RiskSettings;
    recentFociCount: number;
    recurrentCount: number;
    epidemiologicalCasesCount: number;
    positiveOvitrapsCount: number;
    eggDensityAverage: number;
    openComplaintsCount: number;
    closedPropertiesCount: number;
    refusalsCount: number;
    coveragePercentage: number;
    overduePeCount: number;
    daysSinceLastVisit: number;
  }): RiskCalculationResult {
    const { settings } = params;
    const factors: RiskFactor[] = [];
    let totalScore = 0;

    // 1. Focos Recentes (Aedes aegypti)
    if (params.recentFociCount > 0) {
      const impact = Math.min(100, params.recentFociCount * 25);
      const points = Math.round((impact * settings.weightRecentFoci) / 100);
      totalScore += points;
      factors.push({
        name: 'Focos de Vetores Ativos',
        category: 'ENTOMOLOGICO',
        points,
        weight: settings.weightRecentFoci,
        description: `${params.recentFociCount} foco(s) de Aedes aegypti ativo(s) detectado(s) na localidade.`,
      });
    }

    // 2. Reincidência de Focos (≥3 focos)
    if (params.recurrentCount > 0) {
      const impact = Math.min(100, params.recurrentCount * 35);
      const points = Math.round((impact * settings.weightRecurrence) / 100);
      totalScore += points;
      factors.push({
        name: 'Reincidência Crônica',
        category: 'ENTOMOLOGICO',
        points,
        weight: settings.weightRecurrence,
        description: `${params.recurrentCount} imóvel(is) com focos reincidentes nos últimos 90 dias.`,
      });
    }

    // 3. Casos Epidemiológicos Notificados (Dengue, Zika, Chikungunya)
    if (params.epidemiologicalCasesCount > 0) {
      const impact = Math.min(100, params.epidemiologicalCasesCount * 40);
      const points = Math.round((impact * settings.weightEpidemiologicalCases) / 100);
      totalScore += points;
      factors.push({
        name: 'Transmissão Viral / Casos Notificados',
        category: 'EPIDEMIOLOGICO',
        points,
        weight: settings.weightEpidemiologicalCases,
        description: `${params.epidemiologicalCasesCount} caso(s) de arbovirose notificado(s) exigindo bloqueio peridomiciliar.`,
      });
    }

    // 4. Ovitrampas Positivas
    if (params.positiveOvitrapsCount > 0) {
      const impact = Math.min(100, params.positiveOvitrapsCount * 30);
      const points = Math.round((impact * settings.weightOvitraps) / 100);
      totalScore += points;
      factors.push({
        name: 'Dispersão de Fêmeas Gravídicas (Ovitrampas)',
        category: 'ENTOMOLOGICO',
        points,
        weight: settings.weightOvitraps,
        description: `${params.positiveOvitrapsCount} armadilha(s) sentinela com presença de ovos no setor.`,
      });
    }

    // 5. Densidade de Ovos (IDO)
    if (params.eggDensityAverage > 50) {
      const impact = Math.min(100, Math.round((params.eggDensityAverage / 150) * 100));
      const points = Math.round((impact * settings.weightEggDensity) / 100);
      totalScore += points;
      factors.push({
        name: 'Alta Densidade de Ovos (IDO)',
        category: 'ENTOMOLOGICO',
        points,
        weight: settings.weightEggDensity,
        description: `Média de ${Math.round(params.eggDensityAverage)} ovos por armadilha positiva indicando infestação massiva.`,
      });
    }

    // 6. Denúncias da Comunidade
    if (params.openComplaintsCount > 0) {
      const impact = Math.min(100, params.openComplaintsCount * 20);
      const points = Math.round((impact * settings.weightComplaints) / 100);
      totalScore += points;
      factors.push({
        name: 'Denúncias de Possíveis Criadouros',
        category: 'COMUNITARIO',
        points,
        weight: settings.weightComplaints,
        description: `${params.openComplaintsCount} chamado(s) comunitário(s) aguardando inspeção do ACE.`,
      });
    }

    // 7. Imóveis Fechados (Ausência de Moradores)
    if (params.closedPropertiesCount > 5) {
      const impact = Math.min(100, params.closedPropertiesCount * 5);
      const points = Math.round((impact * settings.weightClosedProperties) / 100);
      totalScore += points;
      factors.push({
        name: 'Imóveis Fechados / Não Inspecionados',
        category: 'OPERACIONAL',
        points,
        weight: settings.weightClosedProperties,
        description: `${params.closedPropertiesCount} imóveis fechados impedindo verificação sanitária.`,
      });
    }

    // 8. Recusas de Visita
    if (params.refusalsCount > 0) {
      const impact = Math.min(100, params.refusalsCount * 25);
      const points = Math.round((impact * settings.weightRefusals) / 100);
      totalScore += points;
      factors.push({
        name: 'Recusas Formais de Vistoria',
        category: 'OPERACIONAL',
        points,
        weight: settings.weightRefusals,
        description: `${params.refusalsCount} morador(es) recusaram acesso sanitário do ACE.`,
      });
    }

    // 9. Cobertura Baixa do Ciclo (< 80%)
    if (params.coveragePercentage < 80) {
      const defict = 80 - params.coveragePercentage;
      const impact = Math.min(100, defict * 2.5);
      const points = Math.round((impact * settings.weightLowCoverage) / 100);
      totalScore += points;
      factors.push({
        name: 'Déficit de Cobertura Territorial',
        category: 'OPERACIONAL',
        points,
        weight: settings.weightLowCoverage,
        description: `Cobertura operacional em ${Math.round(params.coveragePercentage)}% (abaixo da meta SUS de 80%).`,
      });
    }

    // 10. Pontos Estratégicos com Inspeção Vencida (> 15 dias)
    if (params.overduePeCount > 0) {
      const impact = Math.min(100, params.overduePeCount * 40);
      const points = Math.round((impact * settings.weightOverduePe) / 100);
      totalScore += points;
      factors.push({
        name: 'Pontos Estratégicos com Vistoria Vencida',
        category: 'OPERACIONAL',
        points,
        weight: settings.weightOverduePe,
        description: `${params.overduePeCount} ponto(s) estratégico(s) (borracharias/ferros-velhos) sem vistoria quinzenal.`,
      });
    }

    // 11. Tempo sem Visita (> 60 dias)
    if (params.daysSinceLastVisit > 60) {
      const impact = Math.min(100, Math.round(((params.daysSinceLastVisit - 60) / 60) * 100));
      const points = Math.round((impact * settings.weightDaysWithoutVisit) / 100);
      totalScore += points;
      factors.push({
        name: 'Intervalo Excessivo sem Inspeção',
        category: 'TEMPORAL',
        points,
        weight: settings.weightDaysWithoutVisit,
        description: `${params.daysSinceLastVisit} dias sem vistoria sanitária registrada.`,
      });
    }

    // Normalização 0 a 100
    const finalScore = Math.min(100, Math.max(0, totalScore));

    // Classificação oficial:
    // 0–24 BAIXO
    // 25–49 ATENÇÃO
    // 50–74 ALTO
    // 75–100 CRÍTICO
    let level: 'BAIXO' | 'ATENCAO' | 'ALTO' | 'CRITICO' = 'BAIXO';
    let color = '#10b981'; // green

    if (finalScore >= 75) {
      level = 'CRITICO';
      color = '#ef4444'; // red
    } else if (finalScore >= 50) {
      level = 'ALTO';
      color = '#f97316'; // orange
    } else if (finalScore >= 25) {
      level = 'ATENCAO';
      color = '#f59e0b'; // amber
    }

    // Resumo explicativo gerado para o gestor
    const topFactors = factors.slice(0, 3).map(f => `${f.name} (+${f.points} pts)`).join(', ');
    const summary = factors.length === 0
      ? 'Território em situação sanitária controlada, sem fatores de risco iminentes.'
      : `Classificado em nível ${level} (${finalScore}/100) devido principalmente a: ${topFactors}.`;

    return {
      score: finalScore,
      level,
      color,
      factors,
      summary,
      calculatedAt: new Date().toISOString(),
    };
  },

  /**
   * Gravar cálculo no histórico
   */
  async saveHistory(params: {
    municipalityId: string;
    entityType: 'PROPERTY' | 'BLOCK' | 'SECTOR' | 'NEIGHBORHOOD' | 'MUNICIPALITY';
    entityId: string;
    entityName: string;
    score: number;
    level: string;
    factors: RiskFactor[];
  }): Promise<void> {
    try {
      await supabase.from('risk_history').insert({
        municipality_id: params.municipalityId,
        entity_type: params.entityType,
        entity_id: params.entityId,
        entity_name: params.entityName,
        risk_score: params.score,
        risk_level: params.level,
        factors: params.factors,
      });
    } catch (err) {
      console.warn('Erro ao salvar histórico de risco:', err);
    }
  },
};
