import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudUpload, ListChecks, Search } from 'lucide-react';
import { PageHeader, Card } from '../ui';
import { Button, DataTable, Dialog, EmptyState, Field, LoadingBlock, Metric, Notice, SectionTitle, SelectInput, StatusPill, TextArea, Tone, useAsync } from '../ui/ModuleKit';
import { PointsMap, MapPoint } from '../ui/PointsMap';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { SEARCH_RESULT_LABELS, zoonosesService } from '../../services/zoonoses/zoonosesService';
import { SPECIES_LABELS, Species, animalCampaignStatus } from '../../services/zoonoses/zoonosesMetrics';
import { liraaModuleService } from '../../services/liraa/liraaModuleService';
import { QueuedRecord, enqueueRecord, newRecordId, readModuleQueue, syncModuleQueue } from '../../services/offlineQueue';
import { formatAddress } from '../../services/schemaHelpers';
import { CampaignPicker, useSelectedCampaign } from './ZoonosesHubView';

const STATUS_TONE: Record<string, Tone> = { pendente: 'warning', vacinado: 'success', nao_vacinado: 'danger', ausente: 'neutral', recusa: 'danger', animal_nao_encontrado: 'neutral' };
const MAP_COLORS: Record<string, string> = { Vacinado: '#147d64', 'Não vacinado (confirmado)': '#c0392b', 'Sem informação': '#64748b' };

