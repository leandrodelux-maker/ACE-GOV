import { supabase } from './supabaseClient';
import { requireMunicipalityId } from './municipalityScope';
import { IntersectoralReferral } from '../types';

/**
 * Encaminhamentos intersetoriais.
 *
 * Usa a tabela `intersectoral_referrals` quando ela existe (migração
 * supabase/migrations/20260923000032_intersectoral_referrals.sql). Enquanto
 * não existir, `available` é false e a tela usa o modo local com aviso.
 */

/** Códigos de "tabela inexistente" (Postgres e PostgREST). */
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205', 'PGRST202']);

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return MISSING_TABLE_CODES.has(error.code || '') || /could not find the table|does not exist/i.test(error.message || '');
}

function fromRow(r: any): IntersectoralReferral {
  return {
    id: r.id,
    protocol: r.protocol,
    municipalityId: r.municipality_id,
    propertyAddress: r.property_address,
    neighborhood: r.neighborhood || '',
    targetSector: r.target_sector,
    description: r.description,
    issuedByAgentName: r.issued_by_name || '',
    status: r.status,
    createdAt: String(r.created_at).slice(0, 10),
  } as IntersectoralReferral;
}

export const referralService = {
  async list(municipalityId: string): Promise<{ available: boolean; items: IntersectoralReferral[]; error?: string }> {
    const { data, error } = await supabase
      .from('intersectoral_referrals')
      .select('*')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .order('created_at', { ascending: false });
    if (isMissingTable(error)) return { available: false, items: [] };
    if (error) return { available: true, items: [], error: error.message };
    return { available: true, items: (data || []).map(fromRow) };
  },

  async create(
    municipalityId: string,
    input: Pick<IntersectoralReferral, 'protocol' | 'propertyAddress' | 'neighborhood' | 'targetSector' | 'description'> & {
      issuedBy?: string;
      issuedByName?: string;
    }
  ): Promise<IntersectoralReferral> {
    const { data, error } = await supabase
      .from('intersectoral_referrals')
      .insert({
        municipality_id: requireMunicipalityId(municipalityId),
        protocol: input.protocol,
        target_sector: input.targetSector,
        property_address: input.propertyAddress,
        neighborhood: input.neighborhood || null,
        description: input.description,
        issued_by: input.issuedBy ?? null,
        issued_by_name: input.issuedByName ?? null,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message || 'Não foi possível registrar o encaminhamento.');
    return fromRow(data);
  },

  async setStatus(municipalityId: string, id: string, status: IntersectoralReferral['status']): Promise<void> {
    const { error } = await supabase
      .from('intersectoral_referrals')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('municipality_id', requireMunicipalityId(municipalityId));
    if (error) throw new Error(error.message);
  },
};
