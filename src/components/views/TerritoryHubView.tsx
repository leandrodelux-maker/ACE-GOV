import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Plus,
  Search,
  Filter,
  Users,
  Home,
  Boxes,
  Map,
  Layers,
  Crosshair,
  Building2,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Eye,
  ShieldAlert,
  UserCheck,
  Building,
} from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import { Neighborhood, Municipality } from '../../types';
import { PageHeader, Breadcrumbs } from '../ui';
import { QuickCreateModal, QuickCreateEntity } from '../ui/QuickCreateModal';
import { StrategicPointsView } from './StrategicPointsView';
import { SpecialPropertiesView } from './SpecialPropertiesView';

export type TerritoryHubTab = 'overview' | 'neighborhoods' | 'sectors' | 'blocks' | 'microareas' | 'strategic_points' | 'special_properties';

interface TerritoryHubViewProps {
  onNavigate: (module: string, action?: string) => void;
  initialTab?: TerritoryHubTab;
}

export const TerritoryHubView: React.FC<TerritoryHubViewProps> = ({
  onNavigate,
  initialTab = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState<TerritoryHubTab>(initialTab);
  const [municipality, setMunicipality] = useState<Municipality | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Métricas dos Cards
  const [metrics, setMetrics] = useState({
    neighborhoodsCount: 0,
    sectorsCount: 0,
    blocksCount: 0,
    propertiesCount: 0,
    microareasCount: 0,
    teamsCount: 0,
    agentsCount: 0,
    strategicPointsCount: 0,
    specialPropertiesCount: 0,
  });

  // Dados das Listas
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [microareas, setMicroareas] = useState<any[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterNeighborhood, setFilterNeighborhood] = useState<string>('ALL');
  const [filterSector, setFilterSector] = useState<string>('ALL');

  // Modal de Criação Rápida
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  // Carregar Dados do Hub
  const loadHubData = useCallback(async () => {
    setIsLoading(true);
    try {
      const muni = await supabaseService.getMunicipality();
      const mId = muni?.id || '00000000-0000-0000-0000-000000000001';
      setMunicipality(muni);

      const [m, neighs, sects, blks, micros] = await Promise.all([
        supabaseService.getTerritoryMetrics(mId),
        supabaseService.getNeighborhoods(mId),
        supabaseService.getSectorsWithDetails(mId),
        supabaseService.getBlocksWithDetails(mId),
        supabaseService.getMicroareasWithDetails(mId),
      ]);

      setMetrics(m);
      if (neighs) setNeighborhoods(neighs);
      setSectors(sects);
      setBlocks(blks);
      setMicroareas(micros);
    } catch (err) {
      console.error('Erro ao carregar dados territoriais:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHubData();
  }, [loadHubData]);

  // Cards Principais da Central de Território
  const cards = [
    {
      id: 'neighborhoods',
      title: 'Bairros',
      count: metrics.neighborhoodsCount,
      icon: MapPin,
      desc: 'Áreas urbanas e rurais de abrangência',
      actionView: () => setActiveTab('neighborhoods'),
      actionNew: () => setQuickCreateOpen(true),
      color: 'border-emerald-200 bg-emerald-50/50 text-emerald-800',
      badgeBg: 'bg-emerald-600',
    },
    {
      id: 'sectors',
      title: 'Setores Censitários',
      count: metrics.sectorsCount,
      icon: Map,
      desc: 'Subdivisões operacionais do bairro',
      actionView: () => setActiveTab('sectors'),
      actionNew: () => setQuickCreateOpen(true),
      color: 'border-amber-200 bg-amber-50/50 text-amber-800',
      badgeBg: 'bg-amber-600',
    },
    {
      id: 'blocks',
      title: 'Quadras',
      count: metrics.blocksCount,
      icon: Boxes,
      desc: 'Quarteirões e faces de quarteirão',
      actionView: () => setActiveTab('blocks'),
      actionNew: () => setQuickCreateOpen(true),
      color: 'border-purple-200 bg-purple-50/50 text-purple-800',
      badgeBg: 'bg-purple-600',
    },
    {
      id: 'properties',
      title: 'Imóveis',
      count: metrics.propertiesCount,
      icon: Home,
      desc: 'Residências, comércios e terrenos',
      actionView: () => onNavigate('properties'),
      actionNew: () => onNavigate('properties', 'new'),
      color: 'border-blue-200 bg-blue-50/50 text-blue-800',
      badgeBg: 'bg-blue-600',
    },
    {
      id: 'microareas',
      title: 'Microáreas',
      count: metrics.microareasCount,
      icon: Layers,
      desc: 'Divisões territoriais por agente',
      actionView: () => setActiveTab('microareas'),
      actionNew: () => setQuickCreateOpen(true),
      color: 'border-indigo-200 bg-indigo-50/50 text-indigo-800',
      badgeBg: 'bg-indigo-600',
    },
    {
      id: 'teams',
      title: 'Equipes',
      count: metrics.teamsCount,
      icon: Users,
      desc: 'Grupos e supervisões municipais',
      actionView: () => onNavigate('teams'),
      actionNew: () => setQuickCreateOpen(true),
      color: 'border-cyan-200 bg-cyan-50/50 text-cyan-800',
      badgeBg: 'bg-cyan-600',
    },
    {
      id: 'agents',
      title: 'Agentes (ACE)',
      count: metrics.agentsCount,
      icon: UserCheck,
      desc: 'Profissionais de campo atuantes',
      actionView: () => onNavigate('teams'),
      actionNew: () => setQuickCreateOpen(true),
      color: 'border-teal-200 bg-teal-50/50 text-teal-800',
      badgeBg: 'bg-teal-600',
    },
    {
      id: 'strategic_points',
      title: 'Pontos Estratégicos',
      count: metrics.strategicPointsCount,
      icon: Crosshair,
      desc: 'Ferros-velhos, borracharias, cemitérios',
      actionView: () => onNavigate('strategic_points'),
      actionNew: () => onNavigate('strategic_points', 'new'),
      color: 'border-orange-200 bg-orange-50/50 text-orange-800',
      badgeBg: 'bg-orange-600',
    },
    {
      id: 'special_properties',
      title: 'Imóveis Especiais',
      count: metrics.specialPropertiesCount,
      icon: Building2,
      desc: 'Hospitais, escolas, órgãos públicos',
      actionView: () => onNavigate('special_properties'),
      actionNew: () => onNavigate('special_properties', 'new'),
      color: 'border-rose-200 bg-rose-50/50 text-rose-800',
      badgeBg: 'bg-rose-600',
    },
  ];

  // Filtros das abas
  const filteredNeighborhoods = neighborhoods.filter(n =>
    n.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSectors = sectors.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchNeigh = filterNeighborhood === 'ALL' || s.neighborhood_id === filterNeighborhood;
    return matchSearch && matchNeigh;
  });

  const filteredBlocks = blocks.filter(b => {
    const matchSearch = b.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSector = filterSector === 'ALL' || b.sector_id === filterSector;
    return matchSearch && matchSector;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Território', icon: MapPin },
          ...(activeTab !== 'overview'
            ? [{ label: activeTab === 'neighborhoods' ? 'Bairros' : activeTab === 'sectors' ? 'Setores' : activeTab === 'blocks' ? 'Quadras' : 'Microáreas' }]
            : []),
        ]}
        onHomeClick={() => onNavigate('dashboard')}
      />

      {/* PageHeader Oficial */}
      <PageHeader
        icon={MapPin}
        title={`Central de Território — ${municipality?.name || 'Município'} (${municipality?.state || 'UF'})`}
        subtitle="Gestão hierárquica e unificada: Município → Bairro → Setor Censitário → Quadra → Imóvel"
        actions={
          <>
            <button
              onClick={() => onNavigate('map')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Map className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ver no Mapa</span>
            </button>

            <button
              onClick={() => setQuickCreateOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Cadastro</span>
            </button>

            <button
              onClick={loadHubData}
              disabled={isLoading}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </>
        }
      />

      {/* Navegação de Abas do Hub */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Visão Geral & Estatísticas</span>
        </button>

        <button
          onClick={() => setActiveTab('neighborhoods')}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'neighborhoods'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Bairros ({metrics.neighborhoodsCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('sectors')}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'sectors'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Map className="w-4 h-4" />
          <span>Setores Censitários ({metrics.sectorsCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('blocks')}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'blocks'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Quadras ({metrics.blocksCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('microareas')}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'microareas'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Microáreas ({metrics.microareasCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('strategic_points')}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'strategic_points'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Crosshair className="w-4 h-4" />
          <span>Pontos Estratégicos</span>
        </button>

        <button
          onClick={() => setActiveTab('special_properties')}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'special_properties'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Imóveis Especiais</span>
        </button>

        <button
          onClick={() => onNavigate('properties')}
          className="pb-3 px-4 border-b-2 border-transparent text-slate-500 hover:text-indigo-600 transition flex items-center gap-2 whitespace-nowrap ml-auto"
        >
          <Home className="w-4 h-4 text-blue-600" />
          <span>Cadastro de Imóveis ({metrics.propertiesCount}) →</span>
        </button>
      </div>

      {/* CONTEÚDO DA ABA: VISÃO GERAL */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Banner da Hierarquia Territorial */}
          <div className="p-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-300">
                Hierarquia Territorial Oficial SUS
              </span>
              <h3 className="text-sm md:text-base font-extrabold flex items-center gap-2">
                <span>{municipality?.name || 'Município'}</span>
                <span className="text-slate-400">→</span>
                <span>Bairros</span>
                <span className="text-slate-400">→</span>
                <span>Setores</span>
                <span className="text-slate-400">→</span>
                <span>Quadras</span>
                <span className="text-slate-400">→</span>
                <span>Imóveis</span>
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl">
                Toda a cadeia de vigilância entomológica e controle vetorial segue estritamente a amarração territorial
                para garantir cobertura censitária total de 100% dos imóveis.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuickCreateOpen(true)}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Entidade</span>
              </button>
            </div>
          </div>

          {/* Grid dos 9 Cards Métricos com Ações Rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map(card => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  className={`p-4 rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between ${card.color}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-wider">{card.title}</span>
                      <div className="text-2xl font-black text-slate-900">{card.count.toLocaleString('pt-BR')}</div>
                      <p className="text-[11px] text-slate-600 leading-snug">{card.desc}</p>
                    </div>

                    <div className={`w-10 h-10 rounded-xl ${card.badgeBg} text-white flex items-center justify-center shadow-xs shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="pt-4 mt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                    <button
                      onClick={card.actionView}
                      className="text-xs font-bold text-slate-700 hover:text-indigo-600 transition flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visualizar</span>
                    </button>

                    <button
                      onClick={card.actionNew}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-[11px] font-bold border border-slate-200/80 transition flex items-center gap-1 shadow-2xs"
                    >
                      <Plus className="w-3 h-3 text-indigo-600" />
                      <span>+ Novo</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: BAIRROS */}
      {activeTab === 'neighborhoods' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex-1 min-w-[240px] text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar bairros por nome..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-transparent outline-none text-slate-800"
              />
            </div>
            <button
              onClick={() => setQuickCreateOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Bairro</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNeighborhoods.map(n => (
              <div
                key={n.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{n.name}</h4>
                    <span className="text-[11px] text-slate-500 font-mono">{n.code || 'Bairro Municipal'}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    n.riskLevel === 'CRITICO'
                      ? 'bg-rose-100 text-rose-800'
                      : n.riskLevel === 'ALTO'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {n.riskLevel || 'BAIXO'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs text-slate-600">
                  <div>
                    <span className="text-[10px] text-slate-400 block">População</span>
                    <span className="font-semibold">{n.population?.toLocaleString('pt-BR') || '—'} hab.</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Setores Vinculados</span>
                    <span className="font-semibold">
                      {sectors.filter(s => s.neighborhood_id === n.id).length} setores
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t text-xs">
                  <button
                    onClick={() => {
                      setFilterNeighborhood(n.id);
                      setActiveTab('sectors');
                    }}
                    className="text-indigo-600 font-bold hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <span>Ver Setores</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onNavigate('properties')}
                    className="text-slate-500 hover:text-slate-800 font-medium text-[11px]"
                  >
                    Ver Imóveis
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: SETORES */}
      {activeTab === 'sectors' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex-1 min-w-[200px] text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar setores por nome ou código..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-transparent outline-none text-slate-800"
              />
            </div>

            <select
              value={filterNeighborhood}
              onChange={e => setFilterNeighborhood(e.target.value)}
              className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">Todos os Bairros</option>
              {neighborhoods.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>

            <button
              onClick={() => setQuickCreateOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Setor</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <th className="p-3">Código</th>
                  <th className="p-3">Nome do Setor</th>
                  <th className="p-3">Bairro Vinculado</th>
                  <th className="p-3 text-center">Quadras Vinculadas</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSectors.map(s => {
                  const bCount = blocks.filter(b => b.sector_id === s.id).length;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-indigo-700">{s.code || '—'}</td>
                      <td className="p-3 font-semibold text-slate-900">{s.name}</td>
                      <td className="p-3 text-slate-600">{s.neighborhoods?.name || '—'}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-200">
                          {bCount} quadras
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setFilterSector(s.id);
                            setActiveTab('blocks');
                          }}
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition"
                        >
                          Ver Quadras →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: QUADRAS */}
      {activeTab === 'blocks' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex-1 min-w-[200px] text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por número da quadra..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-transparent outline-none text-slate-800"
              />
            </div>

            <select
              value={filterSector}
              onChange={e => setFilterSector(e.target.value)}
              className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">Todos os Setores</option>
              {sectors.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>

            <button
              onClick={() => setQuickCreateOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Quadra</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredBlocks.map(b => (
              <div
                key={b.id}
                className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-purple-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs mb-2">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <h5 className="font-extrabold text-sm text-slate-900 font-mono">{b.code}</h5>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{b.sectors?.name || 'Setor'}</p>
                </div>

                <div className="mt-3 pt-2 border-t flex items-center justify-between text-[11px]">
                  <button
                    onClick={() => onNavigate('properties')}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    Ver Imóveis →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: MICROÁREAS */}
      {activeTab === 'microareas' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <h4 className="font-bold text-xs text-slate-700">Microáreas Sanitárias Operacionais</h4>
            <button
              onClick={() => setQuickCreateOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Microárea</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {microareas.map(m => (
              <div key={m.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs text-slate-900">{m.name}</h5>
                  <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-100 rounded text-slate-600">{m.code}</span>
                </div>
                <p className="text-xs text-slate-500">Setor: {m.sectors?.name || '—'}</p>
                <div className="pt-2 border-t text-xs flex items-center justify-between text-slate-700">
                  <span>Agente:</span>
                  <span className="font-semibold text-indigo-700">{m.agents?.profiles?.full_name || 'Não atribuído'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: PONTOS ESTRATÉGICOS */}
      {activeTab === 'strategic_points' && <StrategicPointsView />}

      {/* CONTEÚDO DA ABA: IMÓVEIS ESPECIAIS */}
      {activeTab === 'special_properties' && <SpecialPropertiesView />}

      {/* Modal de Criação Rápida */}
      <QuickCreateModal
        isOpen={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onNavigate={onNavigate}
        municipalityId={municipality?.id}
        onSuccess={() => loadHubData()}
      />
    </div>
  );
};
