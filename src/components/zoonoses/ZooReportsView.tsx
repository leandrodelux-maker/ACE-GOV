import React, { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { PageHeader, Card } from '../ui';
import { DataTable, ExportMenu, LoadingBlock, Notice, SelectInput, TextInput, useAsync } from '../ui/ModuleKit';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { zoonosesService } from '../../services/zoonoses/zoonosesService';
import { MODEL_DISCLAIMER } from '../../services/reportExport';
import { CampaignPicker, useSelectedCampaign } from './ZoonosesHubView';
import { buildZooReport, ZOO_REPORT_LABELS, ZooReportKind } from './zooReports';

export const ZooReportsView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const { municipality, session, can } = useAuth();
  const campaignsQ = useAsync(() => zoonosesService.listCampaigns(municipalityId), [municipalityId]);
  const [campaignId, setCampaignId] = useSelectedCampaign(campaignsQ.data, true);
  const [kind, setKind] = useState<ZooReportKind>('consolidado');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const campaign = campaignsQ.data?.find((c) => c.id === campaignId) || null;

  const docQ = useAsync(async () => {
    if (!campaignId) return null;
    const [counts, balances] = await Promise.all([
      zoonosesService.counts(campaignId === 'todas' ? null : campaignId, from, to),
      kind === 'estoque' || kind === 'doses_perdas' ? zoonosesService.stockBalances() : Promise.resolve(undefined),
    ]);
    return buildZooReport(kind, {
      counts, campaign, balances, generatedBy: session?.profile.fullName,
      municipalityLabel: municipality ? `${municipality.name}/${municipality.state}` : '',
      periodLabel: from || to ? `Período: ${from || 'início'} a ${to || 'hoje'}` : undefined,
    });
  }, [campaignId, kind, from, to]);

  const preview = docQ.data?.tables[docQ.data.tables.length - 1];
  const columns = useMemo(() => (preview?.columns || []).map((c) => ({
    key: c.key, header: c.label, align: c.type === 'number' || c.type === 'percent' ? ('right' as const) : undefined,
    render: (r: Record<string, unknown>) => {
      const v = r[c.key];
      if (v === null || v === undefined || v === '') return '—';
      if (c.type === 'percent' && typeof v === 'number') return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      if (c.type === 'date' && typeof v === 'string') return new Date(v.length <= 10 ? `${v}T12:00:00` : v).toLocaleDateString('pt-BR');
      return typeof v === 'number' ? v.toLocaleString('pt-BR') : String(v);
    },
    text: (r: Record<string, unknown>) => String(r[c.key] ?? ''),
  })), [preview]);

  return (
    <div className="space-y-4">
      <PageHeader icon={FileText} title="Relatórios antirrábicos" subtitle="Boletim diário, consolidados, espécie, sexo, localidade, equipes, cobertura, postos, estoque, perdas e conferência estadual." />
      {campaignsQ.loading && <LoadingBlock />}
      {campaignsQ.data && (
        <Card padding="compact">
          <div className="flex flex-wrap items-end gap-3">
            <CampaignPicker campaigns={campaignsQ.data} value={campaignId} onChange={setCampaignId} allowAll />
            <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs"><span className="text-xs font-semibold text-slate-700">Relatório</span>
              <SelectInput value={kind} onChange={(e) => setKind(e.target.value as ZooReportKind)}>{Object.entries(ZOO_REPORT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput></label>
            <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-700">De</span><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="sm:w-40" /></label>
            <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-700">Até</span><TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="sm:w-40" /></label>
            {can('antirrabica.export') && docQ.data && <ExportMenu build={() => docQ.data!} />}
          </div>
        </Card>
      )}
      {docQ.loading && <LoadingBlock label="Montando relatório..." />}
      {docQ.error && <Notice tone="danger">{docQ.error}</Notice>}
      {docQ.data && preview && (
        <Card>
          <h2 className="text-sm font-bold text-slate-900">{docQ.data.title}</h2>
          <p className="mb-3 text-xs text-slate-500">{docQ.data.subtitle}{docQ.data.tables.length > 1 ? ` · prévia: ${preview.title} (o arquivo traz todas as tabelas)` : ''}</p>
          <DataTable rows={preview.rows.map((r, i) => ({ ...r, __row: i }))} rowKey={(r) => String(r.__row)} columns={columns} pageSize={20} />
          <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] text-slate-500">{[...(docQ.data.notes || []), MODEL_DISCLAIMER].map((n) => <li key={n}>{n}</li>)}</ul>
        </Card>
      )}
    </div>
  );
};
