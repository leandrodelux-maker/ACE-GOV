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
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { useHubTab } from '../../hooks/useHubTab';
import { canAccessView } from '../../config/routes';
import { SpecialPropertiesView } from './SpecialPropertiesView';

export type TerritoryHubTab = 'overview' | 'neighborhoods' | 'sectors' | 'blocks' | 'microareas' | 'strategic_points' | 'special_properties';

interface TerritoryHubViewProps {
  onNavigate: (module: string, action?: string) => void;
  initialTab?: TerritoryHubTab;
  onTabChange?: (tab: TerritoryHubTab) => void;
}

export const TerritoryHubView: React.FC<TerritoryHubViewProps> = ({
  onNavigate,
  initialTab = 'overview',
  onTabChange,
}) => {
  const { municipality: sessionMunicipality } = useAuth();
  const municipalityId = useMunicipalityId();
  const [activeTab, setActiveTab] = useHubTab<TerritoryHubTab>(initialTab as TerritoryHubTab, onTabChange);
  const { can, hasRole } = useAuth();
  const canSeeStrategicPoints = canAccessView('strategic_points', { can, hasRole });
  const canSeeSpecialProperties = canAccessView('special_properties', { can, hasRole });
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
      const muni = sessionMunicipality;
      const mId = municipalityId;
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
      iconClass: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    },
    {
      id: 'sectors',
      title: 'Setores Censitários',
      count: metrics.sectorsCount,
      icon: Map,
      desc: 'Subdivisões operacionais do bairro',
      actionView: () => setActiveTab('sectors'),
      actionNew: () => setQuickCreateOpen(true),
      iconClass: 'bg-amber-50 text-amber-600 border border-amber-100',
    },
    {
      id: 'blocks',
      title: 'Quadras',
      count: metrics.blocksCount,
      icon: Boxes,
      desc: 'Quarteirões e faces de quarteirão',
      actionView: () => setActiveTab('blocks'),
      actionNew: () => setQuickCreateOpen(true),
      iconClass: 'bg-purple-50 text-purple-600 border border-purple-100',
    },
    {
      id: 'properties',
      title: 'Imóveis',
      count: metrics.propertiesCount,
      icon: Home,
      desc: 'Residências, comércios e terrenos',
      actionView: () => onNavigate('properties'),
      actionNew: () => onNavigate('properties', 'new'),
      iconClass: 'bg-blue-50 text-blue-600 border border-blue-100',
    },
    {
      id: 'microareas',
      title: 'Microáreas',
      count: metrics.microareasCount,
      icon: Layers,
      desc: 'Divisões territoriais por agente',
      actionView: () => setActiveTab('microareas'),
      actionNew: () => setQuickCreateOpen(true),
      iconClass: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
    },
    {
      id: 'teams',
      title: 'Equipes',
      count: metrics.teamsCount,
      icon: Users,
      desc: 'Grupos e supervisões municipais',
      actionView: () => onNavigate('teams'),
      actionNew: () => setQuickCreateOpen(true),
      iconClass: 'bg-cyan-50 text-cyan-600 border border-cyan-100',
    },
    {
      id: 'agents',
      title: 'Agentes (ACE)',
      count: metrics.agentsCount,
      icon: UserCheck,
      desc: 'Profissionais de campo atuantes',
      actionView: () => onNavigate('teams'),
      actionNew: () => setQuickCreateOpen(true),
      iconClass: 'bg-teal-50 text-teal-600 border border-teal-100',
    },
    {
      id: 'strategic_points',
      title: 'Pontos Estratégicos',
      count: metrics.strategicPointsCount,
      icon: Crosshair,
      desc: 'Ferros-velhos, borracharias, cemitérios',
      actionView: () => onNavigate('strategic_points'),
      actionNew: () => onNavigate('strategic_points', 'new'),
      iconClass: 'bg-orange-50 text-orange-600 border border-orange-100',
    },
    {
      id: 'special_properties',
      title: 'Imóveis Especiais',
      count: metrics.specialPropertiesCount,
      icon: Building2,
      desc: 'Hospitais, escolas, órgãos públicos',
      actionView: () => onNavigate('special_properties'),
      actionNew: () => onNavigate('special_properties', 'new'),
      iconClass: 'bg-rose-50 text-rose-600 border border-rose-100',
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
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-1 text-xs font-semibold">
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

        {canSeeStrategicPoints && (
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
        )}

        {canSeeSpecialProperties && (
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
        )}

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
          {/* Banner da Hierarquia Territorial - Versão Clean Executiva */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                    Hierarquia Territorial Oficial SUS
                  </span>
                  <span className="text-[11px] text-slate-400">Amarração censitária obrigatória</span>
                </div>
                <p className="text-xs text-slate-500">
                  Estrutura de vigilância vetorial integrada para garantia de 100% de cobertura nos ciclos operacionais
                </p>
              </div>

              <button
                onClick={() => setQuickCreateOpen(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 self-start sm:self-auto shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Entidade</span>
              </button>
            </div>

            {/* Fluxo Visual da Hierarquia */}
            <div className="flex items-center overflow-x-auto scrollbar-none gap-2 py-1 text-xs">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-lg shrink-0">
                <Building className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-bold text-slate-900">{municipality?.name || 'Município'}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-lg shrink-0">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold text-slate-800">Bairros</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">{metrics.neighborhoodsCount}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-lg shrink-0">
                <Map className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-semibold text-slate-800">Setores</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">{metrics.sectorsCount}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-lg shrink-0">
                <Boxes className="w-3.5 h-3.5 text-purple-600" />
                <span className="font-semibold text-slate-800">Quadras</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">{metrics.blocksCount}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-lg shrink-0">
                <Home className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-semibold text-slate-800">Imóveis</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">{metrics.propertiesCount}</span>
              </div>
            </div>
          </div>

          {/* Grid dos Cards Métricos Limpos e Executivos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {cards.map(card => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  className="bg-white p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">
                        {card.title}
                      </span>
                      <span className={`p-1.5 rounded-lg flex items-center justify-center shrink-0 ${card.iconClass}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                    </div>

                    <p className="text-2xl font-extrabold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {card.count.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5 line-clamp-1">
                      {card.desc}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={card.actionView}
                      className="text-xs font-semibold text-slate-600 hover:text-indigo-600 transition flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
                      <span>Visualizar</span>
                    </button>

                    <button
                      onClick={card.actionNew}
                      className="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-md text-[11px] font-semibold border border-slate-200/70 hover:border-indigo-200 transition flex items-center gap-1 shadow-2xs"
                    >
                      <Plus className="w-3 h-3 text-indigo-600" />
                      <span>Novo</span>
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
                      : n.riskLevel
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {n.riskLevel || 'Risco sem dados'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs text-slate-600">
                  <div>
                    <span className="text-[10px] text-slate-400 block">População</span>
                    <span className="font-semibold">{n.estimatedPopulation ? `${n.estimatedPopulation.toLocaleString('pt-BR')} hab.` : 'Sem dados'}</span>
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
      {activeTab === 'strategic_points' && canSeeStrategicPoints && <StrategicPointsView />}

      {/* CONTEÚDO DA ABA: IMÓVEIS ESPECIAIS */}
      {activeTab === 'special_properties' && canSeeSpecialProperties && <SpecialPropertiesView />}

      {/* Modal de Criação Rápida */}
      <QuickCreateModal
        isOpen={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onNavigate={onNavigate}
        onSuccess={() => loadHubData()}
      />
    </div>
  );
};
