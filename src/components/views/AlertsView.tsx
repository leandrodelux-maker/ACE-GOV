import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { alertsService, AlertNotificationItem } from '../../services/alertsService';
import { supabaseService } from '../../services/supabaseService';
import { PageHeader } from '../ui';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';

export const AlertsView: React.FC = () => {
  const { user: sessionUser } = useAuth();
  const { municipality: sessionMunicipality } = useAuth();
  const municipalityId = useMunicipalityId();
  const [alerts, setAlerts] = useState<AlertNotificationItem[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const muni = sessionMunicipality;
      const muniId = municipalityId;
      const data = await alertsService.getAlerts(muniId);
      setAlerts(data);
    } catch (err) {
      console.error('Erro ao carregar alertas:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleResolveAlert = async (id: string) => {
    setResolvingId(id);
    try {
      const ok = await alertsService.acknowledgeAlert(id, sessionUser?.name || 'Usuário autenticado', municipalityId);
      if (ok) {
        setAlerts(prev =>
          prev.map(a => (a.id === id ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a))
        );
      }
    } catch (err) {
      console.error('Erro ao resolver alerta:', err);
    } finally {
      setResolvingId(null);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filterType === 'ALL') return true;
    return a.type === filterType || (filterType === 'CRITICO' && a.severity === 'CRITICO');
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={Bell}
        title="Central de Alertas em Tempo Real (Supabase)"
        subtitle="Incidentes epidemiológicos, entomológicos, operacionais e administrativos conectados ao banco"
        actions={
          <>
            <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1.5 rounded-md transition ${filterType === 'ALL' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
              >
                Todos ({alerts.length})
              </button>
              <button
                onClick={() => setFilterType('CRITICO')}
                className={`px-3 py-1.5 rounded-md transition ${filterType === 'CRITICO' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'}`}
              >
                Críticos
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

            <button
              onClick={loadAlerts}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              title="Recarregar alertas"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-rose-600' : ''}`} />
            </button>
          </>
        }
      />

      {/* Alerts Feed */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-600 mb-2" />
          <p className="text-xs">Consultando alertas no Supabase...</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
          Nenhum alerta pendente com o filtro selecionado.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map(alert => {
            const isCritical = alert.severity === 'CRITICO';
            const isHigh = alert.severity === 'ALTO' || alert.severity === 'ATENCAO';

            return (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition bg-white shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                  alert.acknowledged
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
                      {alert.severity} • {alert.type}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{alert.title}</span>
                  </div>

                  <p className="text-xs text-slate-600">{alert.description}</p>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span>Criado em: {new Date(alert.createdAt).toLocaleString('pt-BR')}</span>
                    {alert.acknowledgedAt && (
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Reconhecido em: {new Date(alert.acknowledgedAt).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {alert.acknowledged ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                      <CheckCircle className="w-3.5 h-3.5" /> Atendido
                    </span>
                  ) : (
                    <button
                      onClick={() => handleResolveAlert(alert.id)}
                      disabled={resolvingId === alert.id}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {resolvingId === alert.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <span>Marcar como Atendido</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
