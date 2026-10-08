/**
 * Acesso a dados do módulo LIRAa/LIA. Escritas sensíveis (sorteio, situação,
 * inspeções, laboratório) passam pelas RPCs da migração 38, que validam permissão,
 * município, situação do levantamento e registram auditoria.
 */
import { supabase } from '../supabaseClient';
import { requireMunicipalityId } from '../municipalityScope';
import { AGENT_EMBED, agentName, formatAddress } from '../schemaHelpers';
import type { DepositCategory } from './liraaMethodology';

export type SurveyStatus = 'planejamento' | 'execucao' | 'conferencia' | 'encerrado' | 'cancelado';
export type SurveyType = 'LIRAa' | 'LIA';
export type SampleStatus = 'selecionado' | 'trabalhado' | 'fechado' | 'recusa' | 'inexistente' | 'cancelado';
export type InspectionSituation = 'trabalhado' | 'fechado' | 'recusa' | 'inexistente';
export type LabResult = 'aedes_aegypti' | 'aedes_albopictus' | 'aegypti_e_albopictus' | 'outros_culicideos' | 'negativo' | 'inconclusivo';

export const STATUS_LABELS: Record<SurveyStatus, string> = {
  planejamento: 'Planejamento',
  execucao: 'Execução',
  conferencia: 'Conferência',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
};

export const SITUATION_LABELS: Record<InspectionSituation | 'selecionado' | 'cancelado', string> = {
  selecionado: 'A visitar',
  trabalhado: 'Trabalhado',
  fechado: 'Fechado',
  recusa: 'Recusa',
  inexistente: 'Inexistente',
  cancelado: 'Cancelado',
};

export const LAB_RESULT_LABELS: Record<LabResult, string> = {
  aedes_aegypti: 'Aedes aegypti',
  aedes_albopictus: 'Aedes albopictus',
  aegypti_e_albopictus: 'Ae. aegypti e Ae. albopictus',
  outros_culicideos: 'Outros culicídeos',
  negativo: 'Negativo',
  inconclusivo: 'Inconclusivo',
};

export const TUBE_STATUS_LABELS: Record<string, string> = {
  coletada: 'Pendente (em campo)',
  recebida: 'Recebida',
  analisada: 'Analisada',
  inconclusiva: 'Inconclusiva',
  descartada: 'Descartada',
};

