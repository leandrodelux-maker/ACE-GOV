import { supabase } from './supabaseClient';
import { weatherService, ClimateSummary } from './weatherService';

export interface DetectedAnomaly {
  id: string;
  territoryName: string;
  type: 'focos_pico' | 'ovitrampas_elevacao' | 'casos_cluster' | 'cobertura_queda';
  severity: 'critico' | 'alto' | 'moderado';
  headline: string;
  evidence: string;
  confidenceScore: number; // 0 a 100%
  recommendedIntervention: string;
}

export interface TerritoryRiskEstimation {
  neighborhoodId: string;
  neighborhoodName: string;
  estimatedRiskLevel: 'baixo' | 'moderado' | 'elevado' | 'muito_elevado';
  riskLabel: string;
  probabilitySignal: 'estavel' | 'sinal_elevacao' | 'tendencia_reducao';
  signalDescription: string;
  confidenceScore: number;
  isDataSufficient: boolean;
  contributingFactors: Array<{
    factor: string;
    impact: 'positivo' | 'neutro' | 'negativo';
    detail: string;
  }>;
}

export interface PredictiveOverview {
  overallSignal: string;
  confidenceScore: number;
  isDataSufficient: boolean;
  insufficiencyMessage?: string;
  climateFactor: ClimateSummary;
  anomalies: DetectedAnomaly[];
  territoryEstimations: TerritoryRiskEstimation[];
  methodologicalNote: string;
}


const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

/**
 * Confiança pela quantidade de registros usados (n): 100·n/(n+50), limitada a 95.
 * Com 50 registros ≈ 50%; com 450 ≈ 90%. É uma medida de suficiência amostral,
 * não uma probabilidade de acerto.
 */
function sampleConfidence(n: number): number {
  return Math.min(95, Math.round((100 * n) / (n + 50)));
}

