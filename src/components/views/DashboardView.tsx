import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  CheckCircle2,
  PieChart as PieChartIcon,
  Clock,
  DoorClosed,
  UserX,
  Flame,
  ShieldCheck,
  Repeat,
  Layers,
  Activity,
  AlertCircle,
  Crosshair,
  Users,
  Filter,
  ArrowUpRight,
  TrendingUp,
  MapPin,
  Calendar,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { situationRoomService, SituationRoomData } from '../../services/situationRoomService';
import { supabaseService } from '../../services/supabaseService';
import { Neighborhood } from '../../types';
import { PageHeader, StatCard, Breadcrumbs } from '../ui';
import { useMunicipalityId } from '../../contexts/AuthContext';

interface DashboardViewProps {
  onNavigate: (module: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const municipalityId = useMunicipalityId();
  const [periodFilter, setPeriodFilter] = useState<'today' | '7days' | '30days' | 'cycle'>('cycle');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string>('ALL');
  const [neighborhoodsList, setNeighborhoodsList] = useState<Neighborhood[]>([]);
  const [dashboardData, setDashboardData] = useState<SituationRoomData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lista de bairros do município da sessão para o filtro
  useEffect(() => {
    let active = true;
    supabaseService.getNeighborhoods(municipalityId).then((neighs) => {
      if (active) setNeighborhoodsList(neighs || []);
    });
    return () => {
      active = false;
    };
  }, [municipalityId]);

  // Carregar dados reais agregados com cache
  const loadSituationData = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      const data = await situationRoomService.getSituationData({
        municipalityId,
        periodFilter,
        neighborhoodId: neighborhoodFilter,
        forceRefresh: force,
      });
      setDashboardData(data);
      setLoadError(null);
    } catch (err) {
      console.error('Erro ao carregar dados da Sala de Situação:', err);
      setDashboardData(null);
      setLoadError('Não foi possível carregar os dados da Sala de Situação. Verifique a conexão e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [municipalityId, periodFilter, neighborhoodFilter]);

  useEffect(() => {
    loadSituationData();
  }, [loadSituationData]);

  const kpis = dashboardData?.kpis;
  const cycleName = dashboardData
    ? dashboardData.activeCycleName ?? 'nenhum ciclo em andamento'
    : null;
  /** Valor do KPI: '...' carregando, '—' sem dados (erro), senão o valor real. */
  const kpiValue = (v: string | number | undefined) => (isLoading ? '...' : kpis ? v ?? '—' : '—');
  const ipoPercent =
    kpis && kpis.totalOvitraps > 0 ? Math.round((kpis.positiveOvitraps / kpis.totalOvitraps) * 100) : null;
  const hasDeposits = (dashboardData?.depositDistribution || []).some((d) => d.count > 0);

  return (
    <div className="space-y-5">
      {/* Breadcrumbs de Navegação */}
      <Breadcrumbs
        items={[
          { label: 'Início', onClick: () => onNavigate('dashboard') },
          { label: 'Sala de Situação' },
        ]}
      />

      {/* Header & Filter Bar */}
      <PageHeader
        live
        title="Sala de Situação de Endemias"
        subtitle={`Monitoramento entomológico, epidemiológico e operacional${cycleName ? ` — ${cycleName}` : ''}`}
        actions={
          <>
            <div className="flex items-center rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-medium">
              <button
                onClick={() => setPeriodFilter('today')}
                className={`px-3 py-1.5 rounded-md transition ${periodFilter === 'today' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Hoje
              </button>
              <button
                onClick={() => setPeriodFilter('7days')}
                className={`px-3 py-1.5 rounded-md transition ${periodFilter === '7days' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                7 Dias
              </button>
              <button
                onClick={() => setPeriodFilter('30days')}
                className={`px-3 py-1.5 rounded-md transition ${periodFilter === '30days' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                30 Dias
              </button>
              <button
                onClick={() => setPeriodFilter('cycle')}
                className={`px-3 py-1.5 rounded-md transition ${periodFilter === 'cycle' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Ciclo Atual
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={neighborhoodFilter}
                onChange={e => setNeighborhoodFilter(e.target.value)}
                className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">Todos os Bairros ({neighborhoodsList.length})</option>
                {neighborhoodsList.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => loadSituationData(true)}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              title="Atualizar dados do banco"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </>
        }
      />

      {loadError && (
        <div role="alert" className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button onClick={() => loadSituationData(true)} className="px-3 py-1 rounded-lg bg-rose-600 text-white font-semibold">
            Tentar novamente
          </button>
        </div>
      )}
      {!loadError && dashboardData && dashboardData.failedSources.length > 0 && (
        <div role="status" className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs">
          Alguns dados não puderam ser carregados ({dashboardData.failedSources.join(', ')}). Os indicadores dessas fontes podem estar incompletos.
        </div>
      )}

      {/* 8 Headline KPIs Operacionais Priorizados (Diretriz & Skill kpi-dashboard-design) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* KPI 1: Visitas Realizadas */}
        <StatCard
          title="Ver registro completo de visitas domiciliares"
          onClick={() => onNavigate('visits')}
          icon={CheckCircle2}
          tone="success"
          label="Visitas Realizadas"
          value={kpiValue(kpis?.visited.toLocaleString('pt-BR'))}
          caption={kpis ? `${kpis.coveragePercent}% dos imóveis cadastrados →` : 'Sem dados →'}
        />

        {/* KPI 2: Imóveis Cadastrados & Cobertura */}
        <StatCard
          title="Abrir Central de Território e Imóveis"
          onClick={() => onNavigate('territory')}
          icon={Home}
          tone="info"
          label="Imóveis no Território"
          value={kpiValue(kpis?.totalProperties.toLocaleString('pt-BR'))}
          footer={
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1">
              <div
                className={`h-full rounded-full ${
                  (kpis?.coveragePercent || 0) >= 80
                    ? 'bg-emerald-500'
                    : (kpis?.coveragePercent || 0) >= 60
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, kpis?.coveragePercent || 0)}%` }}
              />
            </div>
          }
        />

        {/* KPI 3: Focos Ativos de Vetores */}
        <StatCard
          title="Ver focos ativos e mapeamento de risco"
          onClick={() => onNavigate('foci_recurrence')}
          icon={Flame}
          tone="danger"
          highlighted
          pulse
          label="Focos Ativos de Aedes"
          value={kpiValue(kpis?.fociActive)}
          caption="Aedes aegypti identificado →"
        />

        {/* KPI 4: Focos Eliminados e Tratados */}
        <StatCard
          title="Ver controle vetorial e condutas adotadas"
          onClick={() => onNavigate('vector_control')}
          icon={ShieldCheck}
          tone="success"
          label="Focos Tratados / Eliminados"
          value={kpiValue(kpis?.eliminated)}
          caption="Tratamento químico / mecânico →"
        />

        {/* KPI 5: Pendências e Fechados */}
        <StatCard
          title="Ver pendências de campo e imóveis fechados para resgate"
          onClick={() => onNavigate('field_pendencies')}
          icon={Clock}
          tone="warning"
          label="Pendências / Fechados"
          value={kpiValue(kpis ? kpis.pending + kpis.closed : undefined)}
          caption={kpis ? `${kpis.refusals} recusas registradas →` : 'Sem dados →'}
        />

        {/* KPI 6: Ovitrampas (Rede Sentinela) */}
        <StatCard
          title="Abrir Rede Sentinela de Ovitrampas"
          onClick={() => onNavigate('ovitraps')}
          icon={Layers}
          tone="info"
          label="Ovitrampas Positivas (IPO)"
          value={kpiValue(kpis ? `${kpis.positiveOvitraps} / ${kpis.totalOvitraps}` : undefined)}
          caption={ipoPercent !== null ? `${ipoPercent}% positividade sentinela →` : 'Sem ovitrampas cadastradas →'}
        />

        {/* KPI 7: Pontos Estratégicos (PE) */}
        <StatCard
          title="Ver monitoramento de Pontos Estratégicos"
          onClick={() => onNavigate('strategic_points')}
          icon={Crosshair}
          tone="danger"
          label="Pontos Estratégicos (PE)"
          value={kpiValue(kpis ? `${kpis.overduePE} pendentes` : undefined)}
          caption="Imóveis críticos quinzenais →"
        />

        {/* KPI 8: Denúncias da População */}
        <StatCard
          title="Ver denúncias da comunidade no portal"
          onClick={() => onNavigate('complaints')}
          icon={AlertCircle}
          tone="warning"
          label="Denúncias Comunitárias"
          value={kpiValue(kpis?.openComplaints)}
          caption="Aguardando inspeção ACE →"
        />
      </div>

      {/* Main Charts and Analytical Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Focos por Bairro e Cobertura */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bairros e Risco */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Situação Territorial por Bairro</h2>
                <p className="text-xs text-slate-500">Índice de Risco Entomológico, Cobertura do Ciclo e Focos</p>
              </div>
              <button
                onClick={() => onNavigate('territory')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>Ver Território Completo</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Bairro / Localidade</th>
                    <th className="py-2.5 px-3">Imóveis</th>
                    <th className="py-2.5 px-3">Cobertura</th>
                    <th className="py-2.5 px-3">Focos</th>
                    <th className="py-2.5 px-3">Índice Risco</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-1" />
                        <span>Carregando situação territorial do banco...</span>
                      </td>
                    </tr>
                  ) : (dashboardData?.neighborhoods || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        {loadError ? 'Não foi possível carregar.' : 'Sem bairros registrados para o município.'}
                      </td>
                    </tr>
                  ) : (dashboardData?.neighborhoods || []).map(n => {
                    const isCritical = n.riskLevel === 'CRITICO';
                    const isHigh = n.riskLevel === 'ALTO';
                    return (
                      <tr key={n.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {n.name}
                          {isCritical && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700">
                              Alerta Crítico
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600">{n.totalProperties.toLocaleString('pt-BR')}</td>
                        <td className="py-3 px-3">
                          {n.coveragePercentage === null ? (
                            <span className="text-slate-400">Sem imóveis cadastrados</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{n.coveragePercentage}%</span>
                              <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${n.coveragePercentage >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                  style={{ width: `${n.coveragePercentage}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded font-bold ${n.fociCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                            {n.fociCount}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isCritical ? 'bg-rose-500' : isHigh ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                            <span className="font-bold text-slate-800">{n.riskScore}/100</span>
                            <span className="text-[10px] text-slate-500">({n.riskLevel})</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => onNavigate('map')}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition"
                          >
                            Ver no Mapa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bloco Oficial: SITUAÇÃO DAS OVITRAMPAS */}
          <div className="bg-gradient-to-r from-sky-950 to-blue-900 text-white p-5 rounded-xl shadow-xs space-y-4 border border-sky-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-800/70">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-sky-800 text-sky-200">
                  <Layers className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black tracking-tight">SITUAÇÃO DAS OVITRAMPAS (REDE SENTINELA)</h3>
                  <p className="text-[11px] text-sky-200">Dispersão precoce de fêmeas e contagem de ovos no município</p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('ovitraps')}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition self-start sm:self-auto flex items-center gap-1 shadow-xs"
              >
                <span>Painel Completo de Ovitrampas</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-sky-950/70 p-3 rounded-lg border border-sky-800/60">
                <span className="text-[10px] text-sky-300 uppercase font-semibold">Armadilhas Ativas</span>
                <p className="text-xl font-extrabold text-white mt-0.5">{kpiValue(kpis?.totalOvitraps)}</p>
                <span className="text-[10px] text-sky-300">Pontos sentinela</span>
              </div>

              <div className="bg-sky-950/70 p-3 rounded-lg border border-sky-800/60">
                <span className="text-[10px] text-rose-300 uppercase font-semibold">Armadilhas Positivas</span>
                <p className="text-xl font-extrabold text-rose-300 mt-0.5">{kpiValue(kpis?.positiveOvitraps)}</p>
                <span className="text-[10px] text-rose-200 font-medium">Presença de ovos</span>
              </div>

              <div className="bg-sky-950/70 p-3 rounded-lg border border-sky-800/60">
                <span className="text-[10px] text-sky-300 uppercase font-semibold">Positividade (IPO)</span>
                <p className="text-xl font-extrabold text-white mt-0.5">
                  {isLoading ? '...' : ipoPercent !== null ? `${ipoPercent}%` : '—'}
                </p>
                <span className="text-[10px] text-sky-300">Índice Municipal</span>
              </div>

              <div className="bg-sky-950/70 p-3 rounded-lg border border-sky-800/60">
                <span className="text-[10px] text-purple-300 uppercase font-semibold">Foco Prioritário</span>
                {dashboardData?.topEggDensityNeighborhood ? (
                  <>
                    <p className="text-xl font-extrabold text-purple-200 mt-0.5 truncate">{dashboardData.topEggDensityNeighborhood.name}</p>
                    <span className="text-[10px] text-purple-300">
                      Maior densidade: {dashboardData.topEggDensityNeighborhood.averageEggs} ovos/armadilha
                    </span>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-purple-200 mt-1.5">{isLoading ? '...' : 'Sem dados registrados'}</p>
                    <span className="text-[10px] text-purple-300">Maior densidade de ovos</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tipos de Criadouros A1 a E (Ministério da Saúde) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Tipologia de Criadouros Encontrados (Padrão MS / LIRAa)</h2>
                <p className="text-xs text-slate-500">Distribuição dos recipientes positivos e inspecionados por categoria</p>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              {!isLoading && !hasDeposits && (
                <p className="text-xs text-slate-400 py-4 text-center">Sem depósitos registrados nas visitas do período.</p>
              )}
              {hasDeposits && (dashboardData?.depositDistribution || []).map(dep => {
                const maxCount = Math.max(1, ...(dashboardData?.depositDistribution || []).map(d => d.count));
                const percent = Math.min(100, Math.round((dep.count / maxCount) * 100));

                return (
                  <div key={dep.code} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-700">
                        <strong className="text-slate-900 mr-1.5">[{dep.code}]</strong>
                        {dep.name}
                      </span>
                      <span className="text-slate-900 font-bold">{dep.count} depósitos</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${dep.color}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Prioridades Operacionais de Hoje e Atalhos */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50/40 to-white shadow-xs">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-3">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Prioridades Operacionais de Hoje</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {isLoading ? (
                <div className="py-6 text-center text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto text-amber-600 mb-1" />
                  <span>Calculando prioridades do dia...</span>
                </div>
              ) : (dashboardData?.priorities || []).length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-center">
                  <p className="font-bold">{loadError ? 'Não foi possível calcular as prioridades.' : 'Nenhuma prioridade identificada.'}</p>
                  {!loadError && <p className="text-[11px] mt-0.5">Baseado apenas nos dados registrados no sistema.</p>}
                </div>
              ) : (
                (dashboardData?.priorities || []).map(prio => (
                  <div key={prio.id} className="p-3 rounded-lg bg-white border border-slate-200 text-slate-900 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900">{prio.title}</p>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${prio.badgeColor}`}>
                        {prio.badgeLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{prio.description}</p>
                    <button
                      onClick={() => onNavigate(prio.targetModule)}
                      className="mt-1 text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-0.5"
                    >
                      <span>Abrir Módulo</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Atalhos Rápidos para Ação */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Ações Imediatas</h3>

            <button
              onClick={() => onNavigate('ace_pwa')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition"
            >
              <span>Abrir Modo Agente em Campo (PWA)</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('planning')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-xs transition"
            >
              <span>Gerar Planejamento de Amanhã</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('map')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs shadow-xs transition"
            >
              <span>Abrir Mapa Geral de Focos & Ovitrampas</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('reports')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition"
            >
              <span>Emitir Boletim Oficial SUS (PDF/CSV)</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
