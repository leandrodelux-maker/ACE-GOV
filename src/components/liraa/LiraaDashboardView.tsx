import React, { useMemo, useState } from 'react';
import { Bug, PieChart } from 'lucide-react';
import { PageHeader, Card } from '../ui';
import { BarList, EmptyState, LoadingBlock, Metric, Notice, SectionTitle, SelectInput, fmtPct, useAsync } from '../ui/ModuleKit';
import { PointsMap, MapPoint } from '../ui/PointsMap';
import { useMunicipalityId } from '../../contexts/AuthContext';
import { liraaModuleService, LiraaSurvey } from '../../services/liraa/liraaModuleService';
import { DEPOSIT_CATEGORIES, RISK_LABELS } from '../../services/liraa/liraaMethodology';
import { SurveyPicker, SurveyStatusPill, useSelectedSurvey } from './SurveyPicker';
import { PROVISIONAL_NOTE, RISK_NOTE, splitUnits, UnitIndicators } from './liraaReports';

const MAP_COLORS: Record<string, string> = {
  'Positivo (laboratório)': '#c0392b',
  'Aguardando laboratório': '#d97706',
  'Trabalhado, sem foco': '#147d64',
  'Fechado/recusa/inexistente': '#64748b',
  'A visitar': '#2a78d6',
};

