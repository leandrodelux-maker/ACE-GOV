import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudOff, CloudUpload, Crosshair, MapPin, Smartphone, Trash2 } from 'lucide-react';
import { PageHeader, Card } from '../ui';
import { Button, EmptyState, Field, LoadingBlock, Notice, SectionTitle, SelectInput, Stepper, StatusPill, TextArea, TextInput, fmtDateTime } from '../ui/ModuleKit';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { liraaModuleService, LiraaSurvey, SampleRow, SITUATION_LABELS, InspectionSituation } from '../../services/liraa/liraaModuleService';
import { DEPOSIT_CATEGORIES, DEPOSIT_LABELS, DepositCategory, validateInspectionDeposits } from '../../services/liraa/liraaMethodology';
import {
  QueuedRecord, clearDraft, discardRecord, enqueueRecord, loadDraft, newRecordId, readModuleQueue, saveDraft, syncModuleQueue,
} from '../../services/offlineQueue';
import { OFFLINE_QUEUE_EVENT } from '../../services/offlineVisitQueue';
import { SurveyPicker, useSelectedSurvey } from './SurveyPicker';

const CACHE_KEY = 'endemias_cache_liraa_campo_v1';
/** Numeração local de tubitos (preservada no logout para não repetir rótulos). */
const TUBE_SEQ_KEY = 'endemias_queue_liraa_tubeseq_v1';

interface FieldCache {
  municipalityId: string;
  surveys: LiraaSurvey[];
  samples: Record<string, SampleRow[]>;
  agentId: string | null;
  savedAt: string;
}

function readCache(municipalityId: string): FieldCache | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return c && c.municipalityId === municipalityId ? c : null;
  } catch {
    return null;
  }
}

