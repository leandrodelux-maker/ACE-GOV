/**
 * Escopo municipal obrigatório.
 *
 * Todo serviço que lê ou grava dados de um município recebe o ID do município
 * da sessão autenticada explicitamente. Não existe município padrão: sem ID a
 * operação é bloqueada (falha fechada). O isolamento definitivo continua sendo
 * garantido pelas políticas RLS do banco; este guarda evita consultas e
 * gravações com escopo errado a partir do navegador.
 */

/** UUID do município de exemplo das migrations de seed — nunca deve ser usado como padrão. */
export const EXAMPLE_MUNICIPALITY_ID = '00000000-0000-0000-0000-000000000001';

export class MissingMunicipalityError extends Error {
  constructor() {
    super('Município da sessão não informado: operação bloqueada para preservar o isolamento entre municípios.');
    this.name = 'MissingMunicipalityError';
  }
}

export function requireMunicipalityId(municipalityId: string | null | undefined): string {
  if (!municipalityId || typeof municipalityId !== 'string') throw new MissingMunicipalityError();
  return municipalityId;
}