export const ZooActiveSearchView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const { session } = useAuth();
  const profileId = session?.profile.id || '';
  const campaignsQ = useAsync(async () => (await zoonosesService.listCampaigns(municipalityId)).filter((c) => c.status === 'em_andamento'), [municipalityId]);
  const [campaignId, setCampaignId] = useSelectedCampaign(campaignsQ.data);
  const [tick, setTick] = useState(0);
  const [onlyMine, setOnlyMine] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pendente');
  const data = useAsync(async () => {
    if (!campaignId) return null;
    const [tasks, neighborhoods, profiles, posts] = await Promise.all([
      zoonosesService.listSearchTasks(municipalityId, campaignId),
      zoonosesService.listNeighborhoods(municipalityId),
      liraaModuleService.listProfiles(municipalityId),
      zoonosesService.listPosts(campaignId),
    ]);
    return { tasks, neighborhoods, profiles, posts };
  }, [campaignId, tick]);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [attempt, setAttempt] = useState<any | null>(null);
  const [queue, setQueue] = useState<QueuedRecord[]>(() => readModuleQueue('search_attempt'));
  const [msg, setMsg] = useState<{ tone: Tone; text: string } | null>(null);

  const sync = useCallback(async () => {
    const r = await syncModuleQueue('search_attempt', (rec) => zoonosesService.registerSearchAttempt(rec.payload), { municipalityId, profileId });
    setQueue(readModuleQueue('search_attempt'));
    if (r.synced) { setMsg({ tone: 'success', text: `${r.synced} tentativa(s) sincronizada(s).` }); setTick((t) => t + 1); }
    else if (r.failed) setMsg({ tone: 'warning', text: r.remaining.find((x) => x.lastError)?.lastError || 'Falha ao sincronizar.' });
  }, [municipalityId, profileId]);
  useEffect(() => {
    const on = () => sync();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [sync]);

  const tasks = data.data?.tasks || [];
  const visible = tasks.filter((t: any) => (!onlyMine || t.assigned_profile_id === profileId) && (statusFilter === 'todos' || t.status === statusFilter));
  const summary = useMemo(() => {
    const s = { vacinado: 0, nao_vacinado_confirmado: 0, sem_informacao: 0 };
    tasks.forEach((t: any) => { s[animalCampaignStatus(t.status === 'vacinado', [t.status])]++; });
    return s;
  }, [tasks]);
  const uncovered = useMemo(() => {
    if (!data.data) return [];
    const covered = new Set<string>([...data.data.posts.map((p) => p.neighborhood_id).filter(Boolean) as string[], ...tasks.filter((t: any) => t.assigned_profile_id).map((t: any) => t.neighborhood_id)]);
    return data.data.neighborhoods.filter((n) => !covered.has(n.id));
  }, [data.data, tasks]);
  const mapPoints: MapPoint[] = tasks.filter((t: any) => t.properties?.latitude != null && t.properties?.longitude != null).map((t: any) => {
    const st = animalCampaignStatus(t.status === 'vacinado', [t.status]);
    return { id: t.id, lat: Number(t.properties.latitude), lng: Number(t.properties.longitude),
      category: st === 'vacinado' ? 'Vacinado' : st === 'nao_vacinado_confirmado' ? 'Não vacinado (confirmado)' : 'Sem informação', label: `${t.animals?.code || ''} · ${t.neighborhoods?.name || ''}` };
  });

  return (
    <div className="space-y-4">
      <PageHeader icon={ListChecks} title="Busca ativa" subtitle="Animais cadastrados ainda sem dose na campanha. Diferencia não vacinado confirmado de sem informação; nada é exposto publicamente." />
      {campaignsQ.loading && <LoadingBlock />}
      {campaignsQ.data && campaignsQ.data.length === 0 && <EmptyState title="Nenhuma campanha em andamento" description="A busca ativa é feita durante a campanha." />}
      {campaignsQ.data && campaignsQ.data.length > 0 && (
        <Card padding="compact">
          <div className="flex flex-wrap items-end gap-3">
            <CampaignPicker campaigns={campaignsQ.data} value={campaignId} onChange={setCampaignId} />
            <Button icon={Search} onClick={() => setGenerateOpen(true)}>Gerar lista</Button>
          </div>
        </Card>
      )}
      {msg && <Notice tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Notice>}
      {queue.length > 0 && (
        <Notice tone="warning" title={`${queue.length} tentativa(s) aguardando envio`}>
          <Button variant="secondary" icon={CloudUpload} onClick={sync} disabled={!navigator.onLine}>Sincronizar</Button>
        </Notice>
      )}
      {data.loading && <LoadingBlock />}
      {data.data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Animais na lista" value={tasks.length} />
            <Metric label="Vacinados (dose registrada)" value={summary.vacinado} />
            <Metric label="Não vacinados (confirmado)" value={summary.nao_vacinado_confirmado} tone={summary.nao_vacinado_confirmado ? 'danger' : undefined} />
            <Metric label="Sem informação" value={summary.sem_informacao} caption="Não visitados, ausentes ou não encontrados" />
          </div>
          {uncovered.length > 0 && <Notice tone="info" title="Localidades sem posto nem agente designado nesta campanha">{uncovered.map((n) => n.name).join(', ')}</Notice>}
          <DataTable rows={visible} rowKey={(t: any) => t.id} onRowClick={(t) => setAttempt(t)} searchPlaceholder="Pesquisar animal ou endereço"
            toolbar={<>
              <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-56" aria-label="Situação">
                <option value="todos">Todas as situações</option>{Object.entries(SEARCH_RESULT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </SelectInput>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Só os meus</label>
            </>}
            columns={[
              { key: 'a', header: 'Animal', render: (t: any) => <span><strong className="font-mono">{t.animals?.code}</strong> · {SPECIES_LABELS[t.animals?.species as Species]}{t.animals?.name ? ` · ${t.animals.name}` : ''}</span>, text: (t: any) => `${t.animals?.code} ${t.animals?.name || ''}` },
              { key: 'l', header: 'Localidade', render: (t: any) => t.neighborhoods?.name || '—', text: (t: any) => t.neighborhoods?.name || '' },
              { key: 'e', header: 'Imóvel', render: (t: any) => formatAddress(t.properties) || '—', text: (t: any) => formatAddress(t.properties) || '' },
              { key: 'r', header: 'Responsável', render: (t: any) => t.profiles?.full_name || 'Não designado' },
              { key: 's', header: 'Situação', render: (t: any) => <StatusPill tone={STATUS_TONE[t.status]}>{SEARCH_RESULT_LABELS[t.status]}</StatusPill> },
              { key: 'n', header: 'Tentativas', align: 'right', render: (t: any) => t.attempts },
            ]} emptyText="Nenhuma tarefa nesta situação." />
          <Card>
            <SectionTitle>Mapa da busca ativa</SectionTitle>
            <PointsMap points={mapPoints} colors={MAP_COLORS} withoutCoordinates={tasks.length - mapPoints.length} ariaLabel="Mapa dos animais da busca ativa" />
          </Card>
        </>
      )}
      {generateOpen && data.data && (
        <GenerateDialog campaignId={campaignId} neighborhoods={data.data.neighborhoods} profiles={data.data.profiles} onClose={() => setGenerateOpen(false)}
          onDone={(n) => { setGenerateOpen(false); setMsg({ tone: 'success', text: `${n} tarefa(s) criada(s).` }); setTick((t) => t + 1); }} />
      )}
      {attempt && data.data && (
        <AttemptDialog task={attempt} profiles={data.data.profiles} onClose={() => setAttempt(null)}
          onQueued={() => { setAttempt(null); setQueue(readModuleQueue('search_attempt')); if (navigator.onLine) sync(); }}
          onAssigned={() => { setAttempt(null); setTick((t) => t + 1); }} municipalityId={municipalityId} profileId={profileId} />
      )}
    </div>
  );
};

const GenerateDialog: React.FC<{ campaignId: string; neighborhoods: { id: string; name: string }[]; profiles: { id: string; full_name: string }[]; onClose: () => void; onDone: (n: number) => void }> = ({
  campaignId, neighborhoods, profiles, onClose, onDone,
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [profile, setProfile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open title="Gerar lista de busca ativa" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} onClick={async () => {
        setBusy(true); setError(null);
        try { onDone(await zoonosesService.generateSearchTasks(campaignId, selected, profile || null)); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
      }}>Gerar</Button></>}>
      <p className="mb-2 text-sm text-slate-700">Inclui animais ativos cadastrados sem dose válida nesta campanha. Animais que já estão na lista não são duplicados.</p>
      <Field label="Responsável (opcional)">{(id) => <SelectInput id={id} value={profile} onChange={(e) => setProfile(e.target.value)}><option value="">Sem designação</option>{profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</SelectInput>}</Field>
      <fieldset className="mt-3">
        <legend className="text-xs font-semibold text-slate-700">Localidades (nenhuma = todas)</legend>
        <div className="mt-1 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {neighborhoods.map((n) => (
            <label key={n.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={selected.includes(n.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, n.id] : selected.filter((x) => x !== n.id))} />{n.name}</label>
          ))}
        </div>
      </fieldset>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
    </Dialog>
  );
};

