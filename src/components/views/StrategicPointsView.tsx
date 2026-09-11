import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { StrategicPoint } from '../../types';
import { PageHeader } from '../ui';

export const StrategicPointsView: React.FC = () => {
  const [points, setPoints] = useState<StrategicPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [inspectingId, setInspectingId] = useState<string | null>(null);

  const loadStrategicPoints = useCallback(async () => {
    setIsLoading(true);
    try {
      const muni = await supabaseService.getMunicipality();
      const muniId = muni?.id || '00000000-0000-0000-0000-000000000001';

      const data = await supabaseService.getStrategicPoints(muniId);
      setPoints(data);
    } catch (err) {
      console.error('Erro ao carregar pontos estratégicos:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRegisterInspection = async (pe: StrategicPoint) => {
    setInspectingId(pe.id);
    try {
      const success = await supabaseService.registerStrategicPointInspection({
        strategicPointId: pe.id,
        agentId: pe.responsibleAgentId,
        depositsFound: 2,
        positiveDeposits: 0,
        treatment: 'Tratamento Focal de rotina quinzenal',
        notes: `Inspeção do Ponto Estratégico ${pe.name} realizada com sucesso e persistida no banco.`,
      });

      if (success) {
        await loadStrategicPoints();
      }
    } catch (err) {
      console.error('Erro ao registrar vistoria de PE:', err);
    } finally {
      setInspectingId(null);
    }
  };

  useEffect(() => {
    loadStrategicPoints();
  }, [loadStrategicPoints]);

  const overdueCount = points.filter(p => p.isInspectionOverdue).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={Crosshair}
        title="Pontos Estratégicos (PE) — Vigilância Quinzenal"
        subtitle="Borracharias, ferros-velhos, cemitérios e depósitos de reciclagem (Diretriz MS: Inspeção a cada 15 dias)"
        actions={
          <>
            {overdueCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold animate-pulse">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>{overdueCount} inspeções quinzenais vencidas!</span>
              </div>
            )}

            <button
              onClick={loadStrategicPoints}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-600' : ''}`} />
            </button>
          </>
        }
      />

      {/* Grid of Strategic Points */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
          <p className="text-xs">Carregando pontos estratégicos do banco...</p>
        </div>
      ) : points.length === 0 ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
          Nenhum ponto estratégico cadastrado no município.
        </div>
      ) : (
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
                  <span className="font-semibold text-slate-800">{pe.contactName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Última Inspeção:</span>
                  <span className="font-bold text-slate-900">
                    {pe.lastInspectionDate ? new Date(pe.lastInspectionDate).toLocaleDateString('pt-BR') : 'Pendente'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Próxima Quinzenal:</span>
                  <span className={`font-bold ${pe.isInspectionOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                    {new Date(pe.nextInspectionDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">ACE: {pe.responsibleAgentName}</span>
                <button
                  onClick={() => handleRegisterInspection(pe)}
                  disabled={inspectingId === pe.id}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1"
                >
                  {inspectingId === pe.id ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Salvando no banco...</span>
                    </>
                  ) : (
                    <span>Registrar Vistoria PE</span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