export interface LiraaSurvey {
  id: string;
  municipality_id: string;
  type: SurveyType;
  name: string;
  year: number;
  cycle_number: number;
  start_date: string;
  end_date: string;
  status: SurveyStatus;
  total_properties: number;
  total_blocks: number | null;
  sample_properties: number;
  rule_set_id: string | null;
  coordinator_id: string | null;
  rules_confirmed_at: string | null;
  rules_confirmation_note: string | null;
  status_changed_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface LiraaStratum {
  id: string;
  survey_id: string;
  name: string;
  code: string;
  stratum_number: number | null;
  neighborhood_ids: string[];
  total_properties: number;
  total_blocks: number;
  sample_size: number;
  inspection_step: number | null;
}

export interface RuleSet {
  id: string;
  code: string;
  version: string;
  kind: 'amostragem_liraa' | 'amostragem_lia' | 'classificacao_risco';
  params: any;
  source: string;
  validation_status: 'referencia_oficial' | 'pendente_validacao';
  validation_notes: string | null;
}

export interface UniverseRow {
  neighborhood_id: string;
  neighborhood_name: string;
  eligible_properties: number;
  blocks: number;
  without_block: number;
  strategic_points: number;
}

export interface DrawRow {
  id: string;
  stratum_id: string;
  rule_code: string;
  rule_version: string;
  algorithm: string;
  seed: string;
  parameters: Record<string, any>;
  universe_count: number;
  universe_hash: string;
  selected_blocks: number;
  selected_properties: number;
  status: 'vigente' | 'substituido';
  executed_at: string;
  executed_by_name?: string;
}

export interface SampleRow {
  id: string;
  stratum_id: string;
  property_id: string;
  block_id: string | null;
  block_code: string | null;
  agent_id: string | null;
  agent_name?: string;
  status: SampleStatus;
  selection_type: 'sorteado' | 'substituto';
  replacement_of: string | null;
  ordinal: number | null;
  address?: string;
  property_code?: string | null;
  neighborhood?: string;
  neighborhood_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  visited_at: string | null;
}

export interface TubeRow {
  id: string;
  tube_label: string;
  deposit_category: DepositCategory | null;
  collection_type: string;
  status: string;
  lab_result: LabResult | null;
  collection_date: string;
  received_at: string | null;
  analyzed_at: string | null;
  discard_reason: string | null;
  notes: string | null;
  liraa_inspection_id: string;
  property_address?: string;
  agent_name?: string;
}

export interface UnitCounts {
  level: 'stratum' | 'neighborhood' | 'municipality';
  unit_id: string;
  unit_name: string;
  programmed: number;
  pending: number;
  substitutes: number;
  situations: Partial<Record<InspectionSituation, number>> | null;
  vacant_lots: number;
  field_positive_properties: number;
  positive_properties_aegypti: number;
  positive_properties_albopictus: number;
  positive_recipients_aegypti: Record<string, number> | null;
  positive_recipients_albopictus: number;
  inspected_recipients: Record<string, number> | null;
  tubes_by_status: Record<string, number> | null;
}

export interface AgentCounts {
  agent_id: string | null;
  name: string | null;
  inspections: number;
  worked: number;
  closed: number;
  refused: number;
  days: number;
  first_at: string | null;
  last_at: string | null;
}

export interface SurveyCounts {
  survey_id: string;
  status: SurveyStatus;
  units: UnitCounts[];
  agents: AgentCounts[];
}

const FRIENDLY: [RegExp, string][] = [
  [/schema cache|PGRST20[25]|Could not find the (table|function)/i, 'Este módulo ainda não foi instalado no banco de dados do município (migrações pendentes). Procure o administrador do sistema.'],
  [/regras_pendentes_validacao/, 'As regras desta modalidade estão pendentes de validação técnica. Registre a confirmação da coordenação antes do sorteio.'],
  [/modalidade_incompativel/, 'A modalidade não corresponde ao porte do município (Portaria GM/MS 3.129/2016).'],
  [/levantamento_bloqueado/, 'O levantamento não permite esta alteração na situação atual.'],
  [/tubitos_incoerentes/, 'Colete um tubito para cada depósito positivo (a quantidade de tubitos deve ser igual à de depósitos com larvas/pupas, por tipo).'],
  [/amostra_ja_resolvida/, 'Este imóvel já foi registrado no levantamento.'],
  [/uq_ento_samples_liraa_tube|duplicate key value.*tube/, 'Já existe tubito com esta identificação no levantamento. Use outra numeração.'],
  [/forbidden/, 'Seu perfil não tem permissão para esta operação.'],
  [/not_authenticated|JWT/, 'Sessão expirada. Entre novamente.'],
];

export function friendlyError(message: string | undefined): string {
  if (!message) return 'Não foi possível concluir a operação.';
  const hit = FRIENDLY.find(([re]) => re.test(message));
  const detail = message.includes(':') ? message.slice(message.indexOf(':') + 1).trim() : '';
  return hit ? (detail && !/^\s*$/.test(detail) && !hit[1].includes(detail) ? `${hit[1]} (${detail})` : hit[1]) : message;
}

function fail(error: { message: string } | null): never {
  throw new Error(friendlyError(error?.message));
}

export const liraaModuleService = {
  async listRuleSets(): Promise<RuleSet[]> {
    const { data, error } = await supabase.from('liraa_rule_sets').select('*').eq('active', true).order('code');
    if (error) fail(error);
    return (data || []) as RuleSet[];
  },

  async listSurveys(municipalityId: string): Promise<LiraaSurvey[]> {
    const { data, error } = await supabase
      .from('liraa_surveys')
      .select('*')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .is('deleted_at', null)
      .order('start_date', { ascending: false });
    if (error) fail(error);
    return (data || []) as LiraaSurvey[];
  },

  async createSurvey(municipalityId: string, input: {
    type: SurveyType; name: string; year: number; cycle_number: number; start_date: string; end_date: string;
    coordinator_id?: string | null; notes?: string | null; created_by?: string | null;
  }): Promise<LiraaSurvey> {
    const { data, error } = await supabase
      .from('liraa_surveys')
      .insert({ ...input, municipality_id: requireMunicipalityId(municipalityId), status: 'planejamento' })
      .select('*')
      .single();
    if (error) fail(error);
    return data as LiraaSurvey;
  },

  async updateSurvey(id: string, patch: Partial<Pick<LiraaSurvey, 'name' | 'start_date' | 'end_date' | 'notes' | 'coordinator_id' | 'cycle_number' | 'type'>>): Promise<void> {
    const { error } = await supabase.from('liraa_surveys').update(patch).eq('id', id);
    if (error) fail(error);
  },

  async listStrata(surveyId: string): Promise<LiraaStratum[]> {
    const { data, error } = await supabase.from('liraa_strata').select('*').eq('survey_id', surveyId).order('stratum_number');
    if (error) fail(error);
    return (data || []).map((s: any) => ({ ...s, neighborhood_ids: s.neighborhood_ids || [] })) as LiraaStratum[];
  },

  async saveStratum(municipalityId: string, surveyId: string, stratum: { id?: string; name: string; stratum_number: number; neighborhood_ids: string[] }): Promise<void> {
    const row = {
      survey_id: surveyId,
      municipality_id: requireMunicipalityId(municipalityId),
      name: stratum.name,
      code: `E${String(stratum.stratum_number).padStart(2, '0')}`,
      stratum_number: stratum.stratum_number,
      neighborhood_ids: stratum.neighborhood_ids,
      neighborhoods: stratum.neighborhood_ids,
    };
    const { error } = stratum.id
      ? await supabase.from('liraa_strata').update(row).eq('id', stratum.id)
      : await supabase.from('liraa_strata').insert(row);
    if (error) fail(error);
  },

  async deleteStratum(id: string): Promise<void> {
    const { error } = await supabase.from('liraa_strata').delete().eq('id', id);
    if (error) fail(error);
  },

  async universeByNeighborhood(): Promise<UniverseRow[]> {
    const { data, error } = await supabase.rpc('liraa_universe_by_neighborhood');
    if (error) fail(error);
    return (data || []) as UniverseRow[];
  },

  async listMembers(surveyId: string): Promise<{ profile_id: string; member_role: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('liraa_survey_members')
      .select('profile_id, member_role, profiles(full_name)')
      .eq('survey_id', surveyId);
    if (error) fail(error);
    return (data || []).map((m: any) => ({ profile_id: m.profile_id, member_role: m.member_role, full_name: m.profiles?.full_name || '—' }));
  },

  async addMember(municipalityId: string, surveyId: string, profileId: string, role: 'supervisor' | 'agente' | 'laboratorio'): Promise<void> {
    const { error } = await supabase.from('liraa_survey_members').insert({
      survey_id: surveyId, municipality_id: requireMunicipalityId(municipalityId), profile_id: profileId, member_role: role,
    });
    if (error && !/duplicate key/.test(error.message)) fail(error);
  },

  async removeMember(surveyId: string, profileId: string, role: string): Promise<void> {
    const { error } = await supabase.from('liraa_survey_members').delete().eq('survey_id', surveyId).eq('profile_id', profileId).eq('member_role', role);
    if (error) fail(error);
  },

  async confirmRules(surveyId: string, note: string): Promise<void> {
    const { error } = await supabase.rpc('liraa_confirm_rules', { p_survey_id: surveyId, p_note: note });
    if (error) fail(error);
  },

  async executeDraw(surveyId: string, seed?: string): Promise<{ seed: string; strata: any[] }> {
    const { data, error } = await supabase.rpc('liraa_execute_draw', { p_survey_id: surveyId, p_seed: seed?.trim() || null });
    if (error) fail(error);
    return data as any;
  },

  async listDraws(surveyId: string): Promise<DrawRow[]> {
    const { data, error } = await supabase
      .from('liraa_draws')
      .select('*, profiles:executed_by(full_name)')
      .eq('survey_id', surveyId)
      .order('executed_at', { ascending: false });
    if (error) fail(error);
    return (data || []).map((d: any) => ({ ...d, executed_by_name: d.profiles?.full_name })) as DrawRow[];
  },

  async listSelectedBlocks(surveyId: string): Promise<{ stratum_id: string; block_id: string; block_code: string; ordinal: number; position: number; properties_in_block: number; draw_id: string }[]> {
    const { data, error } = await supabase
      .from('liraa_selected_blocks')
      .select('stratum_id, block_id, ordinal, position, properties_in_block, draw_id, blocks(code), liraa_draws!inner(status)')
      .eq('survey_id', surveyId)
      .eq('liraa_draws.status', 'vigente')
      .order('ordinal');
    if (error) fail(error);
    return (data || []).map((b: any) => ({ ...b, block_code: b.blocks?.code ?? '—' }));
  },

  async listSamples(surveyId: string, opts: { agentId?: string; includeCancelled?: boolean } = {}): Promise<SampleRow[]> {
    let q = supabase
      .from('liraa_samples')
      .select(`id, stratum_id, property_id, block_id, agent_id, status, selection_type, replacement_of, ordinal, visited_at,
        blocks(code), agents(${AGENT_EMBED}),
        properties(street, number, complement, property_code, latitude, longitude, neighborhood_id, neighborhoods(name))`)
      .eq('survey_id', surveyId)
      .order('ordinal', { ascending: true })
      .limit(5000);
    if (!opts.includeCancelled) q = q.neq('status', 'cancelado');
    if (opts.agentId) q = q.eq('agent_id', opts.agentId);
    const { data, error } = await q;
    if (error) fail(error);
    return (data || []).map((s: any) => ({
      id: s.id,
      stratum_id: s.stratum_id,
      property_id: s.property_id,
      block_id: s.block_id,
      block_code: s.blocks?.code ?? null,
      agent_id: s.agent_id,
      agent_name: agentName(s.agents),
      status: s.status,
      selection_type: s.selection_type,
      replacement_of: s.replacement_of,
      ordinal: s.ordinal,
      visited_at: s.visited_at,
      address: formatAddress(s.properties),
      property_code: s.properties?.property_code,
      neighborhood: s.properties?.neighborhoods?.name,
      neighborhood_id: s.properties?.neighborhood_id,
      latitude: s.properties?.latitude,
      longitude: s.properties?.longitude,
    }));
  },

  /** Imóveis do quarteirão na ordem do sistema (sugestão de substituto anterior/posterior). */
  async blockProperties(municipalityId: string, blockId: string): Promise<{ id: string; address?: string; property_code?: string | null }[]> {
    const { data, error } = await supabase
      .from('properties')
      .select('id, street, number, complement, property_code')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .eq('block_id', blockId)
      .is('deleted_at', null)
      .limit(1000);
    if (error) fail(error);
    const num = (v: string | null) => {
      const m = /^\s*(\d{1,15})/.exec(v || '');
      return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
    };
    const cmp = (a?: string | null, b?: string | null) => ((a ?? '') < (b ?? '') ? -1 : (a ?? '') > (b ?? '') ? 1 : 0);
    return (data || [])
      .sort((a: any, b: any) => cmp(a.street, b.street) || num(a.number) - num(b.number) || cmp(a.number, b.number)
        || cmp(a.complement, b.complement) || cmp(a.property_code, b.property_code) || cmp(a.id, b.id))
      .map((p: any) => ({ id: p.id, address: formatAddress(p), property_code: p.property_code }));
  },

  async assignSamples(surveyId: string, sampleIds: string[], agentId: string | null): Promise<number> {
    const { data, error } = await supabase.rpc('liraa_assign_samples', { p_survey_id: surveyId, p_sample_ids: sampleIds, p_agent_id: agentId });
    if (error) fail(error);
    return Number(data) || 0;
  },

  async changeStatus(surveyId: string, to: SurveyStatus, justification?: string): Promise<void> {
    const { error } = await supabase.rpc('liraa_change_status', { p_survey_id: surveyId, p_to: to, p_justification: justification?.trim() || null });
    if (error) fail(error);
  },

  async statusHistory(surveyId: string): Promise<{ from_status: string | null; to_status: string; justification: string | null; created_at: string; actor: string }[]> {
    const { data, error } = await supabase
      .from('liraa_status_history')
      .select('from_status, to_status, justification, created_at, profiles:actor_id(full_name)')
      .eq('survey_id', surveyId)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data || []).map((h: any) => ({ ...h, actor: h.profiles?.full_name || '—' }));
  },

