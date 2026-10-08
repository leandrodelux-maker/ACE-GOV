/**
 * Acesso a dados do módulo Zoonoses (vacinação antirrábica e vigilância da raiva).
 * Doses, lançamentos agregados, estoque de vacinas e busca ativa passam pelas RPCs
 * da migração 39 (validação, trava de estoque, idempotência e auditoria).
 */
import { supabase } from '../supabaseClient';
import { requireMunicipalityId } from '../municipalityScope';
import { friendlyError } from '../liraa/liraaModuleService';
import type { Species } from './zoonosesMetrics';

export type CampaignStatus = 'planejamento' | 'em_andamento' | 'encerrada' | 'cancelada';
export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
};
export const POST_MODALITY_LABELS: Record<string, string> = {
  posto_fixo: 'Posto fixo',
  posto_volante: 'Posto volante',
  casa_a_casa: 'Casa a casa',
};
export const SEARCH_RESULT_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  vacinado: 'Vacinado (dose registrada)',
  nao_vacinado: 'Não vacinado (confirmado na visita)',
  ausente: 'Ninguém em casa',
  recusa: 'Recusa',
  animal_nao_encontrado: 'Animal não encontrado',
};
export const RABIES_STATUS_LABELS: Record<string, string> = {
  notificado: 'Notificado',
  em_investigacao: 'Em investigação',
  aguardando_laboratorio: 'Aguardando laboratório',
  encerrado_descartado: 'Encerrado — descartado',
  encerrado_confirmado: 'Encerrado — confirmado',
  encerrado_inconclusivo: 'Encerrado — inconclusivo',
};
export const RABIES_TYPE_LABELS: Record<string, string> = {
  agressao_animal: 'Agressão por animal',
  animal_suspeito: 'Animal com sinais suspeitos',
  morte_suspeita: 'Morte suspeita de animal',
  morcego: 'Morcego (encontrado/caído/agressão)',
  outro: 'Outro',
};
export const RABIES_SPECIES_LABELS: Record<string, string> = {
  canina: 'Cão', felina: 'Gato', quiroptero: 'Morcego', herbivoro: 'Herbívoro', silvestre: 'Silvestre', outra: 'Outra',
};

export interface Campaign {
  id: string;
  municipality_id: string;
  name: string;
  year: number;
  start_date: string;
  end_date: string;
  status: CampaignStatus;
  target_dog_coverage_pct: number | null;
  target_cat_coverage_pct: number | null;
  coverage_target_source: string | null;
  est_dog_population: number | null;
  est_cat_population: number | null;
  population_source: string | null;
  population_reference_date: string | null;
  population_method: string | null;
  planned_doses: number | null;
  notes: string | null;
}

export interface VaccinationPost {
  id: string;
  campaign_id: string;
  name: string;
  modality: string;
  neighborhood_id: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  team_id: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  planned_doses: number | null;
  active: boolean;
}

export interface Animal {
  id: string;
  code: string;
  name: string | null;
  species: Species;
  sex: string;
  age_group: string;
  approx_age_months: number | null;
  characteristics: string | null;
  tutor_id: string | null;
  without_known_tutor: boolean;
  property_id: string | null;
  neighborhood_id: string | null;
  status: string;
  neighborhood_name?: string | null;
}

export interface Tutor {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  property_id: string | null;
  neighborhood_id: string | null;
}

export interface BatchBalance {
  product_id: string;
  product_name: string;
  manufacturer: string | null;
  minimum_stock: number | null;
  batch_id: string;
  batch_number: string;
  expiration_date: string;
  quantity_received: number;
  central_balance: number;
  teams: { team_id: string; team_name: string; balance: number }[];
  applied: number;
  losses: number;
}

export interface VaccinationCounts {
  campaign: Campaign | null;
  doses_total: number;
  doses_by_source: Record<string, number>;
  by_species: Partial<Record<Species, { doses: number; animals: number }>>;
  by_sex: { species: Species; sex: string; doses: number }[];
  by_age_group: { species: Species; age_group: string; doses: number }[];
  by_day: { day: string; species: Species; doses: number }[];
  by_neighborhood: { neighborhood_id: string | null; name: string | null; species: Species; doses: number; animals: number; est_dog_population: number | null; est_cat_population: number | null }[];
  by_team: { team_id: string | null; name: string | null; doses: number }[];
  by_post: { post_id: string | null; name: string | null; modality: string | null; doses: number }[];
  localities: { neighborhood_id: string; name: string; est_dog_population: number | null; est_cat_population: number | null }[];
}

