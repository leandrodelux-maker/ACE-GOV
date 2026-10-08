import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, CloudUpload, Search, Syringe } from 'lucide-react';
import { PageHeader, Card } from '../ui';
import { Button, DataTable, Dialog, EmptyState, Field, Notice, SectionTitle, SelectInput, StatusPill, TextArea, TextInput, fmtDateTime, todayLocal } from '../ui/ModuleKit';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { Animal, BatchBalance, Campaign, Tutor, VaccinationPost, zoonosesService } from '../../services/zoonoses/zoonosesService';
import { AGE_GROUP_LABELS, SEX_LABELS, SPECIES_LABELS, Species } from '../../services/zoonoses/zoonosesMetrics';
import { QueuedRecord, discardRecord, enqueueRecord, newRecordId, readModuleQueue, syncModuleQueue } from '../../services/offlineQueue';
import { OFFLINE_QUEUE_EVENT } from '../../services/offlineVisitQueue';
import { VaccinationCard, VaccinationCardData } from './VaccinationCard';

const CACHE_KEY = 'endemias_cache_vacinacao_v1';

interface VaccCache {
  municipalityId: string;
  campaigns: Campaign[];
  posts: VaccinationPost[];
  balances: BatchBalance[];
  teams: { id: string; name: string }[];
  neighborhoods: { id: string; name: string }[];
  savedAt: string;
}

type Mode = 'individual' | 'campanha_rapida' | 'agregado';

const readCache = (mun: string): VaccCache | null => {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return c?.municipalityId === mun ? c : null;
  } catch {
    return null;
  }
};

