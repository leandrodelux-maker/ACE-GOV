/**
 * Consolidação e relatórios do LIRAa/LIA (puro, sem React nem banco — testável).
 * Positividade = confirmação laboratorial de Ae. aegypti; suspeita de campo aparece
 * separada. Cumprimento da amostra (trabalhados/programados) não é índice de infestação.
 */
import { classifyIip, computeIndicators, DEPOSIT_CATEGORIES, DEPOSIT_LABELS, RISK_LABELS, RiskLevel } from '../../services/liraa/liraaMethodology';
import type { AgentCounts, DrawRow, LiraaSurvey, LiraaStratum, SampleRow, SurveyCounts, TubeRow, UnitCounts } from '../../services/liraa/liraaModuleService';
import { LAB_RESULT_LABELS, SITUATION_LABELS, STATUS_LABELS, TUBE_STATUS_LABELS } from '../../services/liraa/liraaModuleService';
import type { ReportDocument } from '../../services/reportExport';

export interface UnitIndicators {
  id: string;
  name: string;
  level: UnitCounts['level'];
  programmed: number;
  worked: number;
  closed: number;
  refused: number;
  nonexistent: number;
  pending: number;
  substitutes: number;
  vacantLots: number;
  /** % da amostra programada efetivamente trabalhada (cumprimento — não é infestação) */
  completion: number | null;
  positiveProperties: number;
  positiveAlbopictus: number;
  fieldPositive: number;
  positiveRecipients: number;
  positiveByType: Record<string, number>;
  inspectedByType: Record<string, number>;
  iip: number | null;
  ib: number | null;
  itr: Record<string, number>;
  risk: RiskLevel | null;
  tubesTotal: number;
  tubesPendingLab: number;
  provisional: boolean;
}

export function unitIndicators(u: UnitCounts): UnitIndicators {
  const s = u.situations || {};
  const worked = s.trabalhado || 0;
  const tubes = u.tubes_by_status || {};
  const tubesPendingLab = (tubes.coletada || 0) + (tubes.recebida || 0);
  const positiveByType = u.positive_recipients_aegypti || {};
  const ind = computeIndicators({ worked, positiveProperties: u.positive_properties_aegypti, positiveRecipientsByType: positiveByType, tubesPendingLab });
  return {
    id: u.unit_id,
    name: u.unit_name,
    level: u.level,
    programmed: u.programmed,
    worked,
    closed: s.fechado || 0,
    refused: s.recusa || 0,
    nonexistent: s.inexistente || 0,
    pending: u.pending,
    substitutes: u.substitutes,
    vacantLots: u.vacant_lots,
    completion: u.programmed > 0 ? Math.round((worked / u.programmed) * 1000) / 10 : null,
    positiveProperties: u.positive_properties_aegypti,
    positiveAlbopictus: u.positive_properties_albopictus,
    fieldPositive: u.field_positive_properties,
    positiveRecipients: ind.positiveRecipients,
    positiveByType,
    inspectedByType: u.inspected_recipients || {},
    iip: ind.iip,
    ib: ind.ib,
    itr: ind.itr,
    risk: classifyIip(ind.iip),
    tubesTotal: Object.values(tubes).reduce((a, b) => a + (b || 0), 0),
    tubesPendingLab,
    provisional: ind.provisional,
  };
}

export function splitUnits(counts: SurveyCounts | null): { municipality: UnitIndicators | null; strata: UnitIndicators[]; neighborhoods: UnitIndicators[] } {
  const units = (counts?.units || []).map(unitIndicators);
  return {
    municipality: units.find((u) => u.level === 'municipality') || null,
    strata: units.filter((u) => u.level === 'stratum'),
    neighborhoods: units.filter((u) => u.level === 'neighborhood'),
  };
}

const n = (v: number | null | undefined) => (v === null || v === undefined ? null : v);
const riskText = (u: UnitIndicators) => (u.risk ? RISK_LABELS[u.risk] : u.worked === 0 ? 'Sem imóveis trabalhados' : '—');

export const PROVISIONAL_NOTE =
  'Índices provisórios enquanto houver tubitos sem resultado laboratorial. IIP e IB consideram somente Ae. aegypti confirmado em laboratório.';
export const RISK_NOTE =
  'Classificação do IIP: < 1% satisfatório; 1 a 3,9% alerta; > 3,9% risco (Diretrizes Nacionais MS, 2009). O IB não é classificado automaticamente até validação técnica de faixas vigentes.';

function header(survey: LiraaSurvey, municipalityLabel: string): string {
  return `${municipalityLabel} · ${survey.type} ${survey.cycle_number}/${survey.year} — ${survey.name} · ${STATUS_LABELS[survey.status]}`;
}