function fail(error: { message: string } | null): never {
  throw new Error(friendlyZooError(error?.message));
}

const ZOO_FRIENDLY: [RegExp, string][] = [
  [/animal_ja_vacinado/, 'Este animal já tem dose válida registrada nesta campanha (ou nesta data, na rotina).'],
  [/lote_vencido/, 'Lote vencido: não é permitido aplicar ou distribuir.'],
  [/saldo_insuficiente_equipe/, 'A equipe não tem saldo deste lote. Registre a distribuição no estoque antes.'],
  [/saldo_insuficiente/, 'Saldo insuficiente no lote.'],
  [/boletim_agregado_existente/, 'Este posto já tem lançamento por boletim nesta data; registrar individualmente contaria em dobro.'],
  [/registros_individuais_existentes/, 'Este posto já tem doses registradas individualmente nesta data; o boletim agregado contaria em dobro.'],
  [/campanha_fora_de_execucao/, 'A campanha não está em andamento.'],
  [/data_fora_da_campanha/, 'A data está fora do período da campanha.'],
  [/campanha_bloqueada/, 'Campanha encerrada ou cancelada: alterações bloqueadas.'],
  [/dose_nao_registrada/, 'Registre a dose antes de concluir a tarefa como vacinado.'],
  [/justificativa_obrigatoria/, 'Informe a justificativa (mínimo 15 caracteres).'],
];

