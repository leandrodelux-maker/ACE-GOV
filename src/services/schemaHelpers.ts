import { supabase } from './supabaseClient';

/**
 * Utilitários que refletem o esquema real do banco (conferido em homologação e no
 * projeto Supabase): `agents` não tem nome (o nome vem do perfil vinculado),
 * `properties` guarda endereço em `street`/`number` e a reincidência de focos é
 * calculada a partir de `breeding_sites` (não há coluna de contagem no imóvel).
 */

/** Trecho de select para embutir o agente com o nome do perfil. */
export const AGENT_EMBED = 'employee_number, profiles(full_name)';

export function agentName(agent: any): string | undefined {
  if (!agent) return undefined;
  return agent.profiles?.full_name || (agent.employee_number ? `Matrícula ${agent.employee_number}` : undefined);
}

export function formatAddress(p: any): string | undefined {
  if (!p?.street) return undefined;
  return `${p.street}, ${p.number || 'S/N'}${p.complement ? ` - ${p.complement}` : ''}`;
}

/**
 * Focos registrados por imóvel (breeding_sites) desde `sinceDays` dias atrás.
 * Reincidente = 2 ou mais focos no período.
 */
export async function fetchFociByProperty(municipalityId: string, sinceDays = 365): Promise<Map<string, number>> {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const { data, error } = await supabase
    .from('breeding_sites')
    .select('property_id')
    .eq('municipality_id', municipalityId)
    .gte('identified_at', since)
    .not('property_id', 'is', null);
  if (error) throw new Error(error.message);
  const map = new Map<string, number>();
  (data || []).forEach((r: any) => map.set(r.property_id, (map.get(r.property_id) || 0) + 1));
  return map;
}

export const RECURRENCE_MIN_FOCI = 2;

/** Situações de pendência gravadas pela RPC ('pendente') e por telas antigas ('PENDENTE'). */
export const PENDING_STATUSES = ['pendente', 'PENDENTE'];

/** Criadouro ativo: a RPC grava 'ativo'; o padrão da tabela é 'ATIVO'. */
export const ACTIVE_FOCUS_STATUSES = ['ativo', 'ATIVO'];
export const ELIMINATED_FOCUS_STATUSES = ['eliminado', 'ELIMINADO'];

/** Resultado da visita normalizado (a RPC grava minúsculas; 'recusa' e 'recusado' são equivalentes). */
export function normResult(r: unknown): 'TRABALHADO' | 'FECHADO' | 'RECUSA' | 'DESABITADO' | 'OUTRO' {
  const v = String(r ?? '').toUpperCase();
  if (v === 'TRABALHADO') return 'TRABALHADO';
  if (v === 'FECHADO') return 'FECHADO';
  if (v === 'RECUSA' || v === 'RECUSADO') return 'RECUSA';
  if (v === 'DESABITADO') return 'DESABITADO';
  return 'OUTRO';
}

/**
 * Vistoria de ponto estratégico/imóvel especial vencida: usa next_inspection quando
 * existe; senão, última vistoria + frequência (padrão quinzenal). Sem vistoria = vencido.
 */
export function isInspectionOverdue(sp: any, now = new Date()): boolean {
  const today = now.toISOString().split('T')[0];
  if (sp?.next_inspection) return sp.next_inspection < today;
  if (!sp?.last_inspection) return true;
  const freq = Number(sp.inspection_frequency_days) || 15;
  return now.getTime() - new Date(`${sp.last_inspection}T00:00:00`).getTime() > freq * 86400000;
}
