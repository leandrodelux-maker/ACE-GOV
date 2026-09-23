import { supabase } from './supabaseClient';

export type HistoricalIndicatorKey =
  | 'cobertura'
  | 'focos'
  | 'reincidencia'
  | 'casos'
  | 'iip'
  | 'ib'
  | 'ovitrampas'
  | 'pe'
  | 'denuncias'
  | 'produtividade';

export interface IndicatorMeta {
  key: HistoricalIndicatorKey;
  label: string;
  unit: string;
  desirableTrend: 'alta' | 'baixa'; // ex: cobertura alta é melhora; focos baixos é melhora
  description: string;
}

export const HISTORICAL_INDICATORS: IndicatorMeta[] = [
  { key: 'cobertura', label: 'Cobertura de Visitas', unit: '%', desirableTrend: 'alta', description: 'Percentual de imóveis trabalhados no ciclo' },
  { key: 'focos', label: 'Focos Larvários Positivos', unit: 'focos', desirableTrend: 'baixa', description: 'Criadouros com presença confirmada de larvas' },
  { key: 'reincidencia', label: 'Reincidência de Focos', unit: 'imóveis', desirableTrend: 'baixa', description: 'Imóveis com múltiplos focos em ciclos consecutivos' },
  { key: 'casos', label: 'Casos Notificados (SINAN)', unit: 'casos', desirableTrend: 'baixa', description: 'Notificações de arboviroses no território' },
  { key: 'iip', label: 'Índice de Infestação Predial (IIP)', unit: '%', desirableTrend: 'baixa', description: 'Imóveis positivos / Imóveis pesquisados (LIRAa)' },
  { key: 'ib', label: 'Índice de Breteau (IB)', unit: 'pts', desirableTrend: 'baixa', description: 'Depósitos positivos / 100 imóveis (LIRAa)' },
  { key: 'ovitrampas', label: 'Ovos em Ovitrampas', unit: 'ovos', desirableTrend: 'baixa', description: 'Total de ovos contados nas leituras de laboratório' },
  { key: 'pe', label: 'Pontos Estratégicos Inspecionados', unit: 'inspeções', desirableTrend: 'alta', description: 'Vistorias quinzenais realizadas em ferros-velhos e cemitérios' },
  { key: 'denuncias', label: 'Denúncias Atendidas', unit: 'denúncias', desirableTrend: 'alta', description: 'Denúncias com vistoria registrada (data da vistoria)' },
  { key: 'produtividade', label: 'Produtividade Média ACE', unit: 'visitas/dia', desirableTrend: 'alta', description: 'Média de imóveis inspecionados por agente/dia' },
];

export interface TrendDataPoint {
  label: string;
  periodKey: string;
  currentValue: number;
  previousValue: number;
  diffPercent: number;
  status: 'melhora' | 'estavel' | 'piora';
}

export type ComparisonMode = 'ano_atual_vs_anterior' | 'ciclo_atual_vs_anterior' | 'ultimas_4semanas_vs_anteriores';

export interface ComparativeAnalysisResult {
  /** false = não há série calculável com os registros (ver unavailableReason) */
  available: boolean;
  unavailableReason?: string;
  indicator: IndicatorMeta;
  periodType: 'anos' | 'ciclos' | 'semanas' | 'meses';
  territoryName: string;
  comparisonTitle: string;
  currentTotal: number;
  previousTotal: number;
  overallDiffPercent: number;
  overallStatus: 'melhora' | 'estavel' | 'piora';
  statusExplanation: string;
  series: TrendDataPoint[];
}


interface HistoryBucket {
  label: string;
  cur: [string, string];
  prev: [string, string];
}

interface HistoryEvent {
  date: string;
  value: number;
  propertyId?: string;
  agentId?: string;
  worked?: boolean;
}

