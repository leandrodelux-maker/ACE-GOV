import React, { useState, useEffect } from 'react';
import {
  Target,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  X,
  Info,
  ShieldCheck,
  Award
} from 'lucide-react';
import {
  managementTargetsService,
  TargetProgressStatus,
  ManagementTarget
} from '../../services/managementTargetsService';

export const ManagementTargetsView: React.FC = () => {
  const municipalityId = '00000000-0000-0000-0000-000000000001';
  const currentYear = 2026;

  const [targetsProgress, setTargetsProgress] = useState<TargetProgressStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form de nova meta
  const [newTitle, setNewTitle] = useState('');
  const [newIndicator, setNewIndicator] = useState('cobertura_ciclo');
  const [newTargetValue, setNewTargetValue] = useState(85);
  const [newOperator, setNewOperator] = useState<'>=' | '<='>('>=');
  const [newPeriodicity, setNewPeriodicity] = useState<'ciclo' | 'mensal' | 'anual'>('ciclo');
  const [newUnit, setNewUnit] = useState('%');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTargets();
  }, []);

  const loadTargets = async () => {
    setLoading(true);
    try {
      const data = await managementTargetsService.calculateTargetsProgress(municipalityId, currentYear);
      setTargetsProgress(data);
    } catch (err) {
      console.error('Erro ao carregar metas de gestão:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await managementTargetsService.saveTarget({
        municipalityId,
        year: currentYear,
        title: newTitle,
        indicator: newIndicator,
        targetValue: Number(newTargetValue),
        comparisonOperator: newOperator,
        periodicity: newPeriodicity,
        unit: newUnit,
        description: newDesc,
        active: true
      });

      setShowModal(false);
      // Resetar form
      setNewTitle('');
      setNewDesc('');
      loadTargets();
    } catch (err) {
      alert('Erro ao salvar meta.');
    } finally {
      setSaving(false);
    }
  };

  const totalTargets = targetsProgress.length;
  const hitTargets = targetsProgress.filter(t => t.status === 'atingida').length;
  const atRiskTargets = targetsProgress.filter(t => t.status === 'em_risco' || t.status === 'nao_atingida').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Metas & Indicadores de Gestão Municipal</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                Ano {currentYear}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Acompanhamento de resultados e diretrizes estratégicas de saúde pública • Vigilância por Desempenho
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Nova Meta</span>
        </button>
      </div>

      {/* Resumo do Painel de Metas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-400 font-bold uppercase">Total de Metas Ativas</span>
          <div className="text-3xl font-black text-slate-900 mt-1">{totalTargets}</div>
          <span className="text-[11px] text-slate-500">Diretrizes pactuadas no município</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-400 font-bold uppercase">Metas Atingidas / Em Dia</span>
          <div className="text-3xl font-black text-emerald-600 mt-1">{hitTargets}</div>
          <span className="text-[11px] text-slate-500">
            {totalTargets > 0 ? Math.round((hitTargets / totalTargets) * 100) : 0}% do plano cumprido
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-400 font-bold uppercase">Metas em Risco de Desvio</span>
          <div className="text-3xl font-black text-rose-600 mt-1">{atRiskTargets}</div>
          <span className="text-[11px] text-slate-500">Necessitam ação de reforço operacional</span>
        </div>
      </div>

      {/* Grid de Cards de Metas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {targetsProgress.map(tp => {
          const { target, currentValue, progressPercent, status, statusLabel, statusColor, trend, trendDetail } = tp;

          return (
            <div
              key={target.id}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Periodicidade: {target.periodicity.toUpperCase()}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-0.5">{target.title}</h3>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                      statusColor === 'emerald'
                        ? 'bg-emerald-100 text-emerald-800'
                        : statusColor === 'blue'
                        ? 'bg-blue-100 text-blue-800'
                        : statusColor === 'amber'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>

                {target.description && (
                  <p className="text-xs text-slate-500 leading-relaxed">{target.description}</p>
                )}

                {/* Comparativo Meta x Atual */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Meta Pactuada</span>
                    <span className="text-base font-bold text-slate-800">
                      {target.comparisonOperator} {target.targetValue} {target.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Valor Atual</span>
                    <span className="text-base font-black text-emerald-700">
                      {currentValue} {target.unit}
                    </span>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Progresso do Indicador</span>
                    <span className="font-bold text-slate-800 font-mono">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, progressPercent)}%` }}
                      className={`h-2 rounded-full transition-all ${
                        statusColor === 'emerald'
                          ? 'bg-emerald-600'
                          : statusColor === 'blue'
                          ? 'bg-blue-600'
                          : statusColor === 'amber'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Tendência e Observações */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  {trend === 'melhora' ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  ) : trend === 'piora' ? (
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <strong className="text-slate-700 capitalize">{trend}:</strong> {trendDetail}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Cadastrar Nova Meta */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Nova Meta de Gestão Municipal</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTarget} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Título da Diretriz</label>
                <input
                  type="text"
                  placeholder="Ex: Ampliação da Cobertura do Ciclo 05"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                  className="w-full py-2 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Indicador Vinculado</label>
                  <select
                    value={newIndicator}
                    onChange={e => setNewIndicator(e.target.value)}
                    className="w-full py-2 px-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="cobertura_ciclo">Cobertura de Ciclo</option>
                    <option value="pe_vencidos">Pontos Estratégicos Vencidos</option>
                    <option value="denuncias_prazo">Denúncias no Prazo</option>
                    <option value="pendencias_visita">Pendências de Visitas</option>
                    <option value="cobertura_liraa">Amostragem LIRAa</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Periodicidade</label>
                  <select
                    value={newPeriodicity}
                    onChange={e => setNewPeriodicity(e.target.value as any)}
                    className="w-full py-2 px-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="ciclo">Ciclo Bimestral</option>
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Critério</label>
                  <select
                    value={newOperator}
                    onChange={e => setNewOperator(e.target.value as any)}
                    className="w-full py-2 px-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value=">=">&gt;= (Mínimo)</option>
                    <option value="<=">&lt;= (Teto)</option>
                    <option value="=">= (Exato)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Valor Alvo</label>
                  <input
                    type="number"
                    value={newTargetValue}
                    onChange={e => setNewTargetValue(Number(e.target.value))}
                    required
                    className="w-full py-2 px-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unidade</label>
                  <input
                    type="text"
                    value={newUnit}
                    onChange={e => setNewUnit(e.target.value)}
                    required
                    className="w-full py-2 px-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição / Justificativa Sanitária</label>
                <textarea
                  rows={2}
                  placeholder="Objetivo pactuado pela coordenação para este exercício..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 border rounded-xl text-slate-600 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {saving ? 'Salvando...' : 'Salvar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