function indicatorRows(units: UnitIndicators[]) {
  return units.map((u) => ({
    unidade: u.name,
    programados: u.programmed,
    trabalhados: u.worked,
    fechados: u.closed,
    recusas: u.refused,
    inexistentes: u.nonexistent,
    pendentes: u.pending,
    cumprimento: n(u.completion),
    positivos: u.positiveProperties,
    recipientes: u.positiveRecipients,
    iip: n(u.iip),
    ib: n(u.ib),
    risco: riskText(u),
    tubitos_pendentes: u.tubesPendingLab,
  }));
}

const INDICATOR_COLUMNS = [
  { key: 'unidade', label: 'Unidade' },
  { key: 'programados', label: 'Programados', type: 'number' as const },
  { key: 'trabalhados', label: 'Trabalhados', type: 'number' as const },
  { key: 'fechados', label: 'Fechados', type: 'number' as const },
  { key: 'recusas', label: 'Recusas', type: 'number' as const },
  { key: 'inexistentes', label: 'Inexistentes', type: 'number' as const },
  { key: 'pendentes', label: 'Pendentes', type: 'number' as const },
  { key: 'cumprimento', label: 'Cumprimento (%)', type: 'percent' as const },
  { key: 'positivos', label: 'Imóveis positivos', type: 'number' as const },
  { key: 'recipientes', label: 'Recipientes positivos', type: 'number' as const },
  { key: 'iip', label: 'IIP (%)', type: 'percent' as const },
  { key: 'ib', label: 'IB', type: 'percent' as const },
  { key: 'risco', label: 'Classificação IIP' },
  { key: 'tubitos_pendentes', label: 'Tubitos sem resultado', type: 'number' as const },
];

export type LiraaReportKind =
  | 'plano_amostral'
  | 'sorteados'
  | 'boletim'
  | 'consolidado_parcial'
  | 'consolidado_estrato'
  | 'resultado_municipal'
  | 'indicadores'
  | 'criadouros'
  | 'produtividade'
  | 'historico';

export const REPORT_LABELS: Record<LiraaReportKind, string> = {
  plano_amostral: 'Plano amostral',
  sorteados: 'Quarteirões e imóveis sorteados',
  boletim: 'Boletim de campo e laboratório',
  consolidado_parcial: 'Consolidado parcial (por bairro)',
  consolidado_estrato: 'Consolidado por estrato',
  resultado_municipal: 'Resultado municipal',
  indicadores: 'Relatório dos indicadores',
  criadouros: 'Relatório de criadouros (ITR)',
  produtividade: 'Produtividade dos agentes',
  historico: 'Histórico comparativo',
};

export interface ReportInputs {
  survey: LiraaSurvey;
  municipalityLabel: string;
  generatedBy?: string;
  counts?: SurveyCounts | null;
  strata?: LiraaStratum[];
  draws?: DrawRow[];
  samples?: SampleRow[];
  blocks?: { stratum_id: string; block_code: string; ordinal: number; properties_in_block: number }[];
  inspections?: any[];
  tubes?: TubeRow[];
  history?: { survey: LiraaSurvey; municipality: UnitIndicators | null }[];
}

