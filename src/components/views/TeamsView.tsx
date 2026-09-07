import React, { useState } from 'react';
import {
  Users,
  Plus,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  TrendingUp,
  Activity,
  CheckCircle,
  Briefcase,
  Layers,
} from 'lucide-react';
import { db } from '../../services/storage';

export const TeamsView: React.FC = () => {
  const loadData = db.calculateAgentsOperationalLoad();

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Equipes de Campo & Carga Operacional dos Agentes (ACE)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dimensionamento da força de trabalho, balanceamento de microáreas e índice de sobrecarga
          </p>
        </div>

        <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
          6 Equipes • {loadData.length} ACEs Monitorados
        </span>
      </div>

      {/* Agents Operational Load Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Índice de Carga Operacional por Agente de Combate às Endemias
          </h3>
          <span className="text-[11px] text-slate-500">
            Fórmula ponderada: Visitas (30%) + Extensão/Rural (20%) + Pendências (20%) + Focos (20%) + Bloqueios (10%)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Agente (ACE)</th>
                <th className="py-3 px-4">Equipe / Zona</th>
                <th className="py-3 px-4">Visitas / Cobertura</th>
                <th className="py-3 px-4">Pendências</th>
                <th className="py-3 px-4">Focos Encontrados</th>
                <th className="py-3 px-4">Índice de Carga</th>
                <th className="py-3 px-4 text-right">Status Carga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadData.map(item => {
                const isOverloaded = item.loadCategory === 'SOBRECARREGADA';
                const isBalanced = item.loadCategory === 'EQUILIBRADA';

                return (
                  <tr key={item.agentId} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                          {item.agentName.charAt(0)}
                        </div>
                        <div>
                          <p>{item.agentName}</p>
                          <span className="text-[10px] text-slate-400 font-normal">Matrícula: {item.agentId}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {item.teamName} {item.ruralArea && <span className="text-amber-700 font-bold ml-1">(Zona Rural)</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-semibold">
                      {item.totalVisits} visitas ({item.coveragePercentage}%)
                    </td>
                    <td className="py-3 px-4 text-amber-700 font-semibold">{item.pendingReturns}</td>
                    <td className="py-3 px-4 text-rose-600 font-bold">{item.fociFound}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">{item.operationalLoadIndex}%</span>
                        <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.operationalLoadIndex > 75 ? 'bg-rose-500' : item.operationalLoadIndex > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${item.operationalLoadIndex}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`px-2.5 py-0.5 rounded font-extrabold text-[10px] ${
                        isOverloaded
                          ? 'bg-rose-100 text-rose-700'
                          : isBalanced
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.loadCategory}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
