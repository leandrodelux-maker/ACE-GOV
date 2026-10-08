import React, { useState } from 'react';
import { CalendarRange, MapPin, Plus } from 'lucide-react';
import { PageHeader, Card } from '../ui';
import { Button, DataTable, Dialog, EmptyState, Field, LoadingBlock, Notice, SectionTitle, SelectInput, StatusPill, TextArea, TextInput, Tone, fmtDate, useAsync } from '../ui/ModuleKit';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { CAMPAIGN_STATUS_LABELS, Campaign, CampaignStatus, POST_MODALITY_LABELS, VaccinationPost, zoonosesService } from '../../services/zoonoses/zoonosesService';

const STATUS_TONE: Record<CampaignStatus, Tone> = { planejamento: 'info', em_andamento: 'warning', encerrada: 'success', cancelada: 'neutral' };
/** Referência do Ministério da Saúde para cães, apenas como valor inicial editável. */
const DEFAULT_DOG_TARGET = 80;

export const ZooCampaignsView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const { can } = useAuth();
  const q = useAsync(() => zoonosesService.listCampaigns(municipalityId), [municipalityId]);
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null);
  const [selected, setSelected] = useState<Campaign | null>(null);

  return (
    <div className="space-y-4">
      <PageHeader icon={CalendarRange} title="Campanhas de vacinação antirrábica" subtitle="Período, localidades, metas por espécie, população estimada com fonte, postos e equipes."
        actions={can('antirrabica.campanhas') ? <Button icon={Plus} onClick={() => setEditing({ year: new Date().getFullYear(), target_dog_coverage_pct: DEFAULT_DOG_TARGET })}>Nova campanha</Button> : undefined} />
      {q.loading && <LoadingBlock />}
      {q.error && <Notice tone="danger">{q.error}</Notice>}
      {q.data && (q.data.length === 0 ? <EmptyState title="Nenhuma campanha cadastrada" /> : (
        <DataTable rows={q.data} rowKey={(c) => c.id} onRowClick={setSelected} searchPlaceholder="Pesquisar campanha"
          columns={[
            { key: 'name', header: 'Campanha', render: (c) => <strong className="text-slate-900">{c.name}</strong>, text: (c) => c.name },
            { key: 'periodo', header: 'Período', render: (c) => `${fmtDate(c.start_date)} a ${fmtDate(c.end_date)}` },
            { key: 'pop', header: 'População estimada', render: (c) => c.est_dog_population || c.est_cat_population ? `${c.est_dog_population ?? '—'} cães · ${c.est_cat_population ?? '—'} gatos` : 'Não informada' },
            { key: 'meta', header: 'Meta cães', align: 'right', render: (c) => (c.target_dog_coverage_pct != null ? `${c.target_dog_coverage_pct}%` : '—') },
            { key: 'status', header: 'Situação', render: (c) => <StatusPill tone={STATUS_TONE[c.status]}>{CAMPAIGN_STATUS_LABELS[c.status]}</StatusPill>, text: (c) => CAMPAIGN_STATUS_LABELS[c.status] },
          ]} />
      ))}
      {editing && <CampaignForm campaign={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); q.reload(); }} />}
      {selected && <CampaignDetail campaign={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} onChanged={() => { setSelected(null); q.reload(); }} />}
    </div>
  );
};

