import React, { useMemo, useState } from 'react';
import { ClipboardList, Dice5, History, Plus, ShieldCheck, Users } from 'lucide-react';
import { PageHeader, Card } from '../ui';
import {
  Button, DataTable, Dialog, EmptyState, Field, LoadingBlock, Notice, SectionTitle, SelectInput, StatusPill, TextArea, TextInput,
  fmtDate, fmtDateTime, useAsync,
} from '../ui/ModuleKit';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import {
  liraaModuleService, LiraaStratum, LiraaSurvey, RuleSet, STATUS_LABELS, SurveyStatus, SurveyType, SITUATION_LABELS,
} from '../../services/liraa/liraaModuleService';
import { LIA_REFERENCIA_ESTADUAL, LIRAA_MS_2013, MethodologyError, liaStep, planLiraaStratum, requiredModality } from '../../services/liraa/liraaMethodology';
import { SurveyStatusPill } from './SurveyPicker';

const TRANSITIONS: { from: SurveyStatus; to: SurveyStatus; label: string; perm: string; needsReason: boolean; variant?: 'danger' | 'secondary' | 'primary' }[] = [
  { from: 'planejamento', to: 'execucao', label: 'Iniciar execução', perm: 'liraa.planejar', needsReason: false },
  { from: 'execucao', to: 'conferencia', label: 'Enviar para conferência', perm: 'liraa.supervisionar', needsReason: false },
  { from: 'conferencia', to: 'execucao', label: 'Devolver para execução', perm: 'liraa.supervisionar', needsReason: true, variant: 'secondary' },
  { from: 'conferencia', to: 'encerrado', label: 'Encerrar levantamento', perm: 'liraa.encerrar', needsReason: false },
  { from: 'encerrado', to: 'conferencia', label: 'Reabrir (formal)', perm: 'liraa.reabrir', needsReason: true, variant: 'secondary' },
  { from: 'planejamento', to: 'cancelado', label: 'Cancelar', perm: 'liraa.encerrar', needsReason: true, variant: 'danger' },
  { from: 'execucao', to: 'cancelado', label: 'Cancelar', perm: 'liraa.encerrar', needsReason: true, variant: 'danger' },
  { from: 'conferencia', to: 'cancelado', label: 'Cancelar', perm: 'liraa.encerrar', needsReason: true, variant: 'danger' },
];

export const LiraaSurveysView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const { can, session } = useAuth();
  const surveysQ = useAsync(() => liraaModuleService.listSurveys(municipalityId), [municipalityId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const selected = surveysQ.data?.find((s) => s.id === selectedId) || null;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ClipboardList}
        title="Levantamentos LIRAa / LIA"
        subtitle="Planejamento, estratos, sorteio amostral auditável, distribuição e acompanhamento por situação."
        actions={can('liraa.planejar') ? <Button icon={Plus} onClick={() => setCreating(true)}>Novo levantamento</Button> : undefined}
      />
      {surveysQ.loading && <LoadingBlock />}
      {surveysQ.error && <Notice tone="danger">{surveysQ.error}</Notice>}
      {surveysQ.data && (
        surveysQ.data.length === 0 ? (
          <EmptyState title="Nenhum levantamento" description="O levantamento começa no planejamento: modalidade, período, estratos e equipe; depois o sorteio define os imóveis." />
        ) : (
          <DataTable
            rows={surveysQ.data}
            rowKey={(s) => s.id}
            onRowClick={(s) => setSelectedId(s.id)}
            searchPlaceholder="Pesquisar levantamento"
            columns={[
              { key: 'name', header: 'Levantamento', render: (s) => <span className="font-semibold text-slate-900">{s.type} {s.cycle_number}/{s.year} — {s.name}</span>, text: (s) => `${s.type} ${s.name} ${s.year}` },
              { key: 'periodo', header: 'Período', render: (s) => `${fmtDate(s.start_date)} a ${fmtDate(s.end_date)}` },
              { key: 'amostra', header: 'Imóveis sorteados', align: 'right', render: (s) => s.sample_properties.toLocaleString('pt-BR') },
              { key: 'status', header: 'Situação', render: (s) => <SurveyStatusPill status={s.status} />, text: (s) => STATUS_LABELS[s.status] },
            ]}
          />
        )
      )}
      {creating && (
        <SurveyForm
          onClose={() => setCreating(false)}
          onSaved={(s) => {
            setCreating(false);
            surveysQ.reload();
            setSelectedId(s.id);
          }}
          municipalityId={municipalityId}
          profileId={session?.profile.id}
        />
      )}
      {selected && <SurveyDetail survey={selected} onClose={() => setSelectedId(null)} onChanged={surveysQ.reload} />}
    </div>
  );
};

