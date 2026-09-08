import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
  X,
  Layers,
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { supabaseService } from '../../services/supabaseService';
import { Neighborhood, Municipality } from '../../types';

export const TerritoryView: React.FC = () => {
  const [municipality, setMunicipality] = useState<Municipality | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [territoryStats, setTerritoryStats] = useState<{ sectorsCount: number; blocksCount: number }>({
    sectorsCount: 0,
    blocksCount: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNeighborhoodName, setNewNeighborhoodName] = useState('');
  const [newTotalProps, setNewTotalProps] = useState(500);
  const [isSaving, setIsSaving] = useState(false);

  const loadTerritoryData = useCallback(async () => {
    setIsLoading(true);
    try {
      const muni = await supabaseService.getMunicipality();
      if (muni) {
        setMunicipality(muni);
        const [neighs, hierarchy] = await Promise.all([
          supabaseService.getNeighborhoods(muni.id),
          supabaseService.getTerritoryHierarchy(muni.id),
        ]);

        if (neighs) setNeighborhoods(neighs);
        setTerritoryStats({
          sectorsCount: hierarchy.sectors.length,
          blocksCount: hierarchy.blocks.length,
        });
      }
    } catch (err) {
      console.error('Erro ao carregar território:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTerritoryData();
  }, [loadTerritoryData]);

  const filteredNeighborhoods = neighborhoods.filter(n => {
    const matchesSearch = n.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleAddNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNeighborhoodName || !municipality) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('neighborhoods').insert({
        municipality_id: municipality.id,
        name: newNeighborhoodName,
        population: newTotalProps * 3,
      });

      if (error) throw error;

      setShowAddModal(false);
      setNewNeighborhoodName('');
      await loadTerritoryData();
    } catch (err: any) {
      alert(`Erro ao cadastrar bairro: ${err.message || 'Falha de conexão'}`);
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
            <MapPin className="w-5 h-5 text-blue-600" />
            <span>Território Sanitário — {municipality?.name || 'Município'} ({municipality?.state || 'RS'})</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Hierarquia do SUS: Município → Bairros ({neighborhoods.length}) → Setores Censitários ({territoryStats.sectorsCount}) → Quadras ({territoryStats.blocksCount}) → Imóveis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Bairro</span>
          </button>

          <button
            onClick={loadTerritoryData}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
            title="Atualizar dados territoriais"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
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

        <div className="text-xs font-semibold text-slate-600">
          {filteredNeighborhoods.length} bairros mapeados
        </div>
      </div>

      {/* Neighborhoods Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-xs">Carregando divisão territorial do banco...</p>
        </div>
      ) : filteredNeighborhoods.length === 0 ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
          Nenhum bairro encontrado.
        </div>
      ) : (
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
                        {neigh.id.slice(0, 8)}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isCritical ? 'bg-rose-100 text-rose-700' : isHigh ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        Risco {neigh.riskLevel}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1.5">{neigh.name}</h3>
                    <p className="text-xs text-slate-500">
                      População Est.: {neigh.estimatedPopulation?.toLocaleString('pt-BR')} hab.
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
                  <span>Pendências de Visita:</span>
                  <span className="font-bold text-amber-700">{neigh.pendingVisitsCount} imóveis</span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Cobertura do Ciclo:</span>
                    <span className="font-bold text-slate-800">{neigh.coveragePercentage}%</span>
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
      )}

      {/* Add Neighborhood Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Cadastrar Novo Bairro / Localidade
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNeighborhood} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Bairro</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Universitário"
                  value={newNeighborhoodName}
                  onChange={e => setNewNeighborhoodName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estimativa de Imóveis</label>
                <input
                  type="number"
                  min="10"
                  max="50000"
                  value={newTotalProps}
                  onChange={e => setNewTotalProps(parseInt(e.target.value) || 100)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold shadow-xs transition"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Bairro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
