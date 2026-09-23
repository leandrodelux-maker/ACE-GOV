import React, { useCallback, useEffect, useState } from 'react';
import { Users, TrendingUp, Clock, Calendar, Search, RefreshCw, Home, UserCheck, Zap } from 'lucide-react';
import {
  agentProductivityService,
  AgentProductivityMetric,
  TeamProductivityMetric,
} from '../../services/agentProductivityService';
import { epidemiologicalWeekService } from '../../services/epidemiologicalWeekService';
import { PageHeader } from '../ui';
import { useMunicipalityId } from '../../contexts/AuthContext';

/**
 * Produtividade dos ACE — acompanhamento técnico não punitivo, calculado apenas
 * com as visitas e pendências registradas no município.
 */
export const AgentProductivityView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const [agents, setAgents] = useState<AgentProductivityMetric[]>([]);
  const [teams, setTeams] = useState<TeamProductivityMetric[]>([]);
  const [periodLabel, setPeriodLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'AGENTS' | 'TEAMS'>('AGENTS');
  const [searchFilter, setSearchFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('TODAS');

  const currentSE = epidemiologicalWeekService.getEpidemiologicalWeek();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const report = await agentProductivityService.getProductivity(municipalityId);
      setAgents(report.agents);
      setTeams(report.teams);
      setPeriodLabel(report.periodLabel);
      setLoadError(report.error ? 'Não foi possível carregar a produtividade dos agentes.' : null);
    } catch (err) {
      console.error('Erro ao carregar métricas de produtividade:', err);
      setLoadError('Não foi possível carregar a produtividade dos agentes.');
    } finally {
      setLoading(false);
    }
  }, [municipalityId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const term = searchFilter.toLowerCase();
  const filteredAgents = agents.filter(
    (a) =>
      (a.agentName.toLowerCase().includes(term) || a.agentCode.toLowerCase().includes(term)) &&
      (teamFilter === 'TODAS' || a.teamName === teamFilter)
  );

  const totalVisits = agents.reduce((acc, a) => acc + a.totalVisits, 0);
  const totalWorked = agents.reduce((acc, a) => acc + a.workedProperties, 0);
  const totalPending = agents.reduce((acc, a) => acc + a.pendingReturns, 0);
  const totalFoci = agents.reduce((acc, a) => acc + a.fociFound, 0);
  const totalFociEliminated = agents.reduce((acc, a) => acc + a.fociEliminated, 0);
  const totalWorkDays = agents.reduce((acc, a) => acc + a.workDays, 0);
  const avgDaily = totalWorkDays > 0 ? (totalWorked / totalWorkDays).toFixed(1) : null;
  const show = (v: React.ReactNode) => (loading ? '...' : loadError ? '—' : v);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Produtividade dos Agentes (ACE)"
        subtitle="Acompanhamento técnico não punitivo com base nas visitas registradas"
        actions={
          <>
            <div className="bg-emerald-50 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 text-xs">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>
                SE {currentSE.week}/{currentSE.year}
              </span>
            </div>
            <button
              onClick={loadData}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              aria-label="Atualizar dados de produtividade"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      {periodLabel && !loadError && <p className="text-xs text-slate-500">Período analisado: {periodLabel}.</p>}
      {loadError && (
        <div role="alert" className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Média Diária / ACE</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-2xl font-black text-slate-900">{show(avgDaily ?? 'Sem dados')}</span>
          <p className="mt-1 text-[11px] text-slate-500">imóveis trabalhados por dia com visita</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Visitas no Período</span>
            <Home className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-black text-slate-900">{show(totalVisits)}</span>
          <p className="mt-1 text-[11px] text-slate-500">{show(`${totalWorked} imóveis trabalhados`)}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Retornos Pendentes</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl font-black text-amber-600">{show(totalPending)}</span>
          <p className="mt-1 text-[11px] text-slate-500">imóveis fechados ou recusados a resgatar</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Focos Encontrados</span>
            <Zap className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-2xl font-black text-rose-600">{show(totalFoci)}</span>
          <p className="mt-1 text-[11px] text-slate-500">{show(`${totalFociEliminated} tratados ou eliminados`)}</p>
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2" role="tablist">
          {(['AGENTS', 'TEAMS'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === tab ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'AGENTS' ? `Por ACE (${agents.length})` : `Por Equipe (${teams.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'AGENTS' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar agente ou matrícula..."
                aria-label="Buscar agente"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 w-48 sm:w-60 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              aria-label="Filtrar por equipe"
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="TODAS">Todas as Equipes</option>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamName}>
                  {t.teamName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === 'AGENTS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Quadro Operacional dos Agentes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Agente / Matrícula</th>
                  <th className="py-2.5 px-3">Equipe</th>
                  <th className="py-2.5 px-3 text-center">Visitas</th>
                  <th className="py-2.5 px-3 text-center">Trabalhados</th>
                  <th className="py-2.5 px-3 text-center">Fechados / Recusas</th>
                  <th className="py-2.5 px-3 text-center">Focos</th>
                  <th className="py-2.5 px-3 text-center">Média/Dia</th>
                  <th className="py-2.5 px-3 text-center">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400" role="status">
                      Carregando...
                    </td>
                  </tr>
                ) : filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      {loadError ? 'Não foi possível carregar.' : agents.length === 0 ? 'Sem agentes ativos registrados no município.' : 'Nenhum agente corresponde aos filtros.'}
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => (
                    <tr key={agent.agentId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{agent.agentName}</div>
                        {agent.agentCode && <span className="font-mono text-[10px] text-slate-500 font-semibold">{agent.agentCode}</span>}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700">{agent.teamName}</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">{agent.totalVisits}</td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-700 bg-emerald-50/40">{agent.workedProperties}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-amber-700 font-bold">{agent.closedProperties}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-rose-700 font-bold">{agent.refusedProperties}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {agent.fociFound > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700">{agent.fociFound}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-800">{agent.dailyAverage ?? '—'}</td>
                      <td className="py-3 px-3 text-center">
                        {agent.workloadStatus === 'REGULAR' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Regular</span>
                        )}
                        {agent.workloadStatus === 'COM_PENDENCIAS' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Pendências ({agent.pendingReturns})
                          </span>
                        )}
                        {agent.workloadStatus === 'SEM_VISITAS' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">Sem visitas no período</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'TEAMS' &&
        (teams.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
            {loading ? 'Carregando...' : loadError ? 'Não foi possível carregar.' : 'Sem equipes registradas no município.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((team) => (
              <div key={team.teamId} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{team.teamName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Supervisor: {team.supervisorName || 'Não designado'}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 whitespace-nowrap">
                    {team.agentsCount} agente(s)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Visitas</span>
                    <div className="text-lg font-black text-slate-900 mt-0.5">{team.totalVisits}</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Trabalhados</span>
                    <div className="text-lg font-black text-emerald-700 mt-0.5">{team.workedProperties}</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Focos</span>
                    <div className="text-lg font-black text-rose-600 mt-0.5">{team.fociCount}</div>
                  </div>
                </div>
                <p className="pt-2 border-t border-slate-100 text-xs text-slate-500">
                  Pendências a resgatar: <strong className="text-amber-700">{team.pendingCount}</strong>
                </p>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
};
