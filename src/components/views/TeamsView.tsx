import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  TrendingUp,
  Activity,
  CheckCircle,
  Briefcase,
  Layers,
  Search,
  Filter,
  RefreshCw,
  X,
} from 'lucide-react';
import { teamService, TeamEntity } from '../../services/teamService';
import { OperationalLoadAgent } from '../../types';
import { PageHeader, StatCard } from '../ui';

export const TeamsView: React.FC = () => {
  const [teams, setTeams] = useState<TeamEntity[]>([]);
  const [loadData, setLoadData] = useState<OperationalLoadAgent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newTeamName, setNewTeamName] = useState<string>('');
  const [newTeamCode, setNewTeamCode] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [fetchedTeams, fetchedLoads] = await Promise.all([
        teamService.getTeams(),
        teamService.getOperationalLoad(),
      ]);
      setTeams(fetchedTeams);
      setLoadData(fetchedLoads);
    } catch (err) {
      console.error('Erro ao carregar equipes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setSubmitting(true);
    try {
      const success = await teamService.createTeam({
        name: newTeamName.trim(),
        code: newTeamCode.trim() || undefined,
      });
      if (success) {
        setNewTeamName('');
        setNewTeamCode('');
        setIsModalOpen(false);
        await loadAll();
      } else {
        alert('Não foi possível registrar a equipe no banco.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLoads = loadData.filter(item => {
    const matchesFilter =
      filterCategory === 'ALL' || item.loadCategory === filterCategory;
    const matchesSearch =
      item.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.agentId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const overloadedCount = loadData.filter(i => i.loadCategory === 'SOBRECARREGADA').length;
  const balancedCount = loadData.filter(i => i.loadCategory === 'EQUILIBRADA').length;
  const avgLoad = loadData.length > 0
    ? Math.round(loadData.reduce((acc, curr) => acc + curr.operationalLoadIndex, 0) / loadData.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={Users}
        title="Equipes de Campo & Carga Operacional dos Agentes (ACE)"
        subtitle="Dimensionamento da força de trabalho, balanceamento de microáreas e sincronização com banco de dados"
        actions={
          <>
            <button
              onClick={loadAll}
              disabled={loading}
              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition border border-slate-200"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Equipe</span>
            </button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard tone="info" icon={Layers} label="Equipes Ativas" value={teams.length} caption="Conectadas via Supabase" />
        <StatCard tone="info" icon={Users} label="ACEs Monitorados" value={loadData.length} caption="Força de campo em operação" />
        <StatCard tone="danger" icon={AlertTriangle} label="Em Sobrecarga (>75%)" value={overloadedCount} caption="Requer remanejamento de rota" />
        <StatCard tone="success" icon={Activity} label="Carga Operacional Média" value={`${avgLoad}%`} caption={`${balancedCount} com carga equilibrada`} />
      </div>

      {/* Grid de Equipes */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-blue-600" />
          <span>Equipes Operacionais Cadastradas</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(team => (
            <div key={team.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {team.code || 'EQUIPE'}
                  </span>
                  <h4 className="font-bold text-sm text-slate-900 mt-1.5">{team.name}</h4>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${team.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-600 space-y-1">
                <p><span className="text-slate-400">Supervisor:</span> <strong className="text-slate-700">{team.supervisor_name}</strong></p>
                <p><span className="text-slate-400">Efetivo Alocado:</span> <strong className="text-slate-700">{team.member_count || 0} agentes</strong></p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela de Carga Operacional */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Índice de Carga Operacional por Agente de Combate às Endemias
            </h3>
            <span className="text-[11px] text-slate-500">
              Ponderação: Visitas (30%) + Extensão/Rural (20%) + Pendências (20%) + Focos (20%) + Bloqueios (10%)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar agente ou equipe..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => setFilterCategory('ALL')}
                className={`px-2 py-1 rounded-md transition ${filterCategory === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterCategory('SOBRECARREGADA')}
                className={`px-2 py-1 rounded-md transition ${filterCategory === 'SOBRECARREGADA' ? 'bg-rose-50 text-rose-700 font-bold shadow-xs' : 'text-slate-600'}`}
              >
                Sobrecarga
              </button>
              <button
                onClick={() => setFilterCategory('MODERADA')}
                className={`px-2 py-1 rounded-md transition ${filterCategory === 'MODERADA' ? 'bg-amber-50 text-amber-700 font-bold shadow-xs' : 'text-slate-600'}`}
              >
                Moderada
              </button>
              <button
                onClick={() => setFilterCategory('EQUILIBRADA')}
                className={`px-2 py-1 rounded-md transition ${filterCategory === 'EQUILIBRADA' ? 'bg-emerald-50 text-emerald-700 font-bold shadow-xs' : 'text-slate-600'}`}
              >
                Equilibrada
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Agente (ACE)</th>
                <th className="py-3 px-4">Equipe / Zona</th>
                <th className="py-3 px-4">Visitas / Cobertura</th>
                <th className="py-3 px-4">Pendências</th>
                <th className="py-3 px-4">Focos Encontrados</th>
                <th className="py-3 px-4">Índice de Carga</th>
                <th className="py-3 px-4 text-right">Status Carga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLoads.map(item => {
                const isOverloaded = item.loadCategory === 'SOBRECARREGADA';
                const isBalanced = item.loadCategory === 'EQUILIBRADA';

                return (
                  <tr key={item.agentId} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                          {item.agentName.charAt(0)}
                        </div>
                        <div>
                          <p>{item.agentName}</p>
                          <span className="text-[10px] text-slate-400 font-normal">Matrícula: {item.agentId}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {item.teamName} {item.ruralArea && <span className="text-amber-700 font-bold ml-1">(Zona Rural)</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-semibold">
                      {item.totalVisits} visitas ({item.coveragePercentage}%)
                    </td>
                    <td className="py-3 px-4 text-amber-700 font-semibold">{item.pendingReturns}</td>
                    <td className="py-3 px-4 text-rose-600 font-bold">{item.fociFound}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">{item.operationalLoadIndex}%</span>
                        <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.operationalLoadIndex > 75
                                ? 'bg-rose-500'
                                : item.operationalLoadIndex > 50
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${item.operationalLoadIndex}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`px-2.5 py-0.5 rounded font-extrabold text-[10px] ${
                          isOverloaded
                            ? 'bg-rose-100 text-rose-700'
                            : isBalanced
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.loadCategory}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredLoads.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nenhum agente encontrado para o filtro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Equipe */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Cadastrar Nova Equipe de Campo
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Equipe *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Equipe Épsilon - Leste"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Código Identificador (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: EQ-07"
                  value={newTeamCode}
                  onChange={e => setNewTeamCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Salvar no Banco
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
