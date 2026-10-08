import React, { useState } from 'react';
import { PawPrint, Plus, Search, UserRound } from 'lucide-react';
import { PageHeader, Card } from '../ui';
import { Button, DataTable, Dialog, Field, LoadingBlock, Notice, SectionTitle, SelectInput, StatusPill, TextInput, fmtDate, useAsync } from '../ui/ModuleKit';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { Animal, Tutor, zoonosesService } from '../../services/zoonoses/zoonosesService';
import { AGE_GROUP_LABELS, SEX_LABELS, SPECIES_LABELS, Species } from '../../services/zoonoses/zoonosesMetrics';
import { VaccinationCard } from './VaccinationCard';

const ANIMAL_STATUS: Record<string, string> = { ativo: 'Ativo', obito: 'Óbito', desaparecido: 'Desaparecido', mudou_municipio: 'Mudou de município' };

export const ZooAnimalsView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const { can } = useAuth();
  const [tab, setTab] = useState<'animais' | 'tutores'>('animais');
  const [term, setTerm] = useState('');
  const [neighborhoodId, setNeighborhoodId] = useState('');
  const [tick, setTick] = useState(0);
  const lookups = useAsync(() => zoonosesService.listNeighborhoods(municipalityId), [municipalityId]);
  const animals = useAsync(() => zoonosesService.searchAnimals(municipalityId, term, { limit: 500, neighborhoodId: neighborhoodId || undefined }), [municipalityId, neighborhoodId, tick]);
  const tutors = useAsync(() => (tab === 'tutores' && can('antirrabica.tutores_dados') ? zoonosesService.searchTutors(municipalityId, term) : Promise.resolve([] as Tutor[])), [tab, tick]);
  const [editAnimal, setEditAnimal] = useState<Partial<Animal> | null>(null);
  const [viewAnimal, setViewAnimal] = useState<Animal | null>(null);
  const [editTutor, setEditTutor] = useState<Partial<Tutor> | null>(null);
  const nName = (id: string | null) => lookups.data?.find((n) => n.id === id)?.name || '—';

  return (
    <div className="space-y-4">
      <PageHeader icon={PawPrint} title="Animais e tutores" subtitle="Cadastro animal com histórico vacinal. Dados pessoais de tutores só para perfis autorizados (LGPD)."
        actions={can('antirrabica.cadastro') ? <Button icon={Plus} onClick={() => (tab === 'animais' ? setEditAnimal({ species: 'canina', sex: 'nao_informado', age_group: 'nao_informada', status: 'ativo' } as any) : setEditTutor({}))}>{tab === 'animais' ? 'Novo animal' : 'Novo tutor'}</Button> : undefined} />
      {can('antirrabica.tutores_dados') && (
        <div role="tablist" className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1.5 sm:w-fit">
          {(['animais', 'tutores'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)}
              className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${tab === t ? 'bg-teal-800 text-white' : 'text-slate-700'}`}>{t === 'animais' ? 'Animais' : 'Tutores'}</button>
          ))}
        </div>
      )}
      <Card padding="compact">
        <div className="flex flex-wrap items-end gap-2">
          <TextInput className="sm:max-w-xs" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setTick((t) => t + 1)}
            placeholder={tab === 'animais' ? 'Código ou nome do animal' : 'Nome ou telefone do tutor'} aria-label="Pesquisar" />
          {tab === 'animais' && (
            <SelectInput className="sm:w-56" value={neighborhoodId} onChange={(e) => setNeighborhoodId(e.target.value)} aria-label="Localidade">
              <option value="">Todas as localidades</option>{(lookups.data || []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </SelectInput>
          )}
          <Button variant="secondary" icon={Search} onClick={() => setTick((t) => t + 1)}>Pesquisar</Button>
        </div>
      </Card>
      {tab === 'animais' ? (
        animals.loading ? <LoadingBlock /> : animals.error ? <Notice tone="danger">{animals.error}</Notice> : (
          <DataTable rows={animals.data || []} rowKey={(a) => a.id} onRowClick={setViewAnimal} searchable={false}
            columns={[
              { key: 'code', header: 'Código', render: (a) => <span className="font-mono font-semibold">{a.code}</span> },
              { key: 'name', header: 'Nome', render: (a) => a.name || '—' },
              { key: 'sp', header: 'Espécie', render: (a) => SPECIES_LABELS[a.species] },
              { key: 'sex', header: 'Sexo', render: (a) => SEX_LABELS[a.sex] },
              { key: 'loc', header: 'Localidade', render: (a) => a.neighborhood_name || '—' },
              { key: 'tut', header: 'Tutor', render: (a) => (a.without_known_tutor ? 'Sem tutor conhecido' : a.tutor_id ? 'Vinculado' : '—') },
              { key: 'st', header: 'Situação', render: (a) => <StatusPill tone={a.status === 'ativo' ? 'success' : 'neutral'}>{ANIMAL_STATUS[a.status]}</StatusPill> },
            ]} emptyText="Nenhum animal encontrado." />
        )
      ) : (
        tutors.loading ? <LoadingBlock /> : (
          <DataTable rows={tutors.data || []} rowKey={(t) => t.id} onRowClick={can('antirrabica.cadastro') ? setEditTutor : undefined} searchable={false}
            columns={[
              { key: 'n', header: 'Nome', render: (t) => <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />{t.full_name}</span> },
              { key: 'p', header: 'Telefone', render: (t) => t.phone || '—' },
              { key: 'l', header: 'Localidade', render: (t) => nName(t.neighborhood_id) },
              { key: 'a', header: 'Endereço', render: (t) => t.address || '—' },
            ]} emptyText="Nenhum tutor encontrado." />
        )
      )}
      {editAnimal && <AnimalForm animal={editAnimal} neighborhoods={lookups.data || []} onClose={() => setEditAnimal(null)} onSaved={() => { setEditAnimal(null); setTick((t) => t + 1); }} />}
      {editTutor && <TutorForm tutor={editTutor} neighborhoods={lookups.data || []} onClose={() => setEditTutor(null)} onSaved={() => { setEditTutor(null); setTick((t) => t + 1); }} />}
      {viewAnimal && <AnimalDetail animal={viewAnimal} onClose={() => setViewAnimal(null)} onEdit={can('antirrabica.cadastro') ? () => { setEditAnimal(viewAnimal); setViewAnimal(null); } : undefined} />}
    </div>
  );
};

const AnimalForm: React.FC<{ animal: Partial<Animal>; neighborhoods: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }> = ({ animal, neighborhoods, onClose, onSaved }) => {
  const municipalityId = useMunicipalityId();
  const { can } = useAuth();
  const [a, setA] = useState<Partial<Animal>>(animal);
  const [tutorTerm, setTutorTerm] = useState('');
  const [tutorOptions, setTutorOptions] = useState<Tutor[]>([]);
  const [propTerm, setPropTerm] = useState('');
  const [props, setProps] = useState<{ id: string; label: string; neighborhood_id: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open title={animal.code ? `Editar ${animal.code}` : 'Novo animal'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={!a.species} onClick={async () => {
        setBusy(true); setError(null);
        try { await zoonosesService.saveAnimal(municipalityId, a as any); onSaved(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
      }}>Salvar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Espécie" required>{(id) => <SelectInput id={id} value={a.species} onChange={(e) => setA({ ...a, species: e.target.value as Species })}><option value="canina">Cão</option><option value="felina">Gato</option></SelectInput>}</Field>
        <Field label="Nome">{(id) => <TextInput id={id} value={a.name || ''} onChange={(e) => setA({ ...a, name: e.target.value })} />}</Field>
        <Field label="Sexo">{(id) => <SelectInput id={id} value={a.sex} onChange={(e) => setA({ ...a, sex: e.target.value })}>{Object.entries(SEX_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
        <Field label="Faixa etária">{(id) => <SelectInput id={id} value={a.age_group} onChange={(e) => setA({ ...a, age_group: e.target.value })}>{Object.entries(AGE_GROUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
        <Field label="Idade aproximada (meses)">{(id) => <TextInput id={id} type="number" min={0} max={360} value={a.approx_age_months ?? ''} onChange={(e) => setA({ ...a, approx_age_months: e.target.value === '' ? null : Number(e.target.value) })} />}</Field>
        <Field label="Situação">{(id) => <SelectInput id={id} value={a.status} onChange={(e) => setA({ ...a, status: e.target.value })}>{Object.entries(ANIMAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
        <Field label="Características" className="sm:col-span-2">{(id) => <TextInput id={id} value={a.characteristics || ''} maxLength={500} onChange={(e) => setA({ ...a, characteristics: e.target.value })} />}</Field>
        <Field label="Localidade">{(id) => <SelectInput id={id} value={a.neighborhood_id || ''} onChange={(e) => setA({ ...a, neighborhood_id: e.target.value || null })}><option value="">—</option>{neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</SelectInput>}</Field>
        <Field label="Imóvel (cadastro territorial)" hint={a.property_id ? 'Imóvel vinculado.' : 'Busque por logradouro ou código.'}>{(id) => (
          <div className="space-y-1">
            <div className="flex gap-1"><TextInput id={id} value={propTerm} onChange={(e) => setPropTerm(e.target.value)} />
              <Button variant="secondary" onClick={async () => setProps(await zoonosesService.searchProperties(municipalityId, propTerm).catch(() => []))}>Buscar</Button></div>
            {props.map((p) => (
              <button key={p.id} type="button" className={`block w-full rounded border px-2 py-1 text-left text-xs ${a.property_id === p.id ? 'border-teal-700 bg-teal-50' : 'border-slate-200'}`}
                onClick={() => setA({ ...a, property_id: p.id, neighborhood_id: a.neighborhood_id || p.neighborhood_id })}>{p.label}</button>
            ))}
          </div>
        )}</Field>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-xs font-semibold text-slate-700">Tutor</legend>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!a.without_known_tutor} onChange={(e) => setA({ ...a, without_known_tutor: e.target.checked, tutor_id: e.target.checked ? null : a.tutor_id })} /> Sem tutor conhecido</label>
          {!a.without_known_tutor && can('antirrabica.tutores_dados') && (
            <>
              <div className="flex gap-1"><TextInput aria-label="Buscar tutor" value={tutorTerm} onChange={(e) => setTutorTerm(e.target.value)} placeholder="Nome ou telefone" />
                <Button variant="secondary" onClick={async () => setTutorOptions(await zoonosesService.searchTutors(municipalityId, tutorTerm).catch(() => []))}>Buscar</Button></div>
              {tutorOptions.map((t) => (
                <label key={t.id} className="flex items-center gap-2 rounded border border-slate-200 p-2 text-sm"><input type="radio" className="h-5 w-5" checked={a.tutor_id === t.id} onChange={() => setA({ ...a, tutor_id: t.id })} />{t.full_name}{t.phone ? ` · ${t.phone}` : ''}</label>
              ))}
              {a.tutor_id && !tutorOptions.length && <p className="text-xs text-slate-500">Tutor vinculado.</p>}
            </>
          )}
        </fieldset>
      </div>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
    </Dialog>
  );
};

const TutorForm: React.FC<{ tutor: Partial<Tutor>; neighborhoods: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }> = ({ tutor, neighborhoods, onClose, onSaved }) => {
  const municipalityId = useMunicipalityId();
  const [t, setT] = useState(tutor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animals = useAsync(() => (tutor.id ? zoonosesService.animalsByTutor(tutor.id) : Promise.resolve([] as Animal[])), [tutor.id]);
  return (
    <Dialog open title={tutor.id ? 'Tutor' : 'Novo tutor'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={(t.full_name || '').trim().length < 2} onClick={async () => {
        setBusy(true); setError(null);
        try { await zoonosesService.saveTutor(municipalityId, t as any); onSaved(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
      }}>Salvar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" required className="sm:col-span-2">{(id) => <TextInput id={id} value={t.full_name || ''} onChange={(e) => setT({ ...t, full_name: e.target.value })} />}</Field>
        <Field label="Telefone">{(id) => <TextInput id={id} inputMode="tel" value={t.phone || ''} onChange={(e) => setT({ ...t, phone: e.target.value })} />}</Field>
        <Field label="Localidade">{(id) => <SelectInput id={id} value={t.neighborhood_id || ''} onChange={(e) => setT({ ...t, neighborhood_id: e.target.value || null })}><option value="">—</option>{neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</SelectInput>}</Field>
        <Field label="Endereço" className="sm:col-span-2">{(id) => <TextInput id={id} value={t.address || ''} maxLength={300} onChange={(e) => setT({ ...t, address: e.target.value })} />}</Field>
      </div>
      {tutor.id && (
        <section className="mt-4">
          <SectionTitle>Animais do tutor</SectionTitle>
          {animals.loading ? <LoadingBlock /> : (animals.data || []).length === 0 ? <p className="text-sm text-slate-500">Nenhum animal vinculado.</p> : (
            <ul className="text-sm">{(animals.data || []).map((a) => <li key={a.id}>{a.code} · {SPECIES_LABELS[a.species]}{a.name ? ` · ${a.name}` : ''}</li>)}</ul>
          )}
        </section>
      )}
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
    </Dialog>
  );
};

const AnimalDetail: React.FC<{ animal: Animal; onClose: () => void; onEdit?: () => void }> = ({ animal, onClose, onEdit }) => {
  const { municipality } = useAuth();
  const history = useAsync(() => zoonosesService.animalHistory(animal.id), [animal.id]);
  const tutor = useAsync(async () => (animal.tutor_id ? (await zoonosesService.getTutors([animal.tutor_id]))[0] || null : null), [animal.tutor_id]);
  const [cardFor, setCardFor] = useState<any | null>(null);
  return (
    <Dialog open title={`${animal.code}${animal.name ? ` — ${animal.name}` : ''}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-700">{SPECIES_LABELS[animal.species]} · {SEX_LABELS[animal.sex]} · {AGE_GROUP_LABELS[animal.age_group]} · {ANIMAL_STATUS[animal.status]}</p>
        {animal.characteristics && <p className="text-slate-600">{animal.characteristics}</p>}
        <p className="text-slate-600">Tutor: {animal.without_known_tutor ? 'sem tutor conhecido' : tutor.data ? `${tutor.data.full_name}${tutor.data.phone ? ` · ${tutor.data.phone}` : ''}` : animal.tutor_id ? 'vinculado (dados restritos ao seu perfil)' : '—'}</p>
        {onEdit && <Button variant="secondary" onClick={onEdit}>Editar cadastro</Button>}
        <section>
          <SectionTitle>Histórico vacinal</SectionTitle>
          {history.loading ? <LoadingBlock /> : (history.data || []).length === 0 ? <p className="text-slate-500">Sem registro de vacinação no sistema (sem informação — não significa não vacinado).</p> : (
            <ul className="space-y-2">
              {(history.data || []).map((h: any) => (
                <li key={h.id} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{fmtDate(h.vaccinated_on)} · {h.vaccination_campaigns?.name || 'Rotina'} · {h.products?.name} lote {h.product_batches?.batch_number}</span>
                    <StatusPill tone={h.status === 'valida' ? 'success' : 'neutral'}>{h.status === 'valida' ? 'Válida' : 'Anulada'}</StatusPill>
                  </div>
                  {h.status === 'valida' && <Button variant="ghost" onClick={() => setCardFor(h)}>Ver comprovante</Button>}
                  {h.void_reason && <p className="text-xs text-slate-500">Motivo da anulação: {h.void_reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {cardFor && (
        <Dialog open title="Comprovante de vacinação" onClose={() => setCardFor(null)}>
          <VaccinationCard data={{
            verification_code: cardFor.verification_code, animal_code: animal.code, animal_name: animal.name, species: animal.species,
            tutor_name: tutor.data?.full_name || null, vaccinated_on: cardFor.vaccinated_on,
            vaccine: `${cardFor.products?.name || ''}${cardFor.products?.manufacturer ? ` (${cardFor.products.manufacturer})` : ''}`, batch: cardFor.product_batches?.batch_number || '',
            service: `Vigilância em Saúde — ${municipality ? `${municipality.name}/${municipality.state}` : ''}`, vaccinator: cardFor.profiles?.full_name || '—',
          }} />
        </Dialog>
      )}
    </Dialog>
  );
};