const SurveyForm: React.FC<{ municipalityId: string; profileId?: string; survey?: LiraaSurvey; onClose: () => void; onSaved: (s: LiraaSurvey) => void }> = ({
  municipalityId, profileId, survey, onClose, onSaved,
}) => {
  const year = new Date().getFullYear();
  const [form, setForm] = useState({
    type: (survey?.type || 'LIRAa') as SurveyType,
    name: survey?.name || '',
    year: survey?.year || year,
    cycle_number: survey?.cycle_number || 1,
    start_date: survey?.start_date || '',
    end_date: survey?.end_date || '',
    notes: survey?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = form.name.trim().length >= 3 && form.start_date && form.end_date && form.end_date >= form.start_date;
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (survey) {
        await liraaModuleService.updateSurvey(survey.id, { ...form, notes: form.notes || null });
        onSaved({ ...survey, ...form });
      } else {
        onSaved(await liraaModuleService.createSurvey(municipalityId, { ...form, notes: form.notes || null, coordinator_id: profileId ?? null, created_by: profileId ?? null }));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open title={survey ? 'Editar levantamento' : 'Novo levantamento'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving} disabled={!valid}>Salvar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Modalidade" required hint="Portaria GM/MS 3.129/2016: LIRAa acima de 2.000 imóveis; LIA abaixo de 2.000.">
          {(id) => (
            <SelectInput id={id} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as SurveyType })}>
              <option value="LIRAa">LIRAa (amostragem por quarteirões)</option>
              <option value="LIA">LIA (amostragem por imóveis)</option>
            </SelectInput>
          )}
        </Field>
        <Field label="Nome" required>{(id) => <TextInput id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: 1º levantamento" />}</Field>
        <Field label="Ano" required>{(id) => <TextInput id={id} type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />}</Field>
        <Field label="Nº do levantamento no ano" required>{(id) => <TextInput id={id} type="number" min={1} max={12} value={form.cycle_number} onChange={(e) => setForm({ ...form, cycle_number: Number(e.target.value) })} />}</Field>
        <Field label="Início" required>{(id) => <TextInput id={id} type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />}</Field>
        <Field label="Término" required error={form.end_date && form.start_date && form.end_date < form.start_date ? 'Término antes do início.' : undefined}>
          {(id) => <TextInput id={id} type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />}
        </Field>
        <Field label="Observações" className="sm:col-span-2">{(id) => <TextArea id={id} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}</Field>
      </div>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
    </Dialog>
  );
};