export const LiraaDashboardView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const [year, setYear] = useState<string>('todos');
  const [unitId, setUnitId] = useState<string>('municipio');
  const surveysQ = useAsync(() => liraaModuleService.listSurveys(municipalityId), [municipalityId]);
  const filteredSurveys = useMemo(() => (surveysQ.data || []).filter((s) => year === 'todos' || String(s.year) === year), [surveysQ.data, year]);
  const [surveyId, setSurveyId] = useSelectedSurvey(filteredSurveys.length ? filteredSurveys : null, (s) => s.status === 'execucao' || s.status === 'conferencia');
  const survey = filteredSurveys.find((s) => s.id === surveyId) || null;

  const detailQ = useAsync(async () => {
    if (!survey) return null;
    const [counts, samples, inspections, tubes] = await Promise.all([
      liraaModuleService.counts(survey.id),
      liraaModuleService.listSamples(survey.id),
      liraaModuleService.listInspections(survey.id),
      liraaModuleService.listTubes(survey.id),
    ]);
    return { counts, samples, inspections, tubes };
  }, [survey?.id]);

  // Comparação histórica: últimos levantamentos encerrados ou em conferência
  const historyQ = useAsync(async () => {
    const list = (surveysQ.data || []).filter((s) => s.status !== 'cancelado' && s.status !== 'planejamento').slice(0, 8);
    const rows = await Promise.all(list.map(async (s: LiraaSurvey) => ({ s, m: splitUnits(await liraaModuleService.counts(s.id).catch(() => null)).municipality })));
    return rows.reverse();
  }, [surveysQ.data]);

  const units = useMemo(() => splitUnits(detailQ.data?.counts || null), [detailQ.data]);
  const focus: UnitIndicators | null = useMemo(() => {
    if (unitId === 'municipio') return units.municipality;
    return [...units.strata, ...units.neighborhoods].find((u) => u.id === unitId) || units.municipality;
  }, [unitId, units]);

  const mapData = useMemo(() => {
    const d = detailQ.data;
    if (!d) return { points: [] as MapPoint[], missing: 0 };
    const inspBySample = new Map(d.inspections.map((i: any) => [i.sample_id, i]));
    const tubesByInsp = new Map<string, string[]>();
    d.tubes.forEach((t) => tubesByInsp.set(t.liraa_inspection_id, [...(tubesByInsp.get(t.liraa_inspection_id) || []), t.lab_result || t.status]));
    let missing = 0;
    const points: MapPoint[] = [];
    for (const s of d.samples) {
      if (s.latitude == null || s.longitude == null) {
        missing++;
        continue;
      }
      const insp: any = inspBySample.get(s.id);
      let category = 'A visitar';
      if (insp && insp.situation !== 'trabalhado') category = 'Fechado/recusa/inexistente';
      else if (insp) {
        const results = tubesByInsp.get(insp.id) || [];
        if (results.some((r) => r === 'aedes_aegypti' || r === 'aegypti_e_albopictus')) category = 'Positivo (laboratório)';
        else if (results.some((r) => r === 'coletada' || r === 'recebida')) category = 'Aguardando laboratório';
        else category = 'Trabalhado, sem foco';
      }
      points.push({ id: s.id, lat: Number(s.latitude), lng: Number(s.longitude), category, label: `Quarteirão ${s.block_code || '—'} · ${s.neighborhood || ''}` });
    }
    return { points, missing };
  }, [detailQ.data]);

  const years = useMemo(() => Array.from(new Set((surveysQ.data || []).map((s) => String(s.year)))).sort().reverse(), [surveysQ.data]);

  if (surveysQ.loading) return <LoadingBlock />;
  if (surveysQ.error) return <Notice tone="danger" title="Não foi possível carregar os levantamentos">{surveysQ.error}</Notice>;

  return (
    <div className="space-y-4">
      <PageHeader icon={PieChart} title="LIRAa / LIA — Painel" subtitle="Índices de infestação do Aedes aegypti por levantamento, estrato e localidade (dados do banco)." />
      {!surveysQ.data?.length ? (
        <EmptyState title="Nenhum levantamento cadastrado" description="Cadastre o primeiro levantamento na aba Levantamentos." />
      ) : (
        <>
          <Card padding="compact">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-700">Ano</span>
                <SelectInput value={year} onChange={(e) => setYear(e.target.value)} className="sm:w-32">
                  <option value="todos">Todos</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </SelectInput>
              </label>
              {filteredSurveys.length > 0 && <SurveyPicker surveys={filteredSurveys} value={surveyId} onChange={setSurveyId} />}
              <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
                <span className="text-xs font-semibold text-slate-700">Recorte territorial</span>
                <SelectInput value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  <option value="municipio">Município (consolidado)</option>
                  {units.strata.length > 0 && <optgroup label="Estratos">{units.strata.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>}
                  {units.neighborhoods.length > 0 && <optgroup label="Localidades">{units.neighborhoods.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>}
                </SelectInput>
              </label>
              {survey && <SurveyStatusPill status={survey.status} />}
            </div>
          </Card>

          {detailQ.loading && <LoadingBlock />}
          {detailQ.error && <Notice tone="danger">{detailQ.error}</Notice>}
          {survey && focus && !detailQ.loading && (
            <>
              {focus.provisional && <Notice tone="warning" title="Índices provisórios">{PROVISIONAL_NOTE} Tubitos sem resultado: {focus.tubesPendingLab}.</Notice>}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Imóveis programados" value={focus.programmed.toLocaleString('pt-BR')} caption={`${focus.substitutes} substituto(s)`} />
                <Metric label="Imóveis pesquisados" value={focus.worked.toLocaleString('pt-BR')} caption={`Cumprimento da amostra: ${fmtPct(focus.completion)}`} />
                <Metric label="Pendentes" value={focus.pending.toLocaleString('pt-BR')} caption={`${focus.closed} fechado(s) · ${focus.refused} recusa(s) · ${focus.nonexistent} inexistente(s)`} tone={focus.pending > 0 ? 'warning' : undefined} />
                <Metric label="Imóveis positivos (lab.)" value={focus.positiveProperties.toLocaleString('pt-BR')} caption={`Suspeitos em campo: ${focus.fieldPositive}`} />
                <Metric label="IIP" value={fmtPct(focus.iip)} caption={focus.risk ? `Classificação: ${RISK_LABELS[focus.risk]}` : 'Sem imóveis pesquisados'}
                  tone={focus.risk === 'risco' ? 'danger' : focus.risk === 'alerta' ? 'warning' : focus.risk === 'satisfatorio' ? 'success' : undefined} />
                <Metric label="IB" value={focus.ib === null ? 'Indisponível' : focus.ib.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} caption={`${focus.positiveRecipients} recipiente(s) positivo(s)`} />
                <Metric label="Tubitos" value={focus.tubesTotal.toLocaleString('pt-BR')} caption={`${focus.tubesPendingLab} sem resultado laboratorial`} tone={focus.tubesPendingLab > 0 ? 'warning' : undefined} />
                <Metric label="Ae. albopictus (imóveis)" value={focus.positiveAlbopictus.toLocaleString('pt-BR')} caption="Não entra no IIP/IB de Ae. aegypti" />
              </div>
              <p className="text-[11px] text-slate-500">{RISK_NOTE}</p>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <SectionTitle>IIP por estrato</SectionTitle>
                  <BarList ariaLabel="IIP por estrato" data={units.strata.map((u) => ({ label: u.name, value: u.iip ?? 0, display: u.iip === null ? 'sem dados' : fmtPct(u.iip) }))} emptyText="Sem imóveis pesquisados." />
                </Card>
                <Card>
                  <SectionTitle>IIP por localidade</SectionTitle>
                  <BarList ariaLabel="IIP por localidade" data={units.neighborhoods.filter((u) => u.worked > 0).sort((a, b) => (b.iip ?? 0) - (a.iip ?? 0)).slice(0, 12)
                    .map((u) => ({ label: u.name, value: u.iip ?? 0, display: fmtPct(u.iip), detail: `${u.name}: IIP ${fmtPct(u.iip)}, ${u.worked} pesquisados` }))} emptyText="Sem imóveis pesquisados." />
                </Card>
                <Card>
                  <SectionTitle>Recipientes positivos por tipo (ITR)</SectionTitle>
                  <BarList ariaLabel="Índice por tipo de recipiente" data={DEPOSIT_CATEGORIES.filter((c) => focus.itr[c] !== undefined)
                    .map((c) => ({ label: c, value: focus.itr[c], display: `${fmtPct(focus.itr[c])} (${focus.positiveByType[c] || 0})` }))} emptyText="Nenhum recipiente positivo confirmado." />
                </Card>
                <Card>
                  <SectionTitle>Execução por agente (imóveis pesquisados)</SectionTitle>
                  <BarList ariaLabel="Imóveis pesquisados por agente" data={(detailQ.data?.counts.agents || []).map((a) => ({ label: a.name || 'Sem agente vinculado', value: a.worked,
                    detail: `${a.name}: ${a.worked} trabalhados, ${a.closed} fechados, ${a.refused} recusas em ${a.days} dia(s)` }))} emptyText="Nenhuma inspeção registrada." />
                </Card>
              </div>

              <Card>
                <SectionTitle>Mapa da amostra</SectionTitle>
                <PointsMap points={mapData.points} colors={MAP_COLORS} withoutCoordinates={mapData.missing} ariaLabel="Mapa dos imóveis da amostra" />
              </Card>
            </>
          )}

          <Card>
            <SectionTitle>
              <span className="inline-flex items-center gap-2"><Bug className="h-4 w-4 text-slate-500" aria-hidden="true" /> Comparação entre levantamentos (IIP municipal)</span>
            </SectionTitle>
            {historyQ.loading ? <LoadingBlock /> : (
              <BarList ariaLabel="IIP municipal por levantamento" data={(historyQ.data || []).filter((h) => h.m && h.m.worked > 0)
                .map((h) => ({ label: `${h.s.type} ${h.s.cycle_number}/${h.s.year}`, value: h.m!.iip ?? 0, display: `${fmtPct(h.m!.iip)}${h.m!.provisional ? ' (provisório)' : ''}` }))}
                emptyText="Ainda não há levantamentos com imóveis pesquisados para comparar." />
            )}
          </Card>
        </>
      )}
    </div>
  );
};
