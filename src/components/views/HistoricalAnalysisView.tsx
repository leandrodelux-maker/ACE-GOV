import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Layers,
  Filter,
  BarChart2,
  AlertTriangle,
  RefreshCw,
  Info,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Compass,
  ArrowRight
} from 'lucide-react';
import {
  historicalAnalysisService,
  ComparativeAnalysisResult,
  HistoricalIndicatorKey,
  HISTORICAL_INDICATORS
} from '../../services/historicalAnalysisService';
import { predictiveIntelligenceService, PredictiveOverview } from '../../services/predictiveIntelligenceService';
import { supabase } from '../../services/supabaseClient';
import { PageHeader } from '../ui';
import { useMunicipalityId } from '../../contexts/AuthContext';

export const HistoricalAnalysisView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  
  const [selectedIndicator, setSelectedIndicator] = useState<HistoricalIndicatorKey>('cobertura');
  const [selectedMode, setSelectedMode] = useState<'2026_vs_2025' | 'ciclo_atual_vs_anterior' | 'ultimas_4semanas_vs_anteriores'>('2026_vs_2025');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('ALL');
  const [neighborhoods, setNeighborhoods] = useState<Array<{ id: string; name: string }>>([]);

  const [analysis, setAnalysis] = useState<ComparativeAnalysisResult | null>(null);
  const [predictive, setPredictive] = useState<PredictiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'COMPARATIVO' | 'PREDITIVA'>('COMPARATIVO');

  useEffect(() => {
    loadNeighborhoods();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedIndicator, selectedMode, selectedNeighborhood]);

  const loadNeighborhoods = async () => {
    try {
      const { data } = await supabase
        .from('neighborhoods')
        .select('id, name')
        .eq('municipality_id', municipalityId)
        .order('name');
      if (data) setNeighborhoods(data);
    } catch (err) {
      console.error('Erro ao carregar bairros:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [histRes, predRes] = await Promise.all([
        historicalAnalysisService.getComparativeAnalysis(
          selectedIndicator,
          selectedMode,
          selectedNeighborhood,
          municipalityId
        ),
        predictiveIntelligenceService.getPredictiveOverview(municipalityId)
      ]);
      setAnalysis(histRes);
      setPredictive(predRes);
    } catch (err) {
      console.error('Erro ao carregar análise histórica:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentIndicatorMeta = HISTORICAL_INDICATORS.find(i => i.key === selectedIndicator) || HISTORICAL_INDICATORS[0];

  // Cálculo da altura máxima para o gráfico SVG
  const maxChartVal = analysis
    ? Math.max(...analysis.series.flatMap(s => [s.currentValue, s.previousValue]), 10)
    : 100;

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <PageHeader
        icon={BarChart2}
        title="Análise Histórica & Séries Temporais"
        subtitle="Comparações entre ciclos bimestrais, anos e semanas epidemiológicas • Detecção de tendências estatísticas"
        badge={{ label: 'Vigilância & Inteligência', tone: 'info' }}
        actions={
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('COMPARATIVO')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'COMPARATIVO' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Séries Históricas</span>
            </button>
            <button
              onClick={() => setActiveTab('PREDITIVA')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'PREDITIVA' ? 'bg-white text-violet-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              <span>Inteligência Preditiva & Anomalias</span>
            </button>
          </div>
        }
      />

      {activeTab === 'COMPARATIVO' ? (
        <>
          {/* Barra de Filtros Multidimensionais */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* 1. Indicador */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Indicador em Análise</label>
                <select
                  value={selectedIndicator}
                  onChange={e => setSelectedIndicator(e.target.value as HistoricalIndicatorKey)}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-blue-500"
                >
                  {HISTORICAL_INDICATORS.map(ind => (
                    <option key={ind.key} value={ind.key}>
                      {ind.label} ({ind.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Modo de Comparação */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Janela Comparativa</label>
                <select
                  value={selectedMode}
                  onChange={e => setSelectedMode(e.target.value as any)}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-blue-500"
                >
                  <option value="2026_vs_2025">Anos: 2026 vs 2025</option>
                  <option value="ciclo_atual_vs_anterior">Ciclos: Ciclo 05 (Atual) vs Ciclo 04</option>
                  <option value="ultimas_4semanas_vs_anteriores">Semanas: Últimas 4 SEs vs 4 Anteriores</option>
                </select>
              </div>

              {/* 3. Território */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Recorte Territorial</label>
                <select
                  value={selectedNeighborhood}
                  onChange={e => setSelectedNeighborhood(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Todo o Município (Consolidado)</option>
                  {neighborhoods.map(n => (
                    <option key={n.id} value={n.id}>
                      Bairro {n.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>{currentIndicatorMeta.description}</span>
            </p>
          </div>

          {/* Cards de Resumo da Comparação */}
          {analysis && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 font-bold uppercase block">Período Atual</span>
                <div className="text-3xl font-black text-slate-900 mt-1">
                  {analysis.currentTotal.toLocaleString('pt-BR')}
                  <span className="text-xs font-normal text-slate-500 ml-1">{analysis.indicator.unit}</span>
                </div>
                <span className="text-[11px] text-slate-500">{analysis.territoryName}</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 font-bold uppercase block">Período de Referência</span>
                <div className="text-3xl font-black text-slate-600 mt-1">
                  {analysis.previousTotal.toLocaleString('pt-BR')}
                  <span className="text-xs font-normal text-slate-400 ml-1">{analysis.indicator.unit}</span>
                </div>
                <span className="text-[11px] text-slate-500">Base comparativa anterior</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 font-bold uppercase block">Variação Real</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {analysis.overallDiffPercent > 0 ? (
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  ) : analysis.overallDiffPercent < 0 ? (
                    <TrendingDown className="w-6 h-6 text-blue-600" />
                  ) : (
                    <Minus className="w-6 h-6 text-slate-400" />
                  )}
                  <span className="text-3xl font-black text-slate-900">
                    {analysis.overallDiffPercent > 0 ? `+${analysis.overallDiffPercent}%` : `${analysis.overallDiffPercent}%`}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">Diferença percentual relativa</span>
              </div>

              <div
                className={`p-5 rounded-2xl border shadow-xs flex flex-col justify-between ${
                  analysis.overallStatus === 'melhora'
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : analysis.overallStatus === 'piora'
                    ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider block">Classificação de Tendência</span>
                  <div className="text-lg font-bold mt-1 uppercase flex items-center gap-1.5">
                    {analysis.overallStatus === 'melhora' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    ) : analysis.overallStatus === 'piora' ? (
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                    ) : (
                      <Minus className="w-5 h-5 text-slate-500" />
                    )}
                    <span>{analysis.overallStatus.toUpperCase()}</span>
                  </div>
                </div>
                <span className="text-[10px] mt-2 font-medium opacity-80">{analysis.statusExplanation}</span>
              </div>
            </div>
          )}

          {/* Gráfico Visual de Barras Comparativas Nativas */}
          {analysis && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{analysis.comparisonTitle}</h3>
                  <p className="text-xs text-slate-500">{analysis.indicator.label} • {analysis.territoryName}</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-600"></span>
                    <strong className="text-slate-700">Período Atual</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-300"></span>
                    <strong className="text-slate-500">Período Anterior</strong>
                  </span>
                </div>
              </div>

              {/* Gráfico de Barras Responsivo */}
              <div className="h-64 flex items-end justify-between gap-2 sm:gap-4 pt-6 px-2">
                {analysis.series.map((pt, idx) => {
                  const hCurrent = Math.min(100, Math.round((pt.currentValue / maxChartVal) * 100));
                  const hPrev = Math.min(100, Math.round((pt.previousValue / maxChartVal) * 100));

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <div className="w-full flex items-end justify-center gap-1 h-48">
                        {/* Barra Anterior */}
                        <div
                          style={{ height: `${Math.max(hPrev, 4)}%` }}
                          className="w-1/2 bg-slate-300 rounded-t-md transition-all group-hover:bg-slate-400 relative"
                          title={`Anterior: ${pt.previousValue}`}
                        ></div>
                        {/* Barra Atual */}
                        <div
                          style={{ height: `${Math.max(hCurrent, 4)}%` }}
                          className="w-1/2 bg-blue-600 rounded-t-md transition-all group-hover:bg-blue-700 relative"
                          title={`Atual: ${pt.currentValue}`}
                        ></div>
                      </div>

                      <div className="mt-2 text-center">
                        <span className="text-[11px] font-bold text-slate-700 block truncate">{pt.label}</span>
                        <span
                          className={`text-[10px] font-mono font-bold ${
                            pt.status === 'melhora'
                              ? 'text-emerald-600'
                              : pt.status === 'piora'
                              ? 'text-rose-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {pt.diffPercent > 0 ? `+${pt.diffPercent}%` : `${pt.diffPercent}%`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabela de Dados Período a Período */}
          {analysis && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Detalhamento Estatístico das Séries
              </h4>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Intervalo / Etapa</th>
                      <th className="py-2.5 px-3">Valor Atual</th>
                      <th className="py-2.5 px-3">Valor Anterior</th>
                      <th className="py-2.5 px-3">Variação (%)</th>
                      <th className="py-2.5 px-3">Tendência Qualitativa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {analysis.series.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-800">{s.label}</td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">
                          {s.currentValue} {analysis.indicator.unit}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500">
                          {s.previousValue} {analysis.indicator.unit}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold">
                          {s.diffPercent > 0 ? `+${s.diffPercent}%` : `${s.diffPercent}%`}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.status === 'melhora'
                                ? 'bg-emerald-100 text-emerald-800'
                                : s.status === 'piora'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {s.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ABA 2: INTELIGÊNCIA PREDITIVA EXPERIMENTAL & ANOMALIAS */
        predictive && (
          <div className="space-y-6">
            {/* Aviso Metodológico */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Nota Metodológica sobre Inteligência Preditiva:</strong>
                <p className="mt-0.5 leading-relaxed">{predictive.methodologicalNote}</p>
              </div>
            </div>

            {/* Score de Confiança dos Dados */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Status Geral do Modelo</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{predictive.overallSignal}</h3>
                {predictive.insufficiencyMessage && (
                  <p className="text-xs text-rose-600 mt-1 font-medium">{predictive.insufficiencyMessage}</p>
                )}
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Grau de Confiabilidade</span>
                <span className="text-2xl font-black text-violet-700 font-mono">
                  {predictive.confidenceScore}%
                </span>
                <span className="text-[10px] text-slate-500 block">Densidade Amostral</span>
              </div>
            </div>

            {/* ANOMALIAS DETECTADAS */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Anomalias Espaciais e Temporais Detectadas</span>
                </h3>
                <span className="text-xs text-slate-400">{predictive.anomalies.length} anomalias ativas</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {predictive.anomalies.map(anom => (
                  <div
                    key={anom.id}
                    className="p-4 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-600 text-white">
                          {anom.severity}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">Confiança: {anom.confidenceScore}%</span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{anom.headline}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{anom.evidence}</p>
                    </div>

                    <div className="pt-2 border-t border-rose-200 text-xs">
                      <span className="font-bold text-slate-800 block text-[10px]">Intervenção Recomendada:</span>
                      <p className="text-slate-700 bg-white/90 p-2 rounded-lg border border-rose-200/60 mt-1">
                        {anom.recommendedIntervention}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Estimativas Probabilísticas por Bairro */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-600" />
                <span>Estimativas de Risco Probabilístico por Bairro</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {predictive.territoryEstimations.map(terr => (
                  <div key={terr.neighborhoodId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{terr.neighborhoodName}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          terr.estimatedRiskLevel === 'muito_elevado'
                            ? 'bg-rose-100 text-rose-800'
                            : terr.estimatedRiskLevel === 'elevado'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {terr.riskLabel}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">{terr.signalDescription}</p>

                    <div className="space-y-1 pt-1 border-t border-slate-200 text-[11px]">
                      {terr.contributingFactors.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-slate-500">
                          <span>{f.factor}:</span>
                          <span className="font-semibold text-slate-700 truncate max-w-[150px]">{f.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};
