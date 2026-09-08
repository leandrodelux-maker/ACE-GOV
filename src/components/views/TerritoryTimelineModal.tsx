import React, { useState, useEffect } from 'react';
import {
  Clock,
  MapPin,
  Bug,
  Shield,
  FileText,
  AlertTriangle,
  Flame,
  CheckCircle,
  X,
  RefreshCw,
  Eye
} from 'lucide-react';
import { territoryTimelineService, TerritoryHistoryResult, TimelineEvent } from '../../services/territoryTimelineService';

interface TerritoryTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId?: string;
  neighborhoodId?: string;
  municipalityId?: string;
}

export const TerritoryTimelineModal: React.FC<TerritoryTimelineModalProps> = ({
  isOpen,
  onClose,
  propertyId,
  neighborhoodId,
  municipalityId = '00000000-0000-0000-0000-000000000001'
}) => {
  const [history, setHistory] = useState<TerritoryHistoryResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTimeline();
    }
  }, [isOpen, propertyId, neighborhoodId]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      let res: TerritoryHistoryResult;
      if (propertyId) {
        res = await territoryTimelineService.getPropertyTimeline(propertyId, municipalityId);
      } else if (neighborhoodId) {
        res = await territoryTimelineService.getNeighborhoodTimeline(neighborhoodId, municipalityId);
      } else {
        return;
      }
      setHistory(res);
    } catch (err) {
      console.error('Erro ao carregar linha do tempo territorial:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'foco': return <Bug className="w-4 h-4 text-rose-600" />;
      case 'bloqueio': return <Flame className="w-4 h-4 text-orange-600" />;
      case 'denuncia': return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default: return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Topo */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">{history?.targetTitle || 'Linha do Tempo Territorial'}</h3>
              <p className="text-xs text-slate-400">{history?.targetSubtitle || 'Histórico Sanitário Cronológico'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo de Indicadores do Local */}
        {history && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-4 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Visitas</span>
              <span className="font-bold text-slate-800 text-sm">{history.summary.totalVisits}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Focos</span>
              <span className="font-bold text-rose-600 text-sm">{history.summary.totalFoci}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Denúncias</span>
              <span className="font-bold text-amber-600 text-sm">{history.summary.totalComplaints}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Bloqueios</span>
              <span className="font-bold text-orange-600 text-sm">{history.summary.totalBlockades}</span>
            </div>
          </div>
        )}

        {/* Linha do Tempo */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-xs">Compilando linha do tempo sanitária...</span>
            </div>
          ) : !history || history.events.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhum evento histórico registrado para este local.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 border-l-2 border-slate-200 ml-3">
              {history.events.map((evt) => (
                <div key={evt.id} className="relative group">
                  {/* Ponto na timeline */}
                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-white border-2 border-slate-300 group-hover:border-emerald-500 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-emerald-500"></div>
                  </div>

                  <div className="bg-slate-50 hover:bg-slate-100/80 p-3.5 rounded-xl border border-slate-200 transition space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getEventIcon(evt.type)}
                        <span className="text-xs font-bold text-slate-900">{evt.title}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{evt.dateFormatted}</span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{evt.description}</p>

                    {evt.agentName && (
                      <div className="text-[10px] text-slate-400 pt-1 flex items-center gap-1">
                        <span>Agente Responsável:</span>
                        <span className="font-semibold text-slate-700">{evt.agentName}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
          >
            Fechar Histórico
          </button>
        </div>
      </div>
    </div>
  );
};
