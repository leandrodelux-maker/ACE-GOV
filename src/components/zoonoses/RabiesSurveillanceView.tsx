import React, { useState } from 'react';
import { Plus, ShieldAlert } from 'lucide-react';
import { PageHeader } from '../ui';
import { Button, DataTable, Dialog, EmptyState, Field, LoadingBlock, Notice, SectionTitle, SelectInput, StatusPill, TextArea, TextInput, Tone, fmtDate, fmtDateTime, useAsync } from '../ui/ModuleKit';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { RABIES_SPECIES_LABELS, RABIES_STATUS_LABELS, RABIES_TYPE_LABELS, zoonosesService } from '../../services/zoonoses/zoonosesService';

const STATUS_TONE: Record<string, Tone> = {
  notificado: 'warning', em_investigacao: 'warning', aguardando_laboratorio: 'info',
  encerrado_descartado: 'neutral', encerrado_confirmado: 'danger', encerrado_inconclusivo: 'neutral',
};
const LAB_LABELS: Record<string, string> = { pendente: 'Pendente', positivo: 'Positivo', negativo: 'Negativo', inconclusivo: 'Inconclusivo', improprio: 'Amostra imprópria' };

/**
 * Vigilância da raiva animal — registro e acompanhamento de eventos. Não substitui a
 * notificação nos sistemas oficiais (SINAN e demais fluxos); o número da notificação
 * oficial pode ser vinculado ao evento.
 */
export const RabiesSurveillanceView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const { can } = useAuth();
  const [tick, setTick] = useState(0);
  const events = useAsync(() => zoonosesService.listRabiesEvents(municipalityId), [municipalityId, tick]);
  const neighborhoods = useAsync(() => zoonosesService.listNeighborhoods(municipalityId), [municipalityId]);
  const [editing, setEditing] = useState<any | null>(null);

  return (
    <div className="space-y-4">
      <PageHeader icon={ShieldAlert} title="Vigilância da raiva animal" subtitle="Ocorrências suspeitas, investigação, coleta e resultado laboratorial, encaminhamentos e bloqueio de foco."
        actions={can('raiva.registrar') ? <Button icon={Plus} onClick={() => setEditing({ event_type: 'agressao_animal', species: 'canina', investigation_status: 'notificado', human_exposure: false, sample_collected: false, reported_at: new Date().toISOString() })}>Registrar ocorrência</Button> : undefined} />
      <Notice tone="info">Este registro apoia a gestão municipal e não substitui a notificação obrigatória nos sistemas oficiais. Classificação, resultado laboratorial, encerramento e bloqueio de foco ficam restritos a profissionais com a permissão "Decisões técnicas (raiva)".</Notice>
      {events.loading && <LoadingBlock />}
      {events.error && <Notice tone="danger">{events.error}</Notice>}
      {events.data && (events.data.length === 0 ? <EmptyState title="Nenhuma ocorrência registrada" /> : (
        <DataTable rows={events.data} rowKey={(e: any) => e.id} onRowClick={(e) => setEditing(e)} searchPlaceholder="Pesquisar ocorrência"
          columns={[
            { key: 'c', header: 'Código', render: (e: any) => <span className="font-mono font-semibold">{e.event_code}</span>, text: (e: any) => e.event_code },
            { key: 'd', header: 'Data', render: (e: any) => fmtDate(e.reported_at) },
            { key: 't', header: 'Tipo', render: (e: any) => RABIES_TYPE_LABELS[e.event_type], text: (e: any) => RABIES_TYPE_LABELS[e.event_type] },
            { key: 'e', header: 'Espécie', render: (e: any) => RABIES_SPECIES_LABELS[e.species] },
            { key: 'l', header: 'Localidade', render: (e: any) => e.neighborhoods?.name || '—', text: (e: any) => e.neighborhoods?.name || '' },
            { key: 'h', header: 'Exposição humana', render: (e: any) => (e.human_exposure ? `Sim${e.exposed_people_count ? ` (${e.exposed_people_count})` : ''}` : 'Não') },
            { key: 'lab', header: 'Laboratório', render: (e: any) => (e.lab_result ? LAB_LABELS[e.lab_result] : e.sample_collected ? 'Coletada' : '—') },
            { key: 's', header: 'Situação', render: (e: any) => <StatusPill tone={STATUS_TONE[e.investigation_status]}>{RABIES_STATUS_LABELS[e.investigation_status]}</StatusPill>, text: (e: any) => RABIES_STATUS_LABELS[e.investigation_status] },
          ]} />
      ))}
      {editing && <EventDialog event={editing} neighborhoods={neighborhoods.data || []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setTick((t) => t + 1); }} />}
    </div>
  );
};