const AttemptDialog: React.FC<{ task: any; profiles: { id: string; full_name: string }[]; municipalityId: string; profileId: string; onClose: () => void; onQueued: () => void; onAssigned: () => void }> = ({
  task, profiles, municipalityId, profileId, onClose, onQueued, onAssigned,
}) => {
  const [result, setResult] = useState('');
  const [notes, setNotes] = useState('');
  const [assignee, setAssignee] = useState(task.assigned_profile_id || '');
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open title={`Animal ${task.animals?.code}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Fechar</Button><Button disabled={!result} onClick={() => {
        try {
          const id = newRecordId();
          enqueueRecord({ id, kind: 'search_attempt', municipality_id: municipalityId, profile_id: profileId, label: `Busca ativa ${task.animals?.code}: ${SEARCH_RESULT_LABELS[result]}`,
            payload: { id, task_id: task.id, result, notes: notes || null, attempted_at: new Date().toISOString() } });
          onQueued();
        } catch (e: any) { setError(e.message); }
      }}>Registrar tentativa</Button></>}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-700">{SPECIES_LABELS[task.animals?.species as Species]} · {task.neighborhoods?.name || ''} · {formatAddress(task.properties) || 'sem imóvel vinculado'}</p>
        <fieldset className="space-y-1">
          <legend className="text-xs font-semibold text-slate-700">Resultado da visita</legend>
          {Object.entries(SEARCH_RESULT_LABELS).filter(([k]) => k !== 'pendente').map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2"><input type="radio" className="h-5 w-5" checked={result === k} onChange={() => setResult(k)} />{v}</label>
          ))}
        </fieldset>
        {result === 'vacinado' && <Notice tone="info">"Vacinado" exige a dose registrada na aba Registrar vacinação (modo individual, com este animal). Sem o registro, a tentativa é recusada na sincronização.</Notice>}
        <Field label="Observações">{(id) => <TextArea id={id} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />}</Field>
        <div className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
          <Field label="Responsável pela tarefa">{(id) => <SelectInput id={id} value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Não designado</option>{profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</SelectInput>}</Field>
          <Button variant="secondary" disabled={assignee === (task.assigned_profile_id || '')} onClick={async () => {
            try { await zoonosesService.assignTask(task.id, assignee || null); onAssigned(); } catch (e: any) { setError(e.message); }
          }}>Designar</Button>
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Dialog>
  );
};
