import { supabase } from './supabaseClient';
import { requireMunicipalityId } from './municipalityScope';

/**
 * Trilha de auditoria (tabela `audit_logs`).
 * Leitura: RLS exige `auditoria.view` no município. Inserção: próprio município.
 * Não há UPDATE/DELETE (retenção obrigatória).
 */

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  action: string;
  module: string;
  entity: string;
  entityId: string | null;
  oldData: unknown;
  newData: unknown;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  error?: string;
}

export const auditLogService = {
  async list(
    municipalityId: string,
    options: { page?: number; pageSize?: number; module?: string; action?: string; search?: string } = {}
  ): Promise<AuditLogPage> {
    const munId = requireMunicipalityId(municipalityId);
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 50));
    const from = (page - 1) * pageSize;

    let query = supabase
      .from('audit_logs')
      .select('id, created_at, user_id, action, module, entity, entity_id, old_data, new_data, profiles(full_name)', {
        count: 'exact',
      })
      .eq('municipality_id', munId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (options.module) query = query.eq('module', options.module);
    if (options.action) query = query.eq('action', options.action);
    if (options.search) {
      const term = options.search.replace(/[%,()]/g, ' ').trim();
      if (term) query = query.or(`entity.ilike.%${term}%,entity_id.ilike.%${term}%,module.ilike.%${term}%`);
    }

    const { data, error, count } = await query;
    if (error) return { items: [], total: 0, error: error.message };

    return {
      total: count ?? 0,
      items: (data || []).map((r: any) => ({
        id: r.id,
        createdAt: r.created_at,
        userId: r.user_id ?? null,
        userName: r.profiles?.full_name ?? null,
        action: r.action,
        module: r.module,
        entity: r.entity,
        entityId: r.entity_id ?? null,
        oldData: r.old_data ?? null,
        newData: r.new_data ?? null,
      })),
    };
  },

  /** Registra um evento. Falha de gravação não interrompe a operação principal, mas é devolvida. */
  async log(entry: {
    municipalityId: string;
    userId?: string | null;
    action: string;
    module: string;
    entity: string;
    entityId?: string | null;
    oldData?: unknown;
    newData?: unknown;
  }): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('audit_logs').insert({
      municipality_id: requireMunicipalityId(entry.municipalityId),
      user_id: entry.userId ?? null,
      action: entry.action,
      module: entry.module,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      old_data: entry.oldData ?? null,
      new_data: entry.newData ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  },
};
