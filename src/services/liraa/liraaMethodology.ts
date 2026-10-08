/**
 * Metodologia LIRAa / LIA — funções puras (sem banco), espelho das regras gravadas em
 * `liraa_rule_sets` e executadas no servidor por `liraa_execute_draw`.
 *
 * Fontes:
 *  - Manual LIRAa MS/SVS 2013, cap. 2 (Amostragem) e 4.5 (Procedimentos de campo).
 *  - Portaria GM/MS 3.129/2016 (RC CIT 1/2021): LIRAa > 2.000 imóveis; LIA < 2.000.
 *  - Diretrizes Nacionais para Prevenção e Controle de Epidemias de Dengue (MS, 2009):
 *    classificação do IIP.
 *
 * O sorteio oficial é feito no banco (auditável); este módulo serve para o
 * planejamento (prévia dos parâmetros), para os indicadores e para os testes.
 */

export interface LiraaSamplingParams {
  base_sample: number;
  stratum_min: number;
  stratum_max: number;
  small_stratum_min: number;
  step_regular: number;
  step_small: number;
  municipality_min_exclusive: number;
}

export interface LiaSamplingParams {
  municipality_max_exclusive: number;
  bands: { max: number; step: number }[];
}

/** Parâmetros oficiais do Manual LIRAa 2013 (mesmos valores da migração 38). */
export const LIRAA_MS_2013: LiraaSamplingParams = {
  base_sample: 450,
  stratum_min: 8100,
  stratum_max: 12000,
  small_stratum_min: 2000,
  step_regular: 5,
  step_small: 2,
  municipality_min_exclusive: 2000,
};

/** Faixas do LIA — PENDENTES de validação técnica (referência estadual, não federal). */
export const LIA_REFERENCIA_ESTADUAL: LiaSamplingParams = {
  municipality_max_exclusive: 2000,
  bands: [
    { max: 400, step: 1 },
    { max: 1500, step: 3 },
    { max: 1999, step: 5 },
  ],
};

export class MethodologyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'MethodologyError';
  }
}

export interface StratumPlan {
  N: number;
  A: number;
  /** imóveis a inspecionar (n = 450 / (1 + 450/N), para cima) */
  n: number;
  /** tamanho médio do quarteirão (sem arredondamento) */
  B: number;
  /** 1 imóvel a cada `step` no quarteirão (5 = 20%; 2 = 50%) */
  step: number;
  /** quarteirões da amostra */
  Q: number;
  /** intervalo amostral */
  IA: number;
}

/** Plano de um estrato LIRAa, com as mesmas faixas e erros do servidor. */
export function planLiraaStratum(N: number, A: number, params: LiraaSamplingParams = LIRAA_MS_2013): StratumPlan {
  if (!Number.isFinite(N) || !Number.isFinite(A) || N <= 0 || A <= 0) {
    throw new MethodologyError('estrato_sem_universo', 'Cadastre imóveis com quarteirão (RG) no estrato.');
  }
  let step: number;
  if (N > params.stratum_max) {
    throw new MethodologyError('estrato_acima_do_limite', `${N} imóveis: acima do máximo de ${params.stratum_max} por estrato. Divida o estrato.`);
  } else if (N >= params.stratum_min) {
    step = params.step_regular;
  } else if (N >= params.small_stratum_min) {
    step = params.step_small;
  } else {
    throw new MethodologyError(
      'estrato_abaixo_do_minimo',
      `${N} imóveis: abaixo de ${params.small_stratum_min}. A metodologia não define este caso — validar com a SES.`
    );
  }
  const n = Math.ceil(params.base_sample / (1 + params.base_sample / N));
  const B = N / A;
  const Q = Math.max(1, Math.min(A, Math.ceil(n / (B / step))));
  const IA = A / Q;
  return { N, A, n, B, step, Q, IA };
}

/**
 * Quarteirões sorteados (numeração 1..A): posições IC + k·IA, arredondadas pela
 * metade para cima, mínimo 1 — reproduz o Quadro 1 do manual.
 */
export function systematicBlockOrdinals(IC: number, IA: number, Q: number, A: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < Q; k++) {
    const pos = IC + k * IA;
    if (pos > A) break;
    const ordinal = Math.min(A, Math.max(1, Math.floor(pos + 0.5)));
    if (!out.includes(ordinal)) out.push(ordinal);
  }
  return out.sort((a, b) => a - b);
}

/** Índices (0-based) inspecionados num quarteirão: o 1º e depois um a cada `step`. */
export function indicesWithinBlock(propertiesInBlock: number, step: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < propertiesInBlock; i += step) out.push(i);
  return out;
}

/** Passo do LIA conforme o porte (faixas pendentes de validação). */
export function liaStep(N: number, params: LiaSamplingParams = LIA_REFERENCIA_ESTADUAL): number {
  const band = [...params.bands].sort((a, b) => a.max - b.max).find((b) => N <= b.max);
  if (!band || N <= 0) throw new MethodologyError('faixa_lia_nao_definida', `Faixa do LIA não definida para ${N} imóveis.`);
  return band.step;
}

/** Índices globais do LIA: início em [0, step) e depois um a cada `step`. */
export function liaSelection(N: number, step: number, unit: number): number[] {
  const start = Math.min(step - 1, Math.floor(unit * step));
  const out: number[] = [];
  for (let i = start; i < N; i += step) out.push(i);
  return out;
}

