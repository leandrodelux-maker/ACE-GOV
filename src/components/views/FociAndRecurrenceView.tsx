import React, { useState } from 'react';
import {
  Flame,
  Repeat,
  AlertTriangle,
  FileWarning,
  Send,
  CheckCircle2,
  Calendar,
  Building,
  User,
  ShieldAlert,
} from 'lucide-react';
import { db } from '../../services/storage';
import { Property } from '../../types';

export const FociAndRecurrenceView: React.FC = () => {
  const properties = db.getProperties();
  const visits = db.getVisits();
  const recurrentProperties = properties.filter(p => p.isRecurrent || p.fociHistoryCount >= 2);
  const activeFociProperties = properties.filter(p => p.status === 'FOCO');
  
  // Cálculo real a partir dos registros de visitas e depósitos tratados
  const eliminatedFociCount = visits.reduce(
    (acc, v) => acc + (v.larvicideDepositsCount || 0) + (v.mechanicalEliminationCount || 0),
    0
  ) || properties.filter(p => p.status === 'NORMAL' && p.fociHistoryCount > 0).length;

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [notificationSent, setNotificationSent] = useState(false);

  const handleEmitNotification = () => {
    if (selectedProperty) {
      db.addAuditLog(
        'CADASTRO',
        'Focos e Reincidências',
        `Notificação Sanitária emitida para o imóvel ${selectedProperty.code} (${selectedProperty.address}, ${selectedProperty.number})`
      );
    }
    setNotificationSent(true);
    setTimeout(() => {
      setNotificationSent(false);
      setSelectedProperty(null);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-600" />
            <span>Central de Focos e Imóveis Reincidentes</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoramento sanitário rigoroso de criadouros persistentes e reincidência de Aedes aegypti
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
            Regra Municipal: ≥ 3 focos em 90 dias
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-bold uppercase">Focos Ativos no Ciclo</span>
            <Flame className="w-4 h-4 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-rose-700 mt-2">{activeFociProperties.length}</p>
          <span className="text-[10px] text-rose-600">Tratamento em execução</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-xs">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-xs font-bold uppercase">Imóveis Reincidentes</span>
            <Repeat className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-purple-700 mt-2">{recurrentProperties.length}</p>
          <span className="text-[10px] text-purple-600">Requerem notificação sanitária</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-bold uppercase">Focos Eliminados</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">{eliminatedFociCount}</p>
          <span className="text-[10px] text-emerald-700">Conduta física / larvicida</span>
        </div>
      </div>

      {/* Reincident Properties Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Imóveis com Histórico de Reincidência e Infestação Persistente
          </h3>
          <p className="text-xs text-slate-500">Acompanhamento contínuo e histórico de autuações</p>
        </div>

        <div className="divide-y divide-slate-100">
          {recurrentProperties.map(prop => (
            <div key={prop.id} className="p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{prop.address}, {prop.number}</span>
                  <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-purple-100 text-purple-700">
                    {prop.fociHistoryCount} Focos Registrados
                  </span>
                  {prop.status === 'FOCO' && (
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-700 animate-pulse">
                      FOCO ATIVO
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-slate-500 text-[11px]">
                  <span>Código: {prop.code}</span>
                  <span>•</span>
                  <span>{prop.neighborhood} ({prop.block})</span>
                  <span>•</span>
                  <span>Morador: {prop.residentName || 'Não identificado'}</span>
                </div>

                <p className="text-[11px] text-slate-600 bg-purple-50/50 p-2 rounded border border-purple-100">
                  {prop.notes || 'Reincidência frequente em tambores sem tampa no quintal e piscina abandonada.'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setSelectedProperty(prop)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1"
                >
                  <FileWarning className="w-3.5 h-3.5" />
                  <span>Emitir Notificação Sanitária</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notification Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-700 pb-2 border-b border-slate-200">
              <FileWarning className="w-5 h-5" />
              <h3 className="text-base font-bold">Notificação Sanitária Formal — Reincidência</h3>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <p><strong>Imóvel:</strong> {selectedProperty.address}, {selectedProperty.number} ({selectedProperty.code})</p>
              <p><strong>Bairro:</strong> {selectedProperty.neighborhood} • <strong>Focos acumulados:</strong> {selectedProperty.fociHistoryCount}</p>
              <p><strong>Amparo Legal:</strong> Lei Municipal de Controle de Vetores e Código Sanitário Municipal.</p>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                O proprietário será formalmente notificado a eliminar todos os depósitos com água parada no prazo improrrogável de <strong>48 horas</strong>, sob pena de auto de infração e multa sanitária.
              </p>
            </div>

            {notificationSent ? (
              <div className="p-3 bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Notificação Sanitária NOT-2026-089 expedida e encaminhada para entrega!</span>
              </div>
            ) : (
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedProperty(null)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEmitNotification}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Expedir Notificação com Protocolo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
