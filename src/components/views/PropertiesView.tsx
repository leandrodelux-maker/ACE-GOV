import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Search,
  Filter,
  Plus,
  MapPin,
  Clock,
  Flame,
  CheckCircle,
  Repeat,
  AlertCircle,
  Eye,
  X,
  FileText,
  Activity,
  User,
  Phone,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Save,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseService } from '../../services/supabaseService';
import { Property, PropertyType, PropertyStatus, Neighborhood } from '../../types';
import { TerritoryTimelineModal } from './TerritoryTimelineModal';
import { PageHeader } from '../ui';

export const PropertiesView: React.FC = () => {
  const { can } = useAuth();

  // Estados da Tabela e Paginação
  const [properties, setProperties] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const pageSize = 12;
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Estados de Filtros e Busca
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);

  // Estados de Modal e Ficha
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const [showTimelineModal, setShowTimelineModal] = useState<boolean>(false);
  const [propertyHistory, setPropertyHistory] = useState<{
    visits: any[];
    breedingSites: any[];
    pendingVisits: any[];
    recurrences: any[];
  } | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'geral' | 'local' | 'visitas' | 'focos' | 'pendencias' | 'timeline'>('geral');

  // Estados do Formulário de Criação / Edição
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    street: '',
    number: '',
    complement: '',
    neighborhoodId: '',
    type: 'RESIDENCIA' as PropertyType,
    status: 'NORMAL' as PropertyStatus,
    residentName: '',
    residentPhone: '',
    residentsCount: 1,
    latitude: -29.718,
    longitude: -52.428,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Carregar Bairros do Município
  useEffect(() => {
    const loadNeighborhoods = async () => {
      const muni = await supabaseService.getMunicipality();
      if (muni) {
        const neighs = await supabaseService.getNeighborhoods(muni.id);
        if (neighs) {
          setNeighborhoods(neighs);
          if (neighs.length > 0 && !formData.neighborhoodId) {
            setFormData(prev => ({ ...prev, neighborhoodId: neighs[0].id }));
          }
        }
      }
    };
    loadNeighborhoods();
  }, []);

  // Carregar Imóveis Paginados do Supabase
  const loadProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await supabaseService.getPropertiesPaginated({
        page,
        pageSize,
        searchTerm: debouncedSearch,
        neighborhoodId: selectedNeighborhood,
        status: selectedStatus,
        propertyType: selectedType,
      });

      setProperties(res.properties);
      setTotalCount(res.totalCount);
    } catch (err) {
      console.error('Erro ao carregar imóveis:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedSearch, selectedNeighborhood, selectedStatus, selectedType]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  // Carregar Histórico ao Selecionar Imóvel
  const handleOpenProperty = async (prop: any) => {
    setSelectedProperty(prop);
    setActiveTab('geral');
    setIsLoadingHistory(true);
    try {
      const history = await supabaseService.getPropertyHistory(prop.id);
      setPropertyHistory(history);
    } catch (err) {
      console.error('Erro ao carregar histórico do imóvel:', err);
      setPropertyHistory({ visits: [], breedingSites: [], pendingVisits: [], recurrences: [] });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Abrir Formulário de Criação
  const handleOpenCreateForm = () => {
    setEditingPropertyId(null);
    setFormData({
      code: `IMV-${Math.floor(100000 + Math.random() * 900000)}`,
      street: '',
      number: '',
      complement: '',
      neighborhoodId: neighborhoods[0]?.id || '',
      type: 'RESIDENCIA',
      status: 'NORMAL',
      residentName: '',
      residentPhone: '',
      residentsCount: 1,
      latitude: -29.718,
      longitude: -52.428,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  // Abrir Formulário de Edição
  const handleOpenEditForm = (prop: any) => {
    setEditingPropertyId(prop.id);
    setFormData({
      code: prop.code,
      street: prop.street || '',
      number: prop.number || '',
      complement: prop.complement || '',
      neighborhoodId: prop.neighborhoodId || neighborhoods[0]?.id || '',
      type: prop.type || 'RESIDENCIA',
      status: prop.status || 'NORMAL',
      residentName: prop.residentName || '',
      residentPhone: prop.residentPhone || '',
      residentsCount: prop.residentsCount || 1,
      latitude: prop.latitude || -29.718,
      longitude: prop.longitude || -52.428,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  // Salvar Imóvel (Criação ou Atualização)
  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.street.trim() || !formData.number.trim()) {
      setFormError('Logradouro e número são campos obrigatórios.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingPropertyId) {
        await supabaseService.updateProperty(editingPropertyId, formData);
        setSuccessMessage('Imóvel atualizado com sucesso no banco de dados.');
      } else {
        await supabaseService.createProperty(formData);
        setSuccessMessage('Novo imóvel sanitário cadastrado com sucesso.');
      }

      setTimeout(() => setSuccessMessage(null), 3500);
      setIsFormOpen(false);
      await loadProperties();

      if (selectedProperty && selectedProperty.id === editingPropertyId) {
        setSelectedProperty(null);
      }
    } catch (err: any) {
      setFormError(err.message || 'Falha ao salvar imóvel no Supabase.');
    } finally {
      setIsSaving(false);
    }
  };

  // Arquivar Imóvel (Soft Delete)
  const handleArchiveProperty = async (id: string, code: string) => {
    if (!window.confirm(`Deseja realmente arquivar o imóvel ${code}? Os registros históricos de vistorias serão preservados na auditoria municipal.`)) {
      return;
    }

    try {
      const ok = await supabaseService.archiveProperty(id);
      if (ok) {
        setSuccessMessage(`Imóvel ${code} arquivado com sucesso.`);
        setTimeout(() => setSuccessMessage(null), 3500);
        setSelectedProperty(null);
        await loadProperties();
      } else {
        alert('Não foi possível arquivar o imóvel.');
      }
    } catch {
      alert('Erro inesperado ao arquivar imóvel.');
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Toast de Sucesso */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-semibold shadow-xs animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        icon={Home}
        title="Cadastro Sanitário e Ficha de Imóveis"
        subtitle="Base territorial com histórico sanitário, geolocalização, reincidências e auditoria municipal"
        actions={
          <>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
              {totalCount} {totalCount === 1 ? 'imóvel cadastrado' : 'imóveis cadastrados'}
            </span>

            {can('properties.create') && (
              <button
                onClick={handleOpenCreateForm}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Imóvel</span>
              </button>
            )}

            <button
              onClick={loadProperties}
              disabled={isLoading}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              title="Atualizar dados do banco"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </>
        }
      />

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex-1 min-w-[260px] text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código (ex: IMV-001), logradouro ou morador..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={selectedNeighborhood}
            onChange={e => {
              setSelectedNeighborhood(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Bairros</option>
            {neighborhoods.map(n => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={e => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Tipos</option>
            <option value="RESIDENCIA">Residencial</option>
            <option value="COMERCIO">Comercial</option>
            <option value="TERRENO_BALDIO">Terreno Baldio</option>
            <option value="PONTO_ESTRATEGICO">Ponto Estratégico (PE)</option>
            <option value="IMOVEL_ESPECIAL">Imóvel Especial (IE)</option>
            <option value="ESTABELECIMENTO_SAUDE">Estabelecimento de Saúde</option>
            <option value="ESCOLA">Escola</option>
          </select>

          <select
            value={selectedStatus}
            onChange={e => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">Todas as Situações</option>
            <option value="NORMAL">Normal / Sem Pendências</option>
            <option value="FOCO">Foco Detectado</option>
            <option value="FECHADO">Fechado / Ausente</option>
            <option value="PENDENTE">Pendente</option>
            <option value="RECUSA">Recusa de Vistoria</option>
          </select>
        </div>
      </div>

      {/* Properties Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Código / Imóvel</th>
                <th className="py-3 px-4">Endereço</th>
                <th className="py-3 px-4">Bairro / Setor</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Situação Sanitária</th>
                <th className="py-3 px-4">Última Vistoria</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>Carregando registros sanitários do banco...</span>
                  </td>
                </tr>
              ) : properties.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Home className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">Nenhum imóvel encontrado.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tente ajustar os filtros ou a busca textual.</p>
                  </td>
                </tr>
              ) : (
                properties.map(prop => {
                  const isFoci = prop.status === 'FOCO';
                  const isClosed = prop.status === 'FECHADO';
                  const isRefusal = prop.status === 'RECUSA';

                  return (
                    <tr key={prop.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {prop.code}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800">{prop.address}</p>
                        {prop.residentName && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{prop.residentName}</span>
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-700">{prop.neighborhood}</p>
                        <p className="text-[10px] text-slate-400">{prop.sector} • {prop.block}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {prop.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isFoci ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1 w-fit">
                            <Flame className="w-3 h-3" />
                            <span>FOCO ATIVO</span>
                          </span>
                        ) : isClosed ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            FECHADO / AUSENTE
                          </span>
                        ) : isRefusal ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                            RECUSA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" />
                            <span>NORMAL</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {prop.lastVisitAt ? (
                          new Date(prop.lastVisitAt).toLocaleDateString('pt-BR')
                        ) : (
                          <span className="text-slate-400">Não vistoriado no ciclo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenProperty(prop)}
                            className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold transition text-[11px] flex items-center gap-1"
                            title="Abrir ficha completa do imóvel"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ficha</span>
                          </button>

                          {can('properties.update') && (
                            <button
                              onClick={() => handleOpenEditForm(prop)}
                              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                              title="Editar imóvel"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {can('properties.delete') && (
                            <button
                              onClick={() => handleArchiveProperty(prop.id, prop.code)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Arquivar imóvel sanitário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação Server-Side */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({totalCount} imóveis no total)
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition"
            >
              <span>Próxima</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Ficha Completa do Imóvel (6 Abas) */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header Modal */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded border border-sky-400/30">
                    {selectedProperty.code}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {selectedProperty.type}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">
                  {selectedProperty.address}
                </h2>
                <p className="text-xs text-slate-400">
                  {selectedProperty.neighborhood} • {selectedProperty.sector} • Quadra {selectedProperty.block}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {can('properties.update') && (
                  <button
                    onClick={() => {
                      handleOpenEditForm(selectedProperty);
                    }}
                    className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
                    title="Editar imóvel"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Abas */}
            <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('geral')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'geral' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Resumo & Geral
              </button>
              <button
                onClick={() => setActiveTab('local')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'local' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Localização & GPS
              </button>
              <button
                onClick={() => setActiveTab('visitas')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'visitas' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                3. Visitas ({propertyHistory?.visits?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('focos')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'focos' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                4. Focos & Criadouros ({propertyHistory?.breedingSites?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('pendencias')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'pendencias' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                5. Pendências ({propertyHistory?.pendingVisits?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'timeline' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                6. Linha do Tempo
              </button>
            </div>

            {/* Conteúdo da Aba */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs text-slate-700">
              {isLoadingHistory ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  <p>Carregando histórico do imóvel no banco de dados...</p>
                </div>
              ) : (
                <>
                  {/* Aba 1: Resumo & Geral */}
                  {activeTab === 'geral' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Proprietário / Morador</span>
                          <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedProperty.residentName || 'Não informado'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Telefone de Contato</span>
                          <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedProperty.residentPhone || 'Não informado'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Moradores Estimados</span>
                          <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedProperty.residentsCount || 1} pessoas</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Tipo de Imóvel</span>
                          <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedProperty.type}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Status Sanitário</span>
                          <p className="font-bold text-blue-700 text-sm mt-0.5">{selectedProperty.status}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Score de Risco</span>
                          <p className="font-bold text-amber-600 text-sm mt-0.5">{selectedProperty.riskScore || 0} pts</p>
                        </div>
                      </div>

                      {selectedProperty.reference && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-800 text-xs">Ponto de Referência:</span>
                          <p className="text-slate-600 mt-0.5">{selectedProperty.reference}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Aba 2: Localização & GPS */}
                  {activeTab === 'local' && (
                    <div className="space-y-3">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-slate-400 font-semibold">Latitude:</span>
                          <p className="font-mono font-bold text-slate-900">{selectedProperty.latitude}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold">Longitude:</span>
                          <p className="font-mono font-bold text-slate-900">{selectedProperty.longitude}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold">Setor:</span>
                          <p className="font-bold text-slate-900">{selectedProperty.sector}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold">Quadra:</span>
                          <p className="font-bold text-slate-900">{selectedProperty.block}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold">Microárea:</span>
                          <p className="font-bold text-slate-900">{selectedProperty.microarea || 'Geral'}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold">CEP:</span>
                          <p className="font-bold text-slate-900">{selectedProperty.postalCode || '96810-000'}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Georreferenciamento integrado ao padrão cartográfico SUS do município.
                      </p>
                    </div>
                  )}

                  {/* Aba 3: Histórico de Visitas */}
                  {activeTab === 'visitas' && (
                    <div className="space-y-3">
                      {!propertyHistory?.visits || propertyHistory.visits.length === 0 ? (
                        <p className="text-slate-500 text-center py-6">Nenhuma visita registrada no banco para este imóvel.</p>
                      ) : (
                        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                          {propertyHistory.visits.map(v => (
                            <div key={v.id} className="p-3 bg-white space-y-1">
                              <div className="flex justify-between font-bold">
                                <span className="text-slate-900">
                                  {new Date(v.visit_date).toLocaleDateString('pt-BR')} — Tipo: {v.visit_type}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] ${
                                  v.result === 'TRABALHADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {v.result}
                                </span>
                              </div>
                              {v.notes && <p className="text-slate-600">{v.notes}</p>}
                              {v.visit_deposits && v.visit_deposits.length > 0 && (
                                <div className="pt-1 text-[11px] text-slate-500">
                                  Depósitos inspecionados: {v.visit_deposits.map((d: any) => `[${d.deposit_type}] ${d.positive ? 'FOCO' : 'Negativo'}`).join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Aba 4: Focos & Criadouros */}
                  {activeTab === 'focos' && (
                    <div className="space-y-3">
                      {!propertyHistory?.breedingSites || propertyHistory.breedingSites.length === 0 ? (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                          <p className="font-bold">Nenhum foco de Aedes aegypti ativo registrado.</p>
                          <p className="text-[11px] mt-0.5">O imóvel está em conformidade entomológica.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                          {propertyHistory.breedingSites.map(b => (
                            <div key={b.id} className="p-3 bg-rose-50/50 space-y-1">
                              <div className="flex justify-between font-bold text-rose-800">
                                <span>Criadouro: {b.deposit_type}</span>
                                <span>Status: {b.status}</span>
                              </div>
                              <p className="text-slate-600 text-xs">{b.elimination_method || 'Tratado com larvicida'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Aba 5: Pendências */}
                  {activeTab === 'pendencias' && (
                    <div className="space-y-2">
                      {!propertyHistory?.pendingVisits || propertyHistory.pendingVisits.length === 0 ? (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-semibold">
                          Nenhuma pendência ativa para este imóvel.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                          {propertyHistory.pendingVisits.map(p => (
                            <div key={p.id} className="p-3 bg-amber-50/60 space-y-1">
                              <div className="flex justify-between font-bold text-amber-900">
                                <span>Motivo: {p.reason}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] bg-amber-200 text-amber-800">{p.status}</span>
                              </div>
                              <p className="text-slate-600">Prioridade: {p.priority}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Aba 6: Linha do Tempo */}
                  {activeTab === 'timeline' && (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      <div className="relative space-y-0.5">
                        <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                        <p className="font-bold text-slate-900">Última Atualização no Banco</p>
                        <p className="text-slate-500 text-[11px]">{new Date(selectedProperty.updatedAt).toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="relative space-y-0.5">
                        <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-slate-400 ring-4 ring-white" />
                        <p className="font-bold text-slate-700">Cadastro Sanitário Criado</p>
                        <p className="text-slate-500 text-[11px]">{new Date(selectedProperty.createdAt).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-2">
              {can('properties.delete') && (
                <button
                  onClick={() => handleArchiveProperty(selectedProperty.id, selectedProperty.code)}
                  className="px-3 py-1.5 text-rose-600 hover:text-rose-700 font-semibold text-xs transition"
                >
                  Arquivar Imóvel
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setShowTimelineModal(true)}
                  className="px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-xl text-xs transition flex items-center gap-1.5 border border-emerald-200"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Linha do Tempo Sanitária</span>
                </button>
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs transition"
                >
                  Fechar Ficha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Linha do Tempo Territorial Cronológica */}
      <TerritoryTimelineModal
        isOpen={showTimelineModal}
        onClose={() => setShowTimelineModal(false)}
        propertyId={selectedProperty?.id}
      />

      {/* Modal: Cadastro / Edição de Imóvel */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Home className="w-5 h-5 text-blue-400" />
                <span>{editingPropertyId ? 'Editar Imóvel Sanitário' : 'Novo Cadastro de Imóvel'}</span>
              </h2>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProperty} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="bg-rose-50 border border-rose-300 p-3 rounded-xl flex items-center gap-2 text-rose-800 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Código do Imóvel</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Bairro *</label>
                  <select
                    required
                    value={formData.neighborhoodId}
                    onChange={e => setFormData({ ...formData, neighborhoodId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
                  >
                    {neighborhoods.map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-600 font-semibold mb-1">Logradouro / Rua *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Rua Marechal Deodoro"
                    value={formData.street}
                    onChange={e => setFormData({ ...formData, street: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Número *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 120"
                    value={formData.number}
                    onChange={e => setFormData({ ...formData, number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Complemento</label>
                  <input
                    type="text"
                    placeholder="Ex: Apto 204, Casa fundos"
                    value={formData.complement}
                    onChange={e => setFormData({ ...formData, complement: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Tipo de Imóvel</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as PropertyType })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
                  >
                    <option value="RESIDENCIA">Residência</option>
                    <option value="COMERCIO">Comércio</option>
                    <option value="TERRENO_BALDIO">Terreno Baldio</option>
                    <option value="IMOVEL_ABANDONADO">Imóvel Abandonado</option>
                    <option value="ESCOLA">Escola</option>
                    <option value="ESTABELECIMENTO_SAUDE">Estabelecimento de Saúde</option>
                    <option value="BORRACHARIA">Borracharia (PE)</option>
                    <option value="FERRO_VELHO">Ferro Velho (PE)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Nome do Morador / Responsável</label>
                  <input
                    type="text"
                    placeholder="Ex: Maria dos Santos"
                    value={formData.residentName}
                    onChange={e => setFormData({ ...formData, residentName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Telefone de Contato</label>
                  <input
                    type="text"
                    placeholder="Ex: (51) 98765-4321"
                    value={formData.residentPhone}
                    onChange={e => setFormData({ ...formData, residentPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Latitude GPS</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.latitude}
                    onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Longitude GPS</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.longitude}
                    onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar no Banco'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
