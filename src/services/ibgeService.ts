import { supabase } from './supabaseClient';
import { requireMunicipalityId } from './municipalityScope';

/**
 * Integração com as APIs públicas do IBGE (sem credencial, CORS liberado):
 *  - Localidades: nome e UF oficiais pelo código do município;
 *  - Agregado 6579 (estimativas de população), variável 9324: população estimada.
 * O resultado é guardado em system_settings (chave IBGE_OFICIAL) do município.
 */
const IBGE_API = 'https://servicodados.ibge.gov.br/api';
export const IBGE_SETTING_KEY = 'IBGE_OFICIAL';

export interface IbgeMunicipalityData {
  ibgeCode: string;
  name: string;
  uf: string;
  population: number | null;
  populationYear: string | null;
  fetchedAt: string;
}

export function isValidIbgeCode(code: string): boolean {
  return /^\d{7}$/.test((code || '').trim());
}

export const ibgeService = {
  async lookupMunicipality(ibgeCode: string, fetchImpl: typeof fetch = fetch): Promise<IbgeMunicipalityData> {
    const code = (ibgeCode || '').trim();
    if (!isValidIbgeCode(code)) throw new Error('Código IBGE inválido: informe os 7 dígitos do município.');

    const locRes = await fetchImpl(`${IBGE_API}/v1/localidades/municipios/${code}`);
    if (!locRes.ok) throw new Error(`IBGE (localidades) respondeu ${locRes.status}.`);
    const loc: any = await locRes.json();
    // Código inexistente: a API responde 200 com corpo vazio
    if (!loc || !loc.nome) throw new Error(`Município com código IBGE ${code} não encontrado.`);
    const uf = loc.microrregiao?.mesorregiao?.UF?.sigla || loc['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla || '';

    let population: number | null = null;
    let populationYear: string | null = null;
    try {
      const popRes = await fetchImpl(`${IBGE_API}/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[${code}]`);
      if (popRes.ok) {
        const pop: any = await popRes.json();
        const serie = pop?.[0]?.resultados?.[0]?.series?.[0]?.serie || {};
        const [year, value] = Object.entries(serie)[0] || [];
        const n = Number(value);
        if (year && Number.isFinite(n) && n > 0) {
          population = n;
          populationYear = String(year);
        }
      }
    } catch {
      /* população indisponível: segue só com nome/UF */
    }

    return { ibgeCode: code, name: loc.nome, uf, population, populationYear, fetchedAt: new Date().toISOString() };
  },

  /** Dados oficiais já sincronizados para o município (ou null). */
  async getStored(municipalityId: string): Promise<IbgeMunicipalityData | null> {
    const munId = requireMunicipalityId(municipalityId);
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('municipality_id', munId)
      .eq('setting_key', IBGE_SETTING_KEY)
      .maybeSingle();
    return (data?.setting_value as IbgeMunicipalityData) || null;
  },

  /**
   * Sincroniza pelo código IBGE cadastrado no município: consulta a API, grava
   * em system_settings e registra o job em integration_jobs.
   */
  async syncMunicipality(municipalityId: string): Promise<{ success: boolean; data?: IbgeMunicipalityData; error?: string }> {
    const munId = requireMunicipalityId(municipalityId);
    const startedAt = new Date().toISOString();
    const finishJob = async (status: 'sucesso' | 'erro', details: string, created = 0, updated = 0) => {
      await supabase.from('integration_jobs').insert({
        municipality_id: munId,
        provider: 'ibge',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        records_read: status === 'sucesso' ? 1 : 0,
        records_created: created,
        records_updated: updated,
        errors: status === 'erro' ? 1 : 0,
        status,
        log_details: { mensagem: details },
      });
    };
    try {
      const { data: mun, error: munErr } = await supabase.from('municipalities').select('ibge_code').eq('id', munId).maybeSingle();
      if (munErr) throw new Error(munErr.message);
      if (!mun?.ibge_code) throw new Error('O município não tem código IBGE cadastrado.');

      const data = await this.lookupMunicipality(mun.ibge_code);
      const previous = await this.getStored(munId);
      const { error: saveErr } = await supabase
        .from('system_settings')
        .upsert({ municipality_id: munId, setting_key: IBGE_SETTING_KEY, setting_value: data }, { onConflict: 'municipality_id,setting_key' });
      if (saveErr) throw new Error(saveErr.message);

      await finishJob('sucesso', `IBGE ${data.ibgeCode}: ${data.name}/${data.uf}; população ${data.population ?? 'indisponível'} (${data.populationYear ?? '-'})`, previous ? 0 : 1, previous ? 1 : 0);
      return { success: true, data };
    } catch (err: any) {
      const message = err?.message || 'Falha ao consultar o IBGE.';
      await finishJob('erro', message).catch(() => undefined);
      return { success: false, error: message };
    }
  },
};
