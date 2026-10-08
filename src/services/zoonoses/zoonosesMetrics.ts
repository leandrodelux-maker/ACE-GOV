/**
 * Vacinação antirrábica — regras de cálculo puras (sem banco).
 *
 * - Doses aplicadas ≠ animais vacinados: o banco impede segunda dose válida do mesmo
 *   animal na mesma campanha; registros de "campanha rápida" sem cadastro contam um
 *   animal por registro; lançamentos agregados contam um animal por dose.
 * - Cobertura = animais vacinados / população estimada × 100. Sem estimativa com
 *   fonte informada, a cobertura é INDISPONÍVEL (null) e só os quantitativos aparecem.
 * - Meta canina: parametrizável por campanha (referência de 80% do MS, não fixa no código).
 */

export type Species = 'canina' | 'felina';
export const SPECIES_LABELS: Record<Species, string> = { canina: 'Cães', felina: 'Gatos' };
export const SEX_LABELS: Record<string, string> = { macho: 'Macho', femea: 'Fêmea', nao_informado: 'Não informado' };
export const AGE_GROUP_LABELS: Record<string, string> = {
  menor_1_ano: 'Menor de 1 ano',
  '1_ano_ou_mais': '1 ano ou mais',
  nao_informada: 'Não informada',
};

/** Cobertura em %, com 1 casa; null quando não há população estimada válida. */
export function coverage(vaccinatedAnimals: number, estimatedPopulation: number | null | undefined): number | null {
  if (!estimatedPopulation || estimatedPopulation <= 0 || !Number.isFinite(estimatedPopulation)) return null;
  return Math.round((vaccinatedAnimals / estimatedPopulation) * 1000) / 10;
}

export interface SpeciesCounts {
  doses: number;
  animals: number;
}

export interface CampaignPopulation {
  est_dog_population?: number | null;
  est_cat_population?: number | null;
  target_dog_coverage_pct?: number | null;
  target_cat_coverage_pct?: number | null;
  population_source?: string | null;
}

export interface CampaignIndicators {
  dogsVaccinated: number;
  catsVaccinated: number;
  animalsVaccinated: number;
  doses: number;
  dogCoverage: number | null;
  catCoverage: number | null;
  dogTarget: number | null;
  catTarget: number | null;
  /** null = sem meta ou sem cobertura calculável */
  dogTargetReached: boolean | null;
  catTargetReached: boolean | null;
  coverageAvailable: boolean;
}

export function campaignIndicators(bySpecies: Partial<Record<Species, SpeciesCounts>>, campaign: CampaignPopulation | null): CampaignIndicators {
  const dogs = bySpecies.canina ?? { doses: 0, animals: 0 };
  const cats = bySpecies.felina ?? { doses: 0, animals: 0 };
  const hasSource = !!campaign?.population_source?.trim();
  const dogCoverage = hasSource ? coverage(dogs.animals, campaign?.est_dog_population) : null;
  const catCoverage = hasSource ? coverage(cats.animals, campaign?.est_cat_population) : null;
  const dogTarget = campaign?.target_dog_coverage_pct ?? null;
  const catTarget = campaign?.target_cat_coverage_pct ?? null;
  return {
    dogsVaccinated: dogs.animals,
    catsVaccinated: cats.animals,
    animalsVaccinated: dogs.animals + cats.animals,
    doses: dogs.doses + cats.doses,
    dogCoverage,
    catCoverage,
    dogTarget,
    catTarget,
    dogTargetReached: dogCoverage === null || dogTarget === null ? null : dogCoverage >= Number(dogTarget),
    catTargetReached: catCoverage === null || catTarget === null ? null : catCoverage >= Number(catTarget),
    coverageAvailable: dogCoverage !== null || catCoverage !== null,
  };
}

export interface LocalityRow {
  neighborhood_id: string | null;
  name: string | null;
  species: Species;
  animals: number;
  est_dog_population?: number | null;
  est_cat_population?: number | null;
}

