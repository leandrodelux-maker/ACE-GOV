import React, { useState } from 'react';
import {
  MapPin,
  Plus,
  Search,
  Filter,
  Users,
  Home,
  CheckCircle2,
  ChevronRight,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { db } from '../../services/storage';
import { Neighborhood } from '../../types';

export const TerritoryView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNeighborhoodName, setNewNeighborhoodName] = useState('');
  const [newZoneId, setNewZoneId] = useState('zone-urbana');
  const [newTotalProps, setNewTotalProps] = useState(500);

  const neighborhoods = db.getNeighborhoods();
  const zones = db.getZones();
  const municipality = db.getMunicipality();

  const filteredNeighborhoods = neighborhoods.filter(n => {
    const matchesSearch = n.name.toLowerCase().includes(searchTerm.toLowerCase()) || n.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZone = selectedZone === 'ALL' || n.zoneId === selectedZone;
    return matchesSearch && matchesZone;
  });

  const handleAddNeighborhood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNeighborhoodName) return;

    const zoneObj = zones.find(z => z.id === newZoneId) || zones[0];

    db.addNeighborhood({
      municipalityId: 'mun-santacruz',
      zoneId: zoneObj.id,
      name: newNeighborhoodName,
      estimatedPopulation: newTotalProps * 3,
      totalProperties: newTotalProps,
      totalSectors: 2,
      totalBlocks: 10,
      responsibleAgents: ['usr-ace-01'],
      coveragePercentage: 0,
      fociCount: 0,
      riskScore: 20,
      riskLevel: 'BAIXO',
      pendingVisitsCount: newTotalProps,
      latitude: -29.718,
      longitude: -52.428,
    });

    setShowAddModal(false);
    setNewNeighborhoodName('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span>Território Municipal — {municipality.name} ({municipality.state})</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Hierarquia oficial: Município → Zonas ({zones.length}) → Bairros ({neighborhoods.length}) → Setores → Quadras → Imóveis
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Bairro / Localidade</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex-1 min-w-[200px] text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome do bairro..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Filtrar por Zona:</span>
          <select
            value={selectedZone}
            onChange={e => setSelectedZone(e.target.value)}
            className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">Todas as Zonas ({zones.length})</option>
            {zones.map(z => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Neighborhoods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredNeighborhoods.map(neigh => {
          const isCritical = neigh.riskLevel === 'CRITICO';
          const isHigh = neigh.riskLevel === 'ALTO';
          const workedEstimated = Math.round((neigh.totalProperties * neigh.coveragePercentage) / 100);

          return (
            <div
              key={neigh.id}
              className={`bg-white rounded-xl border p-5 shadow-xs hover:shadow-md transition space-y-4 ${
                isCritical ? 'border-rose-300' : isHigh ? 'border-orange-300' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {neigh.id}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      isCritical ? 'bg-rose-100 text-rose-700' : isHigh ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      Risco {neigh.riskLevel} ({neigh.riskScore}/100)
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1.5">{neigh.name}</h3>
                  <p className="text-xs text-slate-500">
                    {zones.find(z => z.id === neigh.zoneId)?.name || 'Zona Urbana'}
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-500">Imóveis</span>
                  <p className="font-bold text-slate-800">{neigh.totalProperties.toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Cobertura</span>
                  <p className="font-bold text-blue-700">{neigh.coveragePercentage}%</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Focos</span>
                  <p className="font-bold text-rose-600">{neigh.fociCount}</p>
                </div>
              </div>

              {/* Pendencies & Status */}
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Pendências / Retornos:</span>
                <span className="font-bold text-amber-700">{neigh.pendingVisitsCount} imóveis</span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Imóveis Trabalhados no Ciclo:</span>
                  <span className="font-bold text-slate-800">{workedEstimated} de {neigh.totalProperties}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${neigh.coveragePercentage >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${neigh.coveragePercentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Neighborhood Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Cadastrar Novo Bairro / Território
            </h3>

            <form onSubmit={handleAddNeighborhood} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Bairro</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jardim das Oliveiras"
                  value={newNeighborhoodName}
                  onChange={e => setNewNeighborhoodName(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Zona</label>
                <select
                  value={newZoneId}
                  onChange={e => setNewZoneId(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-medium text-slate-800"
                >
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Total de Imóveis Estimados</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newTotalProps}
                  onChange={e => setNewTotalProps(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-slate-300 font-medium text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                >
                  Salvar Bairro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
