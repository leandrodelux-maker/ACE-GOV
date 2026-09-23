/**
 * Município do Portal do Cidadão (rotas públicas, sem sessão).
 *
 * Ordem de resolução:
 *  1. `?municipio=<uuid>` no link oficial divulgado pela prefeitura
 *     (guardado na sessão do navegador para as páginas seguintes do portal);
 *  2. variável de ambiente `VITE_PUBLIC_MUNICIPALITY_ID` (implantação de um município);
 *  3. nenhum => o portal informa que não está configurado.
 *
 * Nunca usa o UUID de exemplo das migrations como padrão.
 */
const STORAGE_KEY = 'endemias_public_municipality_id';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidMunicipalityId(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value);
}

export function resolvePublicMunicipalityId(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('municipio');
    if (isValidMunicipalityId(fromUrl)) {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const remembered = sessionStorage.getItem(STORAGE_KEY);
    if (isValidMunicipalityId(remembered)) return remembered;
  } catch {
    /* ambiente sem DOM/armazenamento */
  }
  const fromEnv = (import.meta as any).env?.VITE_PUBLIC_MUNICIPALITY_ID as string | undefined;
  return isValidMunicipalityId(fromEnv) ? fromEnv : null;
}
