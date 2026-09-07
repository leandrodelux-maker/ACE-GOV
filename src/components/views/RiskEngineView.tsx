import React, { useState } from 'react';
import {
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { db } from '../../services/storage';

export const RiskEngineView: React.FC = () => {
  const neighborhoods = db.getNeighborhoods();

  // Configurable weights (Prompt 21)
  const [weightFoci, setWeightFoci] = useState(30);
  const [weightOvitraps, setWeightOvitraps] = useState(25);
  const [weightCases, setWeightCases] = useState(20);
  const [weightPendencies, setWeightPendencies] = useState(15);
  const [weightStrategic, setWeightStrategic] = useState(10);

  const totalWeight = weightFoci + weightOvitraps + weightCases + weightPendencies + weightStrategic;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <span>Motor de Risco Territorial (Algoritmo 0 a 100)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Modelagem ponderada multicritério com memória de cálculo transparente para cada bairro
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
            Soma dos Pesos: {totalWeight}% {totalWeight === 100 ? '✅' : '⚠️ (Ajuste para 100%)'}
          </span>
        </div>
      </div>

      {/* Interactive Weight Sliders */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Configuração dos Pesos dos Indicadores de Risco</span>
          </h3>
          <span className="text-[11px] text-slate-500">Parâmetros vigentes para o 1º Ciclo</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Densidade de Focos</span>
              <span className="text-blue-700">{weightFoci}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={weightFoci}
              onChange={e => setWeightFoci(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Presença confirmada de larvas Aedes</p>
          </div>

          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Ovitrampas (Ovos)</span>
              <span className="text-sky-700">{weightOvitraps}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={weightOvitraps}
              onChange={e => setWeightOvitraps(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Positividade e densidade de ovos</p>
          </div>

          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Casos Notificados</span>
              <span className="text-rose-700">{weightCases}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={weightCases}
              onChange={e => setWeightCases(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Notificações Sinan de Dengue/Zika</p>
          </div>

          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Pendências / Fechados</span>
              <span className="text-amber-700">{weightPendencies}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={weightPendencies}
              onChange={e => setWeightPendencies(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Imóveis não inspecionados</p>
          </div>

          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-bold">
              <span>Pontos Estratégicos</span>
              <span className="text-indigo-700">{weightStrategic}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={weightStrategic}
              onChange={e => setWeightStrategic(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Borracharias e ferros-velhos</p>
          </div>
        </div>
      </div>

      {/* Neighborhood Risk Ranking & "Por que esta área está em risco?" */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Memória de Cálculo e Análise Causal por Bairro
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {neighborhoods.map(n => {
            const isCritical = n.riskLevel === 'CRITICO';
            const isHigh = n.riskLevel === 'ALTO';
            const riskDetails = db.calculateTerritoryRisk(n.id);

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
                      {n.id}
                    </span>
                    <h4 className="text-base font-bold text-slate-900 mt-1">{n.name}</h4>
                  </div>

                  <div className="text-right">
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                      isCritical ? 'bg-rose-100 text-rose-700' : isHigh ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      ÍNDICE {n.riskScore}/100 — {n.riskLevel}
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
                    {riskDetails.factors.length > 0 ? (
                      riskDetails.factors.map((f, i) => (
                        <li key={i}><strong>{f.label}:</strong> {f.impactText} (+{f.value} pts)</li>
                      ))
                    ) : (
                      <li>Área monitorada sob parâmetros epidemiológicos normais ({n.coveragePercentage}% de cobertura).</li>
                    )}
                  </ul>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <span>Cobertura: {n.coveragePercentage}%</span>
                  <span>Focos Detectados: {n.fociCount}</span>
                  <span className="font-semibold text-blue-600">Recomendação: {isCritical ? 'Bloqueio Imediato' : 'Varredura'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
