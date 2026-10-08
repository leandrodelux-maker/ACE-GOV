import React, { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { PageHeader, Card } from '../ui';
import { DataTable, EmptyState, ExportMenu, LoadingBlock, Notice, SelectInput, useAsync } from '../ui/ModuleKit';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { liraaModuleService } from '../../services/liraa/liraaModuleService';
import { SurveyPicker, useSelectedSurvey } from './SurveyPicker';
import { buildLiraaReport, LiraaReportKind, REPORT_LABELS, splitUnits } from './liraaReports';
import { MODEL_DISCLAIMER, ReportDocument } from '../../services/reportExport';

/** Dados que cada relatório precisa (carrega só o necessário). */
const NEEDS: Record<LiraaReportKind, ('counts' | 'strata' | 'draws' | 'samples' | 'blocks' | 'inspections' | 'tubes' | 'history')[]> = {
  plano_amostral: ['strata', 'draws'],
  sorteados: ['strata', 'samples', 'blocks'],
  boletim: ['inspections', 'tubes'],
  consolidado_parcial: ['counts'],
  consolidado_estrato: ['counts'],
  resultado_municipal: ['counts'],
  indicadores: ['counts'],
  criadouros: ['counts'],
  produtividade: ['counts'],
  historico: ['history'],
};

export const LiraaReportsView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const { municipality, session, can } = useAuth();
  const surveysQ = useAsync(() => liraaModuleService.listSurveys(municipalityId), [municipalityId]);
  const [surveyId, setSurveyId] = useSelectedSurvey(surveysQ.data?.length ? surveysQ.data : null);
  const survey = surveysQ.data?.find((s) => s.id === surveyId) || null;
  const [kind, setKind] = useState<LiraaReportKind>('resultado_municipal');

  const docQ = useAsync(async (): Promise<ReportDocument | null> => {
    if (!survey) return null;
    const need = new Set(NEEDS[kind]);
    const [counts, strata, draws, samples, blocks, inspections, tubes] = await Promise.all([
      need.has('counts') ? liraaModuleService.counts(survey.id) : null,
      need.has('strata') ? liraaModuleService.listStrata(survey.id) : undefined,
      need.has('draws') ? liraaModuleService.listDraws(survey.id) : undefined,
      need.has('samples') ? liraaModuleService.listSamples(survey.id) : undefined,
      need.has('blocks') ? liraaModuleService.listSelectedBlocks(survey.id) : undefined,
      need.has('inspections') ? liraaModuleService.listInspections(survey.id) : undefined,
      need.has('tubes') ? liraaModuleService.listTubes(survey.id) : undefined,
    ]);
    let history;
    if (need.has('history')) {
      const list = (surveysQ.data || []).filter((s) => s.status !== 'cancelado');
      history = await Promise.all(list.map(async (s) => ({ survey: s, municipality: splitUnits(await liraaModuleService.counts(s.id).catch(() => null)).municipality })));
    }
    return buildLiraaReport(kind, {
      survey,
      municipalityLabel: municipality ? `${municipality.name}/${municipality.state}` : '',
      generatedBy: session?.profile.fullName,
      counts, strata, draws, samples, blocks, inspections, tubes, history,
    });
  }, [survey?.id, kind]);

  const preview = docQ.data?.tables[docQ.data.tables.length - 1];
  const columns = useMemo(() => (preview?.columns || []).map((c) => ({
    key: c.key,
    header: c.label,
    align: c.type === 'number' || c.type === 'percent' ? ('right' as const) : undefined,
    render: (r: Record<string, unknown>) => {
      const v = r[c.key];
      if (v === null || v === undefined || v === '') return '—';
      if (c.type === 'percent' && typeof v === 'number') return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      if (c.type === 'date' && typeof v === 'string') return new Date(v.length <= 10 ? `${v}T12:00:00` : v).toLocaleDateString('pt-BR');
      return String(v);
    },
    text: (r: Record<string, unknown>) => String(r[c.key] ?? ''),
  })), [preview]);

  return (
    <div className="space-y-4">
      <PageHeader icon={FileText} title="Relatórios LIRAa / LIA" subtitle="Plano amostral, sorteio, boletim de campo e laboratório, consolidados, indicadores, criadouros, produtividade e histórico." />
      {surveysQ.loading && <LoadingBlock />}
      {!surveysQ.loading && !surveysQ.data?.length && <EmptyState title="Nenhum levantamento" />}
      {survey && (
        <>
          <Card padding="compact">
            <div className="flex flex-wrap items-end gap-3">
              <SurveyPicker surveys={surveysQ.data!} value={surveyId} onChange={setSurveyId} />
              <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
                <span className="text-xs font-semibold text-slate-700">Relatório</span>
                <SelectInput value={kind} onChange={(e) => setKind(e.target.value as LiraaReportKind)}>
                  {Object.entries(REPORT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </SelectInput>
              </label>
              {can('liraa.export') && docQ.data && <ExportMenu build={() => docQ.data!} />}
            </div>
            {!can('liraa.export') && <p className="mt-2 text-xs text-slate-500">Exportação disponível para perfis com a permissão "Exportar relatórios LIRAa/LIA".</p>}
          </Card>
          {docQ.loading && <LoadingBlock label="Montando relatório..." />}
          {docQ.error && <Notice tone="danger">{docQ.error}</Notice>}
          {docQ.data && preview && (
            <Card>
              <h2 className="text-sm font-bold text-slate-900">{docQ.data.title}</h2>
              <p className="mb-3 text-xs text-slate-500">{docQ.data.subtitle}{docQ.data.tables.length > 1 ? ` · prévia: ${preview.title} (o arquivo traz todas as tabelas)` : ''}</p>
              <DataTable rows={preview.rows.map((r, i) => ({ ...r, __row: i }))} rowKey={(r) => String(r.__row)} columns={columns} pageSize={20} />
              <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] text-slate-500">
                {[...(docQ.data.notes || []), MODEL_DISCLAIMER].map((n) => <li key={n}>{n}</li>)}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
