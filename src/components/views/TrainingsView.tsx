import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Plus,
  Users,
  Award,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  BookOpen,
  Shield,
  FileCheck,
  ChevronRight,
  RefreshCw,
  X
} from 'lucide-react';
import { trainingService, Training, TrainingParticipant, AgentTrainingPassport } from '../../services/trainingService';
import { PageHeader } from '../ui';

export const TrainingsView: React.FC = () => {
  const municipalityId = '00000000-0000-0000-0000-000000000001';
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [participants, setParticipants] = useState<TrainingParticipant[]>([]);
  const [showNewTrainingModal, setShowNewTrainingModal] = useState(false);
  const [showPassportModal, setShowPassportModal] = useState(false);
  const [agentPassport, setAgentPassport] = useState<AgentTrainingPassport | null>(null);

  // Form de novo curso
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Training['category']>('dengue');
  const [newInstructor, setNewInstructor] = useState('');
  const [newWorkload, setNewWorkload] = useState(8);
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEndDate, setNewEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [newLocation, setNewLocation] = useState('Auditório da Vigilância em Saúde');

  useEffect(() => {
    loadTrainings();
  }, []);

  const loadTrainings = async () => {
    setLoading(true);
    try {
      const data = await trainingService.getTrainings(municipalityId);
      setTrainings(data);
      if (data.length > 0 && !selectedTraining) {
        handleSelectTraining(data[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar capacitações:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTraining = async (training: Training) => {
    setSelectedTraining(training);
    try {
      const pList = await trainingService.getParticipants(training.id);
      setParticipants(pList);
    } catch (err) {
      console.error('Erro ao carregar participantes:', err);
    }
  };

  const handleCreateTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await trainingService.createTraining({
        municipality_id: municipalityId,
        title: newTitle,
        category: newCategory,
        instructor: newInstructor,
        workload_hours: Number(newWorkload),
        start_date: newStartDate,
        end_date: newEndDate,
        status: 'planejado',
        location: newLocation
      });

      setShowNewTrainingModal(false);
      loadTrainings();
    } catch (err) {
      alert('Falha ao criar capacitação.');
    }
  };

  const handleEvaluate = async (participantId: string, status: 'aprovado' | 'reprovado', score: number) => {
    try {
      const res = await trainingService.evaluateParticipant(participantId, status, 100, score);
      if (res.certificateCode) {
        alert(`Certificado emitido: ${res.certificateCode}`);
      }
      if (selectedTraining) {
        handleSelectTraining(selectedTraining);
      }
    } catch (err) {
      alert('Erro ao atualizar avaliação.');
    }
  };

  const handleOpenAgentPassport = async (userId: string) => {
    try {
      const passport = await trainingService.getAgentTrainingPassport(userId);
      setAgentPassport(passport);
      setShowPassportModal(true);
    } catch (err) {
      alert('Erro ao carregar passaporte do agente.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <PageHeader
        icon={GraduationCap}
        title="Capacitação & Educação Permanente"
        subtitle="Formação contínua de ACEs e Supervisores • Emissão de Certificados • Histórico Técnico"
        actions={
          <button
            onClick={() => setShowNewTrainingModal(true)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Nova Capacitação</span>
          </button>
        }
      />

      {/* Grid de Turmas e Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de Capacitações */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cursos & Turmas</h3>
            <span className="text-xs text-slate-400">{trainings.length} cadastrados</span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {trainings.map(t => {
              const isSelected = selectedTraining?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTraining(t)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-violet-50/70 border-violet-300 ring-1 ring-violet-400'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900 leading-snug">{t.title}</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 uppercase shrink-0">
                      {t.category}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {t.workload_hours}h aula
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {new Date(t.start_date).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Users className="w-3 h-3 text-slate-400" />
                      {t.participants_count || 0} alunos
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalhe da Turma Selecionada */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          {selectedTraining ? (
            <>
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                    Módulo Oficial
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedTraining.title}</h2>
                  <p className="text-xs text-slate-500">
                    Instrutor: {selectedTraining.instructor || 'Equipe Técnica'} • Local: {selectedTraining.location}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-slate-700 block">{selectedTraining.workload_hours} Horas</span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(selectedTraining.start_date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Tabela de Participantes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Lista de Presença & Avaliação</h4>
                  <span className="text-xs text-slate-400">{participants.length} agentes inscritos</span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Agente / Aluno</th>
                        <th className="py-2.5 px-3">Cargo</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Nota</th>
                        <th className="py-2.5 px-3">Certificado</th>
                        <th className="py-2.5 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {participants.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            Nenhum agente inscrito nesta turma.
                          </td>
                        </tr>
                      ) : (
                        participants.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-800">
                              <button
                                onClick={() => handleOpenAgentPassport(p.user_id)}
                                className="text-violet-600 hover:underline font-bold text-left"
                              >
                                {p.user?.name || 'Agente ACE'}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 uppercase text-[10px]">
                              {p.user?.role || 'ACE'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  p.status === 'aprovado'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : p.status === 'reprovado'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {p.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono">{p.score !== undefined ? `${p.score}/10` : '-'}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                              {p.certificate_code || '---'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {p.status !== 'aprovado' ? (
                                <button
                                  onClick={() => handleEvaluate(p.id, 'aprovado', 9.5)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                                >
                                  Aprovar
                                </button>
                              ) : (
                                <span className="text-emerald-600 font-bold text-[10px] flex items-center justify-end gap-1">
                                  <Award className="w-3 h-3" /> Certificado
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-slate-400">
              Selecione uma capacitação ao lado para ver participantes e emitir certificados.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Cadastrar Nova Capacitação */}
      {showNewTrainingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Nova Turma de Capacitação</h3>
              <button onClick={() => setShowNewTrainingModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTraining} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Título do Curso</label>
                <input
                  type="text"
                  placeholder="Ex: Atualização Técnica em LIRAa e Amostragem"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                  className="w-full py-2 px-3 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Categoria</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as any)}
                    className="w-full py-2 px-2.5 border rounded-xl bg-white"
                  >
                    <option value="dengue">Dengue / Arboviroses</option>
                    <option value="liraa">LIRAa / LIA</option>
                    <option value="controle_vetorial">Controle Vetorial</option>
                    <option value="seguranca">Segurança & EPI</option>
                    <option value="pwa">PWA de Campo</option>
                    <option value="ovitrampas">Ovitrampas</option>
                    <option value="pe">Pontos Estratégicos</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">Carga Horária (h)</label>
                  <input
                    type="number"
                    value={newWorkload}
                    onChange={e => setNewWorkload(Number(e.target.value))}
                    required
                    className="w-full py-2 px-3 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Instrutor Responsável</label>
                <input
                  type="text"
                  placeholder="Ex: Dr. Marcelo (Vigilância Estadual)"
                  value={newInstructor}
                  onChange={e => setNewInstructor(e.target.value)}
                  className="w-full py-2 px-3 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Data de Início</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={e => setNewStartDate(e.target.value)}
                    className="w-full py-2 px-2.5 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Data de Término</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={e => setNewEndDate(e.target.value)}
                    className="w-full py-2 px-2.5 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Local</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  className="w-full py-2 px-3 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewTrainingModal(false)}
                  className="px-3 py-1.5 border rounded-xl text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold"
                >
                  Salvar Capacitação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Passaporte de Capacitação do Agente */}
      {showPassportModal && agentPassport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Passaporte de Capacitações do ACE</h3>
                <p className="text-xs text-slate-500">{agentPassport.userName}</p>
              </div>
              <button onClick={() => setShowPassportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Totalizadores */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-violet-50 border border-violet-200 p-3 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-violet-700 block">Horas Acumuladas</span>
                <span className="text-2xl font-bold text-violet-900">{agentPassport.completedHours}h</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Cursos Concluídos</span>
                <span className="text-2xl font-bold text-emerald-900">{agentPassport.coursesCount}</span>
              </div>
            </div>

            {/* Cursos Certificados */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Certificados Oficiais Emitidos:</span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
                {agentPassport.certifications.length === 0 ? (
                  <p className="text-slate-400 text-[11px]">Nenhuma certificação registrada ainda.</p>
                ) : (
                  agentPassport.certifications.map((c, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800">{c.trainingTitle}</div>
                        <span className="text-[10px] font-mono text-emerald-700 font-bold">{c.certificateCode}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(c.completedAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Alertas de Reciclagem */}
            {agentPassport.pendingRecyclings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-1.5">
                <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Reciclagens Obrigatórias Pendentes:
                </span>
                {agentPassport.pendingRecyclings.map((rec, i) => (
                  <div key={i} className="text-xs text-amber-900">
                    • {rec.title} (Ciclo recomendado: {rec.recommendedCycleMonths} meses)
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowPassportModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
