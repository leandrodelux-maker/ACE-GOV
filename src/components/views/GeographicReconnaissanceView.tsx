import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Building2,
  AlertTriangle,
  UserCheck,
  UserX,
  Search,
  Plus,
  RefreshCw,
  Navigation,
  ShieldCheck,
  CheckCircle2,
  Filter,
  ArrowRightLeft,
  XCircle,
  Eye,
  SlidersHorizontal,
  Home,
  Layers,
  Map,
  FileCheck
} from 'lucide-react';
import {
  geographicReconnaissanceService,
  PropertyRG,
  RGIndicators,
  RGCadastralAnomaly,
} from '../../services/geographicReconnaissanceService';
import { PageHeader } from '../ui';

export const GeographicReconnaissanceView: React.FC = () => {
  const [indicators, setIndicators] = useState<RGIndicators>({
    totalProperties: 0,
    georeferencedProperties: 0,
    georeferencedPercentage: 0,
    propertiesWithoutSector: 0,
    propertiesWithoutAgent: 0,
    outdatedProperties: 0,
  });

  const [properties, setProperties] = useState<PropertyRG[]>([]);
  const [anomalies, setAnomalies] = useState<RGCadastralAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'imoveis' | 'anomalias'>('imoveis');

  // Filtros
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('todos');
  const [filterSituation, setFilterSituation] = useState('todos');
  const [filterOnlyNoCoords, setFilterOnlyNoCoords] = useState(false);

  // Opções territoriais
  const [territoryOptions, setTerritoryOptions] = useState<{
    neighborhoods: any[];
    sectors: any[];
    microareas: any[];
    blocks: any[];
    agents: any[];
  }>({
    neighborhoods: [],
    sectors: [],
    microareas: [],
    blocks: [],
    agents: [],
  });

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyRG | null>(null);
  const [showTransferSectorModal, setShowTransferSectorModal] = useState(false);
  const [showTransferAgentModal, setShowTransferAgentModal] = useState(false);
  const [targetSectorId, setTargetSectorId] = useState('');
  const [targetAgentId, setTargetAgentId] = useState('');

  // Formulário de Novo Imóvel
  const [formData, setFormData] = useState<Partial<PropertyRG>>({
    property_type: 'residencia',
    situation: 'ativo',
    street: '',
    number: '',
    complement: '',
    reference: '',
    residents_count: 3,
    resident_name: '',
    resident_phone: '',
    neighborhood_id: '',
    sector_id: '',
    microarea_id: '',
    block_id: '',
    assigned_agent_id: '',
  });

  const [geoLocating, setGeoLocating] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ind, props, anom, opts] = await Promise.all([
        geographicReconnaissanceService.getIndicators(),
        geographicReconnaissanceService.getProperties({
          search,
          propertyType: filterType !== 'todos' ? filterType : undefined,
          situation: filterSituation !== 'todos' ? filterSituation : undefined,
          onlyWithoutCoords: filterOnlyNoCoords ? true : undefined,
          limit: 150,
        }),
        geographicReconnaissanceService.detectCadastralAnomalies(),
        geographicReconnaissanceService.getTerritoryOptions(),
      ]);

      setIndicators(ind);
      setProperties(props);
      setAnomalies(anom);
      setTerritoryOptions(opts);
    } catch (err) {
      console.error('Erro ao carregar dados do RG:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterType, filterSituation, filterOnlyNoCoords]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Capturar geolocalização do navegador
  const handleGeolocateCurrent = (property: PropertyRG) => {
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada neste navegador.');
      return;
    }

    setGeoLocating(property.id);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const res = await geographicReconnaissanceService.setGeoreference(property.id, lat, lng);
        setGeoLocating(null);
        if (res.success) {
          alert(`Imóvel georreferenciado com sucesso!\nLat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
          loadData();
        } else {
          alert(`Erro: ${res.message}`);
        }
      },
      (err) => {
        setGeoLocating(null);
        alert(`Erro ao obter GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Alternar situação ativo / inativo
  const handleToggleSituation = async (property: PropertyRG) => {
    const nextSituation = property.situation === 'ativo' ? 'inativo' : 'ativo';
    const confirmMsg = `Deseja realmente alterar a situação do imóvel ${property.property_code} para "${nextSituation}"?`;
    if (!window.confirm(confirmMsg)) return;

    const res = await geographicReconnaissanceService.setSituation(property.id, nextSituation);
    if (res.success) {
      loadData();
    } else {
      alert(res.message);
    }
  };

  // Salvar novo imóvel
  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.street || !formData.number) {
      alert('Preencha ao menos o logradouro e o número da porta.');
      return;
    }

    const res = await geographicReconnaissanceService.createProperty(formData);
    if (res.success) {
      alert(res.message);
      setShowCreateModal(false);
      setFormData({
        property_type: 'residencia',
        situation: 'ativo',
        street: '',
        number: '',
        complement: '',
        reference: '',
        residents_count: 3,
        resident_name: '',
        resident_phone: '',
      });
      loadData();
    } else {
      alert(res.message);
    }
  };

  // Confirmar transferência de Setor
  const handleConfirmTransferSector = async () => {
    if (!selectedProperty || !targetSectorId) return;
    const res = await geographicReconnaissanceService.transferSector(selectedProperty.id, targetSectorId);
    if (res.success) {
      alert(res.message);
      setShowTransferSectorModal(false);
      setSelectedProperty(null);
      loadData();
    } else {
      alert(res.message);
    }
  };

  // Confirmar transferência de ACE
  const handleConfirmTransferAgent = async () => {
    if (!selectedProperty) return;
    const res = await geographicReconnaissanceService.transferAgent(selectedProperty.id, targetAgentId || null);
    if (res.success) {
      alert(res.message);
      setShowTransferAgentModal(false);
      setSelectedProperty(null);
      loadData();
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <PageHeader
        icon={Map}
        title="Reconhecimento Geográfico — RG"
        subtitle="Base territorial viva de imóveis, setores, microáreas e designação de ACE para planejamento de ciclos."
        badge={{ label: 'TERRITÓRIO & CONTROLE', tone: 'success' }}
        actions={
          <>
            <button
              onClick={loadData}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium border border-slate-200 flex items-center gap-2 transition shadow-xs"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Atualizar</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Imóvel (RG)</span>
            </button>
          </>
        }
      />

      {/* Cards de Indicadores Reais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Imóveis Cadastrados</span>
            <Building2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{indicators.totalProperties.toLocaleString('pt-BR')}</span>
            <span className="text-xs text-emerald-400 font-medium">RG Oficial</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Censo territorial ativo</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Georreferenciados</span>
            <Navigation className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{indicators.georeferencedProperties.toLocaleString('pt-BR')}</span>
            <span className="text-xs text-cyan-400 font-semibold">{indicators.georeferencedPercentage}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, indicators.georeferencedPercentage)}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sem Setor</span>
            <Layers className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">{indicators.propertiesWithoutSector}</span>
            <span className="text-xs text-slate-400">imóveis</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Necessitam vinculação</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sem ACE</span>
            <UserX className="w-5 h-5 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400">{indicators.propertiesWithoutAgent}</span>
            <span className="text-xs text-slate-400">imóveis</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Sem titular designado</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Desatualizados (&gt;60d)</span>
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-orange-400">{indicators.outdatedProperties}</span>
            <span className="text-xs text-slate-400">imóveis</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Requerem atualização em campo</p>
        </div>
      </div>

      {/* Abas e Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('imoveis')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition flex items-center gap-2 ${
                activeTab === 'imoveis'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Base de Imóveis ({properties.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('anomalias')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition flex items-center gap-2 ${
                activeTab === 'anomalias'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Diagnóstico de Anomalias ({anomalies.reduce((acc, a) => acc + a.count, 0)})</span>
            </button>
          </div>

          {activeTab === 'imoveis' && (
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por código, rua ou morador..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium border border-slate-200 transition"
              >
                Filtrar
              </button>
            </form>
          )}
        </div>

        {activeTab === 'imoveis' && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4">
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">Tipo de Imóvel</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="residencia">Residência</option>
                <option value="comercio">Comércio</option>
                <option value="terreno_baldio">Terreno Baldio</option>
                <option value="escola">Escola</option>
                <option value="unidade_publica">Unidade Pública</option>
                <option value="obra">Obra / Construção</option>
                <option value="igreja">Igreja / Templo</option>
                <option value="industria">Indústria</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">Situação Cadastral</label>
              <select
                value={filterSituation}
                onChange={(e) => setFilterSituation(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="todos">Todas as Situações</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="demolido">Demolido</option>
              </select>
            </div>

            <div className="flex items-center gap-2 sm:mt-5">
              <input
                type="checkbox"
                id="onlyNoCoords"
                checked={filterOnlyNoCoords}
                onChange={(e) => setFilterOnlyNoCoords(e.target.checked)}
                className="rounded bg-white border-slate-300 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
              />
              <label htmlFor="onlyNoCoords" className="text-xs text-slate-600 select-none cursor-pointer">
                Apenas sem GPS/Coordenadas
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Conteúdo da Aba 1: Tabela de Imóveis */}
      {activeTab === 'imoveis' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Código / Tipo</th>
                  <th className="py-3 px-4">Logradouro & Número</th>
                  <th className="py-3 px-4">Bairro / Setor / Quadra</th>
                  <th className="py-3 px-4">ACE Titular</th>
                  <th className="py-3 px-4">GPS (Lat/Lng)</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Ações Operacionais</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {properties.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Nenhum imóvel encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  properties.map((prop) => (
                    <tr key={prop.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-mono text-xs font-semibold text-emerald-400">{prop.property_code}</div>
                        <div className="text-xs text-slate-600 capitalize">{prop.property_type.replace('_', ' ')}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-900 font-medium">
                          {prop.street}, {prop.number}
                        </div>
                        {prop.complement && <div className="text-xs text-slate-400">{prop.complement}</div>}
                        {prop.reference && <div className="text-xs text-slate-500 italic">Ref: {prop.reference}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-slate-700">
                          {prop.neighborhood?.name || 'Bairro s/ vinc.'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {prop.sector?.code ? `Setor ${prop.sector.code}` : 'Sem setor'} •{' '}
                          {prop.block?.code ? `Qd. ${prop.block.code}` : 'Sem quadra'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {prop.assigned_agent ? (
                          <div className="flex items-center gap-1 text-xs text-slate-200">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{prop.assigned_agent.name}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Sem ACE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {prop.latitude && prop.longitude ? (
                          <span className="text-cyan-400 flex items-center gap-1" title={`${prop.latitude}, ${prop.longitude}`}>
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{prop.latitude.toFixed(4)}, {prop.longitude.toFixed(4)}</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleGeolocateCurrent(prop)}
                            disabled={geoLocating === prop.id}
                            className="text-xs px-2 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded border border-cyan-200 font-medium flex items-center gap-1 transition"
                            title="Capturar GPS do navegador agora"
                          >
                            <Navigation className={`w-3 h-3 ${geoLocating === prop.id ? 'animate-spin' : ''}`} />
                            <span>Georreferenciar</span>
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            prop.situation === 'ativo'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : prop.situation === 'inativo'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {prop.situation}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedProperty(prop);
                              setTargetSectorId(prop.sector_id || '');
                              setShowTransferSectorModal(true);
                            }}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-emerald-600 rounded transition"
                            title="Transferir de Setor"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedProperty(prop);
                              setTargetAgentId(prop.assigned_agent_id || '');
                              setShowTransferAgentModal(true);
                            }}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-cyan-600 rounded transition"
                            title="Transferir de ACE"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleSituation(prop)}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded transition"
                            title={prop.situation === 'ativo' ? 'Inativar imóvel' : 'Reativar imóvel'}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 2: Diagnóstico de Anomalias Cadastrais */}
      {activeTab === 'anomalias' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800">Auditoria Automática de Qualidade Cadastral do RG</h3>
              <p className="text-xs text-amber-700 mt-1">
                A ferramenta identifica inconsistências que impactam o cálculo de cobertura, as rotas dos ACE e a
                amostragem probabilística do LIRAa.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {anomalies.map((anom, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        anom.severity === 'alta'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {anom.severity.toUpperCase()}
                    </span>
                    <h4 className="text-sm font-semibold text-slate-900">{anom.title}</h4>
                  </div>
                  <span className="text-lg font-bold text-slate-900 font-mono bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                    {anom.count}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">{anom.description}</p>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Ação recomendada de saneamento</span>
                  <button
                    onClick={() => {
                      if (anom.type === 'NO_COORDINATES') {
                        setFilterOnlyNoCoords(true);
                        setActiveTab('imoveis');
                      } else {
                        setActiveTab('imoveis');
                      }
                    }}
                    className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
                  >
                    <span>Verificar Registros</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Novo Imóvel no RG */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                Cadastrar Imóvel no Reconhecimento Geográfico
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700 text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProperty} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Tipo de Imóvel *</label>
                  <select
                    value={formData.property_type}
                    onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="residencia">Residência</option>
                    <option value="comercio">Comércio</option>
                    <option value="terreno_baldio">Terreno Baldio</option>
                    <option value="escola">Escola</option>
                    <option value="unidade_publica">Unidade Pública</option>
                    <option value="obra">Obra / Construção</option>
                    <option value="igreja">Igreja / Templo</option>
                    <option value="industria">Indústria</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-600 block mb-1">Situação Inicial *</label>
                  <select
                    value={formData.situation}
                    onChange={(e) => setFormData({ ...formData, situation: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="demolido">Demolido</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-slate-600 block mb-1">Logradouro / Rua *</label>
                  <input
                    type="text"
                    required
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    placeholder="Ex: Rua das Flores"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Número *</label>
                  <input
                    type="text"
                    required
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    placeholder="123"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Complemento</label>
                  <input
                    type="text"
                    value={formData.complement || ''}
                    onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                    placeholder="Apto 101 / Bloco B"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Ponto de Referência</label>
                  <input
                    type="text"
                    value={formData.reference || ''}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="Próximo à padaria"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Morador Principal</label>
                  <input
                    type="text"
                    value={formData.resident_name || ''}
                    onChange={(e) => setFormData({ ...formData, resident_name: e.target.value })}
                    placeholder="Nome do morador ou responsável"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Qtd Aprox. Moradores</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.residents_count || 1}
                    onChange={(e) => setFormData({ ...formData, residents_count: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Vínculo Territorial */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-2">
                  Estrutura Territorial
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Bairro</label>
                    <select
                      value={formData.neighborhood_id || ''}
                      onChange={(e) => setFormData({ ...formData, neighborhood_id: e.target.value })}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">Selecione...</option>
                      {territoryOptions.neighborhoods.map((n) => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Setor</label>
                    <select
                      value={formData.sector_id || ''}
                      onChange={(e) => setFormData({ ...formData, sector_id: e.target.value })}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">Selecione...</option>
                      {territoryOptions.sectors.map((s) => (
                        <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Microárea</label>
                    <select
                      value={formData.microarea_id || ''}
                      onChange={(e) => setFormData({ ...formData, microarea_id: e.target.value })}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">Selecione...</option>
                      {territoryOptions.microareas.map((m) => (
                        <option key={m.id} value={m.id}>MA {m.code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Quadra</label>
                    <select
                      value={formData.block_id || ''}
                      onChange={(e) => setFormData({ ...formData, block_id: e.target.value })}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">Selecione...</option>
                      {territoryOptions.blocks.map((b) => (
                        <option key={b.id} value={b.id}>Qd {b.code}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">ACE Responsável (Titular)</label>
                <select
                  value={formData.assigned_agent_id || ''}
                  onChange={(e) => setFormData({ ...formData, assigned_agent_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">Nenhum ACE vinculado no momento</option>
                  {territoryOptions.agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>{ag.name} (Reg: {ag.registry || 'S/N'})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-md transition"
                >
                  Salvar no RG
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transferir de Setor */}
      {showTransferSectorModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
              Transferir Imóvel de Setor
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Imóvel: <span className="text-slate-900 font-semibold">{selectedProperty.property_code}</span> - {selectedProperty.street}, {selectedProperty.number}
            </p>

            <div className="mt-4">
              <label className="text-xs text-slate-600 block mb-1">Novo Setor Censitário *</label>
              <select
                value={targetSectorId}
                onChange={(e) => setTargetSectorId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Selecione o setor de destino...</option>
                {territoryOptions.sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-slate-200">
              <button
                onClick={() => setShowTransferSectorModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmTransferSector}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
              >
                Confirmar Transferência
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Transferir de ACE */}
      {showTransferAgentModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-cyan-400" />
              Designar / Transferir ACE Titular
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Imóvel: <span className="text-slate-900 font-semibold">{selectedProperty.property_code}</span> - {selectedProperty.street}, {selectedProperty.number}
            </p>

            <div className="mt-4">
              <label className="text-xs text-slate-600 block mb-1">Novo ACE Responsável</label>
              <select
                value={targetAgentId}
                onChange={(e) => setTargetAgentId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              >
                <option value="">Sem ACE designado</option>
                {territoryOptions.agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>{ag.name} (Reg: {ag.registry || 'S/N'})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-slate-200">
              <button
                onClick={() => setShowTransferAgentModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmTransferAgent}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium"
              >
                Confirmar Designação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