export const predictiveIntelligenceService = {
  /**
   * Sinais territoriais calculados apenas com registros do município:
   * focos (depósitos positivos nas visitas), positividade de ovitrampas e
   * casos notificados, comparando os últimos 30 dias com os 30 anteriores.
   * Nada é estimado sem dado; sem registros suficientes, a tela informa.
   */
  async getPredictiveOverview(municipalityId: string): Promise<PredictiveOverview> {
    const now = Date.now();
    const recentFrom = iso(now - 30 * DAY);
    const previousFrom = iso(now - 60 * DAY);

    const [climate, neighRes, visitsRes, casesRes, oviRes, propsRes] = await Promise.all([
      weatherService.getClimateSummary(municipalityId),
      supabase.from('neighborhoods').select('id, name').eq('municipality_id', municipalityId),
      supabase
        .from('visits')
        .select('visit_date, properties!inner(neighborhood_id), visit_deposits(positive)')
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null)
        .gte('visit_date', previousFrom),
      supabase
        .from('epidemiological_cases')
        .select('neighborhood_id, notification_date')
        .eq('municipality_id', municipalityId)
        .gte('notification_date', previousFrom),
      supabase
        .from('ovitrap_results')
        .select('positive, laboratory_date, ovitraps!inner(municipality_id, neighborhood_id)')
        .eq('ovitraps.municipality_id', municipalityId)
        .gte('laboratory_date', previousFrom),
      supabase
        .from('breeding_sites')
        .select('property_id, properties(neighborhood_id)')
        .eq('municipality_id', municipalityId)
        .gte('identified_at', new Date(Date.now() - 365 * 86400000).toISOString())
        .not('property_id', 'is', null),
    ]);

    const neighborhoods = neighRes.data || [];
    const visits = visitsRes.data || [];
    const cases = casesRes.data || [];
    const oviResults = oviRes.data || [];
    // Reincidentes: imóveis com 2+ focos (breeding_sites) nos últimos 12 meses
    const fociPerProperty = new Map<string, { n: number; neighborhood_id?: string }>();
    (propsRes.data || []).forEach((b: any) => {
      const cur = fociPerProperty.get(b.property_id) || { n: 0, neighborhood_id: b.properties?.neighborhood_id };
      cur.n += 1;
      fociPerProperty.set(b.property_id, cur);
    });
    const recurrentProps = [...fociPerProperty.values()].filter((p) => p.n >= 2);
    const nameOf = (id: string) => neighborhoods.find((n: any) => n.id === id)?.name || 'Bairro não informado';

    // Focos por bairro e janela
    const foci: Record<string, { recent: number; previous: number }> = {};
    visits.forEach((v: any) => {
      const nid = v.properties?.neighborhood_id;
      if (!nid) return;
      const positives = (v.visit_deposits || []).filter((d: any) => d.positive).length;
      if (!positives) return;
      foci[nid] = foci[nid] || { recent: 0, previous: 0 };
      if (v.visit_date >= recentFrom) foci[nid].recent += positives;
      else foci[nid].previous += positives;
    });

    const isDataSufficient = visits.length >= 50 && neighborhoods.length > 0;
    const confidenceScore = sampleConfidence(visits.length);
    const insufficiencyMessage = !isDataSufficient
      ? `Registros insuficientes para sinais confiáveis (${visits.length} visitas nos últimos 60 dias; mínimo recomendado: 50).`
      : undefined;

    const anomalies: DetectedAnomaly[] = [];

    // 1. Pico de focos: pelo menos 3 focos recentes e o dobro da janela anterior
    Object.entries(foci)
      .filter(([, f]) => f.recent >= 3 && f.recent >= 2 * f.previous)
      .sort((a, b) => b[1].recent - a[1].recent)
      .slice(0, 3)
      .forEach(([nid, f]) => {
        const variation = f.previous > 0 ? `+${Math.round(((f.recent - f.previous) / f.previous) * 100)}%` : 'sem focos na janela anterior';
        anomalies.push({
          id: `focos-${nid}`,
          territoryName: nameOf(nid),
          type: 'focos_pico',
          severity: f.recent >= 8 ? 'critico' : 'alto',
          headline: `${f.recent} foco(s) em ${nameOf(nid)} nos últimos 30 dias (${variation})`,
          evidence: `Depósitos positivos registrados em visitas: ${f.recent} nos últimos 30 dias contra ${f.previous} nos 30 dias anteriores.`,
          confidenceScore: sampleConfidence(f.recent + f.previous),
          recommendedIntervention: 'Priorizar vistorias e eliminação mecânica de depósitos no bairro.',
        });
      });

    // 2. Positividade de ovitrampas (IPO) subindo pelo menos 10 pontos
    const recentOvi = oviResults.filter((r: any) => r.laboratory_date >= recentFrom);
    const previousOvi = oviResults.filter((r: any) => r.laboratory_date < recentFrom);
    const ipo = (rows: any[]) => (rows.length ? Math.round((rows.filter((r) => r.positive).length / rows.length) * 100) : null);
    const ipoRecent = ipo(recentOvi);
    const ipoPrevious = ipo(previousOvi);
    if (ipoRecent !== null && ipoPrevious !== null && ipoRecent - ipoPrevious >= 10) {
      anomalies.push({
        id: 'ovitrampas-ipo',
        territoryName: 'Município',
        type: 'ovitrampas_elevacao',
        severity: ipoRecent >= 50 ? 'alto' : 'moderado',
        headline: `Positividade das ovitrampas subiu de ${ipoPrevious}% para ${ipoRecent}%`,
        evidence: `${recentOvi.length} leituras nos últimos 30 dias e ${previousOvi.length} nos 30 dias anteriores.`,
        confidenceScore: sampleConfidence(oviResults.length),
        recommendedIntervention: 'Revisar pontos positivos e intensificar remoção de depósitos no entorno das armadilhas.',
      });
    }

    // 3. Agregação de casos: 3 ou mais notificações recentes no mesmo bairro
    const casesByNeigh: Record<string, number> = {};
    cases
      .filter((c: any) => c.notification_date >= recentFrom && c.neighborhood_id)
      .forEach((c: any) => {
        casesByNeigh[c.neighborhood_id] = (casesByNeigh[c.neighborhood_id] || 0) + 1;
      });
    Object.entries(casesByNeigh)
      .filter(([, n]) => n >= 3)
      .forEach(([nid, n]) => {
        anomalies.push({
          id: `casos-${nid}`,
          territoryName: nameOf(nid),
          type: 'casos_cluster',
          severity: n >= 6 ? 'alto' : 'moderado',
          headline: `${n} notificações em ${nameOf(nid)} nos últimos 30 dias`,
          evidence: `Casos registrados em epidemiological_cases com bairro informado.`,
          confidenceScore: sampleConfidence(n),
          recommendedIntervention: 'Avaliar necessidade de bloqueio de transmissão conforme protocolo municipal.',
        });
      });

    // 4. Sinais por bairro (ordenados por focos recentes)
    const territoryEstimations: TerritoryRiskEstimation[] = neighborhoods
      .map((n: any) => ({ n, f: foci[n.id] || { recent: 0, previous: 0 } }))
      .sort((a, b) => b.f.recent - a.f.recent)
      .slice(0, 8)
      .map(({ n, f }) => {
        const level: TerritoryRiskEstimation['estimatedRiskLevel'] =
          f.recent >= 8 ? 'muito_elevado' : f.recent >= 5 ? 'elevado' : f.recent >= 2 ? 'moderado' : 'baixo';
        const signal: TerritoryRiskEstimation['probabilitySignal'] =
          f.recent > f.previous ? 'sinal_elevacao' : f.recent < f.previous ? 'tendencia_reducao' : 'estavel';
        const recurrent = recurrentProps.filter((p: any) => p.neighborhood_id === n.id).length;
        return {
          neighborhoodId: n.id,
          neighborhoodName: n.name,
          estimatedRiskLevel: level,
          riskLabel:
            level === 'muito_elevado' ? 'Muitos focos recentes' : level === 'elevado' ? 'Focos recentes elevados' : level === 'moderado' ? 'Focos recentes moderados' : 'Poucos ou nenhum foco recente',
          probabilitySignal: signal,
          signalDescription: `Focos: ${f.recent} nos últimos 30 dias, ${f.previous} nos 30 anteriores.`,
          confidenceScore: sampleConfidence(f.recent + f.previous),
          isDataSufficient,
          contributingFactors: [
            { factor: 'Focos recentes', impact: f.recent >= 5 ? 'negativo' : 'neutro', detail: `${f.recent} depósito(s) positivo(s) em 30 dias` },
            { factor: 'Condição meteorológica', impact: climate.environmentalTendency === 'alta_proliferacao' ? 'negativo' : 'neutro', detail: climate.tendencyLabel },
            { factor: 'Reincidência', impact: recurrent > 0 ? 'negativo' : 'neutro', detail: `${recurrent} imóvel(is) com 2 ou mais focos registrados` },
          ],
        };
      });

    const failed = [neighRes, visitsRes, casesRes, oviRes, propsRes].some((r) => r.error);
    return {
      overallSignal:
        climate.environmentalTendency === 'alta_proliferacao'
          ? 'Clima favorável à proliferação do vetor nos últimos dias'
          : anomalies.length > 0
          ? `${anomalies.length} sinal(is) de atenção identificado(s) nos registros`
          : 'Nenhum sinal de atenção identificado nos registros',
      confidenceScore,
      isDataSufficient,
      insufficiencyMessage: failed ? 'Parte dos dados não pôde ser carregada; os sinais podem estar incompletos.' : insufficiencyMessage,
      climateFactor: climate,
      anomalies,
      territoryEstimations,
      methodologicalNote:
        'Sinais calculados com os registros do município: focos (depósitos positivos em visitas), positividade de ovitrampas e casos notificados, comparando os últimos 30 dias com os 30 anteriores. A confiança indica suficiência de registros, não certeza de ocorrência. Não são previsões.',
    };
  },
};