  /** Envio de uma inspeção (usado pela fila offline). Erros de validação voltam como mensagem. */
  async submitInspection(payload: Record<string, unknown>): Promise<{ success: boolean; duplicated?: boolean; message?: string; substitute_sample_id?: string }> {
    const { data, error } = await supabase.rpc('liraa_submit_inspection', { p: payload });
    if (error) {
      if (/fetch|network|timeout/i.test(error.message)) throw new Error(error.message);
      return { success: false, message: friendlyError(error.message) };
    }
    return { success: true, duplicated: !!(data as any)?.duplicated, substitute_sample_id: (data as any)?.substitute_sample_id };
  },

  async listInspections(surveyId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('liraa_inspections')
      .select(`id, sample_id, property_id, agent_id, inspected_at, situation, is_vacant_lot, notes, latitude, longitude, stratum_id,
        agents(${AGENT_EMBED}), properties(street, number, complement, property_code, neighborhoods(name), blocks(code)),
        liraa_inspection_deposits(deposit_category, inspected_count, positive_count)`)
      .eq('survey_id', surveyId)
      .order('inspected_at')
      .limit(10000);
    if (error) fail(error);
    return (data || []).map((i: any) => ({
      ...i,
      agent_name: agentName(i.agents),
      address: formatAddress(i.properties),
      neighborhood: i.properties?.neighborhoods?.name,
      block_code: i.properties?.blocks?.code,
      deposits: i.liraa_inspection_deposits || [],
    }));
  },

