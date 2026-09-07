import React, { useState } from 'react';
import {
  Layers,
  Plus,
  QrCode,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Calendar,
  X,
  Camera,
} from 'lucide-react';
import { db } from '../../services/storage';
import { Ovitrap } from '../../types';

export const OvitrapsView: React.FC = () => {
  const [ovitraps, setOvitraps] = useState<Ovitrap[]>(db.getOvitraps());
  const [selectedTrap, setSelectedTrap] = useState<Ovitrap | null>(null);
  const [eggCountInput, setEggCountInput] = useState(0);
  const [paddleReplaced, setPaddleReplaced] = useState(true);
  const [readingNotes, setReadingNotes] = useState('');
  const [showReadingModal, setShowReadingModal] = useState(false);

  // Indicators
  const totalTraps = ovitraps.length;
  const positiveTraps = ovitraps.filter(o => o.isPositive).length;
  const positivityRate = totalTraps > 0 ? Math.round((positiveTraps / totalTraps) * 100) : 0;
  const totalEggs = ovitraps.reduce((acc, o) => acc + (o.lastEggCount || 0), 0);
  const idoAverage = positiveTraps > 0 ? Math.round(totalEggs / positiveTraps) : 0;

  const handleOpenReading = (trap: Ovitrap) => {
    setSelectedTrap(trap);
    setEggCountInput(trap.lastEggCount || 0);
    setPaddleReplaced(true);
    setReadingNotes('');
    setShowReadingModal(true);
  };

  const handleSaveReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrap) return;

    const updated = ovitraps.map(o => {
      if (o.id === selectedTrap.id) {
        const isPos = eggCountInput > 0;
        const newHistory = [...(o.eggHistory || []), eggCountInput];
        const growthAlert = eggCountInput > (o.lastEggCount || 0) * 1.3;
        return {
          ...o,
          lastEggCount: eggCountInput,
          isPositive: isPos,
          eggHistory: newHistory,
          growthAlert,
          lastCollectionDate: new Date().toISOString().split('T')[0],
        };
      }
      return o;
    });

    setOvitraps(updated);
    localStorage.setItem('endemias_ovitraps', JSON.stringify(updated));
    setShowReadingModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-600" />
            <span>Vigilância Entomológica — Rede Municipal de Ovitrampas</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoramento precoce da densidade vetorial e dispersão de fêmeas de Aedes aegypti
          </p>
        </div>
      </div>

      {/* Entomological KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Armadilhas Ativas</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalTraps}</p>
          <span className="text-[10px] text-slate-500">Pontos sentinela</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Positividade (IPO)</span>
          <p className="text-2xl font-extrabold text-sky-700 mt-1">{positivityRate}%</p>
          <span className="text-[10px] text-slate-500">{positiveTraps} com ovos</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Índice Densidade Ovos (IDO)</span>
          <p className="text-2xl font-extrabold text-amber-700 mt-1">{idoAverage}</p>
          <span className="text-[10px] text-slate-500">Ovos / armadilha positiva</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-rose-700">Alertas de Alta</span>
          <p className="text-2xl font-extrabold text-rose-700 mt-1">
            {ovitraps.filter(o => o.growthAlert).length}
          </p>
          <span className="text-[10px] text-rose-600">Subida consecutiva</span>
        </div>
      </div>

      {/* Ovitraps List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ovitraps.map(trap => (
          <div
            key={trap.id}
            className={`bg-white rounded-xl border p-5 shadow-xs space-y-3 transition ${
              trap.growthAlert ? 'border-rose-300' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-sky-50 text-sky-800 px-2 py-0.5 rounded border border-sky-200">
                    {trap.code}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    trap.isPositive ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {trap.isPositive ? 'POSITIVA' : 'NEGATIVA'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-1.5">{trap.address}</h3>
                <p className="text-xs text-slate-500">{trap.neighborhood} • {trap.microarea}</p>
              </div>

              <div className="p-2 bg-slate-50 rounded-lg text-slate-600" title="Código QR da Armadilha">
                <QrCode className="w-5 h-5" />
              </div>
            </div>

            {/* Reading and Eggs stats */}
            <div className="bg-slate-50 p-3 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Última Leitura</span>
                <p className="text-lg font-black text-slate-900">{trap.lastEggCount} ovos</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Palheta</span>
                <p className="text-xs font-mono font-bold text-blue-700">{trap.paddleCode}</p>
              </div>
            </div>

            {/* Alert info */}
            {trap.growthAlert && (
              <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Alerta Entomológico: Infestação em aceleração</span>
              </div>
            )}

            {/* Action button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Coleta: {trap.lastCollectionDate}</span>
              <button
                onClick={() => handleOpenReading(trap)}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition"
              >
                Registrar Leitura
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Reading Modal */}
      {showReadingModal && selectedTrap && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Leitura Entomológica — {selectedTrap.code}</h3>
                <p className="text-xs text-slate-500">{selectedTrap.address}</p>
              </div>
              <button onClick={() => setShowReadingModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReading} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Quantidade de Ovos Contados na Palheta
                </label>
                <input
                  type="number"
                  min="0"
                  max="1500"
                  required
                  value={eggCountInput}
                  onChange={e => setEggCountInput(Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-bold text-slate-900 text-base"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer pt-1 font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={paddleReplaced}
                    onChange={e => setPaddleReplaced(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Palheta de eucalipto substituída no local</span>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações Entomológicas</label>
                <textarea
                  value={readingNotes}
                  onChange={e => setReadingNotes(e.target.value)}
                  placeholder="Ex: Presença de água limpa, fêmeas adultas avistadas na vegetação ao redor."
                  className="w-full p-2 rounded-lg border border-slate-300"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReadingModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold"
                >
                  Salvar Leitura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