export const ZooVaccinationView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const { session, can, municipality } = useAuth();
  const profileId = session?.profile.id || '';
  const [cache, setCache] = useState<VaccCache | null>(() => readCache(municipalityId));
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<QueuedRecord[]>(() => readModuleQueue('vaccination'));
  const [mode, setMode] = useState<Mode>('individual');
  const [context, setContext] = useState<string>(''); // campaign id ou 'rotina'
  const [postId, setPostId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);
  const [card, setCard] = useState<VaccinationCardData | null>(null);
  const [recentTick, setRecentTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const campaigns = (await zoonosesService.listCampaigns(municipalityId)).filter((c) => c.status === 'em_andamento');
      const [posts, balances, teams, neighborhoods] = await Promise.all([
        zoonosesService.listPostsForCampaigns(campaigns.map((c) => c.id)),
        zoonosesService.stockBalances(),
        zoonosesService.listTeams(municipalityId),
        zoonosesService.listNeighborhoods(municipalityId),
      ]);
      const next = { municipalityId, campaigns, posts, balances, teams, neighborhoods, savedAt: new Date().toISOString() };
      setCache(next);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* conveniência */ }
    } catch (e: any) {
      setMessage({ tone: 'warning', text: `Usando os dados salvos no aparelho: ${e.message}` });
    }
  }, [municipalityId]);

  const sync = useCallback(async () => {
    if (!profileId) return;
    const res = await syncModuleQueue('vaccination', (r) => zoonosesService.registerVaccination(r.payload), { municipalityId, profileId });
    setQueue(readModuleQueue('vaccination'));
    if (res.synced) {
      setMessage({ tone: 'success', text: `${res.synced} vacinação(ões) sincronizada(s).` });
      setRecentTick((t) => t + 1);
      refresh();
    } else if (res.failed) setMessage({ tone: 'warning', text: `${res.failed} registro(s) não enviado(s); veja a fila.` });
  }, [municipalityId, profileId, refresh]);

  useEffect(() => {
    if (navigator.onLine) refresh();
    const on = () => { setOnline(true); sync(); };
    const off = () => setOnline(false);
    const q = () => setQueue(readModuleQueue('vaccination'));
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener(OFFLINE_QUEUE_EVENT, q);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener(OFFLINE_QUEUE_EVENT, q); };
  }, [refresh, sync]);

  useEffect(() => {
    if (!cache || context) return;
    setContext(cache.campaigns[0]?.id || 'rotina');
  }, [cache, context]);

  const campaign = cache?.campaigns.find((c) => c.id === context) || null;
  const posts = (cache?.posts || []).filter((p) => p.campaign_id === context);
  const post = posts.find((p) => p.id === postId) || null;
  const effectiveTeam = post?.team_id || teamId || null;
  const batches = useMemo(() => zoonosesService.usableBatches(cache?.balances || [], effectiveTeam), [cache, effectiveTeam]);
  useEffect(() => {
    if (batchId && !batches.some((b) => b.batch_id === batchId)) setBatchId('');
    if (!batchId && batches.length === 1) setBatchId(batches[0].batch_id);
  }, [batches, batchId]);

  const base = () => ({
    campaign_id: campaign ? campaign.id : null,
    post_id: post?.id || null,
    team_id: effectiveTeam,
    batch_id: batchId,
  });

  const submitRecord = async (payload: Record<string, unknown>, label: string, cardData: Omit<VaccinationCardData, 'verification_code'> | null) => {
    const id = newRecordId();
    const full = { ...payload, ...base(), id, client_created_at: new Date().toISOString() };
    enqueueRecord({ id, kind: 'vaccination', municipality_id: municipalityId, profile_id: profileId, payload: full, label });
    setQueue(readModuleQueue('vaccination'));
    if (!navigator.onLine) {
      setMessage({ tone: 'warning', text: 'Sem conexão: vacinação guardada no aparelho. O comprovante fica disponível depois da sincronização.' });
      return;
    }
    const res = await syncModuleQueue('vaccination', async (r) => {
      const out = await zoonosesService.registerVaccination(r.payload);
      if (r.id === id && out.success && cardData) setCard({ ...cardData, verification_code: out.verification_code || '', animal_code: out.animal_code || cardData.animal_code });
      return out;
    }, { municipalityId, profileId });
    setQueue(readModuleQueue('vaccination'));
    const mine = res.remaining.find((r) => r.id === id);
    if (mine?.lastError) setMessage({ tone: 'danger', text: mine.lastError });
    else {
      setMessage({ tone: 'success', text: 'Vacinação registrada.' });
      setRecentTick((t) => t + 1);
      refresh();
    }
  };

  const ready = !!batchId && (context === 'rotina' || !!campaign);

  return (
    <div className="space-y-4">
      <PageHeader icon={Syringe} title="Registrar vacinação antirrábica" subtitle="Registro em poucos passos, também sem internet. Cada registro tem identificador único e não duplica ao sincronizar." />
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={online ? 'success' : 'warning'}>{online ? 'Conectado' : 'Sem conexão — registros ficam no aparelho'}</StatusPill>
        {cache?.savedAt && <span className="text-xs text-slate-500">Dados de campanha e estoque de {fmtDateTime(cache.savedAt)}</span>}
        <Button variant="ghost" onClick={refresh} disabled={!online}>Atualizar</Button>
      </div>
      {message && <Notice tone={message.tone} onClose={() => setMessage(null)}>{message.text}</Notice>}

      {queue.length > 0 && (
        <Card padding="compact">
          <SectionTitle actions={<Button icon={CloudUpload} onClick={sync} disabled={!online}>Sincronizar</Button>}>{queue.length} vacinação(ões) aguardando envio</SectionTitle>
          <ul className="space-y-1 text-sm">
            {queue.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
                <span>{q.label}{q.lastError ? <span className="block text-xs text-rose-700">{q.lastError}</span> : null}</span>
                {q.status === 'erro' && <Button variant="ghost" onClick={() => { discardRecord('vaccination', q.id); setQueue(readModuleQueue('vaccination')); }}>Descartar</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!cache ? <EmptyState title="Conecte-se para carregar campanhas e lotes" description="Depois do primeiro carregamento, o registro funciona sem internet." /> : (
        <>
          <Card padding="compact">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Atividade">{(id) => (
                <SelectInput id={id} value={context} onChange={(e) => { setContext(e.target.value); setPostId(''); }}>
                  {cache.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="rotina">Vacinação de rotina (fora de campanha)</option>
                </SelectInput>
              )}</Field>
              {campaign && (
                <Field label="Posto / modalidade">{(id) => (
                  <SelectInput id={id} value={postId} onChange={(e) => setPostId(e.target.value)}>
                    <option value="">Sem posto (volante/casa a casa)</option>
                    {posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </SelectInput>
                )}</Field>
              )}
              {!post?.team_id && (
                <Field label="Equipe (saldo de vacinas)" hint="Sem equipe, a baixa sai do almoxarifado central.">{(id) => (
                  <SelectInput id={id} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                    <option value="">Almoxarifado central</option>
                    {cache.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </SelectInput>
                )}</Field>
              )}
              <Field label="Vacina e lote" required error={!batches.length ? 'Sem lote válido com saldo para esta equipe.' : undefined}>{(id) => (
                <SelectInput id={id} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                  <option value="">Selecione</option>
                  {batches.map((b) => <option key={b.batch_id} value={b.batch_id}>{b.product_name} · lote {b.batch_number} · val. {b.expiration_date.split('-').reverse().join('/')} · {b.available} dose(s)</option>)}
                </SelectInput>
              )}</Field>
            </div>
          </Card>

          <div role="tablist" className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
            {([['individual', 'Individual (com cadastro)'], ['campanha_rapida', 'Campanha rápida'], ...(campaign ? [['agregado', 'Boletim físico']] : [])] as [Mode, string][]).map(([m, l]) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-semibold ${mode === m ? 'bg-teal-800 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>{l}</button>
            ))}
          </div>

          {mode === 'individual' && (
            <IndividualForm ready={ready} online={online} defaultNeighborhood={post?.neighborhood_id || ''} neighborhoods={cache.neighborhoods} canRegisterAnimal={can('antirrabica.cadastro')}
              canSeeTutors={can('antirrabica.tutores_dados')}
              onSubmit={(payload, label, cardData) => submitRecord(payload, label, cardData)}
              municipalityLabel={municipality ? `${municipality.name}/${municipality.state}` : ''} vaccinator={session?.profile.fullName || ''}
              batchLabel={batches.find((b) => b.batch_id === batchId)} />
          )}
          {mode === 'campanha_rapida' && (
            <RapidForm ready={ready} defaultNeighborhood={post?.neighborhood_id || ''} neighborhoods={cache.neighborhoods} onSubmit={(payload, label) => submitRecord(payload, label, null)} />
          )}
          {mode === 'agregado' && campaign && (
            <AggregateForm campaign={campaign} posts={posts} batchId={batchId} teamId={effectiveTeam} online={online} onDone={(text) => { setMessage({ tone: 'success', text }); refresh(); }} />
          )}
          <RecentList tick={recentTick} canVoid={can('antirrabica.anular')} onChanged={() => { setRecentTick((t) => t + 1); refresh(); }} />
        </>
      )}
      {card && <Dialog open title="Comprovante de vacinação" onClose={() => setCard(null)}><VaccinationCard data={card} /></Dialog>}
    </div>
  );
};

const NEW_ANIMAL = { species: '' as Species | '', name: '', sex: 'nao_informado', age_group: 'nao_informada', characteristics: '', without_known_tutor: false };

const IndividualForm: React.FC<{
  ready: boolean; online: boolean; defaultNeighborhood: string; neighborhoods: { id: string; name: string }[]; canRegisterAnimal: boolean; canSeeTutors: boolean;
  onSubmit: (payload: Record<string, unknown>, label: string, card: Omit<VaccinationCardData, 'verification_code'>) => Promise<void>;
  municipalityLabel: string; vaccinator: string; batchLabel?: BatchBalance;
}> = ({ ready, online, defaultNeighborhood, neighborhoods, canRegisterAnimal, canSeeTutors, onSubmit, municipalityLabel, vaccinator, batchLabel }) => {
  const municipalityId = useMunicipalityId();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Animal[]>([]);
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [creating, setCreating] = useState(false);
  const [na, setNa] = useState({ ...NEW_ANIMAL });
  const [tutorMode, setTutorMode] = useState<'existente' | 'novo' | 'sem'>('novo');
  const [tutorTerm, setTutorTerm] = useState('');
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [newTutor, setNewTutor] = useState({ full_name: '', phone: '', address: '' });
  const [neighborhood, setNeighborhood] = useState(defaultNeighborhood);
  const [when, setWhen] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setNeighborhood((n) => n || defaultNeighborhood), [defaultNeighborhood]);

  const search = async () => {
    setError(null);
    try { setResults(await zoonosesService.searchAnimals(municipalityId, term, { limit: 20 })); } catch (e: any) { setError(e.message); }
  };
  const reset = () => { setAnimal(null); setCreating(false); setNa({ ...NEW_ANIMAL }); setTutor(null); setNewTutor({ full_name: '', phone: '', address: '' }); setNotes(''); setResults([]); setTerm(''); };

  const valid = ready && (animal || (creating && na.species && (tutorMode !== 'novo' || newTutor.full_name.trim().length >= 2) && (tutorMode !== 'existente' || tutor)));
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const vaccinatedAt = new Date(when).toISOString();
      let payload: Record<string, unknown>;
      let label: string;
      if (animal) {
        payload = { record_mode: 'individual', animal_id: animal.id, species: animal.species, vaccinated_at: vaccinatedAt, notes: notes || null, neighborhood_id: neighborhood || null };
        label = `${SPECIES_LABELS[animal.species]} ${animal.code}${animal.name ? ` (${animal.name})` : ''}`;
      } else {
        const animalId = newRecordId();
        const tutorPayload = tutorMode === 'novo' ? { id: newRecordId(), ...newTutor } : null;
        payload = {
          record_mode: 'individual', species: na.species, sex: na.sex, age_group: na.age_group, vaccinated_at: vaccinatedAt, notes: notes || null, neighborhood_id: neighborhood || null,
          new_animal: { id: animalId, name: na.name, species: na.species, sex: na.sex, age_group: na.age_group, characteristics: na.characteristics, neighborhood_id: neighborhood || null,
            without_known_tutor: tutorMode === 'sem', tutor_id: tutorMode === 'existente' ? tutor?.id : null, new_tutor: tutorPayload },
        };
        label = `${SPECIES_LABELS[na.species as Species]} novo${na.name ? ` (${na.name})` : ''}`;
      }
      await onSubmit(payload, label, {
        animal_code: animal?.code || 'gerado na sincronização', animal_name: animal?.name || na.name || null, species: (animal?.species || na.species) as Species,
        tutor_name: tutorMode === 'existente' ? tutor?.full_name || null : tutorMode === 'novo' ? newTutor.full_name : null,
        vaccinated_on: vaccinatedAt.slice(0, 10), vaccine: batchLabel ? `${batchLabel.product_name}${batchLabel.manufacturer ? ` (${batchLabel.manufacturer})` : ''}` : '',
        batch: batchLabel?.batch_number || '', service: `Vigilância em Saúde — ${municipalityLabel}`, vaccinator,
      });
      reset();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <div className="space-y-4">
        {!animal && !creating && (
          <>
            <div className="flex gap-2">
              <TextInput value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Código ou nome do animal" aria-label="Buscar animal" onKeyDown={(e) => e.key === 'Enter' && search()} />
              <Button variant="secondary" icon={Search} onClick={search} disabled={!online}>Buscar</Button>
            </div>
            {!online && <p className="text-xs text-slate-500">Sem conexão a busca não está disponível; cadastre o animal no próprio atendimento.</p>}
            {results.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {results.map((a) => (
                  <li key={a.id}><button type="button" className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50" onClick={() => setAnimal(a)}>
                    <span><strong>{a.code}</strong> · {SPECIES_LABELS[a.species]}{a.name ? ` · ${a.name}` : ''}{a.neighborhood_name ? ` · ${a.neighborhood_name}` : ''}</span>
                    <span className="text-xs text-slate-500">{SEX_LABELS[a.sex]}</span>
                  </button></li>
                ))}
              </ul>
            )}
            {canRegisterAnimal && <Button variant="secondary" onClick={() => setCreating(true)}>Cadastrar animal novo</Button>}
          </>
        )}
        {animal && (
          <Notice tone="info" title={`${animal.code} · ${SPECIES_LABELS[animal.species]}${animal.name ? ` · ${animal.name}` : ''}`} onClose={() => setAnimal(null)}>
            {SEX_LABELS[animal.sex]} · {AGE_GROUP_LABELS[animal.age_group]}
          </Notice>
        )}
        {creating && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Espécie" required>{(id) => (
              <div id={id} className="grid grid-cols-2 gap-2">
                {(['canina', 'felina'] as Species[]).map((s) => (
                  <button key={s} type="button" aria-pressed={na.species === s} onClick={() => setNa({ ...na, species: s })}
                    className={`min-h-12 rounded-lg border text-sm font-semibold ${na.species === s ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white'}`}>{SPECIES_LABELS[s]}</button>
                ))}
              </div>
            )}</Field>
            <Field label="Nome (se conhecido)">{(id) => <TextInput id={id} value={na.name} onChange={(e) => setNa({ ...na, name: e.target.value })} />}</Field>
            <Field label="Sexo">{(id) => <SelectInput id={id} value={na.sex} onChange={(e) => setNa({ ...na, sex: e.target.value })}>{Object.entries(SEX_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
            <Field label="Faixa etária">{(id) => <SelectInput id={id} value={na.age_group} onChange={(e) => setNa({ ...na, age_group: e.target.value })}>{Object.entries(AGE_GROUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
            <Field label="Características" className="sm:col-span-2">{(id) => <TextInput id={id} value={na.characteristics} maxLength={500} onChange={(e) => setNa({ ...na, characteristics: e.target.value })} placeholder="Cor, porte, sinais (opcional)" />}</Field>
            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="text-xs font-semibold text-slate-700">Tutor</legend>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="radio" className="h-5 w-5" checked={tutorMode === 'novo'} onChange={() => setTutorMode('novo')} /> Novo tutor</label>
                {canSeeTutors && <label className="flex items-center gap-2"><input type="radio" className="h-5 w-5" checked={tutorMode === 'existente'} onChange={() => setTutorMode('existente')} disabled={!online} /> Tutor já cadastrado</label>}
                <label className="flex items-center gap-2"><input type="radio" className="h-5 w-5" checked={tutorMode === 'sem'} onChange={() => setTutorMode('sem')} /> Sem tutor conhecido</label>
              </div>
              {tutorMode === 'novo' && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <TextInput aria-label="Nome do tutor" placeholder="Nome do tutor" value={newTutor.full_name} onChange={(e) => setNewTutor({ ...newTutor, full_name: e.target.value })} />
                  <TextInput aria-label="Telefone" placeholder="Telefone (opcional)" inputMode="tel" value={newTutor.phone} onChange={(e) => setNewTutor({ ...newTutor, phone: e.target.value })} />
                  <TextInput aria-label="Endereço" placeholder="Endereço (opcional)" value={newTutor.address} onChange={(e) => setNewTutor({ ...newTutor, address: e.target.value })} />
                </div>
              )}
              {tutorMode === 'existente' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <TextInput aria-label="Buscar tutor" placeholder="Nome ou telefone" value={tutorTerm} onChange={(e) => setTutorTerm(e.target.value)} />
                    <Button variant="secondary" onClick={async () => setTutors(await zoonosesService.searchTutors(municipalityId, tutorTerm).catch(() => []))}>Buscar</Button>
                  </div>
                  {tutors.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                      <input type="radio" className="h-5 w-5" checked={tutor?.id === t.id} onChange={() => setTutor(t)} /> {t.full_name}{t.phone ? ` · ${t.phone}` : ''}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-500">Colete apenas os dados necessários (LGPD). Endereço e telefone são opcionais.</p>
            </fieldset>
          </div>
        )}
        {(animal || creating) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Localidade">{(id) => <SelectInput id={id} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}><option value="">—</option>{neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</SelectInput>}</Field>
            <Field label="Data e hora">{(id) => <TextInput id={id} type="datetime-local" value={when} max={`${todayLocal()}T23:59`} onChange={(e) => setWhen(e.target.value)} />}</Field>
            <Field label="Observações" className="sm:col-span-2">{(id) => <TextArea id={id} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />}</Field>
          </div>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        {(animal || creating) && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset}>Cancelar</Button>
            <Button className="flex-1" icon={Syringe} loading={busy} disabled={!valid} onClick={submit}>Registrar dose</Button>
          </div>
        )}
        {!ready && <p className="text-xs text-amber-700">Selecione a atividade e um lote válido com saldo.</p>}
      </div>
    </Card>
  );
};

const RapidForm: React.FC<{ ready: boolean; defaultNeighborhood: string; neighborhoods: { id: string; name: string }[]; onSubmit: (payload: Record<string, unknown>, label: string) => Promise<void> }> = ({
  ready, defaultNeighborhood, neighborhoods, onSubmit,
}) => {
  const [species, setSpecies] = useState<Species | ''>('');
  const [sex, setSex] = useState('nao_informado');
  const [age, setAge] = useState('nao_informada');
  const [neighborhood, setNeighborhood] = useState(defaultNeighborhood);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  useEffect(() => setNeighborhood((n) => n || defaultNeighborhood), [defaultNeighborhood]);
  const go = async () => {
    if (!species) return;
    setBusy(true);
    try {
      await onSubmit({ record_mode: 'campanha_rapida', species, sex, age_group: age, neighborhood_id: neighborhood || null, vaccinated_at: new Date().toISOString() },
        `${SPECIES_LABELS[species]} · ${SEX_LABELS[sex]} (rápido)`);
      setCount((c) => c + 1);
    } finally { setBusy(false); }
  };
  return (
    <Card>
      <p className="mb-3 text-xs text-slate-500">Cada registro conta um animal atendido. Use quando não houver cadastro; animais com cadastro devem usar o modo individual para não contar duas vezes.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          {(['canina', 'felina'] as Species[]).map((s) => (
            <button key={s} type="button" aria-pressed={species === s} onClick={() => setSpecies(s)}
              className={`min-h-14 rounded-lg border text-base font-bold ${species === s ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white'}`}>{SPECIES_LABELS[s]}</button>
          ))}
        </div>
        <Field label="Sexo">{(id) => <SelectInput id={id} value={sex} onChange={(e) => setSex(e.target.value)}>{Object.entries(SEX_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
        <Field label="Faixa etária">{(id) => <SelectInput id={id} value={age} onChange={(e) => setAge(e.target.value)}>{Object.entries(AGE_GROUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
        <Field label="Localidade" className="sm:col-span-2">{(id) => <SelectInput id={id} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}><option value="">—</option>{neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</SelectInput>}</Field>
      </div>
      <Button className="mt-4 w-full" icon={Syringe} loading={busy} disabled={!ready || !species} onClick={go}>Registrar dose</Button>
      {count > 0 && <p className="mt-2 text-center text-xs text-slate-600">{count} registro(s) nesta sessão.</p>}
    </Card>
  );
};

const AggregateForm: React.FC<{ campaign: Campaign; posts: VaccinationPost[]; batchId: string; teamId: string | null; online: boolean; onDone: (text: string) => void }> = ({
  campaign, posts, batchId, teamId, online, onDone,
}) => {
  const [f, setF] = useState({ post_id: '', entry_date: todayLocal(), species: 'canina', sex: 'nao_informado', age_group: 'nao_informada', quantity: '', source_document: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = online && f.post_id && batchId && Number(f.quantity) > 0 && f.source_document.trim();
  return (
    <Card>
      <p className="mb-3 text-xs text-slate-500">Transcrição de boletins em papel. O sistema recusa o lançamento quando o posto já tem doses registradas individualmente na mesma data (evita dupla contagem). Exige conexão.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Posto" required>{(id) => <SelectInput id={id} value={f.post_id} onChange={(e) => setF({ ...f, post_id: e.target.value })}><option value="">Selecione</option>{posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</SelectInput>}</Field>
        <Field label="Data" required>{(id) => <TextInput id={id} type="date" min={campaign.start_date} max={campaign.end_date} value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value })} />}</Field>
        <Field label="Espécie">{(id) => <SelectInput id={id} value={f.species} onChange={(e) => setF({ ...f, species: e.target.value })}><option value="canina">Cães</option><option value="felina">Gatos</option></SelectInput>}</Field>
        <Field label="Sexo">{(id) => <SelectInput id={id} value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value })}>{Object.entries(SEX_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
        <Field label="Faixa etária">{(id) => <SelectInput id={id} value={f.age_group} onChange={(e) => setF({ ...f, age_group: e.target.value })}>{Object.entries(AGE_GROUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
        <Field label="Quantidade de doses" required>{(id) => <TextInput id={id} type="number" inputMode="numeric" min={1} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />}</Field>
        <Field label="Nº / identificação do boletim" required className="sm:col-span-2">{(id) => <TextInput id={id} value={f.source_document} maxLength={80} onChange={(e) => setF({ ...f, source_document: e.target.value })} />}</Field>
      </div>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
      <Button className="mt-4 w-full" icon={ClipboardList} loading={busy} disabled={!valid} onClick={async () => {
        setBusy(true); setError(null);
        try {
          await zoonosesService.registerAggregate({ ...f, id: newRecordId(), quantity: Number(f.quantity), campaign_id: campaign.id, batch_id: batchId, team_id: teamId });
          onDone(`Boletim ${f.source_document} lançado: ${f.quantity} dose(s).`);
          setF({ ...f, quantity: '', source_document: '' });
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
      }}>Lançar boletim</Button>
    </Card>
  );
};

const RecentList: React.FC<{ tick: number; canVoid: boolean; onChanged: () => void }> = ({ tick, canVoid, onChanged }) => {
  const municipalityId = useMunicipalityId();
  const [rows, setRows] = useState<any[]>([]);
  const [voiding, setVoiding] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!navigator.onLine) return;
    zoonosesService.listVaccinations(municipalityId, { from: todayLocal(), limit: 50 }).then(setRows).catch(() => setRows([]));
  }, [municipalityId, tick]);
  if (!rows.length) return null;
  return (
    <Card>
      <SectionTitle>Registros de hoje</SectionTitle>
      <DataTable rows={rows} rowKey={(r) => r.id} pageSize={10} searchable={false}
        columns={[
          { key: 'h', header: 'Hora', render: (r) => new Date(r.vaccinated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
          { key: 'a', header: 'Animal', render: (r) => `${SPECIES_LABELS[r.species as Species]}${r.animals?.code ? ` ${r.animals.code}` : ' (rápido)'}` },
          { key: 'c', header: 'Código', render: (r) => <span className="font-mono text-[11px]">{r.verification_code}</span> },
          { key: 's', header: 'Situação', render: (r) => <StatusPill tone={r.status === 'valida' ? 'success' : 'neutral'}>{r.status === 'valida' ? 'Válida' : 'Anulada'}</StatusPill> },
          ...(canVoid ? [{ key: 'x', header: '', render: (r: any) => r.status === 'valida' ? <Button variant="ghost" onClick={() => { setVoiding(r); setReason(''); }}>Anular</Button> : null }] : []),
        ]} />
      {voiding && (
        <Dialog open title="Anular registro" onClose={() => setVoiding(null)}
          footer={<><Button variant="secondary" onClick={() => setVoiding(null)}>Voltar</Button><Button variant="danger" disabled={reason.trim().length < 15} onClick={async () => {
            setError(null);
            try { await zoonosesService.voidRecord('individual', voiding.id, reason); setVoiding(null); onChanged(); } catch (e: any) { setError(e.message); }
          }}>Anular e estornar dose</Button></>}>
          <p className="mb-2 text-sm text-slate-700">A dose volta ao saldo do lote e o registro fica marcado como anulado (não é excluído).</p>
          <Field label="Justificativa" required hint="Mínimo de 15 caracteres.">{(id) => <TextArea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          {error && <Notice tone="danger">{error}</Notice>}
        </Dialog>
      )}
    </Card>
  );
};
