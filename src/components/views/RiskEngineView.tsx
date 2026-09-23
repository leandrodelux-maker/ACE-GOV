import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  ArrowRight,
  RefreshCw,
  Save,
} from 'lucide-react';
import { riskEngineService, RiskSettings, RiskCalculationResult } from '../../services/riskEngineService';
import { situationRoomService, NeighborhoodSituation } from '../../services/situationRoomService';
import { PageHeader } from '../ui';
import { useMunicipalityId } from '../../contexts/AuthContext';

export const RiskEngineView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodSituation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RiskSettings>({
    weightRecentFoci: 25,
    weightRecurrence: 20,
    weightEpidemiologicalCases: 15,
    weightOvitraps: 10,
    weightEggDensity: 5,
    weightComplaints: 5,
    weightClosedProperties: 5,
    weightRefusals: 5,
    weightLowCoverage: 5,
    weightOverduePe: 5,
    weightDaysWithoutVisit: 5,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Entradas reais por bairro (mesma fonte da Sala de Situação, ciclo atual)
      const [currentSettings, situation] = await Promise.all([
        riskEngineService.getSettings(municipalityId),
        situationRoomService.getSituationData({ municipalityId, periodFilter: 'cycle', forceRefresh: true }),
      ]);

      setSettings(currentSettings);
      setNeighborhoods(situation.neighborhoods);
      setLoadError(null);
    } catch (err) {
      console.error('Erro ao carregar configurações de risco:', err);
      setLoadError('Não foi possível carregar os dados dos bairros.');
    } finally {
      setIsLoading(false);
    }
  }, [municipalityId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalWeight =
    settings.weightRecentFoci +
    settings.weightRecurrence +
    settings.weightEpidemiologicalCases +
    settings.weightOvitraps +
    settings.weightEggDensity +
    settings.weightComplaints +
    settings.weightClosedProperties +
    settings.weightRefusals +
    settings.weightLowCoverage +
    settings.weightOverduePe +
    settings.weightDaysWithoutVisit;

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const ok = await riskEngineService.updateSettings(municipalityId, settings);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('Falha ao salvar pesos no banco.');
      }
    } catch (err) {
      alert('Falha ao salvar pesos no banco.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        icon={ShieldAlert}
        title="Motor de Risco Territorial (Algoritmo Oficial 0 a 100)"
        subtitle="Modelagem ponderada multicritério com memória de cálculo transparente e parâmetros salvos no banco"
        actions={
          <>
            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
              Soma dos Pesos: {totalWeight}% {totalWeight === 100 ? '✅' : '⚠️ (Recomendado 100%)'}
            </span>

            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Salvando...' : saveSuccess ? 'Salvo no Banco!' : 'Salvar Pesos'}</span>
            </button>
          </>
        }
      />

      {/* Interactive Weight Sliders */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Configuração dos Pesos Ponderados (Tabela risk_settings)</span>
          </h3>
          <span className="text-[11px] text-slate-500">Parâmetros vigentes para o município</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Densidade de Focos</span>
              <span className="text-blue-700">{settings.weightRecentFoci}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={settings.weightRecentFoci}
              onChange={e => setSettings({ ...settings, weightRecentFoci: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Presença confirmada de larvas Aedes</p>
          </div>

          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Reincidência Crônica</span>
              <span className="text-purple-700">{settings.weightRecurrence}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={settings.weightRecurrence}
              onChange={e => setSettings({ ...settings, weightRecurrence: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Imóveis com ≥ 2 focos em 90 dias</p>
          </div>

          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Casos Epidemiológicos</span>
              <span className="text-rose-700">{settings.weightEpidemiologicalCases}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={settings.weightEpidemiologicalCases}
              onChange={e => setSettings({ ...settings, weightEpidemiologicalCases: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Notificações Sinan de Dengue/Zika</p>
          </div>

          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Ovitrampas (Positividade)</span>
              <span className="text-sky-700">{settings.weightOvitraps}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={settings.weightOvitraps}
              onChange={e => setSettings({ ...settings, weightOvitraps: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Dispersão de fêmeas gravídicas</p>
          </div>

          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Denúncias Comunitárias</span>
              <span className="text-amber-700">{settings.weightComplaints}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={settings.weightComplaints}
              onChange={e => setSettings({ ...settings, weightComplaints: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Chamados pendentes de vistoria</p>
          </div>

          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Imóveis Fechados</span>
              <span className="text-slate-700">{settings.weightClosedProperties}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={settings.weightClosedProperties}
              onChange={e => setSettings({ ...settings, weightClosedProperties: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Imóveis sem acesso sanitário</p>
          </div>

          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Pontos Estratégicos Vencidos</span>
              <span className="text-indigo-700">{settings.weightOverduePe}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={settings.weightOverduePe}
              onChange={e => setSettings({ ...settings, weightOverduePe: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">PE sem vistoria quinzenal (&gt; 15 dias)</p>
          </div>

          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Déficit de Cobertura</span>
              <span className="text-emerald-700">{settings.weightLowCoverage}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={settings.weightLowCoverage}
              onChange={e => setSettings({ ...settings, weightLowCoverage: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Cobertura do ciclo abaixo de 80%</p>
          </div>
        </div>
      </div>

      {/* Neighborhood Risk Ranking & Memória de Cálculo */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Memória de Cálculo e Análise Causal por Bairro
        </h3>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-1" />
            <span className="text-xs">Carregando cálculo de risco dos bairros...</span>
          </div>
        ) : loadError || neighborhoods.length === 0 ? (
          <div className="py-10 text-center text-slate-500 bg-white rounded-xl border border-slate-200 text-xs" role={loadError ? 'alert' : undefined}>
            {loadError || 'Sem bairros registrados para o município.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {neighborhoods.map(n => {
              // Recalcula com os pesos em edição, sobre as entradas reais do bairro
              const riskCalc: RiskCalculationResult = riskEngineService.calculateScore({ settings, ...n.riskInputs });

              const isCritical = riskCalc.level === 'CRITICO';
              const isHigh = riskCalc.level === 'ALTO';

              return (
                <div
                  key={n.id}
                  className={`bg-white rounded-xl border p-5 shadow-xs space-y-3 ${
                    isCritical ? 'border-rose-300' : isHigh ? 'border-orange-300' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {n.id.slice(0, 8)}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-1">{n.name}</h4>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                        isCritical ? 'bg-rose-100 text-rose-700' : isHigh ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        ÍNDICE {riskCalc.score}/100 — {riskCalc.level}
                      </span>
                    </div>
                  </div>

                  {/* Transparent breakdown: "Por que esta área está em risco?" */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Info className="w-3.5 h-3.5 text-blue-600" />
                      <span>Por que esta área está em risco? (Memória de Cálculo)</span>
                    </div>
                    <ul className="space-y-1 text-slate-600 pl-4 list-disc text-[11px]">
                      {riskCalc.factors.length > 0 ? (
                        riskCalc.factors.map((f, i) => (
                          <li key={i}>
                            <strong>{f.name}:</strong> {f.description} (+{f.points} pts)
                          </li>
                        ))
                      ) : (
                        <li>Nenhum fator de risco identificado nos dados registrados.</li>
                      )}
                    </ul>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <span>Cobertura: {n.coveragePercentage === null ? 'sem imóveis' : `${n.coveragePercentage}%`}</span>
                    <span>Focos: {n.fociCount}</span>
                    <span className="font-semibold text-blue-600">Recomendação: {isCritical ? 'Bloqueio Imediato' : 'Varredura'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
