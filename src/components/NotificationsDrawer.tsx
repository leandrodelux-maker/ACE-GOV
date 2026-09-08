import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Clock,
  ExternalLink,
  Shield,
  Check,
} from 'lucide-react';
import { alertsService, AlertNotificationItem } from '../services/alertsService';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToModule?: (module: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateToModule,
}) => {
  const [alerts, setAlerts] = useState<AlertNotificationItem[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('TODOS');
  const [loading, setLoading] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAlerts();
    }
  }, [isOpen]);

  const loadAlerts = async () => {
    setLoading(true);
    const data = await alertsService.getAlerts();
    setAlerts(data);
    setLoading(false);
  };

  const handleAcknowledge = async (item: AlertNotificationItem) => {
    setAcknowledgingId(item.id);
    const res = await alertsService.acknowledgeAlert(item.id);
    setAcknowledgingId(null);
    loadAlerts();
  };

  const handleAcknowledgeAll = async () => {
    await alertsService.acknowledgeAll();
    loadAlerts();
  };

  const filtered = alerts.filter(a => {
    if (selectedSeverity === 'TODOS') return true;
    return a.severity === selectedSeverity;
  });

  const unreadCount = alerts.filter(a => !a.acknowledged).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-300">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header da Gaveta */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-sm font-bold leading-tight">Central de Alertas & Notificações</h2>
              <p className="text-[11px] text-slate-400">
                {unreadCount} alerta(s) pendente(s) de ciência
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleAcknowledgeAll}
                className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition"
              >
                Marcar lidas
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filtro de Severidade */}
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1 text-[11px] font-semibold">
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: 'CRITICO', label: 'Críticos' },
            { id: 'ALTO', label: 'Altos' },
            { id: 'ATENCAO', label: 'Atenção' },
            { id: 'INFORMATIVO', label: 'Info' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedSeverity(f.id)}
              className={`px-2.5 py-1 rounded-md transition ${
                selectedSeverity === f.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista de Alertas */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.map(item => {
            const isCritical = item.severity === 'CRITICO';
            const isHigh = item.severity === 'ALTO';

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition ${
                  item.acknowledged
                    ? 'bg-slate-50 border-slate-200 opacity-70'
                    : isCritical
                    ? 'bg-rose-50/60 border-rose-300'
                    : isHigh
                    ? 'bg-amber-50/60 border-amber-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      isCritical
                        ? 'bg-rose-600 text-white'
                        : isHigh
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.severity}
                  </span>

                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(item.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <h4 className="font-bold text-xs text-slate-900 mt-1.5">{item.title}</h4>
                <p className="text-xs text-slate-600 mt-0.5">{item.description}</p>

                <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-200/60 text-xs">
                  {item.acknowledged ? (
                    <span className="text-emerald-700 font-medium text-[11px] flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Ciência confirmada
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(item)}
                      disabled={acknowledgingId === item.id}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        isCritical
                          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                          : 'bg-slate-800 hover:bg-slate-900 text-white'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      <span>{isCritical ? 'Confirmar Ciência Obrigatória' : 'Marcar como Lido'}</span>
                    </button>
                  )}

                  {item.entityType && onNavigateToModule && (
                    <button
                      onClick={() => {
                        onClose();
                        if (item.entityType === 'EPIDEMIOLOGY_CASE') onNavigateToModule('epidemiology');
                        else if (item.entityType === 'STRATEGIC_POINT') onNavigateToModule('strategic_points');
                        else if (item.entityType === 'STOCK') onNavigateToModule('stock');
                        else onNavigateToModule('dashboard');
                      }}
                      className="text-indigo-600 hover:text-indigo-800 text-[11px] font-semibold flex items-center gap-1"
                    >
                      <span>Ver registro</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-xs text-slate-400">
              Nenhuma notificação encontrada nesta categoria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