export const historicalAnalysisService = {
  /**
   * Avalia a tendência com base em limites de sensibilidade configuráveis (Threshold de 5%)
   * Evita classificar flutuações insignificantes como melhora ou piora.
   */
  classifyTrend(current: number, previous: number, desirable: 'alta' | 'baixa', thresholdPercent = 5.0): {
    status: 'melhora' | 'estavel' | 'piora';
    diffPercent: number;
  } {
    if (previous === 0) {
      if (current === 0) return { status: 'estavel', diffPercent: 0 };
      const diff = 100;
      return {
        status: desirable === 'alta' ? 'melhora' : 'piora',
        diffPercent: diff
      };
    }

    const diffPercent = Math.round(((current - previous) / previous) * 1000) / 10;

    if (Math.abs(diffPercent) < thresholdPercent) {
      return { status: 'estavel', diffPercent };
    }

    if (desirable === 'alta') {
      // Ex: Cobertura: aumento > 5% é melhora, queda > 5% é piora
      return {
        status: diffPercent > 0 ? 'melhora' : 'piora',
        diffPercent
      };
    } else {
      // Ex: Focos ou Casos: queda > 5% é melhora, aumento > 5% é piora
      return {
        status: diffPercent < 0 ? 'melhora' : 'piora',
        diffPercent
      };
    }
  },

  /**
   * Série comparativa calculada com registros do município (sem valores gerados).
   * Indicadores sem fonte temporal nos registros retornam available=false.
   */
  async getComparativeAnalysis(
    indicatorKey: HistoricalIndicatorKey,
    mode: ComparisonMode,
    neighborhoodId: string | undefined,
    municipalityId: string
  ): Promise<ComparativeAnalysisResult> {
    const meta = HISTORICAL_INDICATORS.find(i => i.key === indicatorKey) || HISTORICAL_INDICATORS[0];
    const nid = neighborhoodId && neighborhoodId !== 'ALL' ? neighborhoodId : null;

    let territoryName = 'Todo o Município';
    if (nid) {
      const { data: nData } = await supabase.from('neighborhoods').select('name').eq('id', nid).eq('municipality_id', municipalityId).maybeSingle();
      if (nData) territoryName = nData.name;
    }

    const base = {
      indicator: meta,
      periodType: (mode === 'ano_atual_vs_anterior' ? 'meses' : mode === 'ciclo_atual_vs_anterior' ? 'ciclos' : 'semanas') as ComparativeAnalysisResult['periodType'],
      territoryName,
    };
    const unavailable = (reason: string, title = ''): ComparativeAnalysisResult => ({
      ...base,
      available: false,
      unavailableReason: reason,
      comparisonTitle: title,
      currentTotal: 0,
      previousTotal: 0,
      overallDiffPercent: 0,
      overallStatus: 'estavel',
      statusExplanation: reason,
      series: [],
    });

    if (indicatorKey === 'iip' || indicatorKey === 'ib' || indicatorKey === 'reincidencia') {
      return unavailable(
        indicatorKey === 'reincidencia'
          ? 'Reincidência não tem registro com data por ocorrência; não há série histórica calculável.'
          : 'IIP e IB são calculados por levantamento (LIRAa). Consulte a tela LIRAa / LIA para os levantamentos concluídos.'
      );
    }

    // 1. Janelas de comparação
    const buckets = await this.buildBuckets(mode, municipalityId);
    if (!buckets.ok) return unavailable(buckets.reason);
    const { title, items } = buckets;
    const allStarts = items.flatMap((b) => [b.cur[0], b.prev[0]]).sort();
    const allEnds = items.flatMap((b) => [b.cur[1], b.prev[1]]).sort();
    const from = allStarts[0];
    const to = allEnds[allEnds.length - 1];

    // 2. Eventos do período
    const events = await this.fetchEvents(indicatorKey, municipalityId, nid, from, to);
    if (events.error) return unavailable('Não foi possível carregar os registros para este indicador.', title);

    let totalProperties = 0;
    if (indicatorKey === 'cobertura') {
      let q = supabase.from('properties').select('id', { count: 'exact', head: true }).eq('municipality_id', municipalityId).is('deleted_at', null);
      if (nid) q = q.eq('neighborhood_id', nid);
      const { count } = await q;
      totalProperties = count ?? 0;
      if (totalProperties === 0) return unavailable('Sem imóveis cadastrados no território para calcular cobertura.', title);
    }

    const inRange = (d: string, r: [string, string]) => d >= r[0] && d < r[1];
    const measure = (rows: HistoryEvent[]): number => {
      if (indicatorKey === 'cobertura') {
        const worked = new Set(rows.filter((r) => r.worked).map((r) => r.propertyId));
        return Math.round((worked.size / totalProperties) * 1000) / 10;
      }
      if (indicatorKey === 'produtividade') {
        const worked = rows.filter((r) => r.worked);
        const agentDays = new Set(worked.map((r) => `${r.agentId}|${r.date}`));
        return agentDays.size ? Math.round((worked.length / agentDays.size) * 10) / 10 : 0;
      }
      return rows.reduce((acc, r) => acc + r.value, 0);
    };

    const series: TrendDataPoint[] = items.map((b) => {
      const cur = measure(events.rows.filter((r) => inRange(r.date, b.cur)));
      const prev = measure(events.rows.filter((r) => inRange(r.date, b.prev)));
      const { status, diffPercent } = this.classifyTrend(cur, prev, meta.desirableTrend);
      return { label: b.label, periodKey: b.cur[0], currentValue: cur, previousValue: prev, diffPercent, status };
    });

    const curRange: [string, string] = [items[0].cur[0], items[items.length - 1].cur[1]];
    const prevRange: [string, string] = [items[0].prev[0], items[items.length - 1].prev[1]];
    const currentTotal = measure(events.rows.filter((r) => inRange(r.date, curRange)));
    const previousTotal = measure(events.rows.filter((r) => inRange(r.date, prevRange)));
    const overall = this.classifyTrend(currentTotal, previousTotal, meta.desirableTrend);

    const statusExplanation =
      currentTotal === 0 && previousTotal === 0
        ? 'Sem registros nos dois períodos comparados.'
        : overall.status === 'estavel'
        ? 'Variação dentro da margem de ±5% entre os períodos.'
        : `Variação de ${overall.diffPercent > 0 ? '+' : ''}${overall.diffPercent}% em relação ao período anterior (${overall.status}).`;

    return {
      ...base,
      available: true,
      comparisonTitle: title,
      currentTotal,
      previousTotal,
      overallDiffPercent: overall.diffPercent,
      overallStatus: overall.status,
      statusExplanation,
      series,
    };
  },

  /** Janelas [início, fim) do período atual e do anterior. */
  async buildBuckets(
    mode: ComparisonMode,
    municipalityId: string
  ): Promise<{ ok: true; title: string; items: HistoryBucket[] } | { ok: false; reason: string }> {
    const day = 86400000;
    const iso = (d: Date) => d.toISOString().split('T')[0];
    const today = new Date();

    if (mode === 'ano_atual_vs_anterior') {
      const y = today.getFullYear();
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const items: HistoryBucket[] = [];
      for (let m = 0; m <= today.getMonth(); m++) {
        items.push({
          label: months[m],
          cur: [iso(new Date(Date.UTC(y, m, 1))), iso(new Date(Date.UTC(y, m + 1, 1)))],
          prev: [iso(new Date(Date.UTC(y - 1, m, 1))), iso(new Date(Date.UTC(y - 1, m + 1, 1)))],
        });
      }
      return { ok: true, title: `Comparativo mensal: ${y} vs ${y - 1} (até o mês atual)`, items };
    }

    if (mode === 'ciclo_atual_vs_anterior') {
      const { data, error } = await supabase
        .from('field_cycles')
        .select('name, start_date, end_date, status')
        .eq('municipality_id', municipalityId)
        .order('start_date', { ascending: false })
        .limit(10);
      if (error) return { ok: false, reason: 'Não foi possível carregar os ciclos.' };
      const list = data || [];
      const curIdx = Math.max(0, list.findIndex((c: any) => c.status === 'EM_ANDAMENTO'));
      const cur = list[curIdx];
      const prev = list[curIdx + 1];
      if (!cur || !prev) return { ok: false, reason: 'É preciso ter o ciclo atual e um ciclo anterior cadastrados.' };
      const curStart = new Date(cur.start_date + 'T00:00:00Z').getTime();
      const prevStart = new Date(prev.start_date + 'T00:00:00Z').getTime();
      const curEnd = Math.min(new Date(cur.end_date + 'T00:00:00Z').getTime() + day, today.getTime() + day);
      const weeks = Math.max(1, Math.min(12, Math.ceil((curEnd - curStart) / (7 * day))));
      const items: HistoryBucket[] = Array.from({ length: weeks }, (_, i) => ({
        label: `Semana ${i + 1}`,
        cur: [iso(new Date(curStart + i * 7 * day)), iso(new Date(curStart + (i + 1) * 7 * day))],
        prev: [iso(new Date(prevStart + i * 7 * day)), iso(new Date(prevStart + (i + 1) * 7 * day))],
      }));
      return { ok: true, title: `Ciclo "${cur.name}" vs "${prev.name}" (semanas desde o início)`, items };
    }

    const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + day;
    const fmt = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
    const items: HistoryBucket[] = Array.from({ length: 4 }, (_, i) => {
      const cs = end - (4 - i) * 7 * day;
      const ps = cs - 28 * day;
      return {
        label: `${fmt(cs)} vs ${fmt(ps)}`,
        cur: [iso(new Date(cs)), iso(new Date(cs + 7 * day))],
        prev: [iso(new Date(ps)), iso(new Date(ps + 7 * day))],
      };
    });
    return { ok: true, title: 'Últimas 4 semanas vs 4 semanas anteriores', items };
  },

  /** Registros datados do indicador no intervalo [from, to). */
  async fetchEvents(
    key: HistoricalIndicatorKey,
    municipalityId: string,
    nid: string | null,
    from: string,
    to: string
  ): Promise<{ rows: HistoryEvent[]; error?: string }> {
    const worked = (r: any) => String(r ?? '').toUpperCase() === 'TRABALHADO';
    if (key === 'focos' || key === 'cobertura' || key === 'produtividade') {
      let q = supabase
        .from('visits')
        .select('visit_date, property_id, agent_id, result, visit_deposits(positive), properties!inner(neighborhood_id)')
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null)
        .gte('visit_date', from)
        .lt('visit_date', to);
      if (nid) q = q.eq('properties.neighborhood_id', nid);
      const { data, error } = await q;
      if (error) return { rows: [], error: error.message };
      return {
        rows: (data || []).map((v: any) => ({
          date: v.visit_date,
          value: (v.visit_deposits || []).filter((d: any) => d.positive).length,
          propertyId: v.property_id,
          agentId: v.agent_id,
          worked: worked(v.result),
        })),
      };
    }
    if (key === 'casos') {
      let q = supabase
        .from('epidemiological_cases')
        .select('notification_date')
        .eq('municipality_id', municipalityId)
        .gte('notification_date', from)
        .lt('notification_date', to);
      if (nid) q = q.eq('neighborhood_id', nid);
      const { data, error } = await q;
      if (error) return { rows: [], error: error.message };
      return { rows: (data || []).map((c: any) => ({ date: c.notification_date, value: 1 })) };
    }
    if (key === 'ovitrampas') {
      let q = supabase
        .from('ovitrap_results')
        .select('laboratory_date, eggs_count, ovitraps!inner(municipality_id, neighborhood_id)')
        .eq('ovitraps.municipality_id', municipalityId)
        .gte('laboratory_date', from)
        .lt('laboratory_date', to);
      if (nid) q = q.eq('ovitraps.neighborhood_id', nid);
      const { data, error } = await q;
      if (error) return { rows: [], error: error.message };
      return { rows: (data || []).map((r: any) => ({ date: r.laboratory_date, value: r.eggs_count || 0 })) };
    }
    if (key === 'pe') {
      let q = supabase
        .from('strategic_point_inspections')
        .select(nid ? 'inspection_date, strategic_points!inner(municipality_id, properties!inner(neighborhood_id))' : 'inspection_date, strategic_points!inner(municipality_id)')
        .eq('strategic_points.municipality_id', municipalityId)
        .gte('inspection_date', from)
        .lt('inspection_date', to);
      if (nid) q = q.eq('strategic_points.properties.neighborhood_id', nid);
      const { data, error } = await q;
      if (error) return { rows: [], error: error.message };
      return { rows: (data || []).map((r: any) => ({ date: r.inspection_date, value: 1 })) };
    }
    // denuncias: vistorias registradas (inspected_at)
    let q = supabase
      .from('complaints')
      .select('inspected_at')
      .eq('municipality_id', municipalityId)
      .not('inspected_at', 'is', null)
      .gte('inspected_at', from)
      .lt('inspected_at', to);
    if (nid) q = q.eq('neighborhood_id', nid);
    const { data, error } = await q;
    if (error) return { rows: [], error: error.message };
    return { rows: (data || []).map((c: any) => ({ date: String(c.inspected_at).slice(0, 10), value: 1 })) };
  },
};
