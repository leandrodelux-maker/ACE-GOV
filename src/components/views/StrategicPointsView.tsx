import React, { useState } from 'react';
import {
  Crosshair,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle,
  MapPin,
  Calendar,
  Building,
  ArrowUpRight,
} from 'lucide-react';
import { db } from '../../services/storage';
import { StrategicPoint } from '../../types';

export const StrategicPointsView: React.FC = () => {
  const [points, setPoints] = useState<StrategicPoint[]>(db.getStrategicPoints());

  const overdueCount = points.filter(p => p.isInspectionOverdue).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-amber-600" />
            <span>Pontos Estratégicos (PE) — Vigilância Quinzenal</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Borracharias, ferros-velhos, cemitérios e depósitos de reciclagem (Diretriz MS: Inspeção a cada 15 dias)
          </p>
        </div>

        {overdueCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{overdueCount} inspeções quinzenais vencidas!</span>
          </div>
        )}
      </div>

      {/* Grid of Strategic Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {points.map(pe => (
          <div
            key={pe.id}
            className={`bg-white rounded-xl border p-5 shadow-xs space-y-3 transition ${
              pe.isInspectionOverdue ? 'border-rose-300 bg-rose-50/10' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 uppercase">
                  {pe.type}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1.5">{pe.name}</h3>
                <p className="text-xs text-slate-500">{pe.address} • {pe.neighborhood}</p>
              </div>

              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                pe.isInspectionOverdue ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {pe.isInspectionOverdue ? 'INSPEÇÃO VENCIDA' : 'EM DIA'}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Responsável:</span>
                <span className="font-semibold text-slate-800">{pe.managerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Última Inspeção:</span>
                <span className="font-bold text-slate-900">{pe.lastInspectionDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Próxima Quinzenal:</span>
                <span className={`font-bold ${pe.isInspectionOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                  {pe.nextInspectionDate}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Depósitos Críticos Predominantes:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {pe.criticalDeposits.map((dep, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                    {dep}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">ACE: {pe.assignedAgentName}</span>
              <button className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition">
                Registrar Vistoria PE
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
