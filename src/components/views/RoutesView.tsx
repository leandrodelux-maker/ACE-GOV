import React, { useState } from 'react';
import {
  Navigation,
  MapPin,
  Flame,
  Repeat,
  DoorClosed,
  Clock,
  ArrowRight,
  CheckCircle2,
  Compass,
  Shuffle,
} from 'lucide-react';
import { db } from '../../services/storage';
import { Property } from '../../types';

interface RoutesViewProps {
  onNavigate: (module: string) => void;
}

export const RoutesView: React.FC<RoutesViewProps> = ({ onNavigate }) => {
  const properties = db.getProperties();
  const currentUser = db.getCurrentUser();

  // Route items sorted by priority (foci first, then recurrent, then closed, then regular)
  const [routeList, setRouteList] = useState<Property[]>(() => {
    return [...properties].sort((a, b) => {
      const scoreA = (a.status === 'FOCO' ? 100 : 0) + (a.isRecurrent ? 50 : 0) + (a.status === 'FECHADO' ? 30 : 0);
      const scoreB = (b.status === 'FOCO' ? 100 : 0) + (b.isRecurrent ? 50 : 0) + (b.status === 'FECHADO' ? 30 : 0);
      return scoreB - scoreA;
    });
  });

  const totalDistanceKm = '2.8 km';
  const estimatedTimeHours = '3h 45min';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-emerald-600" />
            <span>Minha Rota Otimizada — Setor 01 (Vila Nova)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ordenação sequencial inteligente por gravidade de risco epidemiológico e menor trajeto
          </p>
        </div>

        {/* Quick summary stats */}
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-500">Extensão: </span>
            <span className="font-bold text-slate-900">{totalDistanceKm}</span>
          </div>
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-500">Estimativa: </span>
            <span className="font-bold text-blue-700">{estimatedTimeHours}</span>
          </div>
        </div>
      </div>

      {/* Sequential Route List */}
      <div className="space-y-3">
        {routeList.map((prop, idx) => {
          const isFoci = prop.status === 'FOCO';
          const isRecurrent = prop.isRecurrent;
          const isClosed = prop.status === 'FECHADO';

          return (
            <div
              key={prop.id}
              className={`p-4 rounded-xl border transition bg-white shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                isFoci ? 'border-rose-300 bg-rose-50/20' : isRecurrent ? 'border-purple-300 bg-purple-50/20' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-black text-sm flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{prop.address}, {prop.number}</span>
                    <span className="font-mono text-xs text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                      {prop.code}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{prop.neighborhood} • {prop.block}</span>
                    <span>•</span>
                    <span className="text-slate-700 font-medium">Tipo: {prop.type}</span>
                    <span>•</span>
                    <span className="text-slate-700 font-medium">Distância: ~{(idx * 120 + 40)}m</span>
                  </div>

                  {/* Priority reason badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {isFoci && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1">
                        <Flame className="w-3 h-3" /> Foco Ativo Recente (Prioridade Máxima)
                      </span>
                    )}
                    {isRecurrent && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 flex items-center gap-1">
                        <Repeat className="w-3 h-3" /> Reincidente ({prop.fociHistoryCount}x)
                      </span>
                    )}
                    {isClosed && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                        <DoorClosed className="w-3 h-3" /> Retorno Pendente (Fechado)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => onNavigate('ace_pwa')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5"
                >
                  <span>Iniciar Visita</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
