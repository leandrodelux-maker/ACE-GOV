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
  Search,
} from 'lucide-react';
import { db } from '../../services/storage';
import { Equipment } from '../../types';

export const EquipmentView: React.FC = () => {
  const [equipments] = useState<Equipment[]>(db.getEquipments());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filteredEquipments = equipments.filter(eq => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (eq.name?.toLowerCase().includes(q) ?? false) ||
      (eq.code?.toLowerCase().includes(q) ?? false) ||
      (eq.brandModel?.toLowerCase().includes(q) ?? false) ||
      (eq.assignedToAgentName?.toLowerCase().includes(q) ?? false);
    const matchesStatus = filterStatus === 'ALL' || eq.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

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
        <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
          {filteredEquipments.length} equipamentos
        </span>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex-1 min-w-[240px] text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, código, modelo ou agente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-medium text-slate-700 text-xs outline-none cursor-pointer"
        >
          <option value="ALL">Todos os Status</option>
          <option value="DISPONIVEL">Disponível</option>
          <option value="EM_USO">Em Uso</option>
          <option value="EM_MANUTENCAO">Em Manutenção</option>
        </select>
      </div>

      {/* Equipments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEquipments.map(eq => {
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
