import React, { useMemo, useState } from 'react';
import { PawPrint } from 'lucide-react';
import { PageHeader, Card } from '../ui';
import { BarList, EmptyState, LoadingBlock, Metric, Notice, SERIES_COLORS, SectionTitle, SelectInput, StackedColumns, TextInput, fmtDate, fmtPct, todayLocal, useAsync } from '../ui/ModuleKit';
import { useMunicipalityId } from '../../contexts/AuthContext';
import { zoonosesService } from '../../services/zoonoses/zoonosesService';
import { SEX_LABELS, SPECIES_LABELS, batchAlert, campaignIndicators, lowestCoverageLocalities } from '../../services/zoonoses/zoonosesMetrics';
import { CampaignPicker, useSelectedCampaign } from './ZoonosesHubView';
import { COVERAGE_NOTE } from './zooReports';

export const ZooDashboardView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const campaignsQ = useAsync(() => zoonosesService.listCampaigns(municipalityId), [municipalityId]);
  const lookupsQ = useAsync(async () => ({ neighborhoods: await zoonosesService.listNeighborhoods(municipalityId), teams: await zoonosesService.listTeams(municipalityId) }), [municipalityId]);
  const [campaignId, setCampaignId] = useSelectedCampaign(campaignsQ.data, true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [species, setSpecies] = useState('');
  const [neighborhoodId, setNeighborhoodId] = useState('');
  const [teamId, setTeamId] = useState('');
  const campaign = campaignsQ.data?.find((c) => c.id === campaignId) || null;

  const countsQ = useAsync(
    () => (campaignId ? zoonosesService.counts(campaignId === 'todas' ? null : campaignId, from, to, { species, neighborhoodId, teamId }) : Promise.resolve(null)),
    [campaignId, from, to, species, neighborhoodId, teamId]
  );
  const stockQ = useAsync(() => zoonosesService.stockBalances(), [municipalityId]);

  const c = countsQ.data;
  const ind = useMemo(() => (c ? campaignIndicators(c.by_species, campaign) : null), [c, campaign]);
  const days = useMemo(() => Array.from(new Set((c?.by_day || []).map((d) => d.day))).sort(), [c]);
  const filtersActive = !!(species || neighborhoodId || teamId);
  const today = todayLocal();
  const stockAlerts = (stockQ.data || []).map((b) => ({ b, alert: batchAlert({ ...b, central_balance: Number(b.central_balance) }, today) })).filter((x) => x.alert);
  const available = (stockQ.data || []).filter((b) => b.expiration_date >= today).reduce((a, b) => a + Number(b.central_balance) + b.teams.reduce((x, t) => x + Number(t.balance), 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader icon={PawPrint} title="Vacinação antirrábica — Painel" subtitle="Cães e gatos vacinados, doses, coberturas estimadas e estoque, com dados do banco." />
      {campaignsQ.loading && <LoadingBlock />}
      {campaignsQ.error && <Notice tone="danger">{campaignsQ.error}</Notice>}
      {campaignsQ.data && (
        <Card padding="compact">
          <div className="flex flex-wrap items-end gap-3">
            <CampaignPicker campaigns={campaignsQ.data} value={campaignId} onChange={setCampaignId} allowAll />
            <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-700">De</span><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="sm:w-40" /></label>
            <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-700">Até</span><TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="sm:w-40" /></label>
            <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-700">Espécie</span>
              <SelectInput value={species} onChange={(e) => setSpecies(e.target.value)} className="sm:w-32"><option value="">Todas</option><option value="canina">Cães</option><option value="felina">Gatos</option></SelectInput></label>
            <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-700">Localidade</span>
              <SelectInput value={neighborhoodId} onChange={(e) => setNeighborhoodId(e.target.value)} className="sm:w-44"><option value="">Todas</option>{(lookupsQ.data?.neighborhoods || []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</SelectInput></label>
            <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-700">Equipe</span>
              <SelectInput value={teamId} onChange={(e) => setTeamId(e.target.value)} className="sm:w-44"><option value="">Todas</option>{(lookupsQ.data?.teams || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</SelectInput></label>
          </div>
          {campaign && <p className="mt-2 text-xs text-slate-500">Competência: {fmtDate(campaign.start_date)} a {fmtDate(campaign.end_date)} · Fonte da estimativa: {campaign.population_source || 'não informada'}</p>}
        </Card>
      )}
      {countsQ.loading && <LoadingBlock />}
      {countsQ.error && <Notice tone="danger">{countsQ.error}</Notice>}
      {c && ind && (
        c.doses_total === 0 ? <EmptyState title="Nenhuma dose registrada neste recorte" description="Os quantitativos aparecem conforme as doses forem registradas ou os boletins lançados." /> : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Cães vacinados" value={ind.dogsVaccinated.toLocaleString('pt-BR')} caption={`${(c.by_species.canina?.doses ?? 0).toLocaleString('pt-BR')} dose(s)`} />
              <Metric label="Gatos vacinados" value={ind.catsVaccinated.toLocaleString('pt-BR')} caption={`${(c.by_species.felina?.doses ?? 0).toLocaleString('pt-BR')} dose(s)`} />
              <Metric label="Total de animais" value={ind.animalsVaccinated.toLocaleString('pt-BR')} caption={`${c.doses_total.toLocaleString('pt-BR')} doses aplicadas`} />
              <Metric label="Estoque disponível" value={available.toLocaleString('pt-BR')} caption={`dose(s) em lotes válidos · ${stockAlerts.length} alerta(s)`} tone={stockAlerts.length ? 'warning' : undefined} />
              <Metric label="Cobertura canina" value={filtersActive ? '—' : fmtPct(ind.dogCoverage)} caption={filtersActive ? 'Remova os filtros para ver a cobertura municipal' : ind.dogTarget != null ? `Meta ${ind.dogTarget}%${ind.dogTargetReached === null ? '' : ind.dogTargetReached ? ' — alcançada' : ' — não alcançada'}` : 'Meta não definida'}
                tone={!filtersActive && ind.dogTargetReached === true ? 'success' : !filtersActive && ind.dogTargetReached === false ? 'warning' : undefined} />
              <Metric label="Cobertura felina" value={filtersActive ? '—' : fmtPct(ind.catCoverage)} caption={ind.catTarget != null ? `Meta ${ind.catTarget}%` : 'Meta não definida'} />
              <Metric label="Registros individuais" value={(c.doses_by_source.individual ?? 0).toLocaleString('pt-BR')} caption={`Rápidos: ${c.doses_by_source.campanha_rapida ?? 0} · Boletins: ${c.doses_by_source.agregado ?? 0}`} />
              <Metric label="Período" value={days.length ? `${days.length} dia(s)` : '—'} caption={days.length ? `${fmtDate(days[0])} a ${fmtDate(days[days.length - 1])}` : ''} />
            </div>
            {!ind.coverageAvailable && !filtersActive && <Notice tone="info" title="Cobertura indisponível">Informe a população estimada (com fonte, data e método) na campanha para calcular a cobertura. Os quantitativos acima continuam válidos.</Notice>}
            <p className="text-[11px] text-slate-500">{COVERAGE_NOTE}</p>

            <Card>
              <SectionTitle>Vacinações por dia</SectionTitle>
              <StackedColumns ariaLabel="Doses por dia e espécie" labels={days.map((d) => fmtDate(d).slice(0, 5))}
                series={[
                  { name: 'Cães', color: SERIES_COLORS[0], values: days.map((d) => c.by_day.filter((x) => x.day === d && x.species === 'canina').reduce((a, x) => a + Number(x.doses), 0)) },
                  { name: 'Gatos', color: SERIES_COLORS[1], values: days.map((d) => c.by_day.filter((x) => x.day === d && x.species === 'felina').reduce((a, x) => a + Number(x.doses), 0)) },
                ]} />
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <SectionTitle>Vacinações por localidade (animais)</SectionTitle>
                <BarList ariaLabel="Animais vacinados por localidade" data={aggregateBy(c.by_neighborhood, (r) => r.name || 'Sem localidade', (r) => Number(r.animals)).slice(0, 12)} />
              </Card>
              <Card>
                <SectionTitle>Localidades com menor cobertura canina estimada</SectionTitle>
                {(() => {
                  const low = lowestCoverageLocalities(c.by_neighborhood as any, 8);
                  return low.length ? (
                    <BarList ariaLabel="Menor cobertura canina por localidade" max={100} data={low.map((l) => ({ label: l.name, value: l.coverage, display: fmtPct(l.coverage), detail: `${l.name}: ${l.animals} de ${l.population} cães estimados` }))} />
                  ) : <p className="py-4 text-xs text-slate-500">Sem população estimada por localidade nesta campanha.</p>;
                })()}
              </Card>
              <Card>
                <SectionTitle>Vacinações por equipe (doses)</SectionTitle>
                <BarList ariaLabel="Doses por equipe" data={c.by_team.map((t) => ({ label: t.name || 'Sem equipe', value: Number(t.doses) })).sort((a, b) => b.value - a.value)} />
              </Card>
              <Card>
                <SectionTitle>Distribuição por sexo (doses)</SectionTitle>
                <BarList ariaLabel="Doses por espécie e sexo" data={c.by_sex.map((x) => ({ label: `${SPECIES_LABELS[x.species]} · ${SEX_LABELS[x.sex] || x.sex}`, value: Number(x.doses) })).sort((a, b) => b.value - a.value)} />
              </Card>
            </div>
          </>
        )
      )}
      {stockAlerts.length > 0 && (
        <Notice tone="warning" title="Alertas de estoque">
          <ul className="list-disc pl-4">
            {stockAlerts.map(({ b, alert }) => (
              <li key={b.batch_id}>{b.product_name} lote {b.batch_number}: {alert === 'vencido' ? `vencido em ${fmtDate(b.expiration_date)} com saldo ${b.central_balance}` : alert === 'vence_em_30_dias' ? `vence em ${fmtDate(b.expiration_date)}` : `saldo ${b.central_balance} abaixo do mínimo ${b.minimum_stock}`}</li>
            ))}
          </ul>
        </Notice>
      )}
    </div>
  );
};

function aggregateBy<T>(rows: T[], label: (r: T) => string, value: (r: T) => number) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(label(r), (m.get(label(r)) || 0) + value(r)));
  return Array.from(m.entries()).map(([l, v]) => ({ label: l, value: v })).sort((a, b) => b.value - a.value);
}