function nextTubeLabels(surveyId: string, prefix: string, count: number): string[] {
  let map: Record<string, number> = {};
  try {
    map = JSON.parse(localStorage.getItem(TUBE_SEQ_KEY) || '{}');
  } catch {
    map = {};
  }
  const start = (map[surveyId] || 0) + 1;
  map[surveyId] = start + count - 1;
  try {
    localStorage.setItem(TUBE_SEQ_KEY, JSON.stringify(map));
  } catch {
    /* sem armazenamento: rótulos ainda podem ser editados */
  }
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(start + i).padStart(3, '0')}`);
}

interface InspectionDraft {
  situation: InspectionSituation | '';
  closed_reason: string;
  is_vacant_lot: boolean;
  deposits: Record<DepositCategory, { inspected: number; positive: number }>;
  tubes: { label: string; category: DepositCategory; stage: string }[];
  notes: string;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  substitute_property_id: string;
  inspected_at: string;
}

const emptyDraft = (): InspectionDraft => ({
  situation: '',
  closed_reason: '',
  is_vacant_lot: false,
  deposits: Object.fromEntries(DEPOSIT_CATEGORIES.map((c) => [c, { inspected: 0, positive: 0 }])) as InspectionDraft['deposits'],
  tubes: [],
  notes: '',
  latitude: null,
  longitude: null,
  gps_accuracy: null,
  substitute_property_id: '',
  inspected_at: new Date().toISOString(),
});

export const LiraaFieldView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const { session, can } = useAuth();
  const profileId = session?.profile.id || '';
  const [cache, setCache] = useState<FieldCache | null>(() => readCache(municipalityId));
  const [loading, setLoading] = useState(!cache);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [queue, setQueue] = useState<QueuedRecord[]>(() => readModuleQueue('liraa_inspection'));
  const [syncMsg, setSyncMsg] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<SampleRow | null>(null);

  const activeSurveys = useMemo(() => (cache?.surveys || []).filter((s) => s.status === 'execucao' || s.status === 'conferencia'), [cache]);
  const [surveyId, setSurveyId] = useSelectedSurvey(activeSurveys.length ? activeSurveys : null);
  const survey = activeSurveys.find((s) => s.id === surveyId) || null;

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const surveys = (await liraaModuleService.listSurveys(municipalityId)).filter((s) => s.status === 'execucao' || s.status === 'conferencia');
      const agentId = profileId ? await liraaModuleService.myAgentId(municipalityId, profileId) : null;
      const samples: Record<string, SampleRow[]> = {};
      for (const s of surveys) samples[s.id] = await liraaModuleService.listSamples(s.id);
      const next = { municipalityId, surveys, samples, agentId, savedAt: new Date().toISOString() };
      setCache(next);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch {
        /* cache é conveniência */
      }
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, [municipalityId, profileId]);

  const sync = useCallback(async () => {
    if (!profileId) return;
    const res = await syncModuleQueue('liraa_inspection', async (r) => liraaModuleService.submitInspection(r.payload), { municipalityId, profileId });
    setQueue(readModuleQueue('liraa_inspection'));
    if (res.synced) setSyncMsg({ tone: 'success', text: `${res.synced} inspeção(ões) sincronizada(s) com o banco municipal.` });
    else if (res.failed) setSyncMsg({ tone: 'warning', text: `${res.failed} registro(s) não enviado(s). Veja os detalhes abaixo.` });
    if (res.synced) refresh();
  }, [municipalityId, profileId, refresh]);

  useEffect(() => {
    if (navigator.onLine) refresh();
    const on = () => { setOnline(true); sync(); };
    const off = () => setOnline(false);
    const q = () => setQueue(readModuleQueue('liraa_inspection'));
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener(OFFLINE_QUEUE_EVENT, q);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, q);
    };
  }, [refresh, sync]);

  const queuedSamples = useMemo(() => new Set(queue.map((q) => String((q.payload as any).sample_id))), [queue]);
  const mine = useMemo(() => {
    const all = (survey && cache?.samples[survey.id]) || [];
    return showAll || !cache?.agentId ? all : all.filter((s) => s.agent_id === cache.agentId);
  }, [survey, cache, showAll]);
  const byBlock = useMemo(() => {
    const m = new Map<string, SampleRow[]>();
    for (const s of mine) {
      const k = s.block_code ? `Quarteirão ${s.block_code}` : s.neighborhood || 'Sem quarteirão';
      m.set(k, [...(m.get(k) || []), s]);
    }
    return Array.from(m.entries());
  }, [mine]);
  const pendingCount = mine.filter((s) => s.status === 'selecionado' && !queuedSamples.has(s.id)).length;

  return (
    <div className="space-y-4">
      <PageHeader icon={Smartphone} title="Coleta de campo — LIRAa/LIA" subtitle="Imóveis sorteados distribuídos para você. Funciona sem internet; os registros ficam na fila até sincronizar." />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusPill tone={online ? 'success' : 'warning'}>{online ? 'Conectado' : 'Sem conexão — registros ficam no aparelho'}</StatusPill>
        {cache?.savedAt && <span className="text-xs text-slate-500">Lista atualizada em {fmtDateTime(cache.savedAt)}</span>}
        <Button variant="ghost" onClick={refresh} disabled={!online}>Atualizar lista</Button>
      </div>
      {loading && <LoadingBlock />}
      {loadError && <Notice tone="warning" title="Usando a última lista salva no aparelho">{loadError}</Notice>}
      {syncMsg && <Notice tone={syncMsg.tone} onClose={() => setSyncMsg(null)}>{syncMsg.text}</Notice>}

      <QueuePanel queue={queue} onSync={sync} online={online} onDiscard={(id) => { discardRecord('liraa_inspection', id); setQueue(readModuleQueue('liraa_inspection')); }} />

      {!loading && activeSurveys.length === 0 && <EmptyState title="Nenhum levantamento em execução" description="Quando a coordenação iniciar a execução, os imóveis sorteados aparecem aqui." />}
      {survey && (
        <>
          <Card padding="compact">
            <div className="flex flex-wrap items-end gap-3">
              <SurveyPicker surveys={activeSurveys} value={surveyId} onChange={setSurveyId} />
              {(can('liraa.supervisionar') || !cache?.agentId) && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="h-5 w-5" checked={showAll || !cache?.agentId} disabled={!cache?.agentId} onChange={(e) => setShowAll(e.target.checked)} />
                  Ver imóveis de todos os agentes
                </label>
              )}
            </div>
            {!cache?.agentId && <p className="mt-2 text-xs text-amber-700">Seu perfil não tem cadastro de agente vinculado: peça o vínculo em Administração › Usuários para receber imóveis.</p>}
            <p className="mt-2 text-sm text-slate-700"><strong>{pendingCount}</strong> imóvel(is) a visitar · {mine.length} no total</p>
          </Card>
          {byBlock.length === 0 ? <EmptyState title="Nenhum imóvel distribuído para você" description="A supervisão distribui os quarteirões sorteados entre os agentes." /> : (
            <div className="space-y-3">
              {byBlock.map(([label, rows]) => (
                <Card key={label} padding="compact">
                  <h2 className="mb-2 text-sm font-bold text-slate-900">{label}</h2>
                  <ul className="divide-y divide-slate-100">
                    {rows.map((s) => {
                      const queued = queuedSamples.has(s.id);
                      return (
                        <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{s.address || 'Endereço não cadastrado'}</p>
                            <p className="text-xs text-slate-500">{s.selection_type === 'substituto' ? 'Substituto · ' : ''}{s.property_code || ''} {s.neighborhood ? `· ${s.neighborhood}` : ''}</p>
                          </div>
                          {queued ? <StatusPill tone="warning">Na fila</StatusPill>
                            : s.status === 'selecionado' ? <Button onClick={() => setOpen(s)} disabled={survey.status === 'conferencia' && !can('liraa.supervisionar')}>Registrar</Button>
                            : <StatusPill tone={s.status === 'trabalhado' ? 'success' : 'neutral'}>{SITUATION_LABELS[s.status]}</StatusPill>}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {open && survey && (
        <InspectionForm
          survey={survey}
          sample={open}
          agentPrefix={(cache?.agentId || profileId).replace(/-/g, '').slice(0, 4).toUpperCase()}
          sameBlockSamples={(cache?.samples[survey.id] || []).filter((x) => x.block_id && x.block_id === open.block_id).map((x) => x.property_id)}
          onClose={() => setOpen(null)}
          onQueued={() => {
            setOpen(null);
            setQueue(readModuleQueue('liraa_inspection'));
            if (navigator.onLine) sync();
          }}
          municipalityId={municipalityId}
          profileId={profileId}
        />
      )}
    </div>
  );
};

const QueuePanel: React.FC<{ queue: QueuedRecord[]; online: boolean; onSync: () => void; onDiscard: (id: string) => void }> = ({ queue, online, onSync, onDiscard }) => {
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!queue.length) return null;
  return (
    <Card padding="compact">
      <SectionTitle actions={<Button icon={CloudUpload} onClick={onSync} disabled={!online}>Sincronizar agora</Button>}>
        <span className="inline-flex items-center gap-2"><CloudOff className="h-4 w-4 text-amber-600" aria-hidden="true" /> {queue.length} registro(s) aguardando envio</span>
      </SectionTitle>
      <ul className="space-y-2 text-sm">
        {queue.map((q) => (
          <li key={q.id} className="rounded-lg border border-slate-200 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-800">{q.label}</span>
              <StatusPill tone={q.status === 'erro' ? 'danger' : 'warning'}>{q.status === 'erro' ? 'Precisa de correção' : 'Pendente'}</StatusPill>
            </div>
            {q.lastError && <p className="mt-1 text-xs text-rose-700">{q.lastError}</p>}
            {q.status === 'erro' && (
              confirm === q.id ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs text-slate-700">Descartar este registro do aparelho? Ele não foi gravado no banco.</span>
                  <Button variant="danger" onClick={() => { onDiscard(q.id); setConfirm(null); }}>Descartar</Button>
                  <Button variant="secondary" onClick={() => setConfirm(null)}>Manter</Button>
                </div>
              ) : <Button variant="ghost" icon={Trash2} onClick={() => setConfirm(q.id)}>Descartar e registrar de novo</Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
};

const InspectionForm: React.FC<{
  survey: LiraaSurvey;
  sample: SampleRow;
  agentPrefix: string;
  sameBlockSamples: string[];
  municipalityId: string;
  profileId: string;
  onClose: () => void;
  onQueued: () => void;
}> = ({ survey, sample, agentPrefix, sameBlockSamples, municipalityId, profileId, onClose, onQueued }) => {
  const draftKey = `liraa_${sample.id}`;
  const [d, setD] = useState<InspectionDraft>(() => loadDraft<InspectionDraft>(draftKey)?.value || emptyDraft());
  const [errors, setErrors] = useState<string[]>([]);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [neighbors, setNeighbors] = useState<{ id: string; address?: string; position: string }[]>([]);

  useEffect(() => saveDraft(draftKey, d), [d, draftKey]);

  // Substituição: imóvel imediatamente anterior, depois posterior (Manual LIRAa, 4.5)
  useEffect(() => {
    if (!(d.situation === 'fechado' || d.situation === 'recusa') || !sample.block_id || !navigator.onLine) return;
    liraaModuleService.blockProperties(municipalityId, sample.block_id).then((props) => {
      const idx = props.findIndex((p) => p.id === sample.property_id);
      const taken = new Set(sameBlockSamples);
      const out: { id: string; address?: string; position: string }[] = [];
      for (let k = 1; k < props.length && out.length < 6; k++) {
        const before = props[idx - k];
        const after = props[idx + k];
        if (before && !taken.has(before.id)) out.push({ id: before.id, address: before.address, position: `${k}º anterior` });
        if (after && !taken.has(after.id)) out.push({ id: after.id, address: after.address, position: `${k}º posterior` });
      }
      setNeighbors(out);
    }).catch(() => setNeighbors([]));
  }, [d.situation, sample, municipalityId, sameBlockSamples]);

  const positives = DEPOSIT_CATEGORIES.flatMap((c) => Array.from({ length: d.deposits[c].positive }, () => c));
  // Mantém um tubito por depósito positivo, preservando rótulos já atribuídos
  useEffect(() => {
    if (d.situation !== 'trabalhado') return;
    const byCat: Record<string, InspectionDraft['tubes']> = {};
    d.tubes.forEach((t) => (byCat[t.category] = [...(byCat[t.category] || []), t]));
    const next: InspectionDraft['tubes'] = [];
    let missing = 0;
    for (const c of DEPOSIT_CATEGORIES) {
      const want = d.deposits[c].positive;
      const have = (byCat[c] || []).slice(0, want);
      next.push(...have);
      missing += want - have.length;
    }
    if (missing === 0 && next.length === d.tubes.length) return;
    const labels = missing > 0 ? nextTubeLabels(survey.id, agentPrefix, missing) : [];
    let li = 0;
    const filled: InspectionDraft['tubes'] = [];
    for (const c of DEPOSIT_CATEGORIES) {
      const existing = next.filter((t) => t.category === c);
      filled.push(...existing);
      for (let i = existing.length; i < d.deposits[c].positive; i++) filled.push({ label: labels[li++], category: c, stage: 'larva' });
    }
    setD((prev) => ({ ...prev, tubes: filled }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positives.join(','), d.situation]);

  const captureGps = () => {
    if (!navigator.geolocation) return setGpsMsg('GPS indisponível neste aparelho.');
    setGpsMsg('Obtendo localização...');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setD((prev) => ({ ...prev, latitude: p.coords.latitude, longitude: p.coords.longitude, gps_accuracy: p.coords.accuracy }));
        setGpsMsg(`Localização registrada (precisão de ${Math.round(p.coords.accuracy)} m).`);
      },
      () => setGpsMsg('Não foi possível obter a localização. O registro pode seguir sem GPS.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const submit = () => {
    const errs: string[] = [];
    if (!d.situation) errs.push('Informe a situação do imóvel.');
    if (d.situation === 'trabalhado') {
      errs.push(...validateInspectionDeposits(DEPOSIT_CATEGORIES.map((c) => ({ category: c, ...d.deposits[c] })), d.tubes));
      const labels = d.tubes.map((t) => t.label.trim().toUpperCase());
      if (labels.some((l) => !l)) errs.push('Todo tubito precisa de identificação.');
      if (new Set(labels).size !== labels.length) errs.push('Há tubitos com a mesma identificação.');
    }
    setErrors(errs);
    if (errs.length) return;
    const payload = {
      id: newRecordId(),
      sample_id: sample.id,
      situation: d.situation,
      inspected_at: d.inspected_at,
      client_created_at: new Date().toISOString(),
      is_vacant_lot: d.is_vacant_lot,
      latitude: d.latitude,
      longitude: d.longitude,
      gps_accuracy: d.gps_accuracy,
      notes: d.notes.trim() || null,
      closed_reason: d.situation === 'fechado' || d.situation === 'recusa' ? d.closed_reason || null : null,
      substitute_property_id: (d.situation === 'fechado' || d.situation === 'recusa') && d.substitute_property_id ? d.substitute_property_id : null,
      deposits: d.situation === 'trabalhado' ? DEPOSIT_CATEGORIES.filter((c) => d.deposits[c].inspected > 0).map((c) => ({ category: c, ...d.deposits[c] })) : [],
      tubes: d.situation === 'trabalhado' ? d.tubes.map((t) => ({ label: t.label.trim().toUpperCase(), category: t.category, stage: t.stage })) : [],
    };
    try {
      enqueueRecord({ id: payload.id, kind: 'liraa_inspection', municipality_id: municipalityId, profile_id: profileId, payload,
        label: `${SITUATION_LABELS[d.situation as InspectionSituation]} · ${sample.block_code ? `Q. ${sample.block_code} · ` : ''}${sample.address || 'imóvel'}` });
      clearDraft(draftKey);
      onQueued();
    } catch (e: any) {
      setErrors([e.message]);
    }
  };

  const SITUATIONS: InspectionSituation[] = ['trabalhado', 'fechado', 'recusa', 'inexistente'];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50" role="dialog" aria-modal="true" aria-label="Registrar inspeção">
      <div className="mx-auto max-w-2xl space-y-4 p-4 pb-28">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{sample.address || 'Imóvel sorteado'}</h2>
            <p className="text-xs text-slate-500">{sample.block_code ? `Quarteirão ${sample.block_code} · ` : ''}{sample.neighborhood} · {survey.type} {survey.cycle_number}/{survey.year}</p>
          </div>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
        <p className="text-[11px] text-slate-500">Rascunho salvo automaticamente neste aparelho.</p>

        <Card padding="compact">
          <SectionTitle>Situação</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {SITUATIONS.map((s) => (
              <button key={s} type="button" onClick={() => setD({ ...d, situation: s })}
                className={`min-h-12 rounded-lg border px-3 text-sm font-semibold ${d.situation === s ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white text-slate-700'}`}
                aria-pressed={d.situation === s}>
                {SITUATION_LABELS[s]}
              </button>
            ))}
          </div>
          {d.situation === 'trabalhado' && (
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-5 w-5" checked={d.is_vacant_lot} onChange={(e) => setD({ ...d, is_vacant_lot: e.target.checked })} /> Terreno baldio (TB)
            </label>
          )}
        </Card>

        {(d.situation === 'fechado' || d.situation === 'recusa') && (
          <Card padding="compact">
            <SectionTitle>Substituição (anterior, depois posterior)</SectionTitle>
            <Field label="Motivo">{(id) => (
              <SelectInput id={id} value={d.closed_reason} onChange={(e) => setD({ ...d, closed_reason: e.target.value })}>
                <option value="">Selecione</option>
                {d.situation === 'fechado' ? <>
                  <option value="sem_morador_no_momento">Sem morador no momento</option>
                  <option value="desocupado">Imóvel desocupado</option>
                  <option value="veraneio">Uso eventual / veraneio</option>
                  <option value="outro">Outro</option>
                </> : <>
                  <option value="morador_recusou">Morador recusou</option>
                  <option value="outro">Outro</option>
                </>}
              </SelectInput>
            )}</Field>
            {!navigator.onLine ? <p className="mt-2 text-xs text-slate-500">Sem conexão: a lista de imóveis vizinhos não está disponível. Registre a situação e faça a substituição ao sincronizar.</p> : (
              <fieldset className="mt-3 space-y-1">
                <legend className="text-xs font-semibold text-slate-700">Imóvel substituto (opcional)</legend>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm">
                  <input type="radio" name="sub" className="h-5 w-5" checked={!d.substitute_property_id} onChange={() => setD({ ...d, substitute_property_id: '' })} /> Sem substituto agora
                </label>
                {neighbors.map((n) => (
                  <label key={n.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm">
                    <input type="radio" name="sub" className="h-5 w-5" checked={d.substitute_property_id === n.id} onChange={() => setD({ ...d, substitute_property_id: n.id })} />
                    <span><strong>{n.position}</strong> · {n.address || 'sem endereço'}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </Card>
        )}

        {d.situation === 'trabalhado' && (
          <Card padding="compact">
            <SectionTitle>Depósitos inspecionados</SectionTitle>
            <ul className="space-y-3">
              {DEPOSIT_CATEGORIES.map((c) => (
                <li key={c} className="rounded-lg border border-slate-200 p-2">
                  <p className="text-sm font-semibold text-slate-800">{DEPOSIT_LABELS[c]}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                    <span className="flex items-center gap-2">Inspecionados <Stepper label={`${c} inspecionados`} value={d.deposits[c].inspected}
                      onChange={(v) => setD({ ...d, deposits: { ...d.deposits, [c]: { inspected: v, positive: Math.min(v, d.deposits[c].positive) } } })} /></span>
                    <span className="flex items-center gap-2">Com larvas/pupas <Stepper label={`${c} com larvas ou pupas`} value={d.deposits[c].positive} max={d.deposits[c].inspected}
                      onChange={(v) => setD({ ...d, deposits: { ...d.deposits, [c]: { ...d.deposits[c], positive: v } } })} /></span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {d.situation === 'trabalhado' && d.tubes.length > 0 && (
          <Card padding="compact">
            <SectionTitle>Tubitos (um por depósito positivo)</SectionTitle>
            <ul className="space-y-2">
              {d.tubes.map((t, i) => (
                <li key={i} className="grid grid-cols-[3rem_1fr_8rem] items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">{t.category}</span>
                  <TextInput value={t.label} aria-label={`Identificação do tubito ${i + 1}`} onChange={(e) => setD({ ...d, tubes: d.tubes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <SelectInput value={t.stage} aria-label={`Fase do tubito ${i + 1}`} onChange={(e) => setD({ ...d, tubes: d.tubes.map((x, j) => (j === i ? { ...x, stage: e.target.value } : x)) })}>
                    <option value="larva">Larva</option><option value="pupa">Pupa</option><option value="larva_pupa">Larva e pupa</option>
                  </SelectInput>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">Escreva a mesma identificação no rótulo do tubito. O resultado depende da análise do laboratório; o registro de campo é suspeita, não confirmação.</p>
          </Card>
        )}

        {d.situation && (
          <Card padding="compact">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" icon={Crosshair} onClick={captureGps}>Registrar GPS</Button>
                {d.latitude !== null && <span className="inline-flex items-center gap-1 text-xs text-slate-600"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{d.latitude.toFixed(5)}, {d.longitude?.toFixed(5)}</span>}
              </div>
              {gpsMsg && <p className="text-xs text-slate-600" role="status">{gpsMsg}</p>}
              <Field label="Observações">{(id) => <TextArea id={id} value={d.notes} maxLength={2000} onChange={(e) => setD({ ...d, notes: e.target.value })} />}</Field>
            </div>
          </Card>
        )}

        {errors.length > 0 && <Notice tone="danger" title="Corrija antes de salvar"><ul className="list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul></Notice>}
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto flex max-w-2xl gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => { clearDraft(draftKey); setD(emptyDraft()); }}>Limpar</Button>
          <Button className="flex-[2]" onClick={submit} disabled={!d.situation}>Salvar inspeção</Button>
        </div>
      </div>
    </div>
  );
};