/** Localidades ordenadas da menor para a maior cobertura canina estimada (só as com estimativa). */
export function lowestCoverageLocalities(rows: LocalityRow[], limit = 5): { name: string; coverage: number; animals: number; population: number }[] {
  const dogs = rows.filter((r) => r.species === 'canina' && r.neighborhood_id && r.est_dog_population && r.est_dog_population > 0);
  return dogs
    .map((r) => ({ name: r.name || 'Localidade', coverage: coverage(r.animals, r.est_dog_population)!, animals: r.animals, population: r.est_dog_population! }))
    .sort((a, b) => a.coverage - b.coverage)
    .slice(0, limit);
}

// ----------------------------------------------------------------------------
// Estoque por lote
// ----------------------------------------------------------------------------
export interface StockMovementLike {
  movement_type: string;
  quantity: number;
  team_id?: string | null;
}

/** Saldo de uma equipe num lote (mesma regra de `zoo_team_batch_balance`). */
export function teamBatchBalance(movements: StockMovementLike[], teamId: string): number {
  return movements
    .filter((m) => m.team_id === teamId)
    .reduce((acc, m) => {
      if (m.movement_type === 'distribuicao_equipe' || m.movement_type === 'estorno_equipe') return acc + m.quantity;
      if (m.movement_type === 'devolucao' || m.movement_type === 'aplicacao_equipe' || m.movement_type === 'perda_equipe') return acc - m.quantity;
      return acc;
    }, 0);
}

/** Saldo central de um lote a partir das movimentações (mesma regra da trigger de estoque). */
export function centralBatchBalance(movements: StockMovementLike[], ajustes: { delta: number }[] = []): number {
  const plus = ['entrada', 'devolucao', 'estorno_aplicacao'];
  const minus = ['saida', 'uso_operacao', 'distribuicao_ace', 'distribuicao_equipe', 'perda', 'vencimento'];
  return (
    movements.reduce((acc, m) => (plus.includes(m.movement_type) ? acc + m.quantity : minus.includes(m.movement_type) ? acc - m.quantity : acc), 0) +
    ajustes.reduce((a, b) => a + b.delta, 0)
  );
}

export function isBatchExpired(expirationDate: string, onDate: string): boolean {
  return expirationDate < onDate;
}

export function daysToExpire(expirationDate: string, today: string): number {
  const ms = new Date(`${expirationDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime();
  return Math.round(ms / 86400000);
}

export type BatchAlert = 'vencido' | 'vence_em_30_dias' | 'saldo_baixo' | null;

export function batchAlert(batch: { expiration_date: string; central_balance: number; minimum_stock?: number | null }, today: string): BatchAlert {
  if (isBatchExpired(batch.expiration_date, today) && batch.central_balance > 0) return 'vencido';
  if (daysToExpire(batch.expiration_date, today) <= 30 && batch.central_balance > 0) return 'vence_em_30_dias';
  if (batch.minimum_stock != null && batch.central_balance < Number(batch.minimum_stock)) return 'saldo_baixo';
  return null;
}

// ----------------------------------------------------------------------------
// Busca ativa
// ----------------------------------------------------------------------------
export type CampaignVaccinationStatus = 'vacinado' | 'nao_vacinado_confirmado' | 'sem_informacao';

/**
 * Situação do animal na campanha: vacinado só com dose válida registrada;
 * "não vacinado" só com tentativa de visita que confirmou (não vacinado ou recusa);
 * o resto é "sem informação" — nunca presumido como não vacinado.
 */
export function animalCampaignStatus(hasValidDose: boolean, attemptResults: string[]): CampaignVaccinationStatus {
  if (hasValidDose) return 'vacinado';
  if (attemptResults.some((r) => r === 'nao_vacinado' || r === 'recusa')) return 'nao_vacinado_confirmado';
  return 'sem_informacao';
}
