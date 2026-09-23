import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Users,
  MapPin,
  Flame,
  Crosshair,
  ArrowRight,
  ShieldAlert,
  History,
  FileCheck,
  Send,
  RefreshCw,
  Check,
  Zap,
} from 'lucide-react';
import {
  planningAssistantService,
  PlanningSuggestion,
  ApprovedOperationalPlan,
} from '../../services/planningAssistantService';
import { epidemiologicalWeekService } from '../../services/epidemiologicalWeekService';
import { PageHeader } from '../ui';
import { useMunicipalityId, useAuth } from '../../contexts/AuthContext';

export const PlanningView: React.FC = () => {
  const { user: sessionUser } = useAuth();
  const municipalityId = useMunicipalityId();
  const [suggestions, setSuggestions] = useState<PlanningSuggestion[]>([]);
  const [history, setHistory] = useState<ApprovedOperationalPlan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [targetDate, setTargetDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [activeTab, setActiveTab] = useState<'ASSISTANT' | 'HISTORY'>('ASSISTANT');
  const [successMessage, setSuccessMessage] = useState('');

  const currentSE = epidemiologicalWeekService.getEpidemiologicalWeek();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const list = await planningAssistantService.getPlansHistory(municipalityId);
    setHistory(list);
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setSuccessMessage('');
    try {
      const sugs = await planningAssistantService.generateSuggestedPlan(municipalityId);
      setSuggestions(sugs);
    } catch (err) {
      console.error('Erro ao gerar planejamento:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateAgentCount = (neighborhoodId: string, count: number) => {
    setSuggestions(prev =>
      prev.map(s =>
        s.neighborhoodId === neighborhoodId
          ? {
              ...s,
              recommendedAgentsCount: Math.max(1, count),
              plannedPropertiesCount: Math.max(1, count) * 25,
            }
          : s
      )
    );
  };

  const handleApprovePlan = async () => {
    if (suggestions.length === 0) return;
    setIsApproving(true);
    try {
      const res = await planningAssistantService.approveAndSavePlan(
        suggestions,
        targetDate,
        sessionUser?.name || 'Usuário autenticado',
        municipalityId
      );
      if (res.success) {
        setSuccessMessage(res.message);
        setSuggestions([]);
        await loadHistory();
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        alert(res.message);
      }
    } catch (err) {
      console.error('Erro ao aprovar planejamento:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const getUrgencyBadge = (urgency: PlanningSuggestion['urgencyLevel']) => {
    switch (urgency) {
      case 'URGENTE':
        return <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-rose-100 text-rose-700">🔴 URGENTE</span>;
      case 'ALTA':
        return <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-orange-100 text-orange-800">🟠 ALTA</span>;
      case 'ATENCAO':
        return <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-amber-100 text-amber-800">🟡 ATENÇÃO</span>;
      default:
        return <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-emerald-100 text-emerald-800">🟢 ROTINA</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Institucional */}
      <PageHeader
        icon={Sparkles}
        title="Assistente de Planejamento de Campo & Governança Operacional"
        subtitle="Cruzamento heurístico de risco epidemiológico: Focos Ativos, Notificações Sinan, Pendências e PEs com validação humana"
        actions={
          <div className="bg-indigo-50 text-indigo-800 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 text-xs flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>SE {currentSE.week}/{currentSE.year}</span>
          </div>
        }
      />

      {/* Alerta de Sucesso */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-bold shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Fluxo de Governança Explicado */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px]">1</span>
            <span>Sugestão Heurística</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[11px]">2</span>
            <span>Revisão & Ajuste Humano</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[11px]">3</span>
            <span>Aprovação Formal</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">4</span>
            <span>Distribuição às Rotas</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('ASSISTANT')}
              className={`px-3 py-1.5 rounded-lg font-bold transition text-xs ${
                activeTab === 'ASSISTANT' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Planejamento Assistido
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3 py-1.5 rounded-lg font-bold transition text-xs flex items-center gap-1.5 ${
                activeTab === 'HISTORY' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Versões Aprovadas ({history.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ABA 1: PLANEJAMENTO ASSISTIDO */}
      {activeTab === 'ASSISTANT' && (
        <div className="space-y-4">
          {/* Card de Ação: Gerar Planejamento */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Gerador Heurístico de Ordens de Operação</h3>
                <p className="text-xs text-slate-500">
                  Data alvo da missão de campo:
                  <input
                    type="date"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="ml-2 font-mono font-bold text-slate-800 border border-slate-200 px-2 py-0.5 rounded text-xs"
                  />
                </p>
              </div>
            </div>

            <button
              onClick={handleGeneratePlan}
              disabled={isGenerating}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? 'Calculando Matriz de Risco...' : 'Gerar Planejamento Sugerido'}</span>
            </button>
          </div>

          {/* Sugestões Geradas */}
          {suggestions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>Prioridades Calculadas para o Território ({suggestions.length} Setores Avaliados)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Revise os parâmetros recomendados e faça os ajustes necessários antes de aprovar e emitir as ordens
                  </p>
                </div>

                <button
                  onClick={handleApprovePlan}
                  disabled={isApproving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-2 self-start sm:self-auto"
                >
                  <Check className="w-4 h-4" />
                  <span>{isApproving ? 'Gravando Versão...' : 'Aprovar e Distribuir às Rotas'}</span>
                </button>
              </div>

              <div className="space-y-3">
                {suggestions.map(s => (
                  <div
                    key={s.neighborhoodId}
                    className={`p-4 rounded-xl border transition ${
                      s.urgencyLevel === 'URGENTE'
                        ? 'border-rose-300 bg-rose-50/20'
                        : s.urgencyLevel === 'ALTA'
                        ? 'border-orange-200 bg-orange-50/20'
                        : 'border-slate-200 bg-slate-50/30'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                            {s.priorityRank}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {s.neighborhoodName} ({s.sectorName})
                          </h4>
                          {getUrgencyBadge(s.urgencyLevel)}
                        </div>

                        <p className="text-xs text-slate-600 font-medium">
                          Motivo: <span className="text-slate-800">{s.rationale}</span>
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1 font-mono">
                          <span>Focos Ativos: <strong className="text-rose-600">{s.factors.activeFociCount}</strong></span>
                          <span>•</span>
                          <span>Casos Sinan: <strong className="text-amber-600">{s.factors.epidemiologicalCasesCount}</strong></span>
                          <span>•</span>
                          <span>Retornos Pendentes: <strong className="text-blue-600">{s.factors.pendingReturnsCount}</strong></span>
                          <span>•</span>
                          <span>Score de Risco: <strong className="text-slate-900">{s.factors.riskScore} pts</strong></span>
                        </div>
                      </div>

                      {/* Ajuste Humano de Agentes e Imóveis */}
                      <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs self-start lg:self-center">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                            ACEs Alocados
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={s.recommendedAgentsCount}
                              onChange={e => handleUpdateAgentCount(s.neighborhoodId, parseInt(e.target.value) || 1)}
                              className="w-14 text-center font-bold text-xs p-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-500">agente(s)</span>
                          </div>
                        </div>

                        <div className="border-l border-slate-100 pl-4">
                          <span className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                            Meta de Imóveis
                          </span>
                          <span className="font-mono font-bold text-xs text-indigo-700">
                            ~{s.plannedPropertiesCount} imóveis
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestions.length === 0 && !isGenerating && (
            <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
              <Sparkles className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Nenhum planejamento gerado para esta data</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Clique em <strong>"Gerar Planejamento Sugerido"</strong> acima para cruzar os focos ativos,
                notificações do Sinan e retornos pendentes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: HISTÓRICO DE VERSÕES APROVADAS */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>Histórico Auditável de Versões de Planejamento Aprovadas</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Registro imutável para prestação de contas, auditoria do SUS e rastreamento das ordens de serviço
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">{history.length} versão(ões)</span>
          </div>

          <div className="space-y-3">
            {history.map(item => (
              <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        Versão {item.versionNumber}
                      </span>
                      <h4 className="font-bold text-slate-900 text-xs">{item.title}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Data da Missão: <strong>{item.targetDate}</strong> • Aprovado por:{' '}
                      <strong>{item.approvedByUserName}</strong> em {item.approvedAt}
                    </p>
                  </div>
                </div>

                {item.suggestions && item.suggestions.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-xs">
                    {item.suggestions.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-medium"
                      >
                        {s.neighborhoodName}: {s.recommendedAgentsCount} ACE(s) (~{s.plannedPropertiesCount} imóveis)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {history.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-500">
                Nenhum histórico de planejamento aprovado registrado ainda.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
