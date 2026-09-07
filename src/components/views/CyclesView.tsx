import React from 'react';
import { Clock } from 'lucide-react';
import { db } from '../../services/storage';
import { FieldCycle } from '../../types';

export const CyclesView: React.FC = () => {
  const currentCycle: FieldCycle = db.getCycle();

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span>Ciclos Operacionais & Cronograma LIRAa / LIA</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerenciamento dos ciclos bimestrais de visitas e metas pactuadas com o Ministério da Saúde
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
              Ciclo Ativo
            </span>
            <h2 className="text-lg font-black text-slate-900 mt-1">{currentCycle.name}</h2>
            <p className="text-xs text-slate-500">Status: {currentCycle.status} • Ano: {currentCycle.year}</p>
          </div>

          <div className="text-right text-xs">
            <span className="text-slate-400">Vigência</span>
            <p className="font-bold text-slate-900">{currentCycle.startDate} a {currentCycle.endDate}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl text-center text-xs">
          <div>
            <span className="text-slate-500 font-semibold">Meta de Cobertura</span>
            <p className="text-xl font-extrabold text-blue-700 mt-1">{currentCycle.goalPercentage}%</p>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">Cobertura Atual</span>
            <p className="text-xl font-extrabold text-emerald-700 mt-1">{currentCycle.currentCoveragePercentage}%</p>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">Imóveis Visitados</span>
            <p className="text-xl font-extrabold text-slate-800 mt-1">{currentCycle.visitedProperties.toLocaleString('pt-BR')}</p>
          </div>
        </div>

        <div className="space-y-1 pt-2">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Progresso da Cobertura Municipal</span>
            <span>{currentCycle.currentCoveragePercentage}% de {currentCycle.goalPercentage}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full"
              style={{ width: `${Math.min(100, currentCycle.currentCoveragePercentage)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
