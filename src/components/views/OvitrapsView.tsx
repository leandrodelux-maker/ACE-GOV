import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
  Save,
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { supabaseService } from '../../services/supabaseService';
import { Ovitrap } from '../../types';

export const OvitrapsView: React.FC = () => {
  const [ovitraps, setOvitraps] = useState<Ovitrap[]>([]);
  const [metrics, setMetrics] = useState({
    ipo: 0,
    ido: 0,
    totalTraps: 0,
    positiveTraps: 0,
    totalEggs: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [selectedTrap, setSelectedTrap] = useState<Ovitrap | null>(null);
  const [eggCountInput, setEggCountInput] = useState(0);
  const [paddleReplaced, setPaddleReplaced] = useState(true);
  const [readingNotes, setReadingNotes] = useState('');
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadOvitraps = useCallback(async () => {
    setIsLoading(true);
    try {
      const muni = await supabaseService.getMunicipality();
      const muniId = muni?.id || '00000000-0000-0000-0000-000000000001';

      const res = await supabaseService.getOvitraps(muniId);
      setOvitraps(res.ovitraps);
      setMetrics(res.metrics);
    } catch (err) {
      console.error('Erro ao carregar ovitrampas:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOvitraps();
  }, [loadOvitraps]);

  const handleOpenReading = (trap: Ovitrap) => {
    setSelectedTrap(trap);
    setEggCountInput(trap.lastEggCount || 0);
    setPaddleReplaced(true);
    setReadingNotes('');
    setShowReadingModal(true);
  };

  const handleSaveReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrap) return;

    setIsSaving(true);
    try {
      const isPos = eggCountInput > 0;
      await supabase
        .from('ovitraps')
        .update({
          eggs_count: eggCountInput,
          positive: isPos,
          last_reading_at: new Date().toISOString(),
          status: isPos ? 'POSITIVA' : 'ATIVA',
        })
        .eq('id', selectedTrap.id);

      setShowReadingModal(false);
      await loadOvitraps();
    } catch (err: any) {
      alert(`Falha ao registrar leitura: ${err.message || 'Erro no banco'}`);
    } finally {
      setIsSaving(false);
    }
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

        <button
          onClick={loadOvitraps}
          disabled={isLoading}
          className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
          title="Atualizar leituras"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-600' : ''}`} />
        </button>
      </div>

      {/* Entomological KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Armadilhas Ativas</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{metrics.totalTraps}</p>
          <span className="text-[10px] text-slate-500">Pontos sentinela</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Positividade (IPO)</span>
          <p className="text-2xl font-extrabold text-sky-700 mt-1">{metrics.ipo}%</p>
          <span className="text-[10px] text-slate-500">{metrics.positiveTraps} com ovos</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Índice Densidade Ovos (IDO)</span>
          <p className="text-2xl font-extrabold text-amber-700 mt-1">{metrics.ido}</p>
          <span className="text-[10px] text-slate-500">Ovos / armadilha positiva</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-rose-700">Total de Ovos Coletados</span>
          <p className="text-2xl font-extrabold text-rose-700 mt-1">
            {metrics.totalEggs.toLocaleString('pt-BR')}
          </p>
          <span className="text-[10px] text-rose-600">No ciclo atual</span>
        </div>
      </div>

      {/* Ovitraps List */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
          <p className="text-xs">Carregando rede de ovitrampas do banco...</p>
        </div>
      ) : ovitraps.length === 0 ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
          Nenhuma ovitrampa cadastrada no município.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ovitraps.map(trap => (
            <div
              key={trap.id}
              className={`bg-white rounded-xl border p-5 shadow-xs space-y-3 transition ${
                trap.isPositive ? 'border-rose-300' : 'border-slate-200'
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
                  <p className="text-xs text-slate-500">{trap.neighborhood} • {trap.sector || 'Setor Geral'}</p>
                </div>

                <div className="p-2 bg-slate-50 rounded-lg text-slate-600" title="Código QR da Armadilha">
                  <QrCode className="w-5 h-5" />
                </div>
              </div>

              {/* Reading and Eggs stats */}
              <div className="bg-slate-50 p-3 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Última Leitura</span>
                  <p className="text-lg font-black text-slate-900">{trap.lastEggCount || 0} ovos</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Instalação</span>
                  <p className="text-xs font-mono font-bold text-blue-700">
                    {new Date(trap.installationDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {/* Action button */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  Leitura: {trap.lastCollectionDate ? new Date(trap.lastCollectionDate).toLocaleDateString('pt-BR') : 'Sem leitura'}
                </span>
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
      )}

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
                  placeholder="Ex: Palheta recolhida para contagem em estereomicroscópio."
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
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Leitura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