const SurveyDetail: React.FC<{ survey: LiraaSurvey; onClose: () => void; onChanged: () => void }> = ({ survey, onClose, onChanged }) => {
  const municipalityId = useMunicipalityId();
  const { can, session } = useAuth();
  const [tick, setTick] = useState(0);
  const refresh = () => {
    setTick((t) => t + 1);
    onChanged();
  };
  const data = useAsync(async () => {
    const [strata, universe, rules, draws, samples, members, agents, profiles, history] = await Promise.all([
      liraaModuleService.listStrata(survey.id),
      liraaModuleService.universeByNeighborhood(),
      liraaModuleService.listRuleSets(),
      liraaModuleService.listDraws(survey.id),
      liraaModuleService.listSamples(survey.id),
      liraaModuleService.listMembers(survey.id),
      liraaModuleService.listAgents(municipalityId),
      liraaModuleService.listProfiles(municipalityId),
      liraaModuleService.statusHistory(survey.id),
    ]);
    return { strata, universe, rules, draws, samples, members, agents, profiles, history };
  }, [survey.id, tick]);

  const [editing, setEditing] = useState(false);
  const [stratumEdit, setStratumEdit] = useState<Partial<LiraaStratum> | null>(null);
  const [transition, setTransition] = useState<(typeof TRANSITIONS)[number] | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [busyMsg, setBusyMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const planning = survey.status === 'planejamento';

  const rule: RuleSet | undefined = data.data?.rules.find((r) => r.kind === (survey.type === 'LIA' ? 'amostragem_lia' : 'amostragem_liraa'));
  const totalEligible = (data.data?.universe || []).reduce((a, u) => a + u.eligible_properties, 0);
  const required = requiredModality(totalEligible);

  return (
    <Dialog open wide title={`${survey.type} ${survey.cycle_number}/${survey.year} — ${survey.name}`} onClose={onClose}>
      {data.loading && <LoadingBlock />}
      {data.error && <Notice tone="danger">{data.error}</Notice>}
      {data.data && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <SurveyStatusPill status={survey.status} />
            <span>{fmtDate(survey.start_date)} a {fmtDate(survey.end_date)}</span>
            {planning && can('liraa.planejar') && <Button variant="ghost" onClick={() => setEditing(true)}>Editar dados</Button>}
          </div>
          {busyMsg && <Notice tone={busyMsg.tone} onClose={() => setBusyMsg(null)}>{busyMsg.text}</Notice>}
          {survey.cancel_reason && <Notice tone="neutral" title="Motivo do cancelamento">{survey.cancel_reason}</Notice>}

          {/* Regras e modalidade */}
          <section>
            <SectionTitle>Metodologia</SectionTitle>
            {rule ? (
              <div className="space-y-2 text-sm">
                <p className="text-slate-700"><strong>{rule.code} v{rule.version}</strong> · {rule.source}</p>
                {rule.validation_notes && <p className="text-xs text-slate-500">{rule.validation_notes}</p>}
                {rule.validation_status === 'pendente_validacao' && (
                  survey.rules_confirmed_at ? (
                    <Notice tone="success" title={`Confirmação técnica registrada em ${fmtDateTime(survey.rules_confirmed_at)}`}>{survey.rules_confirmation_note}</Notice>
                  ) : (
                    <ConfirmRules surveyId={survey.id} canConfirm={planning && can('liraa.planejar')} onDone={refresh} />
                  )
                )}
              </div>
            ) : <Notice tone="warning">Regras metodológicas não encontradas.</Notice>}
            <div className="mt-2">
              {required === 'indefinida' ? (
                <Notice tone="warning">O município tem exatamente 2.000 imóveis elegíveis: a Portaria define LIRAa acima e LIA abaixo desse número. Validar a modalidade com a SES.</Notice>
              ) : required !== survey.type ? (
                <Notice tone="warning">O município tem {totalEligible.toLocaleString('pt-BR')} imóveis elegíveis (sem pontos estratégicos): a modalidade exigida é <strong>{required}</strong>. O sorteio será recusado com {survey.type}.</Notice>
              ) : (
                <p className="text-xs text-slate-600">{totalEligible.toLocaleString('pt-BR')} imóveis elegíveis no município (pontos estratégicos excluídos) — modalidade {required} adequada.</p>
              )}
            </div>
          </section>

          {/* Estratos */}
          <section>
            <SectionTitle actions={planning && can('liraa.planejar') && survey.type === 'LIRAa'
              ? <Button variant="secondary" icon={Plus} onClick={() => setStratumEdit({ name: '', stratum_number: (data.data!.strata.length || 0) + 1, neighborhood_ids: [] })}>Estrato</Button> : undefined}>
              Estratos
            </SectionTitle>
            {survey.type === 'LIA' ? (
              <LiaPreview totalEligible={totalEligible} />
            ) : data.data.strata.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum estrato. Agrupe bairros com características semelhantes (8.100 a 12.000 imóveis; ou 2.000 a 8.100 com 50% dos imóveis do quarteirão).</p>
            ) : (
              <ul className="space-y-2">
                {data.data.strata.map((s) => {
                  const uni = data.data!.universe.filter((u) => s.neighborhood_ids.includes(u.neighborhood_id));
                  const N = uni.reduce((a, u) => a + u.eligible_properties - u.without_block, 0);
                  const A = uni.reduce((a, u) => a + u.blocks, 0);
                  const noBlock = uni.reduce((a, u) => a + u.without_block, 0);
                  let plan: string;
                  try {
                    const p = planLiraaStratum(N, A, (rule?.params as any) || LIRAA_MS_2013);
                    plan = `N ${p.N} · A ${p.A} · n ${p.n} · 1 a cada ${p.step} · Q ${p.Q} · IA ${p.IA.toFixed(2)}`;
                  } catch (e) {
                    plan = e instanceof MethodologyError ? `⚠ ${e.message}` : String(e);
                  }
                  return (
                    <li key={s.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-slate-900">{s.stratum_number}. {s.name}</strong>
                        {planning && can('liraa.planejar') && (
                          <span className="flex gap-1">
                            <Button variant="ghost" onClick={() => setStratumEdit(s)}>Editar</Button>
                            <Button variant="ghost" onClick={async () => {
                              try { await liraaModuleService.deleteStratum(s.id); refresh(); } catch (e: any) { setBusyMsg({ tone: 'danger', text: e.message }); }
                            }}>Excluir</Button>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">{uni.map((u) => u.neighborhood_name).join(', ') || 'Sem bairros'}</p>
                      <p className="mt-1 text-xs font-medium text-slate-800">Prévia do plano: {plan}</p>
                      {noBlock > 0 && <p className="text-xs text-amber-700">{noBlock} imóvel(is) sem quarteirão no RG ficam fora do sorteio por conglomerado.</p>}
                      {s.sample_size > 0 && <p className="text-xs text-slate-500">Sorteio vigente: {s.sample_size} imóveis em {s.total_blocks} quarteirões do universo.</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Equipe */}
          <Members survey={survey} members={data.data.members} profiles={data.data.profiles} editable={can('liraa.planejar') && survey.status !== 'encerrado' && survey.status !== 'cancelado'} onChanged={refresh} />

          {/* Sorteio */}
          <section>
            <SectionTitle actions={planning && can('liraa.planejar') ? <Button icon={Dice5} onClick={() => setDrawOpen(true)}>{data.data.draws.length ? 'Refazer sorteio' : 'Executar sorteio'}</Button> : undefined}>
              Sorteio amostral
            </SectionTitle>
            {data.data.draws.length === 0 ? <p className="text-sm text-slate-500">Sorteio ainda não executado.</p> : (
              <DataTable
                rows={data.data.draws}
                rowKey={(d) => d.id}
                searchable={false}
                pageSize={10}
                columns={[
                  { key: 'estrato', header: 'Estrato', render: (d) => data.data!.strata.find((s) => s.id === d.stratum_id)?.name || '—' },
                  { key: 'params', header: 'Parâmetros', render: (d) => <span className="font-mono text-[11px]">{Object.entries(d.parameters).filter(([k]) => ['N', 'A', 'n', 'Q', 'step', 'IA', 'IC', 'start'].includes(k)).map(([k, v]) => `${k}=${typeof v === 'number' ? +Number(v).toFixed(4) : v}`).join(' ')}</span> },
                  { key: 'sel', header: 'Sorteados', align: 'right', render: (d) => `${d.selected_properties} imóveis${d.selected_blocks ? ` / ${d.selected_blocks} quart.` : ''}` },
                  { key: 'seed', header: 'Semente', render: (d) => <span className="font-mono text-[11px]">{d.seed}</span> },
                  { key: 'st', header: 'Situação', render: (d) => <StatusPill tone={d.status === 'vigente' ? 'success' : 'neutral'}>{d.status === 'vigente' ? 'Vigente' : 'Substituído'}</StatusPill> },
                  { key: 'when', header: 'Executado', render: (d) => `${fmtDateTime(d.executed_at)} · ${d.executed_by_name || ''}` },
                ]}
              />
            )}
          </section>

          {/* Distribuição */}
          {data.data.samples.length > 0 && (
            <Distribution survey={survey} samples={data.data.samples} agents={data.data.agents} editable={(can('liraa.planejar') || can('liraa.supervisionar')) && ['planejamento', 'execucao', 'conferencia'].includes(survey.status)} onChanged={refresh} />
          )}

          {/* Situação */}
          <section>
            <SectionTitle>Situação do levantamento</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {TRANSITIONS.filter((t) => t.from === survey.status && can(t.perm)).map((t) => (
                <Button key={`${t.from}-${t.to}`} variant={t.variant || 'primary'} onClick={() => setTransition(t)}>{t.label}</Button>
              ))}
              {TRANSITIONS.every((t) => t.from !== survey.status || !can(t.perm)) && <p className="text-sm text-slate-500">Nenhuma ação disponível para o seu perfil.</p>}
            </div>
            {data.data.history.length > 0 && (
              <ol className="mt-3 space-y-1.5 text-xs text-slate-600">
                {data.data.history.map((h, i) => (
                  <li key={i} className="flex gap-2"><History className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{fmtDateTime(h.created_at)} · {h.actor}: {h.from_status ? STATUS_LABELS[h.from_status as SurveyStatus] : '—'} → {STATUS_LABELS[h.to_status as SurveyStatus]}{h.justification ? ` — "${h.justification}"` : ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {editing && <SurveyForm municipalityId={municipalityId} survey={survey} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh(); }} />}
      {stratumEdit && data.data && (
        <StratumForm
          stratum={stratumEdit}
          universe={data.data.universe}
          usedElsewhere={new Set(data.data.strata.filter((s) => s.id !== stratumEdit.id).flatMap((s) => s.neighborhood_ids))}
          onClose={() => setStratumEdit(null)}
          onSave={async (s) => {
            await liraaModuleService.saveStratum(municipalityId, survey.id, s as any);
            setStratumEdit(null);
            refresh();
          }}
        />
      )}
      {drawOpen && <DrawDialog survey={survey} hasPrevious={!!data.data?.draws.length} onClose={() => setDrawOpen(false)} onDone={(msg) => { setDrawOpen(false); setBusyMsg({ tone: 'success', text: msg }); refresh(); }} />}
      {transition && (
        <TransitionDialog survey={survey} transition={transition} onClose={() => setTransition(null)}
          onDone={() => { setTransition(null); refresh(); }} actor={session?.profile.fullName} />
      )}
    </Dialog>
  );
};

const LiaPreview: React.FC<{ totalEligible: number }> = ({ totalEligible }) => {
  let text: string;
  try {
    const step = liaStep(totalEligible, LIA_REFERENCIA_ESTADUAL);
    text = step === 1 ? 'todos os imóveis elegíveis' : `1 imóvel a cada ${step} (≈ ${Math.ceil(totalEligible / step)} imóveis)`;
  } catch (e: any) {
    text = e.message;
  }
  return (
    <div className="space-y-1 text-sm">
      <p className="text-slate-700">LIA: estrato único com todos os imóveis elegíveis do município ({totalEligible.toLocaleString('pt-BR')}). Prévia: {text}.</p>
      <p className="text-xs text-amber-700">Faixas do LIA pendentes de validação técnica (referência estadual). O sorteio exige a confirmação da coordenação.</p>
    </div>
  );
};

const ConfirmRules: React.FC<{ surveyId: string; canConfirm: boolean; onDone: () => void }> = ({ surveyId, canConfirm, onDone }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Notice tone="warning" title="Regras pendentes de validação técnica">
      <p>Antes do sorteio, a coordenação deve registrar a referência técnica que valida estas regras (ex.: nota técnica ou orientação da SES-GO, com número e data).</p>
      {canConfirm && (
        <div className="mt-2 space-y-2">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Referência técnica validada (mínimo 20 caracteres)" aria-label="Referência técnica" />
          {error && <p className="text-xs text-rose-700">{error}</p>}
          <Button icon={ShieldCheck} loading={busy} disabled={note.trim().length < 20} onClick={async () => {
            setBusy(true); setError(null);
            try { await liraaModuleService.confirmRules(surveyId, note); onDone(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
          }}>Registrar confirmação</Button>
        </div>
      )}
    </Notice>
  );
};

const StratumForm: React.FC<{
  stratum: Partial<LiraaStratum>;
  universe: { neighborhood_id: string; neighborhood_name: string; eligible_properties: number; blocks: number; without_block: number }[];
  usedElsewhere: Set<string>;
  onClose: () => void;
  onSave: (s: Partial<LiraaStratum>) => Promise<void>;
}> = ({ stratum, universe, usedElsewhere, onClose, onSave }) => {
  const [form, setForm] = useState({ ...stratum, neighborhood_ids: stratum.neighborhood_ids || [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = universe.filter((u) => form.neighborhood_ids!.includes(u.neighborhood_id));
  const N = chosen.reduce((a, u) => a + u.eligible_properties - u.without_block, 0);
  const A = chosen.reduce((a, u) => a + u.blocks, 0);
  let preview = '';
  try {
    const p = planLiraaStratum(N, A);
    preview = `n ${p.n} · Q ${p.Q} · 1 a cada ${p.step}`;
  } catch (e: any) {
    preview = e.message;
  }
  return (
    <Dialog open title={stratum.id ? 'Editar estrato' : 'Novo estrato'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={!form.name?.trim() || !form.neighborhood_ids!.length}
        onClick={async () => { setBusy(true); setError(null); try { await onSave(form); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}>Salvar</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Field label="Nome do estrato" required>{(id) => <TextInput id={id} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
          <Field label="Número" required>{(id) => <TextInput id={id} type="number" min={1} value={form.stratum_number || 1} onChange={(e) => setForm({ ...form, stratum_number: Number(e.target.value) })} />}</Field>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-xs font-semibold text-slate-700">Bairros (imóveis elegíveis com quarteirão / quarteirões)</legend>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {universe.map((u) => (
              <label key={u.neighborhood_id} className={`flex items-center gap-2 rounded px-1 py-1.5 text-sm ${usedElsewhere.has(u.neighborhood_id) ? 'text-slate-400' : 'text-slate-800'}`}>
                <input type="checkbox" className="h-4 w-4" disabled={usedElsewhere.has(u.neighborhood_id)} checked={form.neighborhood_ids!.includes(u.neighborhood_id)}
                  onChange={(e) => setForm({ ...form, neighborhood_ids: e.target.checked ? [...form.neighborhood_ids!, u.neighborhood_id] : form.neighborhood_ids!.filter((x) => x !== u.neighborhood_id) })} />
                <span className="flex-1">{u.neighborhood_name}{usedElsewhere.has(u.neighborhood_id) ? ' (em outro estrato)' : ''}</span>
                <span className="tabular-nums text-xs text-slate-500">{(u.eligible_properties - u.without_block).toLocaleString('pt-BR')} / {u.blocks}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-sm text-slate-700">Total: <strong>{N.toLocaleString('pt-BR')}</strong> imóveis em <strong>{A}</strong> quarteirões · {preview}</p>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Dialog>
  );
};

const DrawDialog: React.FC<{ survey: LiraaSurvey; hasPrevious: boolean; onClose: () => void; onDone: (msg: string) => void }> = ({ survey, hasPrevious, onClose, onDone }) => {
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open title="Sorteio amostral" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button icon={Dice5} loading={busy} onClick={async () => {
        setBusy(true); setError(null);
        try {
          const r = await liraaModuleService.executeDraw(survey.id, seed);
          const total = r.strata.reduce((a: number, s: any) => a + s.selected_properties, 0);
          onDone(`Sorteio executado com a semente ${r.seed}: ${total} imóveis selecionados.`);
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
      }}>Executar</Button></>}>
      <div className="space-y-3 text-sm text-slate-700">
        <p>O sorteio é feito no servidor, com regras versionadas, e fica registrado com a semente, os parâmetros e o hash do universo de imóveis. A mesma semente sobre o mesmo cadastro reproduz a seleção.</p>
        {hasPrevious && <Notice tone="warning">O sorteio anterior será mantido no histórico como "substituído" e os imóveis dele deixam de valer.</Notice>}
        <Field label="Semente (opcional)" hint="Deixe em branco para gerar uma semente aleatória. Informe uma semente quando o sorteio for público (ex.: número anunciado em reunião).">
          {(id) => <TextInput id={id} value={seed} onChange={(e) => setSeed(e.target.value)} maxLength={64} />}
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Dialog>
  );
};

const Members: React.FC<{ survey: LiraaSurvey; members: { profile_id: string; member_role: string; full_name: string }[]; profiles: { id: string; full_name: string }[]; editable: boolean; onChanged: () => void }> = ({
  survey, members, profiles, editable, onChanged,
}) => {
  const municipalityId = useMunicipalityId();
  const [profileId, setProfileId] = useState('');
  const [role, setRole] = useState<'supervisor' | 'agente' | 'laboratorio'>('supervisor');
  const [error, setError] = useState<string | null>(null);
  const ROLE: Record<string, string> = { supervisor: 'Supervisor', agente: 'Agente', laboratorio: 'Laboratório' };
  return (
    <section>
      <SectionTitle><span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-slate-500" aria-hidden="true" /> Responsáveis e equipe</span></SectionTitle>
      {members.length === 0 ? <p className="text-sm text-slate-500">Nenhum responsável definido.</p> : (
        <ul className="flex flex-wrap gap-2">
          {members.map((m) => (
            <li key={`${m.profile_id}-${m.member_role}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs">
              <strong>{ROLE[m.member_role]}:</strong> {m.full_name}
              {editable && <button type="button" className="ml-1 text-slate-500 hover:text-rose-700" aria-label={`Remover ${m.full_name}`}
                onClick={async () => { try { await liraaModuleService.removeMember(survey.id, m.profile_id, m.member_role); onChanged(); } catch (e: any) { setError(e.message); } }}>×</button>}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <SelectInput value={role} onChange={(e) => setRole(e.target.value as any)} className="sm:w-40" aria-label="Função">
            <option value="supervisor">Supervisor</option><option value="agente">Agente</option><option value="laboratorio">Laboratório</option>
          </SelectInput>
          <SelectInput value={profileId} onChange={(e) => setProfileId(e.target.value)} className="sm:w-64" aria-label="Servidor">
            <option value="">Selecione o servidor</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </SelectInput>
          <Button variant="secondary" disabled={!profileId} onClick={async () => {
            try { await liraaModuleService.addMember(municipalityId, survey.id, profileId, role); setProfileId(''); onChanged(); } catch (e: any) { setError(e.message); }
          }}>Adicionar</Button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
    </section>
  );
};

const Distribution: React.FC<{ survey: LiraaSurvey; samples: any[]; agents: { id: string; name: string }[]; editable: boolean; onChanged: () => void }> = ({
  survey, samples, agents, editable, onChanged,
}) => {
  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of samples) {
      const key = survey.type === 'LIRAa' ? `Quarteirão ${s.block_code || '—'}` : s.neighborhood || 'Sem bairro';
      m.set(key, [...(m.get(key) || []), s]);
    }
    return Array.from(m.entries()).map(([label, rows]) => ({
      label,
      rows,
      done: rows.filter((r) => r.status !== 'selecionado').length,
      agentNames: Array.from(new Set(rows.map((r) => r.agent_name || 'Não distribuído'))).join(', '),
    }));
  }, [samples, survey.type]);
  const [agentFor, setAgentFor] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  return (
    <section>
      <SectionTitle>Distribuição aos agentes</SectionTitle>
      <p className="mb-2 text-xs text-slate-500">Os imóveis vêm do sorteio; o agente não escolhe imóveis. Situações: {Object.entries(SITUATION_LABELS).filter(([k]) => k !== 'cancelado').map(([, v]) => v).join(', ')}.</p>
      <DataTable
        rows={groups}
        rowKey={(g) => g.label}
        pageSize={15}
        searchPlaceholder={survey.type === 'LIRAa' ? 'Pesquisar quarteirão' : 'Pesquisar bairro'}
        columns={[
          { key: 'label', header: survey.type === 'LIRAa' ? 'Quarteirão' : 'Bairro' },
          { key: 'n', header: 'Imóveis', align: 'right', render: (g) => `${g.done}/${g.rows.length}` },
          { key: 'ag', header: 'Agente(s)', render: (g) => g.agentNames },
          ...(editable ? [{
            key: 'assign', header: 'Distribuir', render: (g: any) => (
              <span className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                <SelectInput value={agentFor[g.label] || ''} onChange={(e) => setAgentFor({ ...agentFor, [g.label]: e.target.value })} className="sm:w-44" aria-label={`Agente para ${g.label}`}>
                  <option value="">Agente...</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </SelectInput>
                <Button variant="secondary" disabled={!agentFor[g.label]} onClick={async () => {
                  setError(null);
                  try {
                    await liraaModuleService.assignSamples(survey.id, g.rows.filter((r: any) => r.status === 'selecionado').map((r: any) => r.id), agentFor[g.label]);
                    onChanged();
                  } catch (e: any) { setError(e.message); }
                }}>Aplicar</Button>
              </span>
            ),
          }] : []),
        ]}
      />
      {error && <Notice tone="danger">{error}</Notice>}
    </section>
  );
};

const TransitionDialog: React.FC<{ survey: LiraaSurvey; transition: (typeof TRANSITIONS)[number]; actor?: string; onClose: () => void; onDone: () => void }> = ({
  survey, transition, onClose, onDone,
}) => {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reopening = transition.from === 'encerrado';
  return (
    <Dialog open title={transition.label} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Voltar</Button><Button variant={transition.variant === 'danger' ? 'danger' : 'primary'} loading={busy}
        disabled={transition.needsReason && reason.trim().length < 15}
        onClick={async () => { setBusy(true); setError(null); try { await liraaModuleService.changeStatus(survey.id, transition.to, reason); onDone(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}>Confirmar</Button></>}>
      <div className="space-y-3 text-sm text-slate-700">
        <p>{STATUS_LABELS[transition.from]} → <strong>{STATUS_LABELS[transition.to]}</strong></p>
        {transition.to === 'encerrado' && <Notice tone="info">Depois de encerrado, o levantamento só muda por reabertura formal, com justificativa registrada na auditoria. Tubitos sem resultado impedem o encerramento.</Notice>}
        {reopening && <Notice tone="warning">A reabertura fica registrada no histórico e na auditoria do sistema.</Notice>}
        {transition.needsReason && (
          <Field label="Justificativa" required hint="Mínimo de 15 caracteres.">{(id) => <TextArea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Dialog>
  );
};
