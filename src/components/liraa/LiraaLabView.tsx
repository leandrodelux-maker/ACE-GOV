import React, { useMemo, useState } from 'react';
import { FlaskConical, PackageCheck } from 'lucide-react';
import { PageHeader, Card } from '../ui';
import { Button, DataTable, Dialog, EmptyState, Field, LoadingBlock, Metric, Notice, SectionTitle, SelectInput, StatusPill, TextArea, fmtDate, fmtDateTime, useAsync, Tone } from '../ui/ModuleKit';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { LAB_RESULT_LABELS, LabResult, liraaModuleService, TUBE_STATUS_LABELS, TubeRow } from '../../services/liraa/liraaModuleService';
import { SurveyPicker, useSelectedSurvey } from './SurveyPicker';

const STATUS_TONE: Record<string, Tone> = { coletada: 'warning', recebida: 'info', analisada: 'success', inconclusiva: 'warning', descartada: 'neutral' };

export const LiraaLabView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const { can } = useAuth();
  const surveysQ = useAsync(() => liraaModuleService.listSurveys(municipalityId), [municipalityId]);
  const labSurveys = useMemo(() => (surveysQ.data || []).filter((s) => ['execucao', 'conferencia', 'encerrado'].includes(s.status)), [surveysQ.data]);
  const [surveyId, setSurveyId] = useSelectedSurvey(labSurveys.length ? labSurveys : null, (s) => s.status !== 'encerrado');
  const survey = labSurveys.find((s) => s.id === surveyId) || null;
  const [tick, setTick] = useState(0);
  const tubesQ = useAsync(() => (survey ? liraaModuleService.listTubes(survey.id) : Promise.resolve([] as TubeRow[])), [survey?.id, tick]);
  const [statusFilter, setStatusFilter] = useState('pendentes');
  const [labels, setLabels] = useState('');
  const [receiveMsg, setReceiveMsg] = useState<{ tone: Tone; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<TubeRow | null>(null);
  const editable = !!survey && survey.status !== 'encerrado' && can('liraa.laboratorio');

  const tubes = tubesQ.data || [];
  const counts = useMemo(() => tubes.reduce<Record<string, number>>((a, t) => ({ ...a, [t.status]: (a[t.status] || 0) + 1 }), {}), [tubes]);
  const filtered = tubes.filter((t) => statusFilter === 'todos' || (statusFilter === 'pendentes' ? ['coletada', 'recebida'].includes(t.status) : t.status === statusFilter));

  const receive = async () => {
    if (!survey) return;
    const list = labels.split(/[\s,;]+/).map((l) => l.trim()).filter(Boolean);
    if (!list.length) return;
    setBusy(true);
    setReceiveMsg(null);
    try {
      const r = await liraaModuleService.labReceive(survey.id, list);
      setReceiveMsg({
        tone: r.not_found.length ? 'warning' : 'success',
        text: `${r.received.length} tubito(s) recebido(s).${r.not_found.length ? ` Não encontrados ou já recebidos: ${r.not_found.join(', ')}.` : ''}`,
      });
      setLabels('');
      setTick((t) => t + 1);
    } catch (e: any) {
      setReceiveMsg({ tone: 'danger', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader icon={FlaskConical} title="Laboratório entomológico — LIRAa/LIA" subtitle="Recebimento dos tubitos, identificação da espécie e resultado. Só o resultado laboratorial entra nos índices." />
      {surveysQ.loading && <LoadingBlock />}
      {!surveysQ.loading && labSurveys.length === 0 && <EmptyState title="Nenhum levantamento com amostras" description="Os tubitos aparecem aqui quando a coleta de campo começa." />}
      {survey && (
        <>
          <Card padding="compact"><SurveyPicker surveys={labSurveys} value={surveyId} onChange={setSurveyId} /></Card>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Metric label="Em campo (não recebidos)" value={counts.coletada || 0} tone={counts.coletada ? 'warning' : undefined} />
            <Metric label="Recebidos sem resultado" value={counts.recebida || 0} tone={counts.recebida ? 'warning' : undefined} />
            <Metric label="Analisados" value={counts.analisada || 0} />
            <Metric label="Inconclusivos" value={counts.inconclusiva || 0} />
            <Metric label="Descartados" value={counts.descartada || 0} />
          </div>
          {editable && (
            <Card>
              <SectionTitle>Recebimento</SectionTitle>
              <Field label="Identificações dos tubitos" hint="Uma por linha ou separadas por vírgula (como escritas no rótulo).">
                {(id) => <TextArea id={id} value={labels} onChange={(e) => setLabels(e.target.value)} />}
              </Field>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button icon={PackageCheck} onClick={receive} loading={busy} disabled={!labels.trim()}>Registrar recebimento</Button>
              </div>
              {receiveMsg && <div className="mt-2"><Notice tone={receiveMsg.tone} onClose={() => setReceiveMsg(null)}>{receiveMsg.text}</Notice></div>}
            </Card>
          )}
          {tubesQ.error && <Notice tone="danger">{tubesQ.error}</Notice>}
          <DataTable
            rows={filtered}
            rowKey={(t) => t.id}
            onRowClick={(t) => setOpen(t)}
            searchPlaceholder="Pesquisar tubito ou endereço"
            toolbar={
              <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-48" aria-label="Filtrar situação">
                <option value="pendentes">Sem resultado</option>
                <option value="todos">Todos</option>
                {Object.entries(TUBE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </SelectInput>
            }
            columns={[
              { key: 'tube_label', header: 'Tubito', render: (t) => <span className="font-mono font-semibold">{t.tube_label}</span>, text: (t) => t.tube_label },
              { key: 'dep', header: 'Depósito', render: (t) => t.deposit_category || '—' },
              { key: 'fase', header: 'Fase', render: (t) => t.collection_type },
              { key: 'coleta', header: 'Coleta', render: (t) => fmtDate(t.collection_date) },
              { key: 'end', header: 'Imóvel', render: (t) => t.property_address || '—', text: (t) => t.property_address || '' },
              { key: 'agente', header: 'Agente', render: (t) => t.agent_name || '—' },
              { key: 'st', header: 'Situação', render: (t) => <StatusPill tone={STATUS_TONE[t.status] || 'neutral'}>{TUBE_STATUS_LABELS[t.status] || t.status}</StatusPill>, text: (t) => TUBE_STATUS_LABELS[t.status] || '' },
              { key: 'res', header: 'Resultado', render: (t) => (t.lab_result ? LAB_RESULT_LABELS[t.lab_result] : '—') },
            ]}
          />
        </>
      )}
      {open && <ResultDialog tube={open} editable={editable} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); setTick((t) => t + 1); }} />}
    </div>
  );
};

const ResultDialog: React.FC<{ tube: TubeRow; editable: boolean; onClose: () => void; onSaved: () => void }> = ({ tube, editable, onClose, onSaved }) => {
  const [result, setResult] = useState<LabResult | 'descartada' | ''>(tube.lab_result || '');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const events = useAsync(() => liraaModuleService.labEvents(tube.id), [tube.id]);
  const rectifying = ['analisada', 'inconclusiva', 'descartada'].includes(tube.status);
  const needsNote = result === 'descartada' || rectifying;
  return (
    <Dialog open title={`Tubito ${tube.tube_label}`} onClose={onClose}
      footer={editable ? <><Button variant="secondary" onClick={onClose}>Fechar</Button>
        <Button loading={busy} disabled={!result || (needsNote && notes.trim().length < 10)} onClick={async () => {
          setBusy(true); setError(null);
          try { await liraaModuleService.labResult(tube.id, result as any, notes); onSaved(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
        }}>{rectifying ? 'Retificar resultado' : 'Registrar resultado'}</Button></> : undefined}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-700">Depósito {tube.deposit_category} · {tube.collection_type} · coletado em {fmtDate(tube.collection_date)} · {tube.property_address}</p>
        {editable && (
          <fieldset className="space-y-1">
            <legend className="text-xs font-semibold text-slate-700">Resultado laboratorial</legend>
            {[...Object.entries(LAB_RESULT_LABELS), ['descartada', 'Descartar amostra (imprópria)']].map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                <input type="radio" name="res" className="h-5 w-5" checked={result === k} onChange={() => setResult(k as any)} /> {v}
              </label>
            ))}
          </fieldset>
        )}
        {editable && (
          <Field label={needsNote ? 'Justificativa (obrigatória)' : 'Observações'} hint={needsNote ? 'Mínimo de 10 caracteres.' : undefined}>
            {(id) => <TextArea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        <section>
          <SectionTitle>Histórico</SectionTitle>
          {events.loading ? <LoadingBlock /> : (events.data || []).length === 0 ? <p className="text-xs text-slate-500">Sem eventos de laboratório.</p> : (
            <ol className="space-y-1 text-xs text-slate-600">
              {(events.data || []).map((e, i) => (
                <li key={i}>{fmtDateTime(e.created_at)} · {e.actor}: {e.event} ({TUBE_STATUS_LABELS[e.from_status || ''] || e.from_status || '—'} → {TUBE_STATUS_LABELS[e.to_status || ''] || e.to_status})
                  {e.lab_result ? ` · ${LAB_RESULT_LABELS[e.lab_result as LabResult]}` : ''}{e.notes ? ` · "${e.notes}"` : ''}</li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Dialog>
  );
};
