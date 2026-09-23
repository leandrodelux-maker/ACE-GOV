import React, { useState, useEffect } from 'react';
import {
  Users,
  Home,
  Calendar,
  MapPin,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  CheckCircle2,
  Phone,
  Radio,
  Send,
  WifiOff,
  Flame,
  FileText,
  Shield,
  Check,
} from 'lucide-react';
import {
  supervisorService,
  SupervisorAgentSummary,
  SupervisorDashboardData,
  FieldSupervision,
} from '../../services/supervisorService';
import { useAuth } from '../../contexts/AuthContext';
import { alertsService, AlertNotificationItem } from '../../services/alertsService';

interface SupervisorMobileViewProps {
  municipalityId?: string;
}

export const SupervisorMobileView: React.FC<SupervisorMobileViewProps> = ({ municipalityId }) => {
  const { user: sessionUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'equipe' | 'planejamento' | 'mapa' | 'supervisao'>('home');
  const [dashboard, setDashboard] = useState<SupervisorDashboardData>({
    agentsInField: null,
    agentsWithoutVisitToday: null,
    visitsToday: null,
    pendingReturns: null,
    openOrdersCount: null,
    criticalAlertsCount: null,
  });
  const fmt = (v: number | null) => (v === null ? '—' : v);
  const [agents, setAgents] = useState<SupervisorAgentSummary[]>([]);
  const [supervisions, setSupervisions] = useState<FieldSupervision[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states para supervisão de campo
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [supervisionActivity, setSupervisionActivity] = useState('Vistoria Peridomiciliar PNCD');
  const [supervisionResult, setSupervisionResult] = useState<'conforme' | 'orientacao' | 'inconsistencia' | 'retorno'>('conforme');
  const [supervisionNotes, setSupervisionNotes] = useState('');

  // Mensagem de feedback
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [openAlerts, setOpenAlerts] = useState<AlertNotificationItem[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashData, agentsList, supList, alertList] = await Promise.all([
        supervisorService.getSupervisorDashboard(municipalityId),
        supervisorService.getTeamAgents(municipalityId),
        supervisorService.getSupervisions(municipalityId),
        alertsService.getAlerts(municipalityId),
      ]);
      setDashboard(dashData);
      setOpenAlerts(alertList.filter((a) => !a.acknowledged).slice(0, 3));
      setAgents(agentsList);
      setSupervisions(supList);
      if (agentsList.length > 0) {
        setSelectedAgentId(agentsList[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [municipalityId]);

  const handleSaveSupervision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !sessionUser?.id) return;

    const res = await supervisorService.registerSupervision({
      municipalityId,
      supervisorId: sessionUser.id, // perfil do supervisor autenticado
      agentId: selectedAgentId,
      activityType: supervisionActivity,
      result: supervisionResult,
      notes: supervisionNotes,
    });

    if (res.success) {
      setFeedbackMsg('Supervisão registrada com sucesso!');
      setSupervisionNotes('');
      setTimeout(() => setFeedbackMsg(''), 3500);
      loadData();
    } else {
      alert(`Erro: ${res.error}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">
      {/* Top Banner Mobile-first */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 rounded-2xl shadow-md">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
              Modo Supervisor Mobile
            </span>
            <h1 className="text-lg font-bold mt-1">Supervisão de Campo</h1>
            <p className="text-xs text-teal-100">Equipe 02 • Coordenação Sul</p>
          </div>
          <div className="flex items-center gap-1 bg-emerald-700/60 px-3 py-1.5 rounded-xl border border-emerald-500/30 text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
            <span>Operação Ativa</span>
          </div>
        </div>

        {/* Mini status bar */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10 text-center">
          <div>
            <span className="text-base font-extrabold">{fmt(dashboard.agentsInField)}</span>
            <p className="text-[10px] text-teal-200">ACE em Campo</p>
          </div>
          <div>
            <span className="text-base font-extrabold">{fmt(dashboard.visitsToday)}</span>
            <p className="text-[10px] text-teal-200">Visitas Hoje</p>
          </div>
          <div>
            <span className="text-base font-extrabold text-amber-300">{fmt(dashboard.pendingReturns)}</span>
            <p className="text-[10px] text-teal-200">Pendências</p>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {feedbackMsg}
        </div>
      )}

      {/* Navegação Mobile Inferior / Abas */}
      <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs justify-between gap-1">
        {[
          { id: 'home', label: 'Início', icon: Home },
          { id: 'equipe', label: 'Equipe', icon: Users },
          { id: 'planejamento', label: 'Planejamento', icon: Calendar },
          { id: 'mapa', label: 'Mapa', icon: MapPin },
          { id: 'supervisao', label: 'Supervisão', icon: ClipboardCheck },
        ].map(tab => {
          const Icon = tab.icon;
          const isSel = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg text-[11px] font-semibold transition-colors ${
                isSel
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* CONTEÚDO DA ABA: HOME */}
      {activeTab === 'home' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-xs text-slate-500">Ordens de Serviço</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {fmt(dashboard.openOrdersCount)}
              </div>
              <p className="text-[10px] text-blue-600 mt-1 font-semibold">Abertas no município</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-xs text-slate-500">Alertas Críticos</span>
              <div className="text-2xl font-bold text-rose-600 mt-1">
                {fmt(dashboard.criticalAlertsCount)}
              </div>
              <p className="text-[10px] text-rose-500 mt-1 font-semibold">Sem ciência registrada</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Alertas pendentes de ciência
            </h3>
            <div className="space-y-2">
              {openAlerts.length === 0 ? (
                <p className="text-xs text-slate-500">Sem alertas pendentes de ciência no município.</p>
              ) : (
                openAlerts.map((al) => (
                  <div
                    key={al.id}
                    className={`p-3 rounded-lg border text-xs ${
                      al.severity === 'CRITICO'
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                      {al.severity === 'CRITICO' ? <Flame className="w-4 h-4 text-rose-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                      {al.title}
                    </div>
                    {al.description && <p className="text-slate-600 dark:text-slate-400 mt-1">{al.description}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: EQUIPE */}
      {activeTab === 'equipe' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              ACEs da Equipe ({agents.length})
            </h3>
            <span className="text-[11px] text-slate-500">Sem rastreamento invasivo</span>
          </div>

          <div className="space-y-2.5">
            {agents.map(ag => (
              <div
                key={ag.id}
                className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{ag.name}</h4>
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                        {ag.registrationNumber}
                      </span>
                    </div>

                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ag.status === 'em_campo'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {ag.status === 'em_campo' ? 'Com visitas hoje' : 'Sem visitas hoje'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-center text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{ag.visitsToday}</span>
                    <p className="text-[10px] text-slate-400">Visitas Hoje</p>
                  </div>
                  <div>
                    <span className="font-bold text-amber-600">{ag.pendingReturns}</span>
                    <p className="text-[10px] text-slate-400">Pendências</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600 dark:text-slate-300 text-[11px]">
                      {ag.lastVisitAt ? new Date(ag.lastVisitAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                    <p className="text-[10px] text-slate-400">Última visita</p>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <a
                    href={`tel:${ag.phone}`}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {ag.phone}
                  </a>

                  <button
                    onClick={() => {
                      setSelectedAgentId(ag.id);
                      setActiveTab('supervisao');
                    }}
                    className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                  >
                    Supervisionar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: PLANEJAMENTO */}
      {activeTab === 'planejamento' && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            Redistribuição Operacional & Ajustes
          </h3>
          <p className="text-xs text-slate-500">
            Realoque ordens de serviço, quadras prioritárias ou pendências sem burocracia:
          </p>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">OS-END-2026-00001 (Bloqueio)</span>
                <p className="text-slate-500 mt-0.5">Bairro Universitário • Quadra 14</p>
              </div>
              <button
                onClick={() => alert('Ordem de Serviço redistribuída para o ACE com maior disponibilidade.')}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold"
              >
                Redistribuir
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">8 Visitas Pendentes (Fechados)</span>
                <p className="text-slate-500 mt-0.5">Reagendamento para o sábado ou retorno no fim de tarde</p>
              </div>
              <button
                onClick={() => alert('Pendências reagendadas para retorno supervisionado.')}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold"
              >
                Aprovar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: MAPA */}
      {activeTab === 'mapa' && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Visão Territorial da Equipe
          </h3>
          <p className="text-xs text-slate-500">
            Focos ativos, pontos estratégicos e setores sob acompanhamento:
          </p>

          <div className="h-64 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center p-4 text-center">
            <MapPin className="w-10 h-10 text-emerald-600 mb-2 animate-bounce" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              3 Focos Ativos • 2 Bloqueios Operacionais • 8 Pendências
            </span>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
              Mapeamento georreferenciado integrado com as rotas de campo e limites dos setores.
            </p>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: SUPERVISÃO */}
      {activeTab === 'supervisao' && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-600" />
            Registrar Supervisão de Campo
          </h3>

          <form onSubmit={handleSaveSupervision} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Agente Supervisionado
              </label>
              <select
                value={selectedAgentId}
                onChange={e => setSelectedAgentId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white"
              >
                {agents.map(ag => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name} ({ag.registrationNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Atividade Acompanhada
              </label>
              <input
                type="text"
                value={supervisionActivity}
                onChange={e => setSupervisionActivity(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Resultado da Supervisão
              </label>
              <select
                value={supervisionResult}
                onChange={e => setSupervisionResult(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white"
              >
                <option value="conforme">Conforme (Padrão Técnico SUS)</option>
                <option value="orientacao">Orientação Técnica Prestada</option>
                <option value="inconsistencia">Inconsistência Detectada</option>
                <option value="retorno">Necessidade de Retorno ao Imóvel</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Observações / Orientações Fornecidas
              </label>
              <textarea
                value={supervisionNotes}
                onChange={e => setSupervisionNotes(e.target.value)}
                rows={3}
                placeholder="Ex: Reforçada a necessidade de inspecionar calhas e caixas d'água no fundo do quintal..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Salvar Supervisão
            </button>
          </form>

          {/* Histórico recente de supervisões */}
          {supervisions.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Supervisões Recentes
              </span>
              {supervisions.slice(0, 3).map(s => (
                <div
                  key={s.id}
                  className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-700 text-[11px]"
                >
                  <div className="flex justify-between font-bold">
                    <span>{s.agentName || 'Agente'}</span>
                    <span className="capitalize text-emerald-700 dark:text-emerald-400">{s.result}</span>
                  </div>
                  <p className="text-slate-500 mt-0.5">{s.notes}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
