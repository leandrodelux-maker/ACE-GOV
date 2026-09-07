import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Flame,
  Activity,
  Package,
  Layers,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { db } from '../../services/storage';
import { Alert } from '../../types';

export const AlertsView: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>(db.getAlerts());
  const [filterType, setFilterType] = useState<string>('ALL');

  const handleResolveAlert = (id: string) => {
    const updated = alerts.map(a => (a.id === id ? { ...a, resolved: true, resolvedAt: new Date().toISOString() } : a));
    setAlerts(updated);
    localStorage.setItem('endemias_alerts', JSON.stringify(updated));
  };

  const filteredAlerts = alerts.filter(a => {
    if (filterType === 'ALL') return true;
    return a.category === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-rose-600" />
            <span>Central de Alertas em Tempo Real</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Incidentes epidemiológicos, entomológicos, operacionais e administrativos com triagem ativa
          </p>
        </div>

        {/* Filter */}
        <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-md transition ${filterType === 'ALL' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
          >
            Todos ({alerts.length})
          </button>
          <button
            onClick={() => setFilterType('EPIDEMIOLOGICO')}
            className={`px-3 py-1.5 rounded-md transition ${filterType === 'EPIDEMIOLOGICO' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
          >
            Epidemiológicos
          </button>
          <button
            onClick={() => setFilterType('ENTOMOLOGICO')}
            className={`px-3 py-1.5 rounded-md transition ${filterType === 'ENTOMOLOGICO' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
          >
            Entomológicos
          </button>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filteredAlerts.map(alert => {
          const isCritical = alert.level === 'CRITICO';
          const isHigh = alert.level === 'IMPORTANTE' || alert.level === 'ATENCAO';

          return (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border transition bg-white shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                alert.resolved
                  ? 'opacity-60 border-slate-200 bg-slate-50/50'
                  : isCritical
                  ? 'border-rose-300 bg-rose-50/20'
                  : isHigh
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                    isCritical
                      ? 'bg-rose-100 text-rose-700'
                      : isHigh
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {alert.level} • {alert.category}
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{alert.title}</span>
                </div>

                <p className="text-xs text-slate-600">{alert.description}</p>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span>Criado em: {alert.createdAt}</span>
                  {alert.resolutionAction && (
                    <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                      Ação: {alert.resolutionAction}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {alert.resolved ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5" /> Resolvido
                  </span>
                ) : (
                  <button
                    onClick={() => handleResolveAlert(alert.id)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition"
                  >
                    Marcar como Atendido
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
