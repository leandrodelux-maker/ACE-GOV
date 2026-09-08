import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Filter,
  BarChart3,
  Shield,
  Search,
  ArrowUpRight,
  HelpCircle,
  Award,
  RefreshCw,
  Home,
  UserCheck,
  Zap,
} from 'lucide-react';
import { agentProductivityService, AgentProductivityMetric, TeamProductivityMetric } from '../../services/agentProductivityService';
import { epidemiologicalWeekService } from '../../services/epidemiologicalWeekService';

export const AgentProductivityView: React.FC = () => {
  const [agents, setAgents] = useState<AgentProductivityMetric[]>([]);
  const [teams, setTeams] = useState<TeamProductivityMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'AGENTS' | 'TEAMS' | 'MICROAREAS'>('AGENTS');
  const [searchFilter, setSearchFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('TODAS');
  const [supportModalAgent, setSupportModalAgent] = useState<AgentProductivityMetric | null>(null);
  const [supportMessage, setSupportMessage] = useState('');

  const currentSE = epidemiologicalWeekService.getEpidemiologicalWeek();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [agentList, teamList] = await Promise.all([
        agentProductivityService.getAgentMetrics(),
        agentProductivityService.getTeamMetrics(),
      ]);
      setAgents(agentList);
      setTeams(teamList);
    } catch (err) {
      console.error('Erro ao carregar métricas de produtividade:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter(a => {
    const matchesSearch =
      a.agentName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.agentCode.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.assignedArea.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesTeam = teamFilter === 'TODAS' || a.teamName === teamFilter;
    return matchesSearch && matchesTeam;
  });

  // KPIs agregados municipais
  const totalVisits = agents.reduce((acc, curr) => acc + curr.totalVisits, 0);
  const totalWorked = agents.reduce((acc, curr) => acc + curr.workedProperties, 0);
  const totalPending = agents.reduce((acc, curr) => acc + curr.pendingReturns, 0);
  const totalFoci = agents.reduce((acc, curr) => acc + curr.fociFound, 0);
  const avgDailyVisits = agents.length > 0 ? (totalWorked / (agents.length * 5)).toFixed(1) : '0';
  const overallCoverage = agents.length > 0 ? ((totalWorked / (agents.length * 150)) * 100).toFixed(1) : '0';

  const handleOpenSupport = (agent: AgentProductivityMetric) => {
    setSupportModalAgent(agent);
    setSupportMessage(`Solicitação de apoio operacional e redistribuição de microárea para ${agent.agentName} (${agent.agentCode}) em ${agent.assignedArea}.`);
  };

  const handleConfirmSupport = () => {
    alert(`Plano de apoio registrado com sucesso para a microárea de ${supportModalAgent?.agentName}! O supervisor foi notificado para remanejamento compartilhado.`);
    setSupportModalAgent(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Institucional */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>Gestão Operacional de Produtividade dos Agentes (ACE)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhamento técnico não punitivo: equilíbrio de carga de trabalho, cobertura de ciclo e apoio às microáreas
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="bg-emerald-50 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>SE {currentSE.week}/{currentSE.year} (Ciclo I - 2026)</span>
          </div>
          <button
            onClick={loadData}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            title="Atualizar dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Cards de Indicadores Globais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Média Diária */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Média Diária / ACE</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{avgDailyVisits}</span>
            <span className="text-xs text-slate-500">imóveis/dia</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Meta técnica recomendada: 20-25 imóveis/dia</span>
          </div>
        </div>

        {/* Card 2: Cobertura Global */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cobertura do Ciclo</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Home className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{overallCoverage}%</span>
            <span className="text-xs text-slate-500">({totalWorked} visitados)</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
            <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${Math.min(100, Number(overallCoverage))}%` }} />
          </div>
        </div>

        {/* Card 3: Pendências Acumuladas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Retornos Necessários</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{totalPending}</span>
            <span className="text-xs text-slate-500">imóveis fechados/recusas</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Requer agendamento de retorno em finais de semana ou pós-horário comercial
          </div>
        </div>

        {/* Card 4: Focos Ativos Detectados */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Focos Interrompidos</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600">{totalFoci}</span>
            <span className="text-xs text-slate-500">criadouros positivos tratados</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-700 font-medium">
            100% dos focos eliminados com aplicação mecânica/larvicida
          </div>
        </div>
      </div>

      {/* Seletor de Abas & Filtros */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('AGENTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'AGENTS' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Visão Individual por ACE ({agents.length})
          </button>
          <button
            onClick={() => setActiveTab('TEAMS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'TEAMS' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Visão Consolidada por Equipe ({teams.length})
          </button>
          <button
            onClick={() => setActiveTab('MICROAREAS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'MICROAREAS' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Diagnóstico de Microáreas Atrasadas
          </button>
        </div>

        {activeTab === 'AGENTS' && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar agente, código ou área..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 w-48 sm:w-60 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <select
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="TODAS">Todas as Equipes</option>
              {teams.map(t => (
                <option key={t.teamId} value={t.teamName}>
                  {t.teamName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ABA 1: VISÃO INDIVIDUAL POR ACE */}
      {activeTab === 'AGENTS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Quadro Operacional de Campo dos Agentes</h2>
            </div>
            <span className="text-xs text-slate-500">
              Exibindo {filteredAgents.length} de {agents.length} agentes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Agente / Matrícula</th>
                  <th className="py-2.5 px-3">Equipe / Supervisor</th>
                  <th className="py-2.5 px-3">Microárea Alocada</th>
                  <th className="py-2.5 px-3 text-center">Visitas Totais</th>
                  <th className="py-2.5 px-3 text-center">Trabalhados</th>
                  <th className="py-2.5 px-3 text-center">Fechados / Recusas</th>
                  <th className="py-2.5 px-3 text-center">Focos</th>
                  <th className="py-2.5 px-3 text-center">Média/Dia</th>
                  <th className="py-2.5 px-3 text-center">% Cobertura</th>
                  <th className="py-2.5 px-3 text-center">Status Carga</th>
                  <th className="py-2.5 px-3 text-right">Apoio Operacional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAgents.map(agent => {
                  return (
                    <tr key={agent.agentId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{agent.agentName}</div>
                        <span className="font-mono text-[10px] text-slate-500 font-semibold">{agent.agentCode}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-700">{agent.teamName}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-slate-600">{agent.assignedArea}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">{agent.totalVisits}</td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-700 bg-emerald-50/40">
                        {agent.workedProperties}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-amber-700 font-bold">{agent.closedProperties}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-rose-700 font-bold">{agent.refusedProperties}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {agent.fociFound > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700">
                            {agent.fociFound} foco(s)
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-800">
                        {agent.dailyAverage}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-bold text-slate-900">{agent.coveragePercentage}%</span>
                          <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-600 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, agent.coveragePercentage)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {agent.workloadStatus === 'REGULAR' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Regular
                          </span>
                        )}
                        {agent.workloadStatus === 'COM_PENDENCIAS' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Pendências ({agent.pendingReturns})
                          </span>
                        )}
                        {agent.workloadStatus === 'SOBRECARREGADO' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            Alta Carga
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleOpenSupport(agent)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition border border-emerald-200"
                        >
                          Apoiar / Remanejar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 2: VISÃO CONSOLIDADA POR EQUIPE */}
      {activeTab === 'TEAMS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map(team => (
            <div key={team.teamId} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{team.teamName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Supervisor: {team.supervisorName}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                  {team.agentsCount} Agentes Ativos
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center pt-2">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Visitas</span>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{team.totalVisits}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Trabalhados</span>
                  <div className="text-lg font-black text-emerald-700 mt-0.5">{team.workedProperties}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Focos Tratados</span>
                  <div className="text-lg font-black text-rose-600 mt-0.5">{team.fociCount}</div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 font-medium mb-1">
                  <span>Cobertura Global do Setor</span>
                  <span>{team.coveragePercentage}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 rounded-full"
                    style={{ width: `${Math.min(100, team.coveragePercentage)}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Pendências a resgatar: <strong className="text-amber-700">{team.pendingCount}</strong></span>
                <span className="text-emerald-700 font-semibold">Operação em ritmo regular</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ABA 3: DIAGNÓSTICO DE MICROÁREAS ATRASADAS */}
      {activeTab === 'MICROAREAS' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Painel de Apoio Preventivo e Diagnóstico de Microáreas com Dificuldade de Acesso
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Este diagnóstico identifica bairros e setores onde o índice de imóveis fechados ou recusas foi superior à média,
            ou onde a extensão territorial exige suporte complementar. O objetivo é a intervenção solidária de equipes volantes
            para garantir que 100% da população seja protegida contra o Aedes aegypti sem sobrecarregar o agente da área.
          </p>

          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <span>Microárea 02 — Centro Comercial (Setor 02)</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                    Alto índice de fechados comerciais
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  18 imóveis fechados durante o horário comercial matutino. Recomenda-se remanejamento de visitação para o início da noite ou sábado.
                </p>
              </div>
              <button
                onClick={() => alert('Mutirão agendado para o sábado pela manhã!')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition whitespace-nowrap"
              >
                Agendar Mutirão Sábado
              </button>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <span>Microárea 04 — Arroio Grande (Setor 04)</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    Extensão periurbana ampla
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Área com chácaras e terrenos baldios extensos. Recomenda-se destacar um segundo ACE para vistoria compartilhada em dupla.
                </p>
              </div>
              <button
                onClick={() => alert('Alocação de dupla de apoio aprovada para Arroio Grande!')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-xs transition whitespace-nowrap"
              >
                Alocar ACE de Apoio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE APOIO / REMANEJAMENTO */}
      {supportModalAgent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>Apoio Operacional & Redistribuição</span>
              </h3>
              <button onClick={() => setSupportModalAgent(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500">Agente: </span>
                <strong className="text-slate-900">{supportModalAgent.agentName} ({supportModalAgent.agentCode})</strong>
              </div>
              <div>
                <span className="text-slate-500">Microárea Atual: </span>
                <span className="font-semibold text-slate-800">{supportModalAgent.assignedArea}</span>
              </div>
              <div>
                <span className="text-slate-500">Pendências de Retorno: </span>
                <span className="font-bold text-amber-700">{supportModalAgent.pendingReturns} imóveis</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Plano de Ação para Equipe de Supervisão:
              </label>
              <textarea
                value={supportMessage}
                onChange={e => setSupportMessage(e.target.value)}
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSupportModalAgent(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSupport}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
              >
                Registrar Apoio da Equipe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