export function buildLiraaReport(kind: LiraaReportKind, input: ReportInputs): ReportDocument {
  const { survey } = input;
  const base = { title: `${REPORT_LABELS[kind]} — ${survey.type}`, subtitle: header(survey, input.municipalityLabel), generatedBy: input.generatedBy };
  const { municipality, strata, neighborhoods } = splitUnits(input.counts || null);
  const stratumName = new Map((input.strata || []).map((s) => [s.id, s.name]));

  switch (kind) {
    case 'plano_amostral': {
      const draws = (input.draws || []).filter((d) => d.status === 'vigente');
      return {
        ...base,
        tables: [{
          title: 'Parâmetros do sorteio por estrato',
          columns: [
            { key: 'estrato', label: 'Estrato' }, { key: 'N', label: 'Imóveis (N)', type: 'number' }, { key: 'A', label: 'Quarteirões (A)', type: 'number' },
            { key: 'n', label: 'Amostra (n)', type: 'number' }, { key: 'passo', label: 'Inspecionar 1 a cada' , type: 'number'}, { key: 'Q', label: 'Quarteirões (Q)', type: 'number' },
            { key: 'IA', label: 'Intervalo (IA)' }, { key: 'IC', label: 'Início casual (IC)' }, { key: 'sel', label: 'Imóveis sorteados', type: 'number' },
            { key: 'regra', label: 'Regra / versão' }, { key: 'semente', label: 'Semente' }, { key: 'hash', label: 'Hash do universo' }, { key: 'data', label: 'Executado em', type: 'date' },
          ],
          rows: draws.map((d) => ({
            estrato: stratumName.get(d.stratum_id) || '—', N: d.parameters?.N, A: d.parameters?.A, n: d.parameters?.n, passo: d.parameters?.step,
            Q: d.parameters?.Q, IA: d.parameters?.IA != null ? Number(d.parameters.IA).toFixed(4) : '—', IC: d.parameters?.IC != null ? Number(d.parameters.IC).toFixed(4) : (d.parameters?.start != null ? `início ${Number(d.parameters.start) + 1}` : '—'),
            sel: d.selected_properties, regra: `${d.rule_code} v${d.rule_version}`, semente: d.seed, hash: d.universe_hash.slice(0, 16), data: d.executed_at,
          })),
        }],
        notes: ['Sorteio executado no servidor com semente registrada; a mesma semente sobre o mesmo universo (hash) reproduz a seleção.'],
      };
    }
    case 'sorteados': {
      const samples = (input.samples || []).slice().sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
      return {
        ...base,
        tables: [
          ...(input.blocks?.length ? [{
            title: 'Quarteirões sorteados',
            columns: [{ key: 'estrato', label: 'Estrato' }, { key: 'ordem', label: 'Nº de ordem', type: 'number' as const }, { key: 'quarteirao', label: 'Quarteirão' }, { key: 'imoveis', label: 'Imóveis no quarteirão', type: 'number' as const }],
            rows: input.blocks.map((b) => ({ estrato: stratumName.get(b.stratum_id) || '—', ordem: b.ordinal, quarteirao: b.block_code, imoveis: b.properties_in_block })),
          }] : []),
          {
            title: 'Imóveis',
            columns: [{ key: 'estrato', label: 'Estrato' }, { key: 'quarteirao', label: 'Quarteirão' }, { key: 'endereco', label: 'Endereço' }, { key: 'codigo', label: 'Código' },
              { key: 'bairro', label: 'Bairro' }, { key: 'tipo', label: 'Seleção' }, { key: 'agente', label: 'Agente' }, { key: 'situacao', label: 'Situação' }],
            rows: samples.map((s) => ({ estrato: stratumName.get(s.stratum_id) || '—', quarteirao: s.block_code || '—', endereco: s.address || '—', codigo: s.property_code || '',
              bairro: s.neighborhood || '', tipo: s.selection_type === 'substituto' ? 'Substituto' : 'Sorteado', agente: s.agent_name || 'Não distribuído', situacao: SITUATION_LABELS[s.status] })),
          },
        ],
      };
    }
    case 'boletim': {
      const tubesByInspection = new Map<string, TubeRow[]>();
      (input.tubes || []).forEach((t) => tubesByInspection.set(t.liraa_inspection_id, [...(tubesByInspection.get(t.liraa_inspection_id) || []), t]));
      return {
        ...base,
        tables: [{
          title: 'Boletim de campo e laboratório',
          columns: [{ key: 'data', label: 'Data', type: 'date' }, { key: 'agente', label: 'Agente' }, { key: 'quarteirao', label: 'Quarteirão' }, { key: 'endereco', label: 'Endereço' },
            { key: 'tb', label: 'TB' }, { key: 'situacao', label: 'Situação' }, ...DEPOSIT_CATEGORIES.map((c) => ({ key: `dep_${c}`, label: `${c} insp./pos.` })),
            { key: 'tubitos', label: 'Tubitos' }, { key: 'lab', label: 'Resultado laboratorial' }],
          rows: (input.inspections || []).map((i) => {
            const deps = Object.fromEntries((i.deposits || []).map((d: any) => [`dep_${d.deposit_category}`, `${d.inspected_count}/${d.positive_count}`]));
            const tubes = tubesByInspection.get(i.id) || [];
            return {
              data: i.inspected_at, agente: i.agent_name || '—', quarteirao: i.block_code || '—', endereco: i.address || '—', tb: i.is_vacant_lot ? 'X' : '',
              situacao: SITUATION_LABELS[i.situation as keyof typeof SITUATION_LABELS] || i.situation, ...deps,
              tubitos: tubes.map((t) => t.tube_label).join(', '),
              lab: tubes.map((t) => `${t.tube_label}: ${t.lab_result ? LAB_RESULT_LABELS[t.lab_result] : TUBE_STATUS_LABELS[t.status] || t.status}`).join('; '),
            };
          }),
        }],
        notes: ['Depósitos: inspecionados/com larvas ou pupas (campo). TB = terreno baldio.'],
      };
    }
    case 'consolidado_parcial':
      return { ...base, tables: [{ title: 'Por bairro', columns: INDICATOR_COLUMNS, rows: indicatorRows(neighborhoods) }], notes: [PROVISIONAL_NOTE, RISK_NOTE] };
    case 'consolidado_estrato':
      return { ...base, tables: [{ title: 'Por estrato', columns: INDICATOR_COLUMNS, rows: indicatorRows(strata) }], notes: [PROVISIONAL_NOTE, RISK_NOTE] };
    case 'resultado_municipal':
    case 'indicadores':
      return {
        ...base,
        tables: [
          { title: 'Município', columns: INDICATOR_COLUMNS, rows: indicatorRows(municipality ? [municipality] : []) },
          ...(kind === 'indicadores' ? [{ title: 'Estratos', columns: INDICATOR_COLUMNS, rows: indicatorRows(strata) }] : []),
        ],
        notes: [PROVISIONAL_NOTE, RISK_NOTE, 'Cumprimento da amostra (trabalhados/programados) indica execução do levantamento, não infestação.'],
      };
    case 'criadouros': {
      const units = [municipality, ...strata].filter(Boolean) as UnitIndicators[];
      return {
        ...base,
        tables: [{
          title: 'Índice por tipo de recipiente (ITR)',
          columns: [{ key: 'unidade', label: 'Unidade' }, ...DEPOSIT_CATEGORIES.flatMap((c) => [
            { key: `insp_${c}`, label: `${c} inspec.`, type: 'number' as const },
            { key: `pos_${c}`, label: `${c} positivos`, type: 'number' as const },
            { key: `itr_${c}`, label: `${c} ITR (%)`, type: 'percent' as const },
          ])],
          rows: units.map((u) => ({
            unidade: u.name,
            ...Object.fromEntries(DEPOSIT_CATEGORIES.flatMap((c) => [[`insp_${c}`, u.inspectedByType[c] || 0], [`pos_${c}`, u.positiveByType[c] || 0], [`itr_${c}`, u.itr[c] ?? null]])),
          })),
        }],
        notes: [...DEPOSIT_CATEGORIES.map((c) => DEPOSIT_LABELS[c]), 'ITR = recipientes positivos do tipo / total de recipientes positivos × 100 (Ae. aegypti confirmado).'],
      };
    }
    case 'produtividade': {
      const agents: AgentCounts[] = input.counts?.agents || [];
      return {
        ...base,
        tables: [{
          title: 'Produtividade por agente',
          columns: [{ key: 'agente', label: 'Agente' }, { key: 'registros', label: 'Registros', type: 'number' }, { key: 'trabalhados', label: 'Trabalhados', type: 'number' },
            { key: 'fechados', label: 'Fechados', type: 'number' }, { key: 'recusas', label: 'Recusas', type: 'number' }, { key: 'dias', label: 'Dias em campo', type: 'number' },
            { key: 'media', label: 'Trabalhados por dia', type: 'percent' }, { key: 'inicio', label: 'Primeiro registro', type: 'date' }, { key: 'fim', label: 'Último registro', type: 'date' }],
          rows: agents.map((a) => ({ agente: a.name || 'Sem agente vinculado', registros: a.inspections, trabalhados: a.worked, fechados: a.closed, recusas: a.refused, dias: a.days,
            media: a.days ? Math.round((a.worked / a.days) * 10) / 10 : null, inicio: a.first_at, fim: a.last_at })),
        }],
        notes: ['Referência operacional do manual: 20 a 25 imóveis/dia por agente.'],
      };
    }
    case 'historico':
      return {
        ...base,
        title: `${REPORT_LABELS.historico} — LIRAa/LIA`,
        tables: [{
          title: 'Levantamentos',
          columns: [{ key: 'levantamento', label: 'Levantamento' }, { key: 'periodo', label: 'Período' }, { key: 'situacao', label: 'Situação' }, { key: 'trabalhados', label: 'Trabalhados', type: 'number' },
            { key: 'iip', label: 'IIP (%)', type: 'percent' }, { key: 'ib', label: 'IB', type: 'percent' }, { key: 'risco', label: 'Classificação IIP' }],
          rows: (input.history || []).map(({ survey: s, municipality: m }) => ({
            levantamento: `${s.type} ${s.cycle_number}/${s.year} — ${s.name}`, periodo: `${s.start_date} a ${s.end_date}`, situacao: STATUS_LABELS[s.status],
            trabalhados: m?.worked ?? 0, iip: m?.iip ?? null, ib: m?.ib ?? null, risco: m ? riskText(m) : '—',
          })),
        }],
        notes: [RISK_NOTE],
      };
  }
}
