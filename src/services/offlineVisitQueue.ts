/**
 * Fila offline de visitas do PWA do ACE.
 *
 * Garantias:
 *  - Sem perda: o resultado do envio é aplicado sobre a fila RELIDA do
 *    armazenamento, então visitas enfileiradas durante a sincronização são mantidas.
 *  - Sem duplicidade: cada visita tem `id` gerado no dispositivo; enfileirar o
 *    mesmo id duas vezes não cria item novo, e a RPC `submit_official_visit`
 *    responde `duplicated` quando o id já existe no banco (reenvio seguro).
 *  - Sem envio concorrente: uma sincronização por vez.
 */

export const OFFLINE_QUEUE_KEY = 'endemias_sync_queue';
/** Evento disparado na janela sempre que a fila muda (o evento 'storage' só cobre outras abas). */
export const OFFLINE_QUEUE_EVENT = 'endemias:offline-queue-changed';

export interface QueueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface QueuedVisit {
  id: string;
  municipality_id: string;
  agent_id: string;
  cycle_id?: string | null;
  status?: 'pendente' | 'erro';
  retryCount?: number;
  lastError?: string;
  [key: string]: unknown;
}

export interface SubmitResult {
  success: boolean;
  duplicated?: boolean;
  message?: string;
}

export interface SyncSummary {
  synced: number;
  failed: number;
  remaining: QueuedVisit[];
  skippedReason?: string;
}

function defaultStorage(): QueueStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function readQueue(storage: QueueStorage | null = defaultStorage()): QueuedVisit[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((v) => v && typeof v.id === 'string') : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedVisit[], storage: QueueStorage | null): void {
  if (!storage) throw new Error('Armazenamento local indisponível: não foi possível guardar a fila offline.');
  storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
  } catch {
    /* ambiente sem DOM (testes) */
  }
}

/** Adiciona uma visita à fila (ignora id já enfileirado). */
export function enqueueVisit(item: QueuedVisit, storage: QueueStorage | null = defaultStorage()): QueuedVisit[] {
  const queue = readQueue(storage);
  if (queue.some((q) => q.id === item.id)) return queue;
  const next = [...queue, { ...item, status: 'pendente' as const, retryCount: item.retryCount ?? 0 }];
  writeQueue(next, storage);
  return next;
}

let syncInProgress = false;

export function isSyncInProgress(): boolean {
  return syncInProgress;
}

/**
 * Envia a fila. Itens de outro município (sessão trocada no aparelho) não são
 * enviados com o município atual — permanecem na fila.
 */
export async function syncQueue(
  submit: (item: QueuedVisit) => Promise<SubmitResult>,
  context: { municipalityId: string; cycleId: string | null },
  storage: QueueStorage | null = defaultStorage()
): Promise<SyncSummary> {
  if (syncInProgress) {
    return { synced: 0, failed: 0, remaining: readQueue(storage), skippedReason: 'Sincronização já em andamento.' };
  }
  syncInProgress = true;
  try {
    const snapshot = readQueue(storage);
    const done = new Set<string>();
    const failures = new Map<string, string>();

    for (const item of snapshot) {
      // Itens antigos (sem município gravado) seguem com o município da sessão atual.
      if (item.municipality_id && item.municipality_id !== context.municipalityId) continue;
      const cycleId = item.cycle_id ?? context.cycleId;
      if (!cycleId) {
        failures.set(item.id, 'Nenhum ciclo de campo em andamento para o município.');
        continue;
      }
      try {
        const res = await submit({ ...item, municipality_id: context.municipalityId, cycle_id: cycleId });
        if (res.success) done.add(item.id);
        else failures.set(item.id, res.message || 'Falha ao registrar visita.');
      } catch (err: any) {
        failures.set(item.id, err?.message || 'Erro de conexão.');
      }
    }

    // Relê a fila atual: preserva o que foi enfileirado durante o envio.
    const latest = readQueue(storage);
    const remaining = latest
      .filter((q) => !done.has(q.id))
      .map((q) =>
        failures.has(q.id)
          ? { ...q, status: 'erro' as const, retryCount: (q.retryCount || 0) + 1, lastError: failures.get(q.id) }
          : q
      );
    writeQueue(remaining, storage);

    return { synced: done.size, failed: failures.size, remaining };
  } finally {
    syncInProgress = false;
  }
}
