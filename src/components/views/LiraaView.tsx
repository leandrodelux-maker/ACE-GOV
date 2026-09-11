import React, { useState, useEffect } from 'react';
import {
  Layers,
  Activity,
  Plus,
  Flame,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Calendar,
  Users,
  Shield,
  FileText,
  PieChart,
  RefreshCw,
  Shuffle,
  CheckCircle2,
  XCircle,
  Lock,
  ArrowRight,
  Filter,
} from 'lucide-react';
import {
  liraaService,
  LiraaSurvey,
  LiraaStratum,
  LiraaSample,
  LiraaIndices,
} from '../../services/liraaService';
import { PageHeader } from '../ui';

export const LiraaView: React.FC = () => {
  const [surveys, setSurveys] = useState<LiraaSurvey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [strata, setStrata] = useState<LiraaStratum[]>([]);
  const [samples, setSamples] = useState<LiraaSample[]>([]);
  const [indices, setIndices] = useState<LiraaIndices | null>(null);
  const [activeTab, setActiveTab] = useState<'INDICES' | 'AMOSTRAGEM' | 'ESTRATOS'>('INDICES');
  const [loading, setLoading] = useState(true);

  // Modais
  const [showNewSurveyModal, setShowNewSurveyModal] = useState(false);
  const [newSurveyName, setNewSurveyName] = useState('LIRAa Municipal 2026 - 2º Ciclo');
  const [newSurveyType, setNewSurveyType] = useState<'LIRAa' | 'LIA'>('LIRAa');
  const [showVisitModal, setShowVisitModal] = useState<LiraaSample | null>(null);
  const [visitResult, setVisitResult] = useState<'visitado' | 'fechado' | 'recusa'>('visitado');
  const [hasLarvae, setHasLarvae] = useState(false);
  const [selectedDeposits, setSelectedDeposits] = useState<string[]>([]);
  const [visitNotes, setVisitNotes] = useState('');

  // Carregar lista de levantamentos
  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    setLoading(true);
    const list = await liraaService.getSurveys();
    setSurveys(list);
    if (list.length > 0) {
      setSelectedSurveyId(list[0].id);
    }
    setLoading(false);
  };

  // Carregar dados do levantamento selecionado
  useEffect(() => {
    if (!selectedSurveyId) return;
    loadSurveyDetails(selectedSurveyId);
  }, [selectedSurveyId]);

  const loadSurveyDetails = async (surveyId: string) => {
    setLoading(true);
    const [strataList, samplesList, indicesData] = await Promise.all([
      liraaService.getStrata(surveyId),
      liraaService.getSamples(surveyId),
      liraaService.calculateIndices(surveyId),
    ]);
    setStrata(strataList);
    setSamples(samplesList);
    setIndices(indicesData);
    setLoading(false);
  };

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await liraaService.createSurvey({
      municipality_id: '00000000-0000-0000-0000-000000000001',
      type: newSurveyType,
      name: newSurveyName,
      year: 2026,
      cycle_number: surveys.length + 1,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      status: 'em_execucao',
      total_properties: 0,
      sample_properties: 0,
    });

    if (created) {
      // Criar estrato padrão inicial
      await liraaService.createStratum({
        survey_id: created.id,
        municipality_id: '00000000-0000-0000-0000-000000000001',
        name: 'Estrato 01 - Bairros Centrais e Adjacências',
        code: 'EST-01',
        population: 45000,
        total_properties: 2500,
        sample_size: 450,
        neighborhoods: [],
        status: 'em_execucao',
      });

      setShowNewSurveyModal(false);
      loadSurveys();
    }
  };

  const handleGenerateSampling = async () => {
    if (!selectedSurveyId || strata.length === 0) return;
    const stratId = strata[0].id;
    const res = await liraaService.generateSample(selectedSurveyId, stratId, 250);
    alert(res.message);
    loadSurveyDetails(selectedSurveyId);
  };

  const handleSaveVisit = async () => {
    if (!showVisitModal) return;

    await liraaService.updateSampleVisit(showVisitModal.id, {
      status: visitResult,
      positive: hasLarvae,
      larvae_found: hasLarvae,
      deposit_types: selectedDeposits,
      notes: visitNotes,
    });

    setShowVisitModal(null);
    setHasLarvae(false);
    setSelectedDeposits([]);
    setVisitNotes('');
    loadSurveyDetails(selectedSurveyId);
  };

  const handleReplace = async (sample: LiraaSample) => {
    if (confirm(`Substituir a amostra do imóvel ${sample.property?.street}, ${sample.property?.number}? Um novo imóvel será sorteado no mesmo estrato.`)) {
      const ok = await liraaService.replaceSample(sample.id, sample.survey_id, sample.stratum_id);
      if (ok) {
        alert('Amostra substituída com sucesso!');
        loadSurveyDetails(selectedSurveyId);
      } else {
        alert('Não foi possível substituir a amostra.');
      }
    }
  };

  const handleFinalizeSurvey = async () => {
    if (!selectedSurveyId) return;
    if (confirm('Deseja consolidar e finalizar este levantamento? As vistorias serão congeladas e registradas na auditoria.')) {
      const res = await liraaService.finalizeSurvey(selectedSurveyId);
      alert(res.message);
      if (res.success) {
        loadSurveys();
      }
    }
  };

  const activeSurvey = surveys.find(s => s.id === selectedSurveyId);
  const isFinalized = activeSurvey?.status === 'finalizado';

  const toggleDeposit = (dep: string) => {
    setSelectedDeposits(prev =>
      prev.includes(dep) ? prev.filter(d => d !== dep) : [...prev, dep]
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        icon={PieChart}
        title="LIRAa / LIA — Levantamento Amostral de Índices"
        subtitle="Cálculo automático de IIP (Infestação Predial), IB (Breteau), estratificação territorial e tipologia de criadouros"
        badge={{ label: 'MINISTÉRIO DA SAÚDE', tone: 'info' }}
        actions={
          <>
            <select
              value={selectedSurveyId}
              onChange={e => setSelectedSurveyId(e.target.value)}
              className="p-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-white shadow-xs"
            >
              {surveys.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.type} {s.year}/{s.cycle_number}) - {s.status.toUpperCase()}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowNewSurveyModal(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Levantamento</span>
            </button>
          </>
        }
      />

      {/* Status Alert Banner */}
      {isFinalized && (
        <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-xl flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span className="font-bold">
              Levantamento Finalizado & Congelado: Dados consolidados para o Boletim Epidemiológico Oficial.
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-700">Auditado pelo Sistema</span>
        </div>
      )}

      {/* KPI Cards: IIP, IB, Cobertura, Focos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* IIP Card */}
        <div className={`p-4 rounded-xl border shadow-xs transition ${
          indices?.classification === 'RISCO'
            ? 'bg-rose-50/50 border-rose-200'
            : indices?.classification === 'ALERTA'
            ? 'bg-amber-50/50 border-amber-200'
            : 'bg-emerald-50/50 border-emerald-200'
        }`}>
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-slate-600">IIP (Infestação)</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
              indices?.classification === 'RISCO'
                ? 'bg-rose-600 text-white'
                : indices?.classification === 'ALERTA'
                ? 'bg-amber-500 text-white'
                : 'bg-emerald-600 text-white'
            }`}>
              {indices?.classification || 'SATISFATÓRIO'}
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {indices?.iip || 0}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Meta MS: &lt; 1,0% satisfatório
          </div>
        </div>

        {/* IB Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-600">Índice de Breteau (IB)</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {indices?.ib || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Recipientes + / 100 imóveis
          </div>
        </div>

        {/* Amostra Pesquisada */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-600">Amostra Pesquisada</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {indices?.totalSurveyed || 0} <span className="text-sm font-normal text-slate-400">/ {indices?.totalPlanned || 0}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Cobertura: {indices?.coveragePercentage || 0}%
          </div>
        </div>

        {/* Imóveis Positivos */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-600">Imóveis com Focos</span>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {indices?.totalPositiveProperties || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Larvas Aedes identificadas
          </div>
        </div>

        {/* Recipientes Positivos */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-600">Depósitos Positivos</span>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {indices?.totalPositiveDeposits || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Tipologia A1 a E
          </div>
        </div>

        {/* Fechados / Recusas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-600">Fechados & Recusas</span>
          <div className="text-2xl font-black text-slate-700 mt-1">
            {(indices?.closedCount || 0) + (indices?.refusalCount || 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {indices?.closedCount || 0} fech. | {indices?.refusalCount || 0} recusas
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('INDICES')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeTab === 'INDICES'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Índices & Tipologia de Depósitos
          </button>
          <button
            onClick={() => setActiveTab('AMOSTRAGEM')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeTab === 'AMOSTRAGEM'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Amostragem & Vistorias ({samples.length})
          </button>
          <button
            onClick={() => setActiveTab('ESTRATOS')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeTab === 'ESTRATOS'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Estratos Territoriais ({strata.length})
          </button>
        </div>

        {!isFinalized && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateSampling}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold flex items-center gap-1.5"
            >
              <Shuffle className="w-3.5 h-3.5 text-blue-600" />
              <span>Sortear Amostra Automática</span>
            </button>
            <button
              onClick={handleFinalizeSurvey}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Finalizar Levantamento</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: INDICES & DEPOSIT TYPES */}
      {activeTab === 'INDICES' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tipologia de Depósitos A1 a E */}
          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-600" />
              <span>Distribuição de Criadouros Positivos por Categoria Oficial (A1 - E)</span>
            </h3>

            <div className="space-y-3">
              {(indices?.byDepositType || []).map(dt => (
                <div key={dt.code} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{dt.name}</span>
                    <span className="text-slate-900 font-mono font-bold">
                      {dt.count} foco(s) ({dt.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${Math.max(dt.percentage, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">Classificação Padrão Ministério da Saúde:</p>
              <p>• <strong>A1/A2</strong>: Armazenamento de água para consumo | • <strong>B</strong>: Vasos e pratinhos ornamentais</p>
              <p>• <strong>C</strong>: Calhas, lajes e ralos | • <strong>D1/D2</strong>: Pneus, entulhos e lixo domiciliar | • <strong>E</strong>: Naturais</p>
            </div>
          </div>

          {/* Semáforo de Risco por Estrato */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>Classificação por Estrato</span>
            </h3>

            <div className="space-y-3">
              {(indices?.byStratum || []).map(st => (
                <div key={st.stratumId} className="p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{st.stratumCode}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      st.classification === 'RISCO'
                        ? 'bg-rose-100 text-rose-700'
                        : st.classification === 'ALERTA'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {st.classification}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{st.stratumName}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 text-[10px]">IIP Estrato:</span>
                      <p className="font-bold text-slate-900">{st.iip}%</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">IB Estrato:</span>
                      <p className="font-bold text-slate-900">{st.ib}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AMOSTRAGEM & VISTORIAS */}
      {activeTab === 'AMOSTRAGEM' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shuffle className="w-4 h-4 text-blue-600" />
              <span>Lista de Imóveis Amostrados no Sorteio</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Total de {samples.length} imóveis sorteados
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Logradouro / Nº</th>
                  <th className="py-2.5 px-3">Status Vistoria</th>
                  <th className="py-2.5 px-3">Resultado</th>
                  <th className="py-2.5 px-3">Depósitos</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {samples.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {s.property?.street}, {s.property?.number}
                      {s.replacement_of && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          Substituto
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.status === 'visitado'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'fechado'
                          ? 'bg-amber-100 text-amber-800'
                          : s.status === 'recusa'
                          ? 'bg-rose-100 text-rose-800'
                          : s.status === 'substituido'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {s.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {s.positive ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-600 text-white">
                          FOCO POSITIVO
                        </span>
                      ) : s.status === 'visitado' ? (
                        <span className="text-emerald-700 font-semibold">Negativo</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                      {(s.deposit_types || []).join(', ') || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1.5">
                      {!isFinalized && (
                        <>
                          <button
                            onClick={() => setShowVisitModal(s)}
                            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px]"
                          >
                            Registrar
                          </button>
                          {(s.status === 'fechado' || s.status === 'recusa') && (
                            <button
                              onClick={() => handleReplace(s)}
                              className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-[11px]"
                            >
                              Substituir
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ESTRATOS */}
      {activeTab === 'ESTRATOS' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Divisão Territorial em Estratos de Amostragem</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strata.map(st => (
              <div key={st.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {st.code}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    População estimada: {st.population.toLocaleString('pt-BR')} hab.
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">{st.name}</h4>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-slate-500">Imóveis Totais:</span>
                    <p className="font-bold text-slate-900">{st.total_properties}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Amostra Calculada:</span>
                    <p className="font-bold text-blue-600">{st.sample_size} imóveis</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Novo Levantamento LIRAa */}
      {showNewSurveyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Abrir Novo Levantamento Amostral (LIRAa / LIA)
            </h3>

            <form onSubmit={handleCreateSurvey} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Levantamento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSurveyType('LIRAa')}
                    className={`p-2 rounded-lg font-bold border ${
                      newSurveyType === 'LIRAa' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    LIRAa (Rápido - Amostral)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSurveyType('LIA')}
                    className={`p-2 rounded-lg font-bold border ${
                      newSurveyType === 'LIA' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    LIA (Índice Amostral)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Levantamento</label>
                <input
                  type="text"
                  value={newSurveyName}
                  onChange={e => setNewSurveyName(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold text-slate-800"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewSurveyModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Criar Levantamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Vistoria de Amostra LIRAa */}
      {showVisitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>Vistoria LIRAa: {showVisitModal.property?.street}, {showVisitModal.property?.number}</span>
              <button onClick={() => setShowVisitModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Situação do Imóvel</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisitResult('visitado')}
                    className={`p-2 rounded-lg font-bold border ${
                      visitResult === 'visitado' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    Inspecionado
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisitResult('fechado')}
                    className={`p-2 rounded-lg font-bold border ${
                      visitResult === 'fechado' ? 'bg-amber-600 text-white border-amber-600' : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    Fechado
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisitResult('recusa')}
                    className={`p-2 rounded-lg font-bold border ${
                      visitResult === 'recusa' ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    Recusado
                  </button>
                </div>
              </div>

              {visitResult === 'visitado' && (
                <>
                  <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasLarvae}
                        onChange={e => setHasLarvae(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                      />
                      <span className="text-rose-600">Presença de Larvas / Foco Positivo</span>
                    </label>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Depósitos Inspecionados (A1 a E)</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { code: 'A1', label: 'A1 - Água Elevada' },
                        { code: 'A2', label: 'A2 - Água Solo' },
                        { code: 'B', label: 'B - Vasos / Pratos' },
                        { code: 'C', label: 'C - Calhas / Ralos' },
                        { code: 'D1', label: 'D1 - Pneus / Rodantes' },
                        { code: 'D2', label: 'D2 - Lixo / Sucatas' },
                        { code: 'E', label: 'E - Naturais / Bromélias' },
                      ].map(dep => (
                        <button
                          key={dep.code}
                          type="button"
                          onClick={() => toggleDeposit(dep.code)}
                          className={`p-1.5 rounded text-left font-semibold border ${
                            selectedDeposits.includes(dep.code)
                              ? 'bg-blue-50 border-blue-600 text-blue-800'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {dep.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações Sanitárias</label>
                <textarea
                  value={visitNotes}
                  onChange={e => setVisitNotes(e.target.value)}
                  placeholder="Anotações do ACE sobre o depósito ou tratamento..."
                  className="w-full p-2 rounded-lg border border-slate-300"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowVisitModal(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveVisit}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Salvar Vistoria LIRAa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
