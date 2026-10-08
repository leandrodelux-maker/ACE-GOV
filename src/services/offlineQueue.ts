/**
 * Fila offline genérica dos módulos LIRAa/LIA e Vacinação Antirrábica.
 *
 * Mesmas garantias da fila de visitas (offlineVisitQueue.ts), que continua intacta:
 *  - Sem perda: o resultado do envio é aplicado sobre a fila RELIDA do armazenamento.
 *  - Sem duplicidade: cada registro tem `id` gerado no aparelho; reenfileirar o mesmo
 *    id não cria item novo e as RPCs respondem `duplicated` quando o id já existe.
 *  - Uma sincronização por fila de cada vez.
 *  - Itens de outro município ou de outro usuário (troca de sessão no aparelho)
 *    não são enviados: aguardam o autor entrar de novo.
 *
 * Armazenamento: localStorage do navegador, apenas dados operacionais mínimos
 * (sem credenciais). As filas são preservadas no logout (authService.clearLocalCaches):
 * registros pendentes nunca são descartados silenciosamente.
 */
import { OFFLINE_QUEUE_EVENT, QueueStorage } from './offlineVisitQueue';

export type QueueKind = 'liraa_inspection' | 'vaccination' | 'search_attempt';

export interface QueuedRecord<P = Record<string, unknown>> {
  id: string;
  kind: QueueKind;
  municipality_id: string;
  /** perfil que criou o registro: só a mesma sessão envia (autoria preservada) */
  profile_id: string;
  payload: P;
  /** texto curto para a lista de pendências (sem dados pessoais) */
  label: string;
  created_at: string;
  status: 'pendente' | 'erro';
  retryCount: number;
  lastError?: string;
}

export interface SubmitOutcome {
  success: boolean;
  duplicated?: boolean;
  /** erro definitivo (validação do servidor): fica na fila marcado como erro para correção */
  message?: string;
}

export const MODULE_QUEUE_KEYS: Record<QueueKind, string> = {
  liraa_inspection: 'endemias_queue_liraa_v1',
  vaccination: 'endemias_queue_vacinacao_v1',
  search_attempt: 'endemias_queue_busca_ativa_v1',
};

function defaultStorage(): QueueStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function readModuleQueue(kind: QueueKind, storage: QueueStorage | null = defaultStorage()): QueuedRecord[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(MODULE_QUEUE_KEYS[kind]) || '[]');
    return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.id === 'string' && r.kind === kind) : [];
  } catch {
    return [];
  }
}

function writeModuleQueue(kind: QueueKind, items: QueuedRecord[], storage: QueueStorage | null): void {
  if (!storage) throw new Error('Armazenamento local indisponível: não foi possível guardar o registro offline.');
  storage.setItem(MODULE_QUEUE_KEYS[kind], JSON.stringify(items));
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
  } catch {
    /* ambiente sem DOM (testes) */
  }
}

export function enqueueRecord(record: Omit<QueuedRecord, 'status' | 'retryCount' | 'created_at'> & { created_at?: string },
  storage: QueueStorage | null = defaultStorage()): QueuedRecord[] {
  const queue = readModuleQueue(record.kind, storage);
  if (queue.some((q) => q.id === record.id)) return queue;
  const next = [...queue, { ...record, created_at: record.created_at ?? new Date().toISOString(), status: 'pendente' as const, retryCount: 0 }];
  writeModuleQueue(record.kind, next, storage);
  return next;
}

/** Remove um item com erro definitivo após o usuário confirmar o descarte. */
export function discardRecord(kind: QueueKind, id: string, storage: QueueStorage | null = defaultStorage()): void {
  writeModuleQueue(kind, readModuleQueue(kind, storage).filter((q) => q.id !== id), storage);
}

export function pendingModuleCount(storage: QueueStorage | null = defaultStorage()): number {
  return (Object.keys(MODULE_QUEUE_KEYS) as QueueKind[]).reduce((acc, k) => acc + readModuleQueue(k, storage).length, 0);
}

const inProgress = new Set<QueueKind>();

export interface ModuleSyncSummary {
  synced: number;
  failed: number;
  remaining: QueuedRecord[];
  skippedReason?: string;
}

/** Erros de rede/sessão ficam como "pendente" para reenvio automático; validação vira "erro". */
export function isTransientError(message: string | undefined): boolean {
  return !message || /failed to fetch|network|fetch|timeout|jwt|not_authenticated|503|502|504/i.test(message);
}

export async function syncModuleQueue(
  kind: QueueKind,
  submit: (record: QueuedRecord) => Promise<SubmitOutcome>,
  session: { municipalityId: string; profileId: string },
  storage: QueueStorage | null = defaultStorage()
): Promise<ModuleSyncSummary> {
  if (inProgress.has(kind)) {
    return { synced: 0, failed: 0, remaining: readModuleQueue(kind, storage), skippedReason: 'Sincronização já em andamento.' };
  }
  inProgress.add(kind);
  try {
    const snapshot = readModuleQueue(kind, storage);
    const done = new Set<string>();
    const failures = new Map<string, { message: string; transient: boolean }>();

    for (const item of snapshot) {
      if (item.municipality_id !== session.municipalityId || item.profile_id !== session.profileId) continue;
      try {
        const res = await submit(item);
        if (res.success) done.add(item.id);
        else failures.set(item.id, { message: res.message || 'Falha ao enviar.', transient: false });
      } catch (err: any) {
        const message = err?.message || 'Erro de conexão.';
        failures.set(item.id, { message, transient: isTransientError(message) });
      }
    }

    const latest = readModuleQueue(kind, storage);
    const remaining = latest
      .filter((q) => !done.has(q.id))
      .map((q) => {
        const f = failures.get(q.id);
        if (!f) return q;
        return { ...q, status: f.transient ? ('pendente' as const) : ('erro' as const), retryCount: q.retryCount + 1, lastError: f.message };
      });
    writeModuleQueue(kind, remaining, storage);
    return { synced: done.size, failed: failures.size, remaining };
  } finally {
    inProgress.delete(kind);
  }
}

// ----------------------------------------------------------------------------
// Rascunhos de formulário (por aparelho)
// ----------------------------------------------------------------------------
const DRAFT_PREFIX = 'endemias_rascunho_v1_';

export function saveDraft<T>(key: string, value: T, storage: QueueStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(DRAFT_PREFIX + key, JSON.stringify({ saved_at: new Date().toISOString(), value }));
  } catch {
    /* sem espaço: rascunho é conveniência */
  }
}

export function loadDraft<T>(key: string, storage: QueueStorage | null = defaultStorage()): { saved_at: string; value: T } | null {
  try {
    const raw = storage?.getItem(DRAFT_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** UUID v4 gerado no aparelho (idempotência dos registros offline). */
export function newRecordId(): string {
  return globalThis.crypto.randomUUID();
}
