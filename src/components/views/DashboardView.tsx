import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Flame,
  Layers,
  Map,
  MapPin,
  RefreshCw,
  Route,
} from 'lucide-react';
import { situationRoomService, SituationRoomData } from '../../services/situationRoomService';
import { supabaseService } from '../../services/supabaseService';
import { Neighborhood } from '../../types';
import { PageHeader, StatCard } from '../ui';
import { useMunicipalityId } from '../../contexts/AuthContext';

interface DashboardViewProps {
  onNavigate: (module: string) => void;
}

const PERIODS = [
  { id: 'today', label: 'Hoje' },
  { id: '7days', label: '7 dias' },
  { id: '30days', label: '30 dias' },
  { id: 'cycle', label: 'Ciclo atual' },
] as const;

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const municipalityId = useMunicipalityId();
  const [periodFilter, setPeriodFilter] = useState<(typeof PERIODS)[number]['id']>('cycle');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('ALL');
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [data, setData] = useState<SituationRoomData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabaseService.getNeighborhoods(municipalityId).then((items) => {
      if (active) setNeighborhoods(items || []);
    });
    return () => { active = false; };
  }, [municipalityId]);

  const load = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const result = await situationRoomService.getSituationData({
        municipalityId,
        periodFilter,
        neighborhoodId: neighborhoodFilter,
        forceRefresh,
      });
      setData(result);
      setLoadError(null);
    } catch (error) {
      console.error('Erro ao carregar a Sala de Situação:', error);
      setData(null);
      setLoadError('Não foi possível atualizar os indicadores. Verifique a conexão e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [municipalityId, neighborhoodFilter, periodFilter]);

  useEffect(() => { load(); }, [load]);

  const kpis = data?.kpis;
  const value = (current: number | string | null | undefined, suffix = '') => {
    if (isLoading) return '…';
    if (current === null || current === undefined) return '—';
    return `${current}${suffix}`;
  };
  const ipo = kpis && kpis.totalOvitraps > 0
    ? Math.round((kpis.positiveOvitraps / kpis.totalOvitraps) * 100)
    : null;
  const updatedAt = useMemo(() => {
    if (!data?.calculatedAt) return null;
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.calculatedAt));
  }, [data?.calculatedAt]);
  const criticalAreas = (data?.neighborhoods || []).filter((item) => item.riskLevel === 'CRITICO' || item.riskLevel === 'ALTO');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sala de Situação"
        subtitle={`Visão municipal para organizar o trabalho de campo${data?.activeCycleName ? ` no ${data.activeCycleName}` : ''}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label="Período dos indicadores">
              {PERIODS.map((period) => (
                <button
                  type="button"
                  key={period.id}
                  onClick={() => setPeriodFilter(period.id)}
                  aria-pressed={periodFilter === period.id}
                  className={`min-h-10 whitespace-nowrap rounded-md px-3 text-sm font-semibold transition-colors ${periodFilter === period.id ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
                >
                  {period.label}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="dashboard-neighborhood">Filtrar por bairro</label>
            <select
              id="dashboard-neighborhood"
              value={neighborhoodFilter}
              onChange={(event) => setNeighborhoodFilter(event.target.value)}
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
            >
              <option value="ALL">Todo o município</option>
              {neighborhoods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={isLoading}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-wait"
              aria-label="Atualizar indicadores"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
        }
      />

      {loadError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <button type="button" onClick={() => load(true)} className="min-h-10 rounded-lg bg-rose-700 px-4 font-semibold text-white">Tentar novamente</button>
        </div>
      ) : null}

      {!loadError && data?.failedSources.length ? (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Dados temporariamente indisponíveis: {data.failedSources.join(', ')}. Os demais indicadores continuam válidos.
        </div>
      ) : null}

      <section aria-labelledby="dashboard-kpis-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="dashboard-kpis-title" className="text-base font-bold text-slate-950">Indicadores principais</h2>
            <p className="text-sm text-slate-500">{updatedAt ? `Atualizado em ${updatedAt}` : 'Aguardando atualização'}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Visitas realizadas" value={value(kpis?.visited)} icon={CheckCircle2} tone="success" caption={`${value(kpis?.totalProperties)} imóveis cadastrados`} onClick={() => onNavigate('visits')} />
          <StatCard label="Cobertura do período" value={value(kpis?.coveragePercent, '%')} icon={MapPin} tone={kpis && kpis.coveragePercent < 80 ? 'warning' : 'success'} caption="Imóveis trabalhados no território" onClick={() => onNavigate('map')} />
          <StatCard label="Pendências de retorno" value={value(kpis?.pending)} icon={ClipboardList} tone={kpis?.pending ? 'warning' : 'neutral'} caption="Fechados, recusas e retornos" onClick={() => onNavigate('field_pendencies')} />
          <StatCard label="Focos ativos" value={value(kpis?.fociActive)} icon={Flame} tone={kpis?.fociActive ? 'danger' : 'success'} caption={`${value(kpis?.eliminated)} eliminados no período`} onClick={() => onNavigate('foci_recurrence')} highlighted={Boolean(kpis?.fociActive)} />
          <StatCard label="IPO de ovitrampas" value={value(ipo, ipo === null ? '' : '%')} icon={Layers} tone={ipo && ipo > 20 ? 'danger' : 'info'} caption={`${value(kpis?.positiveOvitraps)} positivas de ${value(kpis?.totalOvitraps)}`} onClick={() => onNavigate('ovitraps')} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-labelledby="territory-title">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id="territory-title" className="text-base font-bold text-slate-950">Situação por território</h2>
              <p className="mt-0.5 text-sm text-slate-500">Áreas ordenadas por prioridade operacional.</p>
            </div>
            <button type="button" onClick={() => onNavigate('map')} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50">
              <Map className="h-4 w-4" aria-hidden="true" /> Ver mapa
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Bairro</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Cobertura</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Pendências</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Focos</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Risco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">Carregando situação territorial…</td></tr>
                ) : data?.neighborhoods.length ? data.neighborhoods.slice(0, 8).map((area) => (
                  <tr key={area.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5"><span className="font-semibold text-slate-900">{area.name}</span><span className="mt-0.5 block text-xs text-slate-500">{area.totalProperties} imóveis</span></td>
                    <td className="px-3 py-3.5">{area.coveragePercentage === null ? 'Não calculada' : `${area.coveragePercentage}%`}</td>
                    <td className="px-3 py-3.5">{area.pendingCount}</td>
                    <td className="px-3 py-3.5">{area.fociCount}</td>
                    <td className="px-5 py-3.5 text-right"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${area.riskLevel === 'CRITICO' ? 'bg-rose-100 text-rose-800' : area.riskLevel === 'ALTO' ? 'bg-orange-100 text-orange-800' : area.riskLevel === 'ATENCAO' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{area.riskLevel === 'ATENCAO' ? 'Atenção' : area.riskLevel.charAt(0) + area.riskLevel.slice(1).toLowerCase()}</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">Nenhum território cadastrado para o filtro selecionado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="priorities-title">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="priorities-title" className="text-base font-bold text-slate-950">Prioridades de hoje</h2>
                <p className="mt-0.5 text-sm text-slate-500">{criticalAreas.length} área(s) em risco alto ou crítico.</p>
              </div>
              <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
            </div>
            <div className="space-y-3">
              {isLoading ? <p className="py-5 text-center text-sm text-slate-500">Calculando prioridades…</p> : data?.priorities.length ? data.priorities.slice(0, 5).map((priority) => (
                <article key={priority.id} className="rounded-lg border border-slate-200 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-950">{priority.title}</h3>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{priority.badgeLabel}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-5 text-slate-600">{priority.description}</p>
                  <button type="button" onClick={() => onNavigate(priority.targetModule)} className="mt-2 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-teal-800 hover:underline">
                    Abrir atividade <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </article>
              )) : <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">Nenhuma prioridade urgente para o período selecionado.</p>}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="shortcuts-title">
            <h2 id="shortcuts-title" className="text-base font-bold text-slate-950">Acesso rápido</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {[
                { label: 'Abrir trabalho de campo', target: 'ace_pwa', icon: Route },
                { label: 'Consultar imóveis', target: 'properties', icon: MapPin },
                { label: 'Ver ovitrampas', target: 'ovitraps', icon: Layers },
                { label: 'Emitir relatório', target: 'reports', icon: ClipboardList },
              ].map(({ label, target, icon: Icon }) => (
                <button type="button" key={target} onClick={() => onNavigate(target)} className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-slate-200 px-3 text-left text-sm font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900">
                  <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
