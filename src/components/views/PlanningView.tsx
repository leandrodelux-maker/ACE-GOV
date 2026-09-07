import React, { useState } from 'react';
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
} from 'lucide-react';
import { db } from '../../services/storage';
import { PlanningTask } from '../../types';

export const PlanningView: React.FC = () => {
  const [tasks, setTasks] = useState<PlanningTask[]>(db.getTasks());
  const [suggestions, setSuggestions] = useState<ReturnType<typeof db.generateTomorrowPlanSuggestions>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [planApproved, setPlanApproved] = useState(false);

  const handleGenerateTomorrowPlan = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const sugs = db.generateTomorrowPlanSuggestions();
      setSuggestions(sugs);
      setIsGenerating(false);
    }, 600);
  };

  const handleApprovePlan = () => {
    const newTasks: PlanningTask[] = [];
    suggestions.forEach(sugGroup => {
      sugGroup.suggestions.forEach((s, idx) => {
        newTasks.push({
          id: `task-gen-${Date.now()}-${sugGroup.agentId}-${idx}`,
          municipalityId: 'mun-santacruz',
          date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          type: (s.type as any) || 'VISITA_DE_ROTINA',
          priority: s.priorityNumber === 1 ? 'URGENTE' : s.priorityNumber === 2 ? 'ALTA' : 'ATENCAO',
          neighborhood: s.area || 'Centro',
          sector: 'Setor Geral',
          assignedAgentId: sugGroup.agentId,
          assignedAgentName: sugGroup.agentName,
          supervisorId: 'usr-sup-01',
          supervisorName: 'Roberto Alves',
          status: 'PENDENTE',
          notes: `${s.title}: ${s.rationale}`,
        });
      });
    });

    const updated = [...newTasks, ...tasks];
    setTasks(updated);
    localStorage.setItem('endemias_tasks', JSON.stringify(updated));
    setSuggestions([]);
    setPlanApproved(true);
    setTimeout(() => setPlanApproved(false), 4000);
  };

  const getPriorityBadge = (p: PlanningTask['priority']) => {
    switch (p) {
      case 'URGENTE':
        return <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-rose-100 text-rose-700">🔴 URGENTE</span>;
      case 'ALTA':
        return <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-orange-100 text-orange-800">🟠 ALTA</span>;
      case 'ATENCAO':
        return <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-amber-100 text-amber-800">🟡 ATENÇÃO</span>;
      default:
        return <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-emerald-100 text-emerald-800">🟢 NORMAL</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span>Planejamento de Campo & Escala Operacional</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Distribuição de tarefas, bloqueios de transmissão, metas diárias e geração inteligente de roteiros
          </p>
        </div>

        <button
          onClick={handleGenerateTomorrowPlan}
          disabled={isGenerating}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-sky-200" />
          <span>{isGenerating ? 'Calculando Prioridades...' : 'Gerar Planejamento de Amanhã'}</span>
        </button>
      </div>

      {/* Approval Banner when plan generated */}
      {suggestions.length > 0 && (
        <div className="bg-gradient-to-r from-sky-50 to-blue-50 p-5 rounded-2xl border border-blue-200 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                Sugestão Heurística do Motor de Risco
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1">
                Planejamento Sugerido para Amanhã ({suggestions.reduce((acc, s) => acc + s.suggestions.length, 0)} Ações Prioritárias)
              </h3>
              <p className="text-xs text-slate-600">
                Priorização baseada em: 1º Bloqueios de Dengue, 2º PEs Vencidos, 3º Reincidentes, 4º Denúncias em Aberto.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSuggestions([])}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-white"
              >
                Descartar
              </button>
              <button
                onClick={handleApprovePlan}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Aprovar e Distribuir aos ACEs</span>
              </button>
            </div>
          </div>

          {/* Suggestions Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions.flatMap(group =>
              group.suggestions.map((sug, idx) => (
                <div key={`${group.agentId}-${idx}`} className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {group.agentName}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{sug.type}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">{sug.title}</h4>
                  <p className="text-[11px] text-slate-600">{sug.area}</p>
                  <p className="text-[10px] text-blue-700 font-medium bg-blue-50 p-1.5 rounded">
                    Motivo: {sug.rationale}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {planApproved && (
        <div className="p-3.5 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Planejamento de amanhã aprovado com sucesso e integrado às rotas dos agentes!</span>
        </div>
      )}

      {/* Task List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Quadro Geral de Atividades e Ordens de Serviço
            </h3>
            <p className="text-xs text-slate-500">Monitoramento das tarefas ativas e executadas</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
            {tasks.length} tarefas cadastradas
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {tasks.map(task => (
            <div key={task.id} className="p-4 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getPriorityBadge(task.priority)}
                  <span className="font-bold text-slate-900 text-sm">{task.type}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-slate-500 text-[11px]">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {task.neighborhood} ({task.sector})
                  </span>
                  <span>•</span>
                  <span>Data: {task.date}</span>
                  <span>•</span>
                  <span className="text-blue-700 font-semibold">Agente: {task.assignedAgentName}</span>
                </div>
                {task.notes && (
                  <p className="text-slate-600 bg-slate-50 p-2 rounded text-[11px]">
                    {task.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                  task.status === 'CONCLUIDA'
                    ? 'bg-emerald-100 text-emerald-800'
                    : task.status === 'EM_ANDAMENTO'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {task.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
