import React, { useState } from 'react';
import {
  Activity,
  Plus,
  Flame,
  AlertTriangle,
  Clock,
  CheckCircle,
  MapPin,
  Calendar,
  Users,
  Shield,
  Radio,
  X,
} from 'lucide-react';
import { db } from '../../services/storage';
import { EpidemiologicalBlock } from '../../types';

export const EpidemiologyView: React.FC = () => {
  const [blocks, setBlocks] = useState<EpidemiologicalBlock[]>(db.getEpidemiologyBlocks());
  const [showNewBlockModal, setShowNewBlockModal] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState<'DENGUE' | 'ZIKA' | 'CHIKUNGUNYA' | 'FEBRE_AMARELA'>('DENGUE');
  const [patientName, setPatientName] = useState('');
  const [neighborhood, setNeighborhood] = useState('Vila Nova');
  const [radiusMeters, setRadiusMeters] = useState(150);

  const neighborhoods = db.getNeighborhoods();

  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    const newBlock: EpidemiologicalBlock = {
      id: `blk-${Date.now()}`,
      code: `BLQ-2026-0${blocks.length + 15}`,
      municipalityId: 'mun-santacruz',
      eventId: `notif-${Date.now()}`,
      disease: selectedDisease,
      targetNeighborhood: neighborhood,
      targetSector: 'Setor 01',
      radiusMeters,
      scheduledDate: new Date().toISOString().split('T')[0],
      assignedTeamId: 'team-01',
      assignedTeamName: 'Equipe de Bloqueio Rápido',
      priority: 'URGENTE',
      propertiesForecast: radiusMeters === 150 ? 120 : 250,
      propertiesVisited: 0,
      propertiesClosed: 0,
      propertiesPending: 0,
      fociFound: 0,
      coveragePercentage: 0,
      status: 'EM_ANDAMENTO',
    };

    const updated = [newBlock, ...blocks];
    setBlocks(updated);
    localStorage.setItem('endemias_blocks', JSON.stringify(updated));
    setShowNewBlockModal(false);
    setPatientName('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-rose-600" />
            <span>Vigilância Epidemiológica & Bloqueio de Transmissão Viral</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Resposta rápida a notificações de Dengue, Zika e Chikungunya com contenção peridomiciliar
          </p>
        </div>

        <button
          onClick={() => setShowNewBlockModal(true)}
          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Disparar Operação de Bloqueio</span>
        </button>
      </div>

      {/* Active Operations List */}
      <div className="space-y-4">
        {blocks.map(blk => {
          const isPending = blk.status === 'EM_ANDAMENTO';

          return (
            <div
              key={blk.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
            >
              {/* Top info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                    {blk.code}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-black bg-rose-600 text-white">
                    {blk.disease}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    Raio Territorial: {blk.radiusMeters}m peridomiciliar
                  </span>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  blk.status === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700 animate-pulse'
                }`}>
                  {blk.status === 'EM_ANDAMENTO' ? 'EM ANDAMENTO (PRAZO 48H)' : 'CONCLUÍDO'}
                </span>
              </div>

              {/* Progress & Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs">
                <div>
                  <span className="text-slate-500">Bairro / Setor:</span>
                  <p className="font-bold text-slate-900">{blk.targetNeighborhood} ({blk.targetSector})</p>
                </div>
                <div>
                  <span className="text-slate-500">Imóveis no Raio:</span>
                  <p className="font-bold text-slate-900">{blk.propertiesVisited} / {blk.propertiesForecast}</p>
                </div>
                <div>
                  <span className="text-slate-500">Cobertura da Ação:</span>
                  <p className="font-bold text-rose-600">{blk.coveragePercentage}%</p>
                </div>
                <div>
                  <span className="text-slate-500">Agendamento:</span>
                  <p className="font-bold text-slate-900">{blk.scheduledDate}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                  <span>Cobertura de Visitas no Raio Epidêmico</span>
                  <span>{blk.coveragePercentage}% concluído</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${blk.coveragePercentage >= 80 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${blk.coveragePercentage}%` }}
                  />
                </div>
              </div>

              {/* Intervention badges */}
              <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 gap-2">
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <CheckCircle className={`w-4 h-4 ${blk.coveragePercentage > 0 ? 'text-emerald-600' : 'text-slate-300'}`} />
                    Bloqueio Focal (Depósitos)
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <CheckCircle className={`w-4 h-4 ${blk.status === 'FINALIZADO' ? 'text-emerald-600' : 'text-slate-300'}`} />
                    Bloqueio Químico (UBV / Nebulização)
                  </span>
                </div>

                <button className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition">
                  Ver Imóveis do Raio no Mapa
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Block Modal */}
      {showNewBlockModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Disparar Operação de Bloqueio Viral</h3>
              <button onClick={() => setShowNewBlockModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBlock} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Agravo / Doença Notificada</label>
                <select
                  value={selectedDisease}
                  onChange={e => setSelectedDisease(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold text-slate-800"
                >
                  <option value="DENGUE">Dengue (Casos Suspeitos / Confirmados)</option>
                  <option value="CHIKUNGUNYA">Chikungunya</option>
                  <option value="ZIKA">Zika Vírus</option>
                  <option value="FEBRE_AMARELA">Febre Amarela Urbana</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bairro do Caso Index</label>
                <select
                  value={neighborhood}
                  onChange={e => setNeighborhood(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-medium text-slate-800"
                >
                  {neighborhoods.map(n => (
                    <option key={n.id} value={n.name}>{n.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Raio Territorial de Contenção</label>
                <select
                  value={radiusMeters}
                  onChange={e => setRadiusMeters(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-slate-300 font-medium text-slate-800"
                >
                  <option value={150}>150 metros peridomiciliar (~120 imóveis / 9 quadras)</option>
                  <option value={300}>300 metros ampliado (~250 imóveis)</option>
                  <option value={500}>500 metros (Surto / Transmissão acelerada)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewBlockModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
                >
                  Iniciar Bloqueio Imediato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