const CampaignForm: React.FC<{ campaign: Partial<Campaign>; onClose: () => void; onSaved: () => void }> = ({ campaign, onClose, onSaved }) => {
  const municipalityId = useMunicipalityId();
  const [f, setF] = useState<Partial<Campaign>>(campaign);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPop = !!(f.est_dog_population || f.est_cat_population);
  const valid = !!f.name?.trim() && !!f.start_date && !!f.end_date && f.end_date >= f.start_date && (!hasPop || !!f.population_source?.trim());
  const num = (v: string) => (v === '' ? null : Number(v));
  return (
    <Dialog open wide title={campaign.id ? 'Editar campanha' : 'Nova campanha'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={!valid} onClick={async () => {
        setBusy(true); setError(null);
        try {
          await zoonosesService.saveCampaign(municipalityId, { ...(f as any), name: f.name!.trim(), year: f.year || new Date(f.start_date!).getFullYear() });
          onSaved();
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
      }}>Salvar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" required className="sm:col-span-2">{(id) => <TextInput id={id} value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Campanha de vacinação antirrábica 2026" />}</Field>
        <Field label="Ano" required>{(id) => <TextInput id={id} type="number" value={f.year || ''} onChange={(e) => setF({ ...f, year: Number(e.target.value) })} />}</Field>
        <Field label="Doses previstas">{(id) => <TextInput id={id} type="number" min={0} value={f.planned_doses ?? ''} onChange={(e) => setF({ ...f, planned_doses: num(e.target.value) })} />}</Field>
        <Field label="Início" required>{(id) => <TextInput id={id} type="date" value={f.start_date || ''} onChange={(e) => setF({ ...f, start_date: e.target.value })} />}</Field>
        <Field label="Término" required>{(id) => <TextInput id={id} type="date" value={f.end_date || ''} onChange={(e) => setF({ ...f, end_date: e.target.value })} />}</Field>
        <Field label="Meta de cobertura canina (%)" hint="Referência do MS: 80% — ajuste conforme norma vigente.">{(id) => <TextInput id={id} type="number" min={0} max={100} step="0.1" value={f.target_dog_coverage_pct ?? ''} onChange={(e) => setF({ ...f, target_dog_coverage_pct: num(e.target.value) })} />}</Field>
        <Field label="Meta de cobertura felina (%)" hint="Deixe em branco se não houver meta definida.">{(id) => <TextInput id={id} type="number" min={0} max={100} step="0.1" value={f.target_cat_coverage_pct ?? ''} onChange={(e) => setF({ ...f, target_cat_coverage_pct: num(e.target.value) })} />}</Field>
        <Field label="Fonte da meta" className="sm:col-span-2">{(id) => <TextInput id={id} value={f.coverage_target_source || ''} onChange={(e) => setF({ ...f, coverage_target_source: e.target.value })} placeholder="Ex.: Nota técnica / orientação estadual" />}</Field>
        <Field label="População canina estimada">{(id) => <TextInput id={id} type="number" min={1} value={f.est_dog_population ?? ''} onChange={(e) => setF({ ...f, est_dog_population: num(e.target.value) })} />}</Field>
        <Field label="População felina estimada">{(id) => <TextInput id={id} type="number" min={1} value={f.est_cat_population ?? ''} onChange={(e) => setF({ ...f, est_cat_population: num(e.target.value) })} />}</Field>
        <Field label="Fonte da estimativa" required={hasPop} error={hasPop && !f.population_source?.trim() ? 'Obrigatória quando há população estimada.' : undefined} className="sm:col-span-2">
          {(id) => <TextInput id={id} value={f.population_source || ''} onChange={(e) => setF({ ...f, population_source: e.target.value })} placeholder="Ex.: censo animal municipal, estimativa estadual..." />}
        </Field>
        <Field label="Data de referência da estimativa">{(id) => <TextInput id={id} type="date" value={f.population_reference_date || ''} onChange={(e) => setF({ ...f, population_reference_date: e.target.value || null })} />}</Field>
        <Field label="Metodologia da estimativa">{(id) => <TextInput id={id} value={f.population_method || ''} onChange={(e) => setF({ ...f, population_method: e.target.value })} placeholder="Ex.: razão habitante/animal informada pela SES" />}</Field>
        <Field label="Observações" className="sm:col-span-2">{(id) => <TextArea id={id} value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
      </div>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
    </Dialog>
  );
};

const CampaignDetail: React.FC<{ campaign: Campaign; onClose: () => void; onEdit: () => void; onChanged: () => void }> = ({ campaign, onClose, onEdit, onChanged }) => {
  const municipalityId = useMunicipalityId();
  const { can } = useAuth();
  const [tick, setTick] = useState(0);
  const data = useAsync(async () => ({
    posts: await zoonosesService.listPosts(campaign.id),
    localities: await zoonosesService.listLocalities(campaign.id),
    neighborhoods: await zoonosesService.listNeighborhoods(municipalityId),
    teams: await zoonosesService.listTeams(municipalityId),
  }), [campaign.id, tick]);
  const [post, setPost] = useState<Partial<VaccinationPost> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locEdit, setLocEdit] = useState<Record<string, { dog: string; cat: string; on: boolean }> | null>(null);
  const editable = can('antirrabica.campanhas') && (campaign.status === 'planejamento' || campaign.status === 'em_andamento');

  const setStatus = async (s: CampaignStatus) => {
    setError(null);
    try { await zoonosesService.setCampaignStatus(campaign.id, s); onChanged(); } catch (e: any) { setError(e.message); }
  };

  return (
    <Dialog open wide title={campaign.name} onClose={onClose}>
      {data.loading && <LoadingBlock />}
      {data.data && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={STATUS_TONE[campaign.status]}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</StatusPill>
            <span className="text-slate-700">{fmtDate(campaign.start_date)} a {fmtDate(campaign.end_date)}</span>
            {editable && <Button variant="ghost" onClick={onEdit}>Editar</Button>}
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          {can('antirrabica.campanhas') && (
            <div className="flex flex-wrap gap-2">
              {campaign.status === 'planejamento' && <Button onClick={() => setStatus('em_andamento')}>Iniciar campanha</Button>}
              {campaign.status === 'em_andamento' && <Button onClick={() => setStatus('encerrada')}>Encerrar campanha</Button>}
              {(campaign.status === 'planejamento' || campaign.status === 'em_andamento') && <Button variant="danger" onClick={() => setStatus('cancelada')}>Cancelar</Button>}
            </div>
          )}
          {campaign.status === 'encerrada' && <Notice tone="info">Campanha encerrada: dados preservados e bloqueados para alteração.</Notice>}

          <section>
            <SectionTitle actions={editable ? <Button variant="secondary" onClick={() => setLocEdit(Object.fromEntries(data.data!.neighborhoods.map((n) => {
              const l = data.data!.localities.find((x) => x.neighborhood_id === n.id);
              return [n.id, { on: !!l, dog: l?.est_dog_population?.toString() || '', cat: l?.est_cat_population?.toString() || '' }];
            })))}>Editar localidades</Button> : undefined}>Localidades participantes</SectionTitle>
            {data.data.localities.length === 0 ? <p className="text-slate-500">Nenhuma localidade definida (a campanha vale para todo o município).</p> : (
              <ul className="grid gap-1 sm:grid-cols-2">
                {data.data.localities.map((l) => (
                  <li key={l.neighborhood_id} className="rounded-lg border border-slate-200 px-3 py-2">
                    <strong>{data.data!.neighborhoods.find((n) => n.id === l.neighborhood_id)?.name}</strong>
                    <span className="block text-xs text-slate-500">Cães: {l.est_dog_population ?? '—'} · Gatos: {l.est_cat_population ?? '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionTitle actions={editable ? <Button variant="secondary" icon={Plus} onClick={() => setPost({ campaign_id: campaign.id, modality: 'posto_fixo', active: true })}>Posto</Button> : undefined}>Postos e calendário</SectionTitle>
            <DataTable rows={data.data.posts} rowKey={(p) => p.id} searchable={false} pageSize={20} onRowClick={editable ? (p) => setPost(p) : undefined}
              columns={[
                { key: 'name', header: 'Posto', render: (p) => <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />{p.name}</span> },
                { key: 'mod', header: 'Modalidade', render: (p) => POST_MODALITY_LABELS[p.modality] || p.modality },
                { key: 'loc', header: 'Localidade', render: (p) => data.data!.neighborhoods.find((n) => n.id === p.neighborhood_id)?.name || '—' },
                { key: 'data', header: 'Data', render: (p) => `${fmtDate(p.scheduled_date)} ${p.start_time?.slice(0, 5) || ''}${p.end_time ? `–${p.end_time.slice(0, 5)}` : ''}` },
                { key: 'eq', header: 'Equipe', render: (p) => data.data!.teams.find((t) => t.id === p.team_id)?.name || '—' },
                { key: 'doses', header: 'Doses previstas', align: 'right', render: (p) => p.planned_doses ?? '—' },
              ]} emptyText="Nenhum posto cadastrado." />
          </section>
        </div>
      )}
      {post && data.data && (
        <PostForm post={post} neighborhoods={data.data.neighborhoods} teams={data.data.teams} onClose={() => setPost(null)} onSaved={() => { setPost(null); setTick((t) => t + 1); }} />
      )}
      {locEdit && data.data && (
        <Dialog open title="Localidades e população estimada" onClose={() => setLocEdit(null)}
          footer={<><Button variant="secondary" onClick={() => setLocEdit(null)}>Cancelar</Button><Button onClick={async () => {
            try {
              await zoonosesService.saveLocalities(municipalityId, campaign.id, Object.entries(locEdit).filter(([, v]) => v.on).map(([id, v]) => ({
                neighborhood_id: id, est_dog_population: v.dog ? Number(v.dog) : null, est_cat_population: v.cat ? Number(v.cat) : null,
              })));
              setLocEdit(null); setTick((t) => t + 1);
            } catch (e: any) { setError(e.message); setLocEdit(null); }
          }}>Salvar</Button></>}>
          <p className="mb-2 text-xs text-slate-500">População por localidade é opcional e usa a mesma fonte informada na campanha.</p>
          <ul className="space-y-2">
            {data.data.neighborhoods.map((n) => (
              <li key={n.id} className="grid grid-cols-[1fr_6rem_6rem] items-center gap-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={locEdit[n.id]?.on} onChange={(e) => setLocEdit({ ...locEdit, [n.id]: { ...locEdit[n.id], on: e.target.checked } })} />{n.name}</label>
                <TextInput aria-label={`Cães em ${n.name}`} placeholder="Cães" type="number" min={1} disabled={!locEdit[n.id]?.on} value={locEdit[n.id]?.dog} onChange={(e) => setLocEdit({ ...locEdit, [n.id]: { ...locEdit[n.id], dog: e.target.value } })} />
                <TextInput aria-label={`Gatos em ${n.name}`} placeholder="Gatos" type="number" min={1} disabled={!locEdit[n.id]?.on} value={locEdit[n.id]?.cat} onChange={(e) => setLocEdit({ ...locEdit, [n.id]: { ...locEdit[n.id], cat: e.target.value } })} />
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </Dialog>
  );
};

const PostForm: React.FC<{ post: Partial<VaccinationPost>; neighborhoods: { id: string; name: string }[]; teams: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }> = ({
  post, neighborhoods, teams, onClose, onSaved,
}) => {
  const municipalityId = useMunicipalityId();
  const [p, setP] = useState(post);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open title={post.id ? 'Editar posto' : 'Novo posto'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={!p.name?.trim()} onClick={async () => {
        setBusy(true); setError(null);
        try { await zoonosesService.savePost(municipalityId, p as any); onSaved(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
      }}>Salvar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" required className="sm:col-span-2">{(id) => <TextInput id={id} value={p.name || ''} onChange={(e) => setP({ ...p, name: e.target.value })} />}</Field>
        <Field label="Modalidade">{(id) => <SelectInput id={id} value={p.modality} onChange={(e) => setP({ ...p, modality: e.target.value })}>{Object.entries(POST_MODALITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
        <Field label="Localidade">{(id) => <SelectInput id={id} value={p.neighborhood_id || ''} onChange={(e) => setP({ ...p, neighborhood_id: e.target.value || null })}><option value="">—</option>{neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</SelectInput>}</Field>
        <Field label="Endereço / referência" className="sm:col-span-2">{(id) => <TextInput id={id} value={p.address || ''} onChange={(e) => setP({ ...p, address: e.target.value })} />}</Field>
        <Field label="Data">{(id) => <TextInput id={id} type="date" value={p.scheduled_date || ''} onChange={(e) => setP({ ...p, scheduled_date: e.target.value || null })} />}</Field>
        <Field label="Equipe">{(id) => <SelectInput id={id} value={p.team_id || ''} onChange={(e) => setP({ ...p, team_id: e.target.value || null })}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</SelectInput>}</Field>
        <Field label="Início">{(id) => <TextInput id={id} type="time" value={p.start_time?.slice(0, 5) || ''} onChange={(e) => setP({ ...p, start_time: e.target.value || null })} />}</Field>
        <Field label="Término">{(id) => <TextInput id={id} type="time" value={p.end_time?.slice(0, 5) || ''} onChange={(e) => setP({ ...p, end_time: e.target.value || null })} />}</Field>
        <Field label="Doses previstas">{(id) => <TextInput id={id} type="number" min={0} value={p.planned_doses ?? ''} onChange={(e) => setP({ ...p, planned_doses: e.target.value === '' ? null : Number(e.target.value) })} />}</Field>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5" checked={p.active !== false} onChange={(e) => setP({ ...p, active: e.target.checked })} /> Posto ativo</label>
      </div>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
    </Dialog>
  );
};
