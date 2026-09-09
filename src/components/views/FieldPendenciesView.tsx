import React, { useState, useEffect } from 'react';
import {
  Clock,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  RotateCcw,
  UserCheck,
  Users,
  Calendar,
  Search,
  Filter,
  Printer,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  MapPin,
  RefreshCw,
  Home
} from 'lucide-react';
import {
  pendencyManagementService,
  PendingVisitItem,
  PendencyIndicators,
} from '../../services/pendencyManagementService';

export const FieldPendenciesView: React.FC = () => {
  const [indicators, setIndicators] = useState<PendencyIndicators>({
    totalCycleClosed: 0,
    totalCycleRefusals: 0,
    totalRecovered: 0,
    stillPending: 0,
    recoveryRate: 0,
    criticalPendingCount: 0,
  });

  const [pendencies, setPendencies] = useState<PendingVisitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'todos' | 'fechados' | 'recusas' | 'retornos' | 'nao_localizados' | 'criticas' | 'recuperados'>('fechados');
  const [search, setSearch] = useState('');

  // Modais de Reatribuição e Agendamento
  const [selectedPendency, setSelectedPendency] = useState<PendingVisitItem | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [recoveryRoute, setRecoveryRoute] = useState<PendingVisitItem[]>([]);

  // Dados do formulário
  const [reassignAgentId, setReassignAgentId] = useState('');
  const [newReturnDate, setNewReturnDate] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [ind, list] = await Promise.all([
        pendencyManagementService.getIndicators(),
        pendencyManagementService.getPendingVisits({
          filterType: activeTab,
          limit: 150,
        }),
      ]);

      setIndicators(ind);
      setPendencies(list);
    } catch (err) {
      console.error('Erro ao carregar pendências:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPendency) return;

    const res = await pendencyManagementService.reassignPendency(selectedPendency.id, {
      agentId: reassignAgentId || undefined,
      notes: actionNotes,
      nextReturnDate: newReturnDate || undefined,
    });

    if (res.success) {
      alert(res.message);
      setShowReassignModal(false);
      setSelectedPendency(null);
      loadData();
    } else {
      alert(res.message);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPendency || !newReturnDate) {
      alert('Informe a data do próximo retorno.');
      return;
    }

    const res = await pendencyManagementService.scheduleReturn(selectedPendency.id, newReturnDate, actionNotes);
    if (res.success) {
      alert(res.message);
      setShowScheduleModal(false);
      setSelectedPendency(null);
      loadData();
    } else {
      alert(res.message);
    }
  };

  const handleGenerateRecoveryRoute = async () => {
    const route = await pendencyManagementService.generateRecoveryRoute({ maxProperties: 30 });
    setRecoveryRoute(route);
    setShowRouteModal(true);
  };

  const filteredList = pendencies.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const propCode = p.property?.property_code?.toLowerCase() || '';
    const street = p.property?.street?.toLowerCase() || '';
    const agent = p.responsible_agent?.name?.toLowerCase() || '';
    return propCode.includes(term) || street.includes(term) || agent.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wider">
              OPERACIONAL
            </span>
            <span className="text-xs text-slate-400">• Gestão de Cobertura e Desfechos</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <Clock className="w-7 h-7 text-rose-400" />
            Pendências de Campo & Recuperação de Fechados
          </h1>
          <p className="text-sm text-slate-400">
            Monitoramento de imóveis fechados, recusas, agendamento de retornos e recuperação automática por novas visitas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium border border-slate-700 flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
            <span>Atualizar</span>
          </button>
          <button
            onClick={handleGenerateRecoveryRoute}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-rose-900/30 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Roteiro de Recuperação</span>
          </button>
        </div>
      </div>

      {/* Alerta de Pendências Críticas */}
      {indicators.criticalPendingCount > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-rose-200">
                Atenção: {indicators.criticalPendingCount} imóveis com excesso de tentativas sem sucesso (≥ 3 visitas)
              </h3>
              <p className="text-xs text-rose-300/80">
                Recomenda-se designar uma Equipe Especial de Recuperação ou agendamento em horário diferenciado (noturno/sábado).
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('criticas')}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition"
          >
            Ver Críticas
          </button>
        </div>
      )}

      {/* Cards de Indicadores Reais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Fechados no Ciclo</span>
            <Home className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{indicators.totalCycleClosed}</span>
            <span className="text-xs text-amber-400 font-medium">imóveis</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Ausência de morador</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Recusas</span>
            <XCircle className="w-5 h-5 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400">{indicators.totalCycleRefusals}</span>
            <span className="text-xs text-slate-400">imóveis</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Entrada impedida</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Recuperados</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{indicators.totalRecovered}</span>
            <span className="text-xs text-emerald-400 font-medium">com sucesso</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Baixa automática por visita</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ainda Pendentes</span>
            <Clock className="w-5 h-5 text-orange-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-orange-400">{indicators.stillPending}</span>
            <span className="text-xs text-slate-400">em aberto</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Aguardando retorno</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Taxa de Recuperação</span>
            <TrendingUp className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{indicators.recoveryRate}%</span>
          </div>
          <div className="w-full bg-slate-700/50 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, indicators.recoveryRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs e Busca */}
      <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'fechados', label: 'Fechados' },
              { id: 'recusas', label: 'Recusas' },
              { id: 'retornos', label: 'Retornos Agendados' },
              { id: 'nao_localizados', label: 'Não Localizados' },
              { id: 'criticas', label: 'Pendências Críticas (≥3)' },
              { id: 'recuperados', label: 'Recuperados' },
              { id: 'todos', label: 'Todas as Abertas' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  activeTab === tab.id
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar código, rua ou ACE..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Pendências */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/60 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Imóvel / Endereço</th>
                <th className="py-3 px-4">Motivo da Pendência</th>
                <th className="py-3 px-4">Tentativas</th>
                <th className="py-3 px-4">1ª Tentativa</th>
                <th className="py-3 px-4">Última Tentativa</th>
                <th className="py-3 px-4">Próximo Retorno</th>
                <th className="py-3 px-4">ACE Responsável</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhuma pendência encontrada para esta categoria.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-700/30 transition">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-emerald-400">
                        {item.property?.property_code}
                      </div>
                      <div className="text-white font-medium text-xs">
                        {item.property?.street}, {item.property?.number}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {item.property?.neighborhood?.name} • {item.property?.sector?.code ? `Setor ${item.property.sector.code}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          item.reason === 'fechado'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : item.reason === 'recusa'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}
                      >
                        {item.reason}
                      </span>
                      {item.status === 'recuperado' && (
                        <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Recuperado
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          (item.attempt_count || 1) >= 3
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-slate-700 text-slate-200'
                        }`}
                      >
                        {item.attempt_count || 1}ª vez
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">
                      {item.first_attempt_date ? new Date(item.first_attempt_date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">
                      {item.last_attempt_date ? new Date(item.last_attempt_date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {item.next_return_date ? (
                        <span className="text-cyan-400 font-medium flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(item.next_return_date).toLocaleDateString('pt-BR')}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Não agendado</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-200">
                      {item.responsible_agent?.name || item.assigned_agent?.name || 'Não atribuído'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedPendency(item);
                            setNewReturnDate(item.next_return_date || '');
                            setShowScheduleModal(true);
                          }}
                          className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 rounded transition"
                          title="Agendar Retorno"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPendency(item);
                            setReassignAgentId(item.responsible_agent_id || '');
                            setShowReassignModal(true);
                          }}
                          className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 rounded transition"
                          title="Reatribuir ACE / Equipe Especial"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Reatribuir Pendência */}
      {showReassignModal && selectedPendency && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              Reatribuir Pendência de Campo
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Imóvel {selectedPendency.property?.property_code} • {selectedPendency.property?.street}, {selectedPendency.property?.number}
            </p>

            <form onSubmit={handleReassignSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Destinar para:</label>
                <select
                  value={reassignAgentId}
                  onChange={(e) => setReassignAgentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Manter mesmo ACE original</option>
                  <option value="equipe_especial">Equipe Especial de Recuperação de Fechados</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Data do Retorno Agendado</label>
                <input
                  type="date"
                  value={newReturnDate}
                  onChange={(e) => setNewReturnDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Instruções para a recuperação</label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Ex: Tentar visita após as 17h ou no sábado pela manhã..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
                >
                  Salvar Atribuição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Agendar Retorno */}
      {showScheduleModal && selectedPendency && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              Agendar Nova Tentativa de Retorno
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Imóvel {selectedPendency.property?.property_code} • Motivo: <span className="capitalize">{selectedPendency.reason}</span>
            </p>

            <form onSubmit={handleScheduleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Data Prevista de Retorno *</label>
                <input
                  type="date"
                  required
                  value={newReturnDate}
                  onChange={(e) => setNewReturnDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Observações do Agendamento</label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Informações do vizinho, melhor horário, etc..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Roteiro de Recuperação de Fechados */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-3xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-rose-400" />
                  Roteiro Prioritário de Recuperação de Fechados
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Lista ordenada por criticidade de tentativas e proximidade de agendamento ({recoveryRoute.length} imóveis).
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Ficha</span>
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {recoveryRoute.map((item, idx) => (
                <div key={item.id} className="p-3 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-400 font-mono">#{idx + 1} {item.property?.property_code}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold capitalize">
                        {item.reason}
                      </span>
                      <span className="text-xs text-rose-400 font-semibold font-mono">
                        {item.attempt_count}ª tentativa
                      </span>
                    </div>
                    <div className="text-sm font-medium text-white mt-1">
                      {item.property?.street}, {item.property?.number}
                    </div>
                    <div className="text-xs text-slate-400">
                      {item.property?.neighborhood?.name} • Setor: {item.property?.sector?.code || 'S/N'}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-cyan-400 font-medium block">
                      Retorno: {item.next_return_date ? new Date(item.next_return_date).toLocaleDateString('pt-BR') : 'Imediato'}
                    </span>
                    <span className="text-xs text-slate-400 block mt-1">
                      {item.responsible_agent?.name || 'Sem ACE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowRouteModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