  async listTubes(surveyId: string): Promise<TubeRow[]> {
    const { data, error } = await supabase
      .from('entomological_samples')
      .select(`id, tube_label, deposit_category, collection_type, status, lab_result, collection_date, received_at, analyzed_at,
        discard_reason, notes, liraa_inspection_id, agents(${AGENT_EMBED}), properties(street, number, complement)`)
      .eq('liraa_survey_id', surveyId)
      .not('liraa_inspection_id', 'is', null)
      .order('tube_label')
      .limit(10000);
    if (error) fail(error);
    return (data || []).map((t: any) => ({ ...t, property_address: formatAddress(t.properties), agent_name: agentName(t.agents) }));
  },

  async labReceive(surveyId: string, labels: string[]): Promise<{ received: string[]; not_found: string[] }> {
    const { data, error } = await supabase.rpc('liraa_lab_receive', { p_survey_id: surveyId, p_labels: labels });
    if (error) fail(error);
    return data as any;
  },

  async labResult(sampleId: string, result: LabResult | 'descartada', notes?: string): Promise<void> {
    const { error } = await supabase.rpc('liraa_lab_result', { p_sample_id: sampleId, p_result: result, p_notes: notes?.trim() || null });
    if (error) fail(error);
  },

  async labEvents(sampleId: string): Promise<{ event: string; from_status: string | null; to_status: string | null; lab_result: string | null; notes: string | null; created_at: string; actor: string }[]> {
    const { data, error } = await supabase
      .from('liraa_lab_events')
      .select('event, from_status, to_status, lab_result, notes, created_at, profiles:actor_id(full_name)')
      .eq('sample_id', sampleId)
      .order('created_at');
    if (error) fail(error);
    return (data || []).map((e: any) => ({ ...e, actor: e.profiles?.full_name || '—' }));
  },

  async counts(surveyId: string): Promise<SurveyCounts> {
    const { data, error } = await supabase.rpc('liraa_survey_counts', { p_survey_id: surveyId });
    if (error) fail(error);
    return data as SurveyCounts;
  },

  async listAgents(municipalityId: string): Promise<{ id: string; name: string; profile_id: string }[]> {
    const { data, error } = await supabase
      .from('agents')
      .select(`id, profile_id, ${AGENT_EMBED}`)
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .eq('active', true);
    if (error) fail(error);
    return (data || []).map((a: any) => ({ id: a.id, profile_id: a.profile_id, name: agentName(a) || 'Agente' })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  },

  async listProfiles(municipalityId: string): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .eq('active', true)
      .order('full_name');
    if (error) fail(error);
    return (data || []) as any;
  },

  async myAgentId(municipalityId: string, profileId: string): Promise<string | null> {
    const { data } = await supabase
      .from('agents')
      .select('id')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .eq('profile_id', profileId)
      .eq('active', true)
      .maybeSingle();
    return (data as any)?.id ?? null;
  },
};