const EventDialog: React.FC<{ event: any; neighborhoods: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }> = ({ event, neighborhoods, onClose, onSaved }) => {
  const municipalityId = useMunicipalityId();
  const { can, session } = useAuth();
  const [e, setE] = useState<any>(event);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [tick, setTick] = useState(0);
  const updates = useAsync(() => (event.id ? zoonosesService.rabiesUpdates(event.id) : Promise.resolve([])), [event.id, tick]);
  const decide = can('raiva.decidir');
  const closed = String(event.investigation_status || '').startsWith('encerrado');
  const editable = event.id ? (closed ? decide : can('raiva.registrar') || decide) : can('raiva.registrar');
  const set = (k: string, v: unknown) => setE({ ...e, [k]: v });

  return (
    <Dialog open wide title={event.id ? `Ocorrência ${event.event_code}` : 'Registrar ocorrência'} onClose={onClose}
      footer={editable ? <><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} onClick={async () => {
        setBusy(true); setError(null);
        try { await zoonosesService.saveRabiesEvent(municipalityId, e); onSaved(); } catch (err: any) { setError(err.message); } finally { setBusy(false); }
      }}>Salvar</Button></> : undefined}>
      <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo de ocorrência" required>{(id) => <SelectInput id={id} value={e.event_type} onChange={(x) => set('event_type', x.target.value)}>{Object.entries(RABIES_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
        <Field label="Espécie do animal" required>{(id) => <SelectInput id={id} value={e.species} onChange={(x) => set('species', x.target.value)}>{Object.entries(RABIES_SPECIES_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
        <Field label="Data da ocorrência">{(id) => <TextInput id={id} type="date" value={(e.reported_at || '').slice(0, 10)} onChange={(x) => set('reported_at', `${x.target.value}T12:00:00`)} />}</Field>
        <Field label="Localidade">{(id) => <SelectInput id={id} value={e.neighborhood_id || ''} onChange={(x) => set('neighborhood_id', x.target.value || null)}><option value="">—</option>{neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</SelectInput>}</Field>
        <Field label="Identificação do animal" className="sm:col-span-2" hint="Descrição ou código do cadastro animal, se houver.">{(id) => <TextInput id={id} value={e.animal_description || ''} onChange={(x) => set('animal_description', x.target.value)} />}</Field>
        <Field label="Local (referência)" className="sm:col-span-2" hint="Acesso restrito à equipe; não é exibido publicamente.">{(id) => <TextInput id={id} value={e.location_description || ''} onChange={(x) => set('location_description', x.target.value)} />}</Field>
        <Field label="Sinais clínicos" className="sm:col-span-2">{(id) => <TextArea id={id} value={e.clinical_signs || ''} onChange={(x) => set('clinical_signs', x.target.value)} />}</Field>
        <Field label="Informações epidemiológicas" className="sm:col-span-2">{(id) => <TextArea id={id} value={e.epidemiological_info || ''} onChange={(x) => set('epidemiological_info', x.target.value)} />}</Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!e.human_exposure} onChange={(x) => set('human_exposure', x.target.checked)} /> Houve exposição humana</label>
        {e.human_exposure && <Field label="Pessoas expostas">{(id) => <TextInput id={id} type="number" min={0} value={e.exposed_people_count ?? ''} onChange={(x) => set('exposed_people_count', x.target.value === '' ? null : Number(x.target.value))} />}</Field>}
        <Field label="Encaminhamentos" className="sm:col-span-2" hint="Ex.: unidade de saúde para profilaxia humana, observação do animal.">{(id) => <TextArea id={id} value={e.referrals || ''} onChange={(x) => set('referrals', x.target.value)} />}</Field>
        <Field label="Nº da notificação oficial (se houver)">{(id) => <TextInput id={id} value={e.official_notification_number || ''} onChange={(x) => set('official_notification_number', x.target.value)} />}</Field>
        <div />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!e.sample_collected} onChange={(x) => set('sample_collected', x.target.checked)} /> Amostra coletada para laboratório</label>
        {e.sample_collected && <>
          <Field label="Data da coleta">{(id) => <TextInput id={id} type="date" value={e.sample_collected_at || ''} onChange={(x) => set('sample_collected_at', x.target.value || null)} />}</Field>
          <Field label="Tipo de amostra">{(id) => <TextInput id={id} value={e.sample_type || ''} onChange={(x) => set('sample_type', x.target.value)} />}</Field>
          <Field label="Laboratório">{(id) => <TextInput id={id} value={e.lab_institution || ''} onChange={(x) => set('lab_institution', x.target.value)} />}</Field>
        </>}
      </fieldset>

      <section className="mt-4 rounded-xl border border-slate-200 p-3">
        <SectionTitle>Decisões técnicas {decide ? '' : '(somente profissionais autorizados)'}</SectionTitle>
        <fieldset disabled={!decide} className="grid gap-3 sm:grid-cols-2">
          <Field label="Situação da investigação">{(id) => (
            <SelectInput id={id} value={e.investigation_status} onChange={(x) => set('investigation_status', x.target.value)}>
              {Object.entries(RABIES_STATUS_LABELS).filter(([k]) => decide || !k.startsWith('encerrado')).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </SelectInput>
          )}</Field>
          <Field label="Resultado laboratorial">{(id) => <SelectInput id={id} value={e.lab_result || ''} onChange={(x) => set('lab_result', x.target.value || null)}><option value="">—</option>{Object.entries(LAB_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
          <Field label="Ações de bloqueio de foco" className="sm:col-span-2">{(id) => <TextArea id={id} value={e.focus_control_actions || ''} onChange={(x) => set('focus_control_actions', x.target.value)} />}</Field>
        </fieldset>
        {!decide && <p className="mt-2 text-xs text-slate-500">Situação "em investigação" e "aguardando laboratório" podem ser informadas por quem registra; encerramento, resultado e bloqueio exigem decisão técnica.</p>}
      </section>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}

      {event.id && (
        <section className="mt-4">
          <SectionTitle>Histórico de acompanhamento</SectionTitle>
          {(can('raiva.registrar') || decide) && (
            <div className="mb-2 flex gap-2">
              <TextInput value={note} onChange={(x) => setNote(x.target.value)} placeholder="Nova anotação de acompanhamento" aria-label="Anotação" />
              <Button variant="secondary" disabled={note.trim().length < 3} onClick={async () => {
                try { await zoonosesService.addRabiesNote(municipalityId, event.id, session!.profile.id, note.trim()); setNote(''); setTick((t) => t + 1); } catch (err: any) { setError(err.message); }
              }}>Anotar</Button>
            </div>
          )}
          {updates.loading ? <LoadingBlock /> : (
            <ol className="space-y-1 text-xs text-slate-600">
              {(updates.data || []).map((u: any) => <li key={u.id}>{fmtDateTime(u.created_at)} · {u.profiles?.full_name || 'Sistema'}: {u.note}</li>)}
            </ol>
          )}
        </section>
      )}
    </Dialog>
  );
};
