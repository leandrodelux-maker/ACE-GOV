import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  CheckCircle,
  AlertTriangle,
  Clock,
  BatteryCharging,
  Car,
  Tablet,
} from 'lucide-react';
import { db } from '../../services/storage';
import { Equipment } from '../../types';

export const EquipmentView: React.FC = () => {
  const [equipments, setEquipments] = useState<Equipment[]>(db.getEquipments());

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            <span>Gestão de Equipamentos, UBV & Manutenção Preventiva</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Termonebulizadores costais, bombas aspersoras, tablets de campo e frotas de apoio
          </p>
        </div>
      </div>

      {/* Equipments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {equipments.map(eq => {
          const isAvailable = eq.status === 'DISPONIVEL';
          const inMaintenance = eq.status === 'EM_MANUTENCAO';

          return (
            <div
              key={eq.id}
              className={`bg-white rounded-xl border p-5 shadow-xs space-y-3 transition ${
                inMaintenance ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {eq.code}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1.5">{eq.name}</h3>
                  <p className="text-xs text-slate-500">{eq.type} • {eq.brandModel}</p>
                </div>

                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                  isAvailable
                    ? 'bg-emerald-100 text-emerald-800'
                    : inMaintenance
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {eq.status}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Última Revisão:</span>
                  <span className="font-bold text-slate-900">{eq.lastMaintenanceDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Próxima Manutenção:</span>
                  <span className="font-bold text-blue-700">{eq.nextMaintenanceDate}</span>
                </div>
                {eq.assignedToAgentName && (
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-500">Cautelado com:</span>
                    <span className="font-semibold text-slate-800">{eq.assignedToAgentName}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition">
                  Registrar Manutenção
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
