import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { db } from '../../services/storage';

interface DashboardViewProps {
  onNavigate: (module: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [periodFilter, setPeriodFilter] = useState<'today' | '7days' | '30days' | 'cycle'>('cycle');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string>('ALL');

  const municipality = db.getMunicipality();
  const cycle = db.getCycle();
  const neighborhoods = db.getNeighborhoods();
  const properties = db.getProperties();
  const ovitraps = db.getOvitraps();
  const strategicPoints = db.getStrategicPoints();
  const blocks = db.getEpidemiologyBlocks();
  const complaints = db.getComplaints();
  const visits = db.getVisits();

  // Filtered properties
  const filteredProps = useMemo(() => {
    if (neighborhoodFilter === 'ALL') return properties;
    return properties.filter(p => p.neighborhoodId === neighborhoodFilter || p.neighborhood === neighborhoodFilter);
  }, [properties, neighborhoodFilter]);

  // Calculations based on actual data
  const totalPropertiesCount = filteredProps.length;
  const visitedCount = filteredProps.filter(p => p.lastVisitStatus === 'TRABALHADO').length;
  const closedCount = filteredProps.filter(p => p.status === 'FECHADO').length;
  const refusalCount = filteredProps.filter(p => p.status === 'RECUSA').length;
  const pendingCount = filteredProps.filter(p => p.status === 'PENDENTE' || p.status === 'FECHADO').length;
  const fociCount = filteredProps.filter(p => p.status === 'FOCO').length;
  const recurrentCount = filteredProps.filter(p => p.isRecurrent).length;
  const coveragePercent = totalPropertiesCount > 0 ? Math.round((visitedCount / totalPropertiesCount) * 100) : 0;

  const positiveOvitrapsCount = ovitraps.filter(o => o.isPositive).length;
  const activeBlocksCount = blocks.filter(b => b.status === 'EM_ANDAMENTO').length;
  const openComplaintsCount = complaints.filter(c => c.status !== 'RESOLVIDA').length;
  const overduePECount = strategicPoints.filter(pe => pe.isInspectionOverdue).length;

  // Deposit types analysis (Ministério da Saúde A1-E)
  const depositDistribution = [
    { code: 'A1', name: 'Caixas d\'água / Elevados', count: 18, color: 'bg-blue-500' },
    { code: 'A2', name: 'Tonéis / Tambores / Cisternas', count: 42, color: 'bg-cyan-500' },
    { code: 'B', name: 'Vasos / Garrafas / Pratos', count: 56, color: 'bg-emerald-500' },
    { code: 'C', name: 'Calhas / Ralos / Lajes', count: 24, color: 'bg-amber-500' },
    { code: 'D1', name: 'Pneus e Rodantes', count: 35, color: 'bg-rose-500' },
    { code: 'D2', name: 'Lixo / Sucatas / Recicláveis', count: 31, color: 'bg-orange-500' },
    { code: 'E', name: 'Naturais (Ocos / Bromélias)', count: 9, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sala de Situação de Endemias</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Monitoramento entomológico, epidemiológico e operacional em tempo real — {cycle.name}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
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
              <option value="ALL">Todos os Bairros ({neighborhoods.length})</option>
              {neighborhoods.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.riskLevel})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid (Prompt 04 Requirements) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {/* Imóveis Cadastrados */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Imóveis Totais</span>
            <Home className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-extrabold text-slate-900">{totalPropertiesCount.toLocaleString('pt-BR')}</p>
          <span className="text-[10px] text-slate-500 font-medium">Cadastrados no setor</span>
        </div>

        {/* Imóveis Visitados */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Visitados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-extrabold text-emerald-700">{visitedCount.toLocaleString('pt-BR')}</p>
          <span className="text-[10px] text-emerald-700 font-medium">{coveragePercent}% do objetivo</span>
        </div>

        {/* Cobertura Territorial */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Cobertura</span>
            <PieChartIcon className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-xl font-extrabold text-sky-700">{coveragePercent}%</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full ${coveragePercent >= 80 ? 'bg-emerald-500' : coveragePercent >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(100, coveragePercent)}%` }}
            />
          </div>
        </div>

        {/* Visitas Pendentes */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pendências</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-extrabold text-amber-700">{pendingCount}</p>
          <span className="text-[10px] text-amber-700 font-medium">Requerem retorno</span>
        </div>

        {/* Imóveis Fechados */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Fechados</span>
            <DoorClosed className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-800">{closedCount}</p>
          <span className="text-[10px] text-slate-500 font-medium">Moradores ausentes</span>
        </div>

        {/* Recusas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Recusas</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-extrabold text-rose-700">{refusalCount}</p>
          <span className="text-[10px] text-rose-600 font-medium">Entrada negada</span>
        </div>

        {/* Focos Encontrados */}
        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30 shadow-xs transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Focos Ativos</span>
            <Flame className="w-4 h-4 text-rose-600 animate-pulse" />
          </div>
          <p className="text-xl font-extrabold text-rose-700">{fociCount}</p>
          <span className="text-[10px] text-rose-600 font-medium">Aedes aegypti</span>
        </div>

        {/* Focos Eliminados */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Eliminados</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-extrabold text-emerald-700">39</p>
          <span className="text-[10px] text-emerald-700 font-medium">Conduta química/física</span>
        </div>

        {/* Imóveis Reincidentes */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Reincidentes</span>
            <Repeat className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl font-extrabold text-purple-700">{recurrentCount}</p>
          <span className="text-[10px] text-purple-700 font-medium">≥ 3 focos em 90 dias</span>
        </div>

        {/* Ovitrampas Positivas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Ovitrampas +</span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-xl font-extrabold text-sky-700">{positiveOvitrapsCount} / {ovitraps.length}</p>
          <span className="text-[10px] text-sky-700 font-medium">2 com alerta de alta</span>
        </div>

        {/* Bloqueios Ativos */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Bloqueios</span>
            <Activity className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-extrabold text-rose-700">{activeBlocksCount}</p>
          <span className="text-[10px] text-rose-600 font-medium">Dengue em contenção</span>
        </div>

        {/* Denúncias da Comunidade */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Denúncias</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-extrabold text-amber-700">{openComplaintsCount}</p>
          <span className="text-[10px] text-amber-700 font-medium">Aguardando vistoria</span>
        </div>

        {/* Pontos Estratégicos Pendentes */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">PE Vencidos</span>
            <Crosshair className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-extrabold text-rose-700">{overduePECount}</p>
          <span className="text-[10px] text-rose-600 font-medium">Borracharias/Ferros-velhos</span>
        </div>

        {/* Equipes em Campo */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Equipes Ativas</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-extrabold text-blue-700">6 / 6</p>
          <span className="text-[10px] text-blue-700 font-medium">42 agentes operando</span>
        </div>
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
                  {neighborhoods.map(n => {
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
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{n.coveragePercentage}%</span>
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${n.coveragePercentage >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ width: `${n.coveragePercentage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded font-bold ${n.fociCount > 5 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
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

          {/* Tipos de Criadouros A1 a E (Ministério da Saúde) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Tipologia de Criadouros Encontrados (Padrão MS / LIRAa)</h2>
                <p className="text-xs text-slate-500">Distribuição dos recipientes positivos com larvas de vetores</p>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              {depositDistribution.map(dep => (
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
                      style={{ width: `${(dep.count / 60) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Quick Critical Alerts & Operational Status */}
        <div className="space-y-6">
          {/* O que precisa da minha atenção imediata? */}
          <div className="bg-white p-5 rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50/40 to-white shadow-xs">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-3">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Prioridades Operacionais de Hoje</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                <p className="font-bold">🔴 Bloqueio BLQ-2026-014 (Dengue)</p>
                <p className="text-[11px] text-rose-700 mt-0.5">Vila Nova - Setor 01 com 78% de cobertura. Faltam 22 imóveis.</p>
                <button
                  onClick={() => onNavigate('epidemiology')}
                  className="mt-2 text-[11px] font-bold text-rose-800 hover:underline"
                >
                  Abrir Operação de Bloqueio →
                </button>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                <p className="font-bold">🟠 2 Pontos Estratégicos Vencidos</p>
                <p className="text-[11px] text-amber-800 mt-0.5">Borracharia Central e Ferro Velho Rodoviário ultrapassaram 15 dias.</p>
                <button
                  onClick={() => onNavigate('strategic_points')}
                  className="mt-2 text-[11px] font-bold text-amber-800 hover:underline"
                >
                  Ver Pontos Estratégicos →
                </button>
              </div>

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
                <p className="font-bold">🔵 Ovitrampa OVI-042 em Alerta de Alta</p>
                <p className="text-[11px] text-blue-800 mt-0.5">Subida para 148 ovos consecutivos. Requer coleta e vistoria peridomiciliar.</p>
                <button
                  onClick={() => onNavigate('ovitraps')}
                  className="mt-2 text-[11px] font-bold text-blue-800 hover:underline"
                >
                  Acessar Ovitrampas →
                </button>
              </div>
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