export type SurveyModality = 'LIRAa' | 'LIA';

/** Modalidade exigida pela Portaria GM/MS 3.129/2016 para o total de imóveis elegíveis. */
export function requiredModality(municipalityEligibleProperties: number): SurveyModality | 'indefinida' {
  if (municipalityEligibleProperties > 2000) return 'LIRAa';
  if (municipalityEligibleProperties < 2000) return 'LIA';
  return 'indefinida';
}

/**
 * Número reproduzível em [0,1): 52 bits iniciais do SHA-256 de `semente|escopo`
 * (mesma fórmula de `liraa_seed_unit` no banco).
 */
export async function seedUnit(seed: string, scope: string): Promise<number> {
  const data = new TextEncoder().encode(`${seed}|${scope}`);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data));
  const hex = Array.from(digest.slice(0, 7), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 13);
  return Number(BigInt(`0x${hex}`)) / 2 ** 52;
}

// ----------------------------------------------------------------------------
// Indicadores
// ----------------------------------------------------------------------------

export interface IndicatorInput {
  /** imóveis trabalhados (pesquisados) */
  worked: number;
  /** imóveis com Ae. aegypti confirmado em laboratório */
  positiveProperties: number;
  /** recipientes positivos para Ae. aegypti por tipo (um tubito por recipiente) */
  positiveRecipientsByType: Record<string, number>;
  /** tubitos ainda sem resultado laboratorial */
  tubesPendingLab?: number;
}

export interface IndicatorResult {
  iip: number | null;
  ib: number | null;
  itr: Record<string, number>;
  positiveRecipients: number;
  /** há tubitos sem resultado: índices ainda podem mudar */
  provisional: boolean;
}

const round = (v: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round((v + Number.EPSILON) * f) / f;
};

/**
 * IIP = imóveis positivos / imóveis pesquisados × 100
 * IB  = recipientes positivos / imóveis pesquisados × 100
 * ITR = recipientes positivos do tipo / total de recipientes positivos × 100
 */
export function computeIndicators(input: IndicatorInput, decimals = 1): IndicatorResult {
  const positiveRecipients = Object.values(input.positiveRecipientsByType).reduce((a, b) => a + (b || 0), 0);
  const itr: Record<string, number> = {};
  if (positiveRecipients > 0) {
    for (const [type, count] of Object.entries(input.positiveRecipientsByType)) {
      if (count > 0) itr[type] = round((count / positiveRecipients) * 100, decimals);
    }
  }
  const worked = input.worked;
  return {
    iip: worked > 0 ? round((input.positiveProperties / worked) * 100, decimals) : null,
    ib: worked > 0 ? round((positiveRecipients / worked) * 100, decimals) : null,
    itr,
    positiveRecipients,
    provisional: (input.tubesPendingLab ?? 0) > 0,
  };
}

export type RiskLevel = 'satisfatorio' | 'alerta' | 'risco';

/** Classificação do IIP (Diretrizes Nacionais 2009): < 1 satisfatório; até 3,9 alerta; > 3,9 risco. */
export function classifyIip(iip: number | null): RiskLevel | null {
  if (iip === null || !Number.isFinite(iip)) return null;
  const v = round(iip, 1);
  if (v < 1) return 'satisfatorio';
  if (v <= 3.9) return 'alerta';
  return 'risco';
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  satisfatorio: 'Satisfatório',
  alerta: 'Alerta',
  risco: 'Risco',
};

/** Categorias oficiais de depósitos (Manual LIRAa 2013, 4.6.1). */
export const DEPOSIT_CATEGORIES = ['A1', 'A2', 'B', 'C', 'D1', 'D2', 'E'] as const;
export type DepositCategory = (typeof DEPOSIT_CATEGORIES)[number];

export const DEPOSIT_LABELS: Record<DepositCategory, string> = {
  A1: 'A1 — Depósito de água elevado',
  A2: 'A2 — Depósito de água ao nível do solo',
  B: 'B — Depósitos móveis',
  C: 'C — Depósitos fixos',
  D1: 'D1 — Pneus e materiais rodantes',
  D2: 'D2 — Resíduos sólidos, sucatas, entulho',
  E: 'E — Depósitos naturais',
};

export interface DepositEntry {
  category: DepositCategory;
  inspected: number;
  positive: number;
}

/** Validação local da inspeção (mesmas regras da RPC `liraa_submit_inspection`). */
export function validateInspectionDeposits(deposits: DepositEntry[], tubes: { category: string }[]): string[] {
  const errors: string[] = [];
  const pos: Record<string, number> = {};
  for (const d of deposits) {
    if (d.inspected < 0 || d.positive < 0) errors.push(`${d.category}: quantidade negativa.`);
    if (d.positive > d.inspected) errors.push(`${d.category}: positivos (${d.positive}) maior que inspecionados (${d.inspected}).`);
    if (d.positive > 0) pos[d.category] = (pos[d.category] || 0) + d.positive;
  }
  const tb: Record<string, number> = {};
  for (const t of tubes) tb[t.category] = (tb[t.category] || 0) + 1;
  for (const cat of new Set([...Object.keys(pos), ...Object.keys(tb)])) {
    if ((pos[cat] || 0) !== (tb[cat] || 0)) {
      errors.push(`${cat}: ${pos[cat] || 0} depósito(s) positivo(s) e ${tb[cat] || 0} tubito(s). Colete um tubito por depósito positivo.`);
    }
  }
  return errors;
}