export function friendlyZooError(message?: string): string {
  if (!message) return 'Não foi possível concluir a operação.';
  const hit = ZOO_FRIENDLY.find(([re]) => re.test(message));
  return hit ? hit[1] : friendlyError(message);
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export const zoonosesService = {
  // -------- Campanhas e postos
  async listCampaigns(municipalityId: string): Promise<Campaign[]> {
    const { data, error } = await supabase
      .from('vaccination_campaigns')
      .select('*')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .is('deleted_at', null)
      .order('start_date', { ascending: false });
    if (error) fail(error);
    return (data || []) as Campaign[];
  },

  async saveCampaign(municipalityId: string, c: Partial<Campaign> & { name: string; year: number; start_date: string; end_date: string }): Promise<Campaign> {
    const row = { ...c, municipality_id: requireMunicipalityId(municipalityId) };
    const { data, error } = c.id
      ? await supabase.from('vaccination_campaigns').update(row).eq('id', c.id).select('*').single()
      : await supabase.from('vaccination_campaigns').insert(row).select('*').single();
    if (error) fail(error);
    return data as Campaign;
  },

  async setCampaignStatus(id: string, status: CampaignStatus): Promise<void> {
    const { error } = await supabase.from('vaccination_campaigns').update({ status }).eq('id', id);
    if (error) fail(error);
  },

  async listLocalities(campaignId: string): Promise<{ neighborhood_id: string; est_dog_population: number | null; est_cat_population: number | null }[]> {
    const { data, error } = await supabase.from('vaccination_campaign_localities').select('neighborhood_id, est_dog_population, est_cat_population').eq('campaign_id', campaignId);
    if (error) fail(error);
    return (data || []) as any;
  },

  async saveLocalities(municipalityId: string, campaignId: string, rows: { neighborhood_id: string; est_dog_population: number | null; est_cat_population: number | null }[]): Promise<void> {
    const mun = requireMunicipalityId(municipalityId);
    const { error: delErr } = await supabase.from('vaccination_campaign_localities').delete().eq('campaign_id', campaignId);
    if (delErr) fail(delErr);
    if (!rows.length) return;
    const { error } = await supabase.from('vaccination_campaign_localities').insert(rows.map((r) => ({ ...r, campaign_id: campaignId, municipality_id: mun })));
    if (error) fail(error);
  },

  async listPosts(campaignId: string): Promise<VaccinationPost[]> {
    const { data, error } = await supabase.from('vaccination_posts').select('*').eq('campaign_id', campaignId).order('scheduled_date').order('name');
    if (error) fail(error);
    return (data || []) as VaccinationPost[];
  },

  async listPostsForCampaigns(campaignIds: string[]): Promise<VaccinationPost[]> {
    if (!campaignIds.length) return [];
    const { data, error } = await supabase.from('vaccination_posts').select('*').in('campaign_id', campaignIds).eq('active', true).order('name');
    if (error) fail(error);
    return (data || []) as VaccinationPost[];
  },

  async savePost(municipalityId: string, post: Partial<VaccinationPost> & { campaign_id: string; name: string }): Promise<void> {
    const row = { ...post, municipality_id: requireMunicipalityId(municipalityId) };
    const { error } = post.id
      ? await supabase.from('vaccination_posts').update(row).eq('id', post.id)
      : await supabase.from('vaccination_posts').insert(row);
    if (error) fail(error);
  },

  // -------- Animais e tutores
  async searchAnimals(municipalityId: string, term: string, opts: { limit?: number; neighborhoodId?: string } = {}): Promise<Animal[]> {
    let q = supabase
      .from('animals')
      .select('*, neighborhoods(name)')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 50);
    const t = term.trim();
    if (t) q = q.or(`code.ilike.%${t.replace(/[%,()]/g, '')}%,name.ilike.%${t.replace(/[%,()]/g, '')}%`);
    if (opts.neighborhoodId) q = q.eq('neighborhood_id', opts.neighborhoodId);
    const { data, error } = await q;
    if (error) fail(error);
    return (data || []).map((a: any) => ({ ...a, neighborhood_name: a.neighborhoods?.name ?? null })) as Animal[];
  },

  async animalsByTutor(tutorId: string): Promise<Animal[]> {
    const { data, error } = await supabase.from('animals').select('*').eq('tutor_id', tutorId).is('deleted_at', null);
    if (error) fail(error);
    return (data || []) as Animal[];
  },

  async saveAnimal(municipalityId: string, a: Partial<Animal> & { species: Species }): Promise<Animal> {
    // Campos de exibição/embutidos e de controle não são gravados
    const { neighborhood_name, neighborhoods, code, created_at, updated_at, created_by, municipality_id, ...rest } = a as any;
    const row = { ...rest, municipality_id: requireMunicipalityId(municipalityId) };
    const { data, error } = a.id && code
      ? await supabase.from('animals').update(row).eq('id', a.id).select('*').single()
      : await supabase.from('animals').insert(row).select('*').single();
    if (error) fail(error);
    return data as Animal;
  },

  async searchTutors(municipalityId: string, term: string): Promise<Tutor[]> {
    const t = term.trim().replace(/[%,()]/g, '');
    let q = supabase.from('animal_tutors').select('*').eq('municipality_id', requireMunicipalityId(municipalityId)).is('deleted_at', null).order('full_name').limit(50);
    if (t) q = q.or(`full_name.ilike.%${t}%,phone.ilike.%${t}%`);
    const { data, error } = await q;
    if (error) fail(error);
    return (data || []) as Tutor[];
  },

  async getTutors(ids: string[]): Promise<Tutor[]> {
    if (!ids.length) return [];
    const { data, error } = await supabase.from('animal_tutors').select('*').in('id', ids);
    if (error) return [];
    return (data || []) as Tutor[];
  },

  async saveTutor(municipalityId: string, t: Partial<Tutor> & { full_name: string }): Promise<Tutor> {
    const { created_at, updated_at, created_by, ...clean } = t as any;
    const row = { ...clean, municipality_id: requireMunicipalityId(municipalityId) };
    const { data, error } = t.id
      ? await supabase.from('animal_tutors').update(row).eq('id', t.id).select('*').single()
      : await supabase.from('animal_tutors').insert(row).select('*').single();
    if (error) fail(error);
    return data as Tutor;
  },

  async animalHistory(animalId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('animal_vaccinations')
      .select('id, vaccinated_on, vaccinated_at, status, verification_code, context, campaign_id, void_reason, vaccination_campaigns(name), products(name, manufacturer), product_batches(batch_number), profiles:vaccinator_profile_id(full_name)')
      .eq('animal_id', animalId)
      .order('vaccinated_at', { ascending: false });
    if (error) fail(error);
    return data || [];
  },

  // -------- Registros
  async registerVaccination(payload: Record<string, unknown>): Promise<{ success: boolean; duplicated?: boolean; message?: string; verification_code?: string; animal_code?: string }> {
    const { data, error } = await supabase.rpc('zoo_register_vaccination', { p: payload });
    if (error) {
      if (/fetch|network|timeout/i.test(error.message)) throw new Error(error.message);
      return { success: false, message: friendlyZooError(error.message) };
    }
    const d = data as any;
    return { success: true, duplicated: !!d?.duplicated, verification_code: d?.verification_code, animal_code: d?.animal_code };
  },

  async registerAggregate(payload: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.rpc('zoo_register_aggregate', { p: payload });
    if (error) fail(error);
  },

  async voidRecord(kind: 'individual' | 'agregado', id: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('zoo_void_record', { p_kind: kind, p_id: id, p_reason: reason });
    if (error) fail(error);
  },

  async listVaccinations(municipalityId: string, filters: { campaignId?: string | null; from?: string; to?: string; limit?: number } = {}): Promise<any[]> {
    let q = supabase
      .from('animal_vaccinations')
      .select('id, vaccinated_at, vaccinated_on, species, sex, age_group, record_mode, context, status, verification_code, void_reason, animal_id, campaign_id, post_id, team_id, neighborhood_id, animals(code, name), neighborhoods(name), teams(name), vaccination_posts(name), products(name), product_batches(batch_number), profiles:vaccinator_profile_id(full_name)')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .order('vaccinated_at', { ascending: false })
      .limit(filters.limit ?? 500);
    if (filters.campaignId) q = q.eq('campaign_id', filters.campaignId);
    if (filters.from) q = q.gte('vaccinated_on', filters.from);
    if (filters.to) q = q.lte('vaccinated_on', filters.to);
    const { data, error } = await q;
    if (error) fail(error);
    return data || [];
  },

  async listAggregates(municipalityId: string, campaignId?: string | null): Promise<any[]> {
    let q = supabase
      .from('vaccination_aggregate_entries')
      .select('*, vaccination_posts(name), product_batches(batch_number), profiles:entered_by(full_name)')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .order('entry_date', { ascending: false })
      .limit(1000);
    if (campaignId) q = q.eq('campaign_id', campaignId);
    const { data, error } = await q;
    if (error) fail(error);
    return data || [];
  },

  async counts(campaignId: string | null, from?: string, to?: string, filters: { species?: string; neighborhoodId?: string; teamId?: string } = {}): Promise<VaccinationCounts> {
    const { data, error } = await supabase.rpc('zoo_vaccination_counts', {
      p_campaign_id: campaignId, p_from: from || null, p_to: to || null,
      p_species: filters.species || null, p_neighborhood: filters.neighborhoodId || null, p_team: filters.teamId || null,
    });
    if (error) fail(error);
    return data as VaccinationCounts;
  },

  // -------- Estoque
  async listVaccineProducts(municipalityId: string): Promise<{ id: string; name: string; manufacturer: string | null; minimum_stock: number | null; unit: string }[]> {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, manufacturer, minimum_stock, unit')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .eq('category', 'vacina_antirrabica')
      .is('deleted_at', null)
      .order('name');
    if (error) fail(error);
    return (data || []) as any;
  },

  async createVaccineProduct(municipalityId: string, p: { name: string; manufacturer: string; minimum_stock: number }): Promise<void> {
    const { error } = await supabase.from('products').insert({
      municipality_id: requireMunicipalityId(municipalityId), name: p.name, manufacturer: p.manufacturer, minimum_stock: p.minimum_stock,
      category: 'vacina_antirrabica', unit: 'dose',
    });
    if (error) fail(error);
  },

  async stockOperation(payload: Record<string, unknown>): Promise<{ central_balance: number; team_balance: number | null }> {
    const { data, error } = await supabase.rpc('zoo_stock_operation', { p: payload });
    if (error) fail(error);
    return data as any;
  },

  async stockBalances(): Promise<BatchBalance[]> {
    const { data, error } = await supabase.rpc('zoo_stock_balances');
    if (error) fail(error);
    return (data || []) as BatchBalance[];
  },

  async stockMovements(municipalityId: string, limit = 300): Promise<any[]> {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('id, movement_type, quantity, notes, created_at, team_id, teams(name), product_batches(batch_number), products!inner(name, category), profiles:created_by(full_name)')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .eq('products.category', 'vacina_antirrabica')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) fail(error);
    return data || [];
  },

  /** Lotes utilizáveis hoje (não vencidos) para o registro de vacinação. */
  usableBatches(balances: BatchBalance[], teamId: string | null): (BatchBalance & { available: number })[] {
    const t = today();
    return balances
      .filter((b) => b.expiration_date >= t)
      .map((b) => ({ ...b, available: teamId ? b.teams.find((x) => x.team_id === teamId)?.balance ?? 0 : b.central_balance }))
      .filter((b) => b.available > 0)
      .sort((a, b) => a.expiration_date.localeCompare(b.expiration_date));
  },

  // -------- Busca ativa
  async generateSearchTasks(campaignId: string, neighborhoodIds: string[], profileId: string | null): Promise<number> {
    const { data, error } = await supabase.rpc('zoo_generate_search_tasks', { p_campaign_id: campaignId, p_neighborhood_ids: neighborhoodIds, p_profile_id: profileId });
    if (error) fail(error);
    return Number(data) || 0;
  },

  async listSearchTasks(municipalityId: string, campaignId: string, opts: { assignedTo?: string } = {}): Promise<any[]> {
    let q = supabase
      .from('zoo_search_tasks')
      .select('*, animals(code, name, species, sex, tutor_id), neighborhoods(name), properties(street, number, complement, latitude, longitude), profiles:assigned_profile_id(full_name)')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .eq('campaign_id', campaignId)
      .order('status')
      .limit(2000);
    if (opts.assignedTo) q = q.eq('assigned_profile_id', opts.assignedTo);
    const { data, error } = await q;
    if (error) fail(error);
    return data || [];
  },

  async assignTask(taskId: string, profileId: string | null): Promise<void> {
    const { error } = await supabase.from('zoo_search_tasks').update({ assigned_profile_id: profileId, updated_at: new Date().toISOString() }).eq('id', taskId);
    if (error) fail(error);
  },

  async registerSearchAttempt(payload: Record<string, unknown>): Promise<{ success: boolean; duplicated?: boolean; message?: string }> {
    const { data, error } = await supabase.rpc('zoo_register_search_attempt', { p: payload });
    if (error) {
      if (/fetch|network|timeout/i.test(error.message)) throw new Error(error.message);
      return { success: false, message: friendlyZooError(error.message) };
    }
    return { success: true, duplicated: !!(data as any)?.duplicated };
  },

  // -------- Raiva
  async listRabiesEvents(municipalityId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('rabies_events')
      .select('*, neighborhoods(name), animals(code, name)')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .is('deleted_at', null)
      .order('reported_at', { ascending: false })
      .limit(500);
    if (error) fail(error);
    return data || [];
  },

  async saveRabiesEvent(municipalityId: string, ev: Record<string, unknown>): Promise<any> {
    const row = { ...ev, municipality_id: requireMunicipalityId(municipalityId) };
    delete (row as any).neighborhoods;
    delete (row as any).animals;
    const { data, error } = ev.id
      ? await supabase.from('rabies_events').update(row).eq('id', ev.id as string).select('*').single()
      : await supabase.from('rabies_events').insert(row).select('*').single();
    if (error) fail(error);
    return data;
  },

  async rabiesUpdates(eventId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('rabies_event_updates')
      .select('*, profiles:actor_id(full_name)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return data || [];
  },

  async addRabiesNote(municipalityId: string, eventId: string, actorId: string, note: string): Promise<void> {
    const { error } = await supabase.from('rabies_event_updates').insert({
      municipality_id: requireMunicipalityId(municipalityId), event_id: eventId, actor_id: actorId, note, update_type: 'acompanhamento',
    });
    if (error) fail(error);
  },

  // -------- Território e equipes (reuso)
  async listNeighborhoods(municipalityId: string): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase.from('neighborhoods').select('id, name').eq('municipality_id', requireMunicipalityId(municipalityId)).order('name');
    if (error) fail(error);
    return (data || []) as any;
  },

  async listTeams(municipalityId: string): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase.from('teams').select('id, name').eq('municipality_id', requireMunicipalityId(municipalityId)).eq('active', true).order('name');
    if (error) fail(error);
    return (data || []) as any;
  },

  async searchProperties(municipalityId: string, term: string): Promise<{ id: string; label: string; neighborhood_id: string }[]> {
    const t = term.trim().replace(/[%,()]/g, '');
    if (t.length < 2) return [];
    const { data, error } = await supabase
      .from('properties')
      .select('id, street, number, complement, property_code, neighborhood_id')
      .eq('municipality_id', requireMunicipalityId(municipalityId))
      .is('deleted_at', null)
      .or(`street.ilike.%${t}%,property_code.ilike.%${t}%`)
      .limit(20);
    if (error) fail(error);
    return (data || []).map((p: any) => ({
      id: p.id,
      neighborhood_id: p.neighborhood_id,
      label: `${p.street || 'Sem logradouro'}, ${p.number || 'S/N'}${p.complement ? ` - ${p.complement}` : ''}${p.property_code ? ` (${p.property_code})` : ''}`,
    }));
  },

  async publicVerify(code: string): Promise<any | null> {
    const { data, error } = await supabase.rpc('public_verify_vaccination', { p_code: code });
    if (error) return null;
    return data;
  },
};
