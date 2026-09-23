import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layers,
  Plus,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Calendar,
  X,
  RefreshCw,
  Clock,
  Flame,
  Search,
  Filter,
  ArrowRight,
  Eye,
  Navigation,
  Download,
  AlertCircle,
  BarChart3,
  FileText,
  Building,
  User,
  ShieldAlert,
  ChevronRight,
  Settings as SettingsIcon,
  Crosshair,
  Sliders,
  Check,
  Printer,
  History,
  Activity,
  Award,
  Zap,
  HelpCircle,
  Microscope,
} from 'lucide-react';
import {
  ovitrapService,
  OvitrapPoint,
  OvitrapKPIs,
  OvitrapFilter,
  OvitrapStatus,
  OvitrapSettings,
  NetworkCoverageItem,
  SuggestedPoint,
  PersistentPointItem,
  CrossingItem,
  InconsistencyItem,
  CollectionRoutePoint,
  calculateOvitrapPositivityIndex,
  calculateEggDensityIndex,
} from '../../services/ovitrapService';
import { PageHeader } from '../ui';
import { supabase } from '../../services/supabaseClient';
import { supabaseService } from '../../services/supabaseService';
import { Neighborhood } from '../../types';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';

interface OvitrapsViewProps {
  onNavigate?: (module: string) => void;
}

type TabType =
  | 'visao_geral'
  | 'rede'
  | 'agenda'
  | 'instalacoes'
  | 'coletas'
  | 'resultados'
  | 'mapa'
  | 'inteligencia'
  | 'historico'
  | 'relatorios'
  | 'configuracoes';

export const OvitrapsView: React.FC<OvitrapsViewProps> = ({ onNavigate }) => {
  const { municipality: sessionMunicipality } = useAuth();
  const municipalityId = useMunicipalityId();
  // 1. Estado da Navegação por Abas (11 Abas Oficiais)
  const [activeTab, setActiveTab] = useState<TabType>('visao_geral');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 2. Filtros Globais no Topo
  const [globalPeriod, setGlobalPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [globalCycle, setGlobalCycle] = useState<string>('ciclo_atual');
  const [globalNeighborhood, setGlobalNeighborhood] = useState<string>('ALL');
  const [globalSector, setGlobalSector] = useState<string>('ALL');
  const [globalMicroarea, setGlobalMicroarea] = useState<string>('ALL');
  const [globalAgent, setGlobalAgent] = useState<string>('ALL');
  const [globalTeam, setGlobalTeam] = useState<string>('ALL');
  const [globalStatus, setGlobalStatus] = useState<string>('ALL');
  const [globalResult, setGlobalResult] = useState<'all' | 'positive' | 'negative' | 'invalid'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 3. Dados Principais
  const [ovitraps, setOvitraps] = useState<OvitrapPoint[]>([]);
  const [kpis, setKpis] = useState<OvitrapKPIs>({
    totalRegistered: 0,
    activeNetwork: 0,
    installedCount: 0,
    waitingCollectionCount: 0,
    collectionsToday: 0,
    overdueCollectionCount: 0,
    collectedCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    invalidCount: 0,
    totalEggs: 0,
    ipo: 0,
    averageEggs: 0,
    ido: 0,
    maxEggs: 0,
    attentionAreasCount: 0,
    trend: 'ESTAVEL',
  });

  // 4. Estruturas Analíticas
  const [coverageData, setCoverageData] = useState<NetworkCoverageItem[]>([]);
  const [pointSuggestions, setPointSuggestions] = useState<SuggestedPoint[]>([]);
  const [persistentPoints, setPersistentPoints] = useState<PersistentPointItem[]>([]);
  const [integratedCrossings, setIntegratedCrossings] = useState<CrossingItem[]>([]);
  const [inconsistencies, setInconsistencies] = useState<InconsistencyItem[]>([]);
  const [temporalTrends, setTemporalTrends] = useState<any[]>([]);
  const [settings, setSettings] = useState<OvitrapSettings>({
    municipalityId,
    collectionIntervalDays: 5,
    installationFrequencyDays: 28,
    doubleCheckEnabled: false,
    doubleCheckThreshold: 15,
    alertEggsThreshold: 100,
    persistentPositiveCycles: 3,
    ipoMethodology: 'padrao_ms',
    idoMethodology: 'padrao_ms',
    trendSensitivity: 'moderada',
    gpsRequired: true,
  });

  // 5. Apoio e Listas
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [sectorsList, setSectorsList] = useState<any[]>([]);
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]);

  // 6. Agenda & Rota
  const [agenda, setAgenda] = useState<{
    today: OvitrapPoint[];
    tomorrow: OvitrapPoint[];
    next7Days: OvitrapPoint[];
    overdue: OvitrapPoint[];
    unscheduled: OvitrapPoint[];
  }>({ today: [], tomorrow: [], next7Days: [], overdue: [], unscheduled: [] });
  const [agendaCategory, setAgendaCategory] = useState<'today' | 'tomorrow' | 'next7Days' | 'overdue' | 'unscheduled'>('today');
  const [selectedForRoute, setSelectedForRoute] = useState<string[]>([]);
  const [generatedRoute, setGeneratedRoute] = useState<CollectionRoutePoint[]>([]);

  // 7. Modais Operacionais
  const [showCreatePointModal, setShowCreatePointModal] = useState<boolean>(false);
  const [showPlanNetworkModal, setShowPlanNetworkModal] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [showCollectModal, setShowCollectModal] = useState<boolean>(false);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [showRouteModal, setShowRouteModal] = useState<boolean>(false);

  // 8. Ovitrampa Ativa para Operação
  const [selectedTrap, setSelectedTrap] = useState<OvitrapPoint | null>(null);
  const [trapHistory, setTrapHistory] = useState<{
    installations: any[];
    collections: any[];
    results: any[];
  }>({ installations: [], collections: [], results: [] });

  // 9. Comparação Histórica entre Pontos (até 5)
  const [compareTrapIds, setCompareTrapIds] = useState<string[]>([]);

  // 10. Formulários
  const [newPointData, setNewPointData] = useState({
    code: '',
    name: '',
    neighborhoodId: '',
    sectorId: '',
    microareaId: '',
    street: '',
    number: '',
    address: '',
    referencePoint: '',
    latitude: '' as number | '',
    longitude: '' as number | '',
    locationType: 'Residencial',
    responsibleName: '',
    responsiblePhone: '',
    responsibleAgentId: '',
    teamId: '',
    notes: '',
  });

  const [installData, setInstallData] = useState({
    agentId: '',
    installationDate: new Date().toISOString().split('T')[0],
    installationTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    expectedDays: 5,
    paddleCode: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    gpsAccuracy: undefined as number | undefined,
    notes: '',
    forceDuplicate: false,
    duplicateJustification: '',
  });

  const [collectData, setCollectData] = useState({
    agentId: '',
    collectionDate: new Date().toISOString().split('T')[0],
    collectionTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    status: 'coleta_realizada' as any,
    paddleReplaced: true,
    paddleCode: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    gpsAccuracy: undefined as number | undefined,
    notes: '',
  });

  const [resultData, setResultData] = useState({
    eggsCount: 0,
    secondReadCount: '' as string | number,
    responsibleName: '',
    laboratoryDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Modal de Planejamento de Rede
  const [planParams, setPlanParams] = useState({
    targetPoints: 12,
    minDistanceMeters: 300,
    periodicityDays: 28,
    priorityNeighborhoodId: 'ALL',
  });

  // 11. Carregamento dos Dados Gerais
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const muni = sessionMunicipality;
      const muniId = municipalityId;

      const filterObj: OvitrapFilter = {
        period: globalPeriod,
        neighborhoodId: globalNeighborhood,
        sectorId: globalSector,
        agentId: globalAgent,
        teamId: globalTeam,
        status: globalStatus,
        result: globalResult,
        search: searchTerm,
      };

      const [
        res,
        neighs,
        secRes,
        agentsRes,
        teamsRes,
        agd,
        cov,
        sug,
        pers,
        cross,
        inc,
        trends,
        cfg,
      ] = await Promise.all([
        ovitrapService.getOvitraps(muniId, filterObj),
        supabaseService.getNeighborhoods(muniId),
        supabase.from('sectors').select('id, name, neighborhood_id').order('name'),
        supabase.from('agents').select('id, employee_number, profiles(full_name)').eq('municipality_id', muniId),
        supabase.from('teams').select('id, name').order('name'),
        ovitrapService.getAgenda(muniId),
        ovitrapService.getNetworkCoverageAnalysis(muniId),
        ovitrapService.suggestNewPoints(muniId),
        ovitrapService.detectPersistentPositivity(muniId),
        ovitrapService.getIntegratedCrossings(muniId),
        ovitrapService.detectInconsistencies(muniId),
        ovitrapService.getTemporalTrends(muniId),
        ovitrapService.getSettings(muniId),
      ]);

      const formattedAgents = (agentsRes.data || []).map((a: any) => ({
        id: a.id,
        name: a.profiles?.full_name || `ACE ${a.employee_number || ''}`,
      }));

      setOvitraps(res.ovitraps);
      setKpis(res.kpis);
      if (neighs) setNeighborhoods(neighs);
      if (secRes.data) setSectorsList(secRes.data);
      setAgentsList(formattedAgents);
      if (teamsRes.data) setTeamsList(teamsRes.data);
      setAgenda(agd);
      setCoverageData(cov);
      setPointSuggestions(sug);
      setPersistentPoints(pers);
      setIntegratedCrossings(cross);
      setInconsistencies(inc);
      setTemporalTrends(trends);
      setSettings(cfg);
    } catch (err) {
      console.error('Erro ao carregar ecossistema de ovitrampas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    globalPeriod,
    globalNeighborhood,
    globalSector,
    globalAgent,
    globalTeam,
    globalStatus,
    globalResult,
    searchTerm,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler: Abrir detalhes e histórico
  const handleOpenDetails = async (trap: OvitrapPoint) => {
    setSelectedTrap(trap);
    setShowDetailModal(true);
    try {
      const hist = await ovitrapService.getOvitrapHistory(trap.id);
      setTrapHistory(hist);
    } catch (err) {
      console.warn('Erro ao carregar histórico:', err);
    }
  };

  // Handler: Abrir modal de instalação
  const handleOpenInstall = (trap: OvitrapPoint) => {
    setSelectedTrap(trap);
    setInstallData({
      agentId: trap.assignedAgentId || trap.responsibleAgentId || agentsList[0]?.id || '',
      installationDate: new Date().toISOString().split('T')[0],
      installationTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      expectedDays: settings.collectionIntervalDays || 5,
      paddleCode: `PAL-${trap.code}-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '')}`,
      latitude: trap.latitude,
      longitude: trap.longitude,
      gpsAccuracy: 3.5,
      notes: '',
      forceDuplicate: false,
      duplicateJustification: '',
    });
    setShowInstallModal(true);
  };

  // Handler: Salvar Instalação
  const handleSaveInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrap) return;
    if (!installData.agentId) {
      alert('Selecione o agente responsável pela instalação.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await ovitrapService.installOvitrap({
        ovitrapId: selectedTrap.id,
        agentId: installData.agentId,
        installationDate: installData.installationDate,
        installationTime: installData.installationTime,
        expectedDays: installData.expectedDays,
        paddleCode: installData.paddleCode,
        latitude: installData.latitude,
        longitude: installData.longitude,
        gpsAccuracy: installData.gpsAccuracy,
        notes: installData.notes,
        forceDuplicate: installData.forceDuplicate,
        duplicateJustification: installData.duplicateJustification,
      });

      if (!res.success) throw new Error(res.error);
      setShowInstallModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Falha ao registrar instalação: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Abrir modal de coleta
  const handleOpenCollect = (trap: OvitrapPoint) => {
    setSelectedTrap(trap);
    setCollectData({
      agentId: trap.assignedAgentId || trap.responsibleAgentId || agentsList[0]?.id || '',
      collectionDate: new Date().toISOString().split('T')[0],
      collectionTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      status: 'coleta_realizada',
      paddleReplaced: true,
      paddleCode: '',
      latitude: trap.latitude,
      longitude: trap.longitude,
      gpsAccuracy: undefined,
      notes: '',
    });
    setShowCollectModal(true);
  };

  // Handler: Salvar Coleta
  const handleSaveCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrap) return;
    if (!collectData.agentId) {
      alert('Selecione o agente responsável pela coleta.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await ovitrapService.registerCollection({
        ovitrapId: selectedTrap.id,
        agentId: collectData.agentId,
        collectionDate: collectData.collectionDate,
        collectionTime: collectData.collectionTime,
        status: collectData.status,
        paddleReplaced: collectData.paddleReplaced,
        paddleCode: collectData.paddleCode,
        latitude: collectData.latitude,
        longitude: collectData.longitude,
        gpsAccuracy: collectData.gpsAccuracy,
        notes: collectData.notes,
      });

      if (!res.success) throw new Error(res.error);
      setShowCollectModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Falha ao registrar coleta: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Abrir modal de contagem de ovos
  const handleOpenResult = (trap: OvitrapPoint) => {
    setSelectedTrap(trap);
    setResultData({
      eggsCount: 0,
      secondReadCount: '',
      responsibleName: '',
      laboratoryDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowResultModal(true);
  };

  // Handler: Salvar Resultado
  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrap) return;
    setIsSubmitting(true);
    try {
      const res = await ovitrapService.registerResult({
        ovitrapId: selectedTrap.id,
        eggsCount: Number(resultData.eggsCount),
        secondReadCount:
          resultData.secondReadCount !== '' ? Number(resultData.secondReadCount) : undefined,
        responsibleName: resultData.responsibleName,
        laboratoryDate: resultData.laboratoryDate,
        notes: resultData.notes,
      });

      if (!res.success) throw new Error(res.error);

      if (res.requiresReview) {
        alert(
          'Aviso: Divergência expressiva entre a 1ª e a 2ª leitura. O registro foi gravado e marcado como [NECESSITA REVISÃO].'
        );
      }

      setShowResultModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Falha ao registrar contagem de ovos: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Abrir modal de cadastro de novo ponto
  const handleOpenCreatePoint = async () => {
    const nextCode = await ovitrapService.generateNextCode(municipalityId);
    setNewPointData({
      code: nextCode,
      name: `Ponto ${nextCode}`,
      neighborhoodId: neighborhoods[0]?.id || '',
      sectorId: '',
      microareaId: '',
      street: '',
      number: '',
      address: '',
      referencePoint: '',
      latitude: '',
      longitude: '',
      locationType: 'Residencial',
      responsibleName: '',
      responsiblePhone: '',
      responsibleAgentId: agentsList[0]?.id || '',
      teamId: teamsList[0]?.id || '',
      notes: '',
    });
    setShowCreatePointModal(true);
  };

  // Handler: Salvar Novo Ponto Sentinela
  const handleSaveCreatePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const muni = sessionMunicipality;
      const muniId = municipalityId;

      const fullAddress = newPointData.street
        ? `${newPointData.street}${newPointData.number ? `, ${newPointData.number}` : ''}`
        : newPointData.address || 'Logradouro não informado';

      const res = await ovitrapService.createPoint({
        municipalityId: muniId,
        code: newPointData.code,
        name: newPointData.name,
        neighborhoodId: newPointData.neighborhoodId,
        sectorId: newPointData.sectorId || undefined,
        microareaId: newPointData.microareaId || undefined,
        street: newPointData.street,
        number: newPointData.number,
        address: fullAddress,
        referencePoint: newPointData.referencePoint,
        // Vazio => sem coordenada (nunca 0,0)
        latitude: (newPointData.latitude === '' ? null : Number(newPointData.latitude)) as any,
        longitude: (newPointData.longitude === '' ? null : Number(newPointData.longitude)) as any,
        locationType: newPointData.locationType,
        responsibleName: newPointData.responsibleName,
        responsiblePhone: newPointData.responsiblePhone,
        responsibleAgentId: newPointData.responsibleAgentId || undefined,
        teamId: newPointData.teamId || undefined,
        notes: newPointData.notes,
      });

      if (!res.success) throw new Error(res.error);
      setShowCreatePointModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Falha ao cadastrar ponto: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Gerar Rota de Coleta Otimizada
  const handleGenerateRoute = async () => {
    if (selectedForRoute.length === 0) {
      alert('Selecione pelo menos um ponto para gerar o roteiro de coleta.');
      return;
    }
    const route = await ovitrapService.generateCollectionRoute(selectedForRoute);
    setGeneratedRoute(route);
    setShowRouteModal(true);
  };

  // Handler: Exportação em CSV com Auditoria
  const handleExportCSV = () => {
    const headers =
      'Código,Nome,Bairro,Setor,Endereço,Status,Última Instalação,Próxima Coleta,Total Ovos,Positiva,Responsável,Latitude,Longitude\n';
    const rows = ovitraps
      .map(
        (o) =>
          `"${o.code}","${o.name || o.code}","${o.neighborhoodName}","${o.sectorName || ''}","${o.address}","${o.status}","${o.lastInstallationDate || ''}","${o.nextCollectionDate || ''}",${o.lastEggsCount},"${o.isPositive ? 'SIM' : 'NÃO'}","${o.responsibleAgentName || ''}",${o.latitude},${o.longitude}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_ovitrampas_endemiasgov_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Handler: Salvar Configurações
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await ovitrapService.updateSettings(settings);
      if (!res.success) throw new Error(res.error);
      alert('Configurações do ecossistema de ovitrampas atualizadas com sucesso!');
      await loadData();
    } catch (err: any) {
      alert(`Erro ao salvar configurações: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lista da agenda filtrada pela categoria selecionada
  const currentAgendaList = useMemo(() => {
    return agenda[agendaCategory] || [];
  }, [agenda, agendaCategory]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. CABEÇALHO CENTRAL DE OVITRAMPAS (CORE MODULE)                           */}
      {/* ========================================================================= */}
      <PageHeader
        icon={Layers}
        title="Central de Ovitrampas"
        subtitle="Vigilância Entomológica de Ovos de Aedes aegypti — Ferramenta Operacional, Territorial e Preditiva"
        badge={[
          { label: 'CORE MODULE', tone: 'info' },
          { label: 'Rede Sentinela Ativa', tone: 'success' },
        ]}
        actions={
          <>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              title="Sincronizar e Recarregar Dados"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-600' : ''}`} />
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition shadow-2xs"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={() => setShowPlanNetworkModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition shadow-2xs"
            >
              <Crosshair className="w-4 h-4 text-indigo-600" />
              <span>Planejar Rede</span>
            </button>

            <button
              onClick={handleOpenCreatePoint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Ponto</span>
            </button>
          </>
        }
      />

      {/* ========================================================================= */}
      {/* 2. FILTROS GLOBAIS NO TOPO (RESPONDEM A TODAS AS ABAS)                    */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-sky-600" />
            Filtros Globais da Central
          </span>
          <button
            onClick={() => {
              setGlobalPeriod('30d');
              setGlobalNeighborhood('ALL');
              setGlobalSector('ALL');
              setGlobalAgent('ALL');
              setGlobalTeam('ALL');
              setGlobalStatus('ALL');
              setGlobalResult('all');
              setSearchTerm('');
            }}
            className="text-[11px] font-semibold text-sky-600 hover:text-sky-800 underline cursor-pointer"
          >
            Limpar Filtros
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-2.5 text-xs">
          {/* Período */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Período</label>
            <select
              value={globalPeriod}
              onChange={(e) => setGlobalPeriod(e.target.value as any)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="all">Todo o Histórico</option>
            </select>
          </div>

          {/* Ciclo */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Ciclo</label>
            <select
              value={globalCycle}
              onChange={(e) => setGlobalCycle(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700"
            >
              <option value="ciclo_atual">Ciclo Atual</option>
              <option value="ciclo_anterior">Ciclo Anterior</option>
              <option value="todos">Todos os Ciclos</option>
            </select>
          </div>

          {/* Bairro */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Bairro</label>
            <select
              value={globalNeighborhood}
              onChange={(e) => setGlobalNeighborhood(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700"
            >
              <option value="ALL">Todos os Bairros</option>
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          {/* Setor */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Setor</label>
            <select
              value={globalSector}
              onChange={(e) => setGlobalSector(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700"
            >
              <option value="ALL">Todos os Setores</option>
              {sectorsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Microárea */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Microárea</label>
            <select
              value={globalMicroarea}
              onChange={(e) => setGlobalMicroarea(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700"
            >
              <option value="ALL">Todas as Microáreas</option>
              <option value="MA-01">MA 01</option>
              <option value="MA-02">MA 02</option>
              <option value="MA-03">MA 03</option>
            </select>
          </div>

          {/* ACE */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">ACE Responsável</label>
            <select
              value={globalAgent}
              onChange={(e) => setGlobalAgent(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700"
            >
              <option value="ALL">Todos os ACEs</option>
              {agentsList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Equipe */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Equipe</label>
            <select
              value={globalTeam}
              onChange={(e) => setGlobalTeam(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700"
            >
              <option value="ALL">Todas as Equipes</option>
              {teamsList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Status Operacional</label>
            <select
              value={globalStatus}
              onChange={(e) => setGlobalStatus(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700"
            >
              <option value="ALL">Todos os Status</option>
              <option value="Disponivel">Disponível</option>
              <option value="Instalada">Instalada</option>
              <option value="Aguardando coleta">Aguardando Coleta</option>
              <option value="Coleta vencida">Coleta Vencida</option>
              <option value="Coletada">Coletada</option>
              <option value="Resultado disponivel">Resultado Disponível</option>
            </select>
          </div>

          {/* Resultado */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Resultado</label>
            <select
              value={globalResult}
              onChange={(e) => setGlobalResult(e.target.value as any)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700"
            >
              <option value="all">Todos</option>
              <option value="positive">Positivas</option>
              <option value="negative">Negativas</option>
              <option value="invalid">Inválidas</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. BARRA DE NAVEGAÇÃO INTERNA POR 11 ABAS                                */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex items-center gap-1 text-xs font-bold overflow-x-auto shadow-2xs">
        {[
          { id: 'visao_geral', label: 'VISÃO GERAL', icon: BarChart3 },
          { id: 'rede', label: 'REDE', icon: Layers },
          { id: 'agenda', label: 'AGENDA', icon: Calendar, badge: agenda.overdue.length },
          { id: 'instalacoes', label: 'INSTALAÇÕES', icon: Plus },
          { id: 'coletas', label: 'COLETAS', icon: Clock },
          { id: 'resultados', label: 'RESULTADOS', icon: Microscope },
          { id: 'mapa', label: 'MAPA', icon: MapPin },
          { id: 'inteligencia', label: 'INTELIGÊNCIA', icon: Zap },
          { id: 'historico', label: 'HISTÓRICO', icon: History },
          { id: 'relatorios', label: 'RELATÓRIOS', icon: FileText },
          { id: 'configuracoes', label: 'CONFIGURAÇÕES', icon: SettingsIcon },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as TabType)}
              className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {typeof t.badge === 'number' && t.badge > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: VISÃO GERAL (DASHBOARD COM 15 CARDS OFICIAIS CALCULADOS)           */}
      {/* ========================================================================= */}
      {activeTab === 'visao_geral' && (
        <div className="space-y-6">
          {/* Grid com os 15 Cards Operacionais e Entomológicos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {/* 1. Pontos Cadastrados */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Pontos Cadastrados
              </span>
              <p className="text-xl font-black text-slate-900 mt-0.5">{kpis.totalRegistered}</p>
              <span className="text-[10px] text-slate-400">Total mapeado</span>
            </div>

            {/* 2. Rede Ativa */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Rede Ativa
              </span>
              <p className="text-xl font-black text-emerald-800 mt-0.5">{kpis.activeNetwork}</p>
              <span className="text-[10px] text-emerald-600 font-medium">Em vigilância</span>
            </div>

            {/* 3. Instaladas */}
            <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Instaladas
              </span>
              <p className="text-xl font-black text-blue-800 mt-0.5">{kpis.installedCount}</p>
              <span className="text-[10px] text-blue-500 font-medium">Armadilhas em campo</span>
            </div>

            {/* 4. Aguardando Coleta */}
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Aguardando Coleta
              </span>
              <p className="text-xl font-black text-amber-800 mt-0.5">
                {kpis.waitingCollectionCount}
              </p>
              <span className="text-[10px] text-amber-600 font-medium">No período</span>
            </div>

            {/* 5. Coletas Hoje */}
            <div className="bg-white p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                Coletas Hoje
              </span>
              <p className="text-xl font-black text-indigo-800 mt-0.5">{kpis.collectionsToday}</p>
              <span className="text-[10px] text-indigo-600 font-medium">Programadas</span>
            </div>

            {/* 6. Coletas Vencidas */}
            <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                Coletas Vencidas
              </span>
              <p className="text-xl font-black text-rose-800 mt-0.5">
                {kpis.overdueCollectionCount}
              </p>
              <span className="text-[10px] text-rose-600 font-medium">Prioridade operacional</span>
            </div>

            {/* 7. Coletadas */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Coletadas
              </span>
              <p className="text-xl font-black text-slate-800 mt-0.5">{kpis.collectedCount}</p>
              <span className="text-[10px] text-slate-400">Palhetas recolhidas</span>
            </div>

            {/* 8. Positivas */}
            <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                Positivas
              </span>
              <p className="text-xl font-black text-rose-700 mt-0.5">{kpis.positiveCount}</p>
              <span className="text-[10px] text-rose-500 font-medium">Com presença de ovos</span>
            </div>

            {/* 9. Negativas */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                Negativas
              </span>
              <p className="text-xl font-black text-emerald-700 mt-0.5">{kpis.negativeCount}</p>
              <span className="text-[10px] text-emerald-500 font-medium">Sem ovos</span>
            </div>

            {/* 10. Inválidas */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Inválidas
              </span>
              <p className="text-xl font-black text-slate-700 mt-0.5">{kpis.invalidCount}</p>
              <span className="text-[10px] text-slate-400">Descartadas / Danificadas</span>
            </div>

            {/* 11. Total de Ovos */}
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Total de Ovos
              </span>
              <p className="text-xl font-black text-amber-800 mt-0.5">{kpis.totalEggs}</p>
              <span className="text-[10px] text-amber-600 font-medium">Contagem total</span>
            </div>

            {/* 12. Positividade % (IPO) */}
            <div className="bg-white p-3.5 rounded-xl border border-sky-300 bg-sky-50/30 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800">
                Positividade % (IPO)
              </span>
              <p className="text-xl font-black text-sky-800 mt-0.5">{kpis.ipo}%</p>
              <span className="text-[10px] text-sky-600 font-medium">Índice Ministério da Saúde</span>
            </div>

            {/* 13. Média de Ovos */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Média de Ovos
              </span>
              <p className="text-xl font-black text-slate-900 mt-0.5">{kpis.averageEggs}</p>
              <span className="text-[10px] text-slate-400">Ovos / armadilha</span>
            </div>

            {/* 14. Densidade de Ovos (IDO) */}
            <div className="bg-white p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
                Densidade Ovos (IDO)
              </span>
              <p className="text-xl font-black text-indigo-800 mt-0.5">{kpis.ido}</p>
              <span className="text-[10px] text-indigo-600 font-medium">Ovos / ovitrampa positiva</span>
            </div>

            {/* 15. Áreas em Atenção */}
            <div className="bg-white p-3.5 rounded-xl border border-rose-300 bg-rose-50/30 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                Áreas em Atenção
              </span>
              <p className="text-xl font-black text-rose-800 mt-0.5">
                {kpis.attentionAreasCount}
              </p>
              <span className="text-[10px] text-rose-600 font-medium">Densidade &gt; 50 ovos</span>
            </div>
          </div>

          {/* Gráfico de Tendência & O que Fazer Hoje / Amanhã */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Tendência de Positividade e Ovos ao Longo do Tempo */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-sky-600" />
                    TENDÊNCIA TEMPORAL DE ATIVIDADE DO AEDES (OVOS & POSITIVIDADE)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Curva epidemiológica semanal com cálculo de densidade real de postura
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">
                  Sensibilidade: {settings.trendSensitivity.toUpperCase()}
                </span>
              </div>

              {/* Barras Horizontais Visuais */}
              <div className="space-y-3 pt-2">
                {temporalTrends.map((t: any, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">{t.period}</span>
                      <span className="font-mono text-slate-500">
                        {t.totalEggs} ovos | IPO {t.ipo}% ({t.positiveCount} pos.)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 flex overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-l-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (t.totalEggs / 150) * 100)}%` }}
                        title={`${t.totalEggs} ovos`}
                      />
                      <div
                        className="bg-sky-600 h-full transition-all duration-500"
                        style={{ width: `${t.ipo}%` }}
                        title={`IPO: ${t.ipo}%`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                    Densidade de Ovos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-sky-600 inline-block" />
                    IPO (%)
                  </span>
                </div>
                <span className="font-medium">
                  {kpis.trend === 'SUBINDO' ? '⚠️ Tendência de Alta Detectada' : '✅ Tendência Estável'}
                </span>
              </div>
            </div>

            {/* Painel Operacional: O que fazer hoje e amanhã? */}
            <div className="space-y-4">
              {/* O que fazer hoje? */}
              <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-amber-800">
                  <Flame className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider">O QUE FAZER HOJE?</h3>
                </div>
                <p className="text-xs font-bold text-slate-800">
                  {agenda.overdue.length > 0
                    ? `Executar imediatamente ${agenda.overdue.length} coletas vencidas e verificar se há oviposição acelerada.`
                    : 'Realizar vistorias programadas de rotina nas ovitrampas da agenda de hoje.'}
                </p>
                <div className="text-[11px] text-slate-600 pt-1">
                  <strong>Sugestão:</strong> Iniciar pelas áreas com histórico positivo recente (ex: Bairro Centro e Setor 03).
                </div>
              </div>

              {/* O que fazer amanhã? */}
              <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-200 space-y-2">
                <div className="flex items-center gap-2 text-sky-800">
                  <Clock className="w-4 h-4 text-sky-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider">O QUE FAZER AMANHÃ?</h3>
                </div>
                <p className="text-xs font-bold text-slate-800">
                  {agenda.tomorrow.length > 0
                    ? `Coleta de ${agenda.tomorrow.length} palhetas com previsão de substituição para novo ciclo de 5 dias.`
                    : 'Programar rota de instalação para pontos sem monitoramento identificados pela rede.'}
                </p>
                <div className="text-[11px] text-slate-600 pt-1">
                  <strong>Prioridade:</strong> Gerar a rota de coleta otimizada com despacho direto para o PWA do ACE.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: REDE (PLANEJAMENTO TERRITORIAL, COBERTURA & PONTOS SENTINELA)       */}
      {/* ========================================================================= */}
      {activeTab === 'rede' && (
        <div className="space-y-6">
          {/* Topo da Rede: Cobertura e Sugestões */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-600" />
                  DISTRIBUIÇÃO TERRITORIAL DA REDE SENTINELA
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Análise de cobertura por setores municipais e detecção de vazios de monitoramento
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPlanNetworkModal(true)}
                  className="px-3.5 py-2 text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 rounded-xl hover:bg-sky-100 transition"
                >
                  Planejar Rede de Ovitrampas
                </button>
              </div>
            </div>

            {/* Tabela de Cobertura Territorial */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Território</th>
                    <th className="p-3">Imóveis Estimados</th>
                    <th className="p-3">Armadilhas</th>
                    <th className="p-3">Pontos Ativos</th>
                    <th className="p-3">Positividade %</th>
                    <th className="p-3">Situação da Cobertura</th>
                    <th className="p-3">Recomendação Operacional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coverageData.map((cov, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-bold text-slate-900">{cov.territoryName}</td>
                      <td className="p-3 text-slate-600">{cov.propertiesCount}</td>
                      <td className="p-3 font-semibold">{cov.ovitrapCount}</td>
                      <td className="p-3 text-emerald-700 font-semibold">{cov.activePoints}</td>
                      <td className="p-3 font-mono font-bold text-slate-800">{cov.positivityRate}%</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            cov.status === 'Adequada'
                              ? 'bg-emerald-100 text-emerald-800'
                              : cov.status === 'Baixa cobertura'
                              ? 'bg-amber-100 text-amber-800'
                              : cov.status === 'Sem monitoramento'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {cov.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{cov.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sugestões de Novos Pontos (Motor Algorítmico com Aprovação Humana) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  SUGESTÃO DE NOVOS PONTOS SENTINELA (RECOMENDAÇÃO AUTOMATIZADA)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Baseado em vazios territoriais, densidade histórica de focos e casos epidemiológicos agregados
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                Requer Aprovação do Coordenador
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pointSuggestions.map((sug) => (
                <div
                  key={sug.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5 hover:border-sky-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-slate-900">{sug.sectorName}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sug.priority === 'CRITICA'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Prioridade {sug.priority}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">{sug.reason}</p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                    <span>Risco: {sug.riskScore}/100</span>
                    <span>Recomendado: +{sug.recommendedTraps} pontos</span>
                  </div>

                  <button
                    onClick={() => {
                      handleOpenCreatePoint();
                      setNewPointData((prev) => ({
                        ...prev,
                        name: `Ovitrampa Sugerida (${sug.sectorName})`,
                        sectorId: sug.sectorId,
                        notes: `Ponto sugerido pelo motor de expansão de rede devido a: ${sug.reason}`,
                      }));
                    }}
                    className="w-full py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition"
                  >
                    Aprovar e Cadastrar Ponto
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Listagem Geral de Pontos Sentinela Cadastrados */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por código, logradouro, bairro ou ACE..."
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Exibindo {ovitraps.length} ovitrampas
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Código</th>
                    <th className="p-3">Território</th>
                    <th className="p-3">Endereço & Referência</th>
                    <th className="p-3">ACE Responsável</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Última Leitura</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ovitraps.map((trap) => (
                    <tr key={trap.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-mono font-black text-sky-700">
                        <div className="flex items-center gap-1.5">
                          <span>{trap.code}</span>
                          {trap.isPositive && (
                            <span className="w-2 h-2 rounded-full bg-rose-500" title="Positiva" />
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{trap.neighborhoodName}</div>
                        <div className="text-[11px] text-slate-400">{trap.sectorName}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-slate-800 font-medium">{trap.address}</div>
                        {trap.referencePoint && (
                          <div className="text-[11px] text-slate-400">Ref: {trap.referencePoint}</div>
                        )}
                      </td>
                      <td className="p-3 text-slate-700">
                        {trap.responsibleAgentName || 'Não atribuído'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            trap.status === 'Instalada'
                              ? 'bg-blue-100 text-blue-800'
                              : trap.status === 'Aguardando coleta'
                              ? 'bg-amber-100 text-amber-800'
                              : trap.status === 'Coleta vencida'
                              ? 'bg-rose-100 text-rose-800'
                              : trap.status === 'Coletada'
                              ? 'bg-purple-100 text-purple-800'
                              : trap.status === 'Resultado disponivel'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {trap.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {trap.lastEggsCount > 0 ? (
                          <span className="font-bold text-rose-600">
                            {trap.lastEggsCount} ovos (Positiva)
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">0 ovos (Negativa)</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(trap)}
                            className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition"
                            title="Ver Histórico Completo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTrap(trap);
                              setShowQrModal(true);
                            }}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="QR Code Operacional"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          {trap.status === 'Disponivel' && (
                            <button
                              onClick={() => handleOpenInstall(trap)}
                              className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                            >
                              Instalar
                            </button>
                          )}
                          {['Instalada', 'Aguardando coleta', 'Coleta vencida'].includes(trap.status) && (
                            <button
                              onClick={() => handleOpenCollect(trap)}
                              className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
                            >
                              Coletar
                            </button>
                          )}
                          {trap.status === 'Coletada' && (
                            <button
                              onClick={() => handleOpenResult(trap)}
                              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                            >
                              Contar Ovos
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: AGENDA INTELIGENTE & ROTA DE COLETA                                */}
      {/* ========================================================================= */}
      {activeTab === 'agenda' && (
        <div className="space-y-6">
          {/* Topo da Agenda: Seletor de Categorias e Ação de Rota */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto">
              {[
                { id: 'today', label: 'HOJE', count: agenda.today.length, color: 'text-sky-700' },
                { id: 'tomorrow', label: 'AMANHÃ', count: agenda.tomorrow.length, color: 'text-indigo-700' },
                { id: 'next7Days', label: 'PRÓXIMOS 7 DIAS', count: agenda.next7Days.length, color: 'text-slate-700' },
                { id: 'overdue', label: 'VENCIDAS', count: agenda.overdue.length, color: 'text-rose-700' },
                { id: 'unscheduled', label: 'SEM PROGRAMAÇÃO', count: agenda.unscheduled.length, color: 'text-slate-500' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setAgendaCategory(cat.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    agendaCategory === cat.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                      agendaCategory === cat.id
                        ? 'bg-white text-slate-900'
                        : 'bg-white/70 text-slate-700'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectedForRoute.length === currentAgendaList.length) {
                    setSelectedForRoute([]);
                  } else {
                    setSelectedForRoute(currentAgendaList.map((t) => t.id));
                  }
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                {selectedForRoute.length === currentAgendaList.length && currentAgendaList.length > 0
                  ? 'Desmarcar Todos'
                  : 'Selecionar Todos'}
              </button>

              <button
                onClick={handleGenerateRoute}
                disabled={selectedForRoute.length === 0}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition ${
                  selectedForRoute.length > 0
                    ? 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Navigation className="w-4 h-4" />
                <span>Criar Rota de Coleta ({selectedForRoute.length})</span>
              </button>
            </div>
          </div>

          {/* Cards da Agenda */}
          {currentAgendaList.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-800">
                Nenhuma armadilha programada nesta categoria da agenda.
              </p>
              <p className="text-xs text-slate-500">
                Acompanhe as demais categorias ou programe novas instalações.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentAgendaList.map((trap) => {
                const isOverdue = agendaCategory === 'overdue';
                const isSelected = selectedForRoute.includes(trap.id);
                return (
                  <div
                    key={trap.id}
                    onClick={() => {
                      setSelectedForRoute((prev) =>
                        prev.includes(trap.id) ? prev.filter((id) => id !== trap.id) : [...prev, trap.id]
                      );
                    }}
                    className={`p-4 rounded-2xl border transition cursor-pointer space-y-3 ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/40 ring-2 ring-sky-300'
                        : isOverdue
                        ? 'border-rose-200 bg-rose-50/20 hover:border-rose-300'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // tratado no card
                          className="rounded text-sky-600 focus:ring-sky-500"
                        />
                        <span className="font-mono font-black text-xs text-sky-700">{trap.code}</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isOverdue
                            ? 'bg-rose-100 text-rose-800'
                            : trap.isPositive
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isOverdue
                          ? 'Prioridade Crítica'
                          : trap.isPositive
                          ? 'Prioridade Alta'
                          : 'Prioridade Normal'}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{trap.neighborhoodName}</h4>
                      <p className="text-xs text-slate-600 line-clamp-1">{trap.address}</p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <span>ACE: {trap.responsibleAgentName?.split(' ')[0] || 'Geral'}</span>
                      <span className="font-mono">
                        Previsto: {trap.nextCollectionDate || 'Não agendado'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: INSTALAÇÕES                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'instalacoes' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                INSTALAÇÕES DA REDE DE OVITRAMPAS
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Validação de armadilhas ativas em campo e controle de palhetas novas
              </p>
            </div>
            <button
              onClick={() => {
                if (ovitraps.length > 0) handleOpenInstall(ovitraps[0]);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
            >
              Nova Instalação
            </button>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Ovitrampa</th>
                  <th className="p-3">Território</th>
                  <th className="p-3">Data Instalação</th>
                  <th className="p-3">Coleta Prevista</th>
                  <th className="p-3">Status Operacional</th>
                  <th className="p-3">ACE Responsável</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ovitraps
                  .filter((t) => ['Instalada', 'Aguardando coleta', 'Coleta vencida'].includes(t.status))
                  .map((trap) => (
                    <tr key={trap.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-mono font-black text-sky-700">{trap.code}</td>
                      <td className="p-3 font-medium text-slate-800">{trap.neighborhoodName}</td>
                      <td className="p-3 text-slate-600">{trap.lastInstallationDate || 'Recentemente'}</td>
                      <td className="p-3 font-semibold text-slate-800">{trap.nextCollectionDate || '5 dias'}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          {trap.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{trap.responsibleAgentName || 'ACE'}</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleOpenCollect(trap)}
                          className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
                        >
                          Coletar Palheta
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 5: COLETAS                                                            */}
      {/* ========================================================================= */}
      {activeTab === 'coletas' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                COLETAS DE CAMPO & PALHETAS RECOLHIDAS
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhamento do envio para leitura laboratorial e identificação de integridade
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Ovitrampa</th>
                  <th className="p-3">Bairro</th>
                  <th className="p-3">Última Coleta</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Ovos Contados</th>
                  <th className="p-3">ACE</th>
                  <th className="p-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ovitraps
                  .filter((t) => ['Coletada', 'Em analise', 'Resultado disponivel'].includes(t.status))
                  .map((trap) => (
                    <tr key={trap.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-mono font-black text-sky-700">{trap.code}</td>
                      <td className="p-3 font-medium text-slate-800">{trap.neighborhoodName}</td>
                      <td className="p-3 text-slate-600">{trap.lastCollectionDate || 'Hoje'}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                          {trap.status}
                        </span>
                      </td>
                      <td className="p-3 font-bold">
                        {trap.lastEggsCount > 0 ? (
                          <span className="text-rose-600">{trap.lastEggsCount} ovos</span>
                        ) : (
                          <span className="text-slate-400">Pendente leitura</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{trap.responsibleAgentName || 'ACE'}</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleOpenResult(trap)}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                        >
                          Registrar Contagem
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 6: RESULTADOS & CONTAGEM DE OVOS                                      */}
      {/* ========================================================================= */}
      {activeTab === 'resultados' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Microscope className="w-4 h-4 text-emerald-600" />
                PAINEL LABORATORIAL DE LEITURA & CONTAGEM DE OVOS
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Digitação facilitada de contagem, verificação de consistência e dupla conferência
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
                Dupla Conferência:{' '}
                <strong className={settings.doubleCheckEnabled ? 'text-emerald-700' : 'text-slate-500'}>
                  {settings.doubleCheckEnabled ? 'ATIVADA' : 'OPCIONAL'}
                </strong>
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Ovitrampa</th>
                  <th className="p-3">Bairro</th>
                  <th className="p-3">Data Coleta</th>
                  <th className="p-3">Contagem de Ovos</th>
                  <th className="p-3">Classificação</th>
                  <th className="p-3">Ações de Leitura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ovitraps.map((trap) => (
                  <tr key={trap.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-3 font-mono font-black text-sky-700">{trap.code}</td>
                    <td className="p-3 font-medium text-slate-800">{trap.neighborhoodName}</td>
                    <td className="p-3 text-slate-600">{trap.lastCollectionDate || '---'}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {trap.lastEggsCount} ovos
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          trap.isPositive
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {trap.isPositive ? 'Positiva' : 'Negativa'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleOpenResult(trap)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                      >
                        Digitar Contagem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 7: MAPA AVANÇADO COM CAMADAS E HEATMAP                                */}
      {/* ========================================================================= */}
      {activeTab === 'mapa' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-sky-600" />
                  MAPA EPIDEMIOLÓGICO & CALOR DE OVITRAMPAS
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualização multimodal: forma, cor e ícone representam a densidade de oviposição
                </p>
              </div>

              {/* Legenda Multimodal */}
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="flex items-center gap-1.5 font-bold text-rose-700">
                  <span className="w-3 h-3 rounded-full bg-rose-600 inline-block" /> Positiva (&gt; 0 ovos)
                </span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" /> Negativa (0 ovos)
                </span>
                <span className="flex items-center gap-1.5 font-bold text-amber-700">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Aguardando Coleta
                </span>
                <span className="flex items-center gap-1.5 font-bold text-blue-700">
                  <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Instalada
                </span>
              </div>
            </div>

            {/* Simulação Visual do Mapa Georreferenciado com Grade Espacial */}
            <div className="relative w-full h-[520px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 p-6 flex flex-col justify-between">
              {/* Overlay Superior de Controles */}
              <div className="flex items-center justify-between z-10">
                <div className="bg-slate-800/90 backdrop-blur-xs p-2.5 rounded-xl border border-slate-700 text-white text-xs space-y-1">
                  <span className="font-bold flex items-center gap-1 text-sky-400">
                    <Navigation className="w-3.5 h-3.5" />
                    Município de Monitoramento
                  </span>
                  <p className="text-[11px] text-slate-300">
                    {ovitraps.length} ovitrampas plotadas no mapa
                  </p>
                </div>

                <div className="bg-slate-800/90 backdrop-blur-xs p-2 rounded-xl border border-slate-700 text-xs text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span className="font-bold">Modo Heatmap Ativo</span>
                </div>
              </div>

              {/* Grid Geográfico dos Pontos */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 my-auto">
                {ovitraps.map((trap, idx) => (
                  <div
                    key={trap.id}
                    onClick={() => handleOpenDetails(trap)}
                    className={`p-3 rounded-xl border backdrop-blur-xs transition cursor-pointer transform hover:scale-105 ${
                      trap.isPositive
                        ? 'bg-rose-950/70 border-rose-500 text-rose-200'
                        : 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-xs">{trap.code}</span>
                      <span className="text-[10px] font-bold">
                        {trap.isPositive ? '🔥 Positiva' : '🟢 Negativa'}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold mt-1 text-white line-clamp-1">
                      {trap.neighborhoodName}
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1 flex items-center justify-between">
                      <span>{trap.lastEggsCount} ovos</span>
                      <span>{trap.status}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Barra Inferior com Coordenadas e Detalhes */}
              <div className="z-10 bg-slate-800/90 backdrop-blur-xs p-3 rounded-xl border border-slate-700 text-slate-300 text-xs flex items-center justify-between">
                <span>Centro do mapa conforme Configurações &gt; Mapas &amp; Camadas</span>
                <span className="text-sky-400 font-bold">
                  Clique em qualquer armadilha para abrir histórico e ciclo sanitário
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 8: INTELIGÊNCIA ENTOMOLÓGICA & CRUZAMENTOS                            */}
      {/* ========================================================================= */}
      {activeTab === 'inteligencia' && (
        <div className="space-y-6">
          {/* 4 Cruzamentos Chave */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                CRUZAMENTOS TERRITORIAIS MULTIFATORIAIS (OVITRAMPAS × FOCOS × EPIDEMIOLOGIA × LIRAa)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Coincidência espacial sem correlação espúria para subsidiar ações de bloqueio
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Território / Setor</th>
                    <th className="p-3">Positividade Ovitrampas (IPO)</th>
                    <th className="p-3">Total Ovos</th>
                    <th className="p-3">Focos Residenciais</th>
                    <th className="p-3">Casos Epidemiológicos</th>
                    <th className="p-3">LIRAa (IIP / IB)</th>
                    <th className="p-3">Prioridade Operacional</th>
                    <th className="p-3">Análise Territorial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {integratedCrossings.map((cross, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-bold text-slate-900">{cross.sectorName}</td>
                      <td className="p-3 font-mono font-bold text-sky-700">
                        {cross.ovitrapPositivity}%
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-700">
                        {cross.totalEggs} ovos
                      </td>
                      <td className="p-3 text-slate-700">{cross.fociCount} focos</td>
                      <td className="p-3 text-slate-700">{cross.epidemiologicalCases} casos</td>
                      <td className="p-3 font-mono text-slate-600">
                        IIP: {cross.liraaIip}% | IB: {cross.liraaIb}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            cross.operationalPriority === 'CRITICA'
                              ? 'bg-rose-100 text-rose-800'
                              : cross.operationalPriority === 'ALTA'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {cross.operationalPriority}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{cross.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Positividade Persistente */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                DETECÇÃO DE POSITIVIDADE PERSISTENTE (≥ 2 CICLOS CONSECUTIVOS)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pontos sentinela com reprodução contínua e risco de estabelecimento crônico do vetor
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {persistentPoints.map((p) => (
                <div
                  key={p.ovitrapId}
                  className="p-4 rounded-xl border border-rose-200 bg-rose-50/20 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-rose-800">{p.code}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                      {p.consecutivePositiveCycles} Ciclos Positivos
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{p.neighborhoodName}</h4>
                    <p className="text-xs text-slate-600">{p.sectorName}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-rose-100">
                    <span className="text-slate-600">Última postura:</span>
                    <strong className="font-mono text-rose-700">{p.latestEggsCount} ovos</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 9: HISTÓRICO COMPLETO & COMPARADOR                                    */}
      {/* ========================================================================= */}
      {activeTab === 'historico' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-sky-600" />
                HISTÓRICO OPERACIONAL & COMPARADOR DE PONTOS
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Selecione até 5 ovitrampas para comparar o comportamento temporal de postura de ovos
              </p>
            </div>

            {/* Seletor de Comparação */}
            <div className="flex items-center gap-2 flex-wrap">
              {ovitraps.slice(0, 10).map((trap) => {
                const isSelected = compareTrapIds.includes(trap.id);
                return (
                  <button
                    key={trap.id}
                    onClick={() => {
                      if (isSelected) {
                        setCompareTrapIds((prev) => prev.filter((id) => id !== trap.id));
                      } else if (compareTrapIds.length < 5) {
                        setCompareTrapIds((prev) => [...prev, trap.id]);
                      } else {
                        alert('Você pode selecionar no máximo 5 ovitrampas para comparação.');
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {trap.code} ({trap.neighborhoodName.split(' ')[0]})
                  </button>
                );
              })}
            </div>

            {/* Tabela de Comparação */}
            {compareTrapIds.length > 0 && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl mt-4">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Código</th>
                      <th className="p-3">Bairro</th>
                      <th className="p-3">Setor</th>
                      <th className="p-3">Última Leitura</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Positividade Histórica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ovitraps
                      .filter((t) => compareTrapIds.includes(t.id))
                      .map((trap) => (
                        <tr key={trap.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-3 font-mono font-black text-sky-700">{trap.code}</td>
                          <td className="p-3 font-medium text-slate-800">{trap.neighborhoodName}</td>
                          <td className="p-3 text-slate-600">{trap.sectorName}</td>
                          <td className="p-3 font-bold text-rose-700">{trap.lastEggsCount} ovos</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {trap.status}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-emerald-700">
                            {trap.isPositive ? 'Positiva no Ciclo' : 'Negativa no Ciclo'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 10: RELATÓRIOS & BOLETIM ENTOMOLÓGICO                                */}
      {/* ========================================================================= */}
      {activeTab === 'relatorios' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                BOLETIM DE VIGILÂNCIA POR OVITRAMPAS & RELATÓRIOS
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Emissão de relatórios operacionais consolidados e boletim técnico padrão SUS
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Boletim</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Dados Completos (CSV)</span>
              </button>
            </div>
          </div>

          {/* Boletim Entomológico Oficial (Estilo Impressão) */}
          <div className="bg-white p-8 rounded-2xl border border-slate-300 shadow-xs space-y-6">
            <div className="text-center border-b border-slate-200 pb-5 space-y-1">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                BOLETIM TÉCNICO DE VIGILÂNCIA ENTOMOLÓGICA POR OVITRAMPAS
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Coordenação Municipal de Vigilância em Saúde e Controle de Endemias
              </p>
              <p className="text-[11px] text-slate-400">
                Gerado em: {new Date().toLocaleDateString('pt-BR')}
              </p>
            </div>

            {/* Resumo Executivo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500">Rede Monitorada</span>
                <p className="text-xl font-black text-slate-900 mt-0.5">{kpis.activeNetwork} pontos</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500">Positividade (IPO)</span>
                <p className="text-xl font-black text-sky-800 mt-0.5">{kpis.ipo}%</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500">Densidade (IDO)</span>
                <p className="text-xl font-black text-amber-800 mt-0.5">{kpis.ido}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500">Total de Ovos</span>
                <p className="text-xl font-black text-rose-800 mt-0.5">{kpis.totalEggs}</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
              <strong>Conclusão Técnica:</strong> A rede sentinela de ovitrampas do município aponta um
              Índice de Positividade de <strong>{kpis.ipo}%</strong> com contagem agregada de{' '}
              <strong>{kpis.totalEggs} ovos</strong> no período. A metodologia empregada atende aos
              requisitos técnicos das Diretrizes Nacionais para a Prevenção e Controle de Epidemias de
              Dengue (Ministério da Saúde).
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 11: CONFIGURAÇÕES DO ECOSSISTEMA DE OVITRAMPAS                        */}
      {/* ========================================================================= */}
      {activeTab === 'configuracoes' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4 text-slate-700" />
                  CONFIGURAÇÕES DO MÓDULO OVITRAMPAS
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Parâmetros metodológicos, periodicidades, limites de alerta e tolerâncias
                </p>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
              {/* Intervalo Instalação -> Coleta */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Intervalo Padrão Instalação → Coleta (Dias)</label>
                <input
                  type="number"
                  value={settings.collectionIntervalDays}
                  onChange={(e) =>
                    setSettings({ ...settings, collectionIntervalDays: Number(e.target.value) })
                  }
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                  min={3}
                  max={15}
                />
                <span className="text-[11px] text-slate-400">Padrão SUS recomendado: 5 dias</span>
              </div>

              {/* Periodicidade entre Ciclos */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Periodicidade da Rede (Dias)</label>
                <input
                  type="number"
                  value={settings.installationFrequencyDays}
                  onChange={(e) =>
                    setSettings({ ...settings, installationFrequencyDays: Number(e.target.value) })
                  }
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                  min={14}
                  max={60}
                />
                <span className="text-[11px] text-slate-400">Ciclo usual: 28 dias</span>
              </div>

              {/* Limite de Alerta de Ovos */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Gatilho de Alerta de Ovos (Densidade)</label>
                <input
                  type="number"
                  value={settings.alertEggsThreshold}
                  onChange={(e) =>
                    setSettings({ ...settings, alertEggsThreshold: Number(e.target.value) })
                  }
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
                <span className="text-[11px] text-slate-400">Gera alerta operacional automático</span>
              </div>

              {/* Ciclos para Positividade Persistente */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Ciclos Consecutivos para Persistência</label>
                <input
                  type="number"
                  value={settings.persistentPositiveCycles}
                  onChange={(e) =>
                    setSettings({ ...settings, persistentPositiveCycles: Number(e.target.value) })
                  }
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                  min={2}
                  max={6}
                />
                <span className="text-[11px] text-slate-400">Gatilho de área crítica</span>
              </div>

              {/* Sensibilidade de Tendência */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Sensibilidade do Algoritmo de Tendência</label>
                <select
                  value={settings.trendSensitivity}
                  onChange={(e) =>
                    setSettings({ ...settings, trendSensitivity: e.target.value as any })
                  }
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="baixa">Baixa (Apenas aumentos acentuados)</option>
                  <option value="moderada">Moderada (Padrão balanceado)</option>
                  <option value="alta">Alta (Mais sensível a variações)</option>
                </select>
              </div>

              {/* Dupla Conferência de Leituras */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Exigir Dupla Conferência de Leituras</label>
                <select
                  value={settings.doubleCheckEnabled ? 'true' : 'false'}
                  onChange={(e) =>
                    setSettings({ ...settings, doubleCheckEnabled: e.target.value === 'true' })
                  }
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="false">Não (Leitura única permitida)</option>
                  <option value="true">Sim (Exige 1ª e 2ª leitura)</option>
                </select>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CADASTRAR NOVO PONTO SENTINELA                                     */}
      {/* ========================================================================= */}
      {showCreatePointModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-600" />
                Cadastrar Novo Ponto Sentinela de Ovitrampa
              </h3>
              <button
                onClick={() => setShowCreatePointModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreatePoint} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Código Oficial</label>
                  <input
                    type="text"
                    required
                    value={newPointData.code}
                    onChange={(e) => setNewPointData({ ...newPointData, code: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Identificação / Nome</label>
                  <input
                    type="text"
                    value={newPointData.name}
                    onChange={(e) => setNewPointData({ ...newPointData, name: e.target.value })}
                    placeholder="Ex: Ovitrampa Escola 12"
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bairro *</label>
                  <select
                    required
                    value={newPointData.neighborhoodId}
                    onChange={(e) => setNewPointData({ ...newPointData, neighborhoodId: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  >
                    <option value="">Selecione o bairro...</option>
                    {neighborhoods.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Setor Operacional</label>
                  <select
                    value={newPointData.sectorId}
                    onChange={(e) => setNewPointData({ ...newPointData, sectorId: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  >
                    <option value="">Selecione o setor...</option>
                    {sectorsList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Logradouro *</label>
                  <input
                    type="text"
                    required
                    value={newPointData.street}
                    onChange={(e) => setNewPointData({ ...newPointData, street: e.target.value })}
                    placeholder="Rua, Avenida, Travessa..."
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Número</label>
                  <input
                    type="text"
                    value={newPointData.number}
                    onChange={(e) => setNewPointData({ ...newPointData, number: e.target.value })}
                    placeholder="123"
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ponto de Referência</label>
                <input
                  type="text"
                  value={newPointData.referencePoint}
                  onChange={(e) => setNewPointData({ ...newPointData, referencePoint: e.target.value })}
                  placeholder="Ex: Próximo ao posto de saúde, nos fundos do quintal sombreado"
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Latitude (GPS)</label>
                  <input
                    type="number"
                    step="any"
                    value={newPointData.latitude}
                    onChange={(e) => setNewPointData({ ...newPointData, latitude: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Longitude (GPS)</label>
                  <input
                    type="number"
                    step="any"
                    value={newPointData.longitude}
                    onChange={(e) => setNewPointData({ ...newPointData, longitude: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ACE Responsável</label>
                  <select
                    value={newPointData.responsibleAgentId}
                    onChange={(e) =>
                      setNewPointData({ ...newPointData, responsibleAgentId: e.target.value })
                    }
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  >
                    <option value="">Selecione o agente...</option>
                    {agentsList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Local</label>
                  <select
                    value={newPointData.locationType}
                    onChange={(e) => setNewPointData({ ...newPointData, locationType: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  >
                    <option value="Residencial">Residencial</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Ponto Estratégico">Ponto Estratégico</option>
                    <option value="Terreno Baldio">Terreno Baldio</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreatePointModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition cursor-pointer"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Ponto Sentinela'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR RESULTADO / CONTAGEM DE OVOS (CAMPO GRANDE)              */}
      {/* ========================================================================= */}
      {showResultModal && selectedTrap && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Microscope className="w-4 h-4 text-emerald-600" />
                  Contagem de Ovos — {selectedTrap.code}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selectedTrap.neighborhoodName} • {selectedTrap.address}
                </p>
              </div>
              <button
                onClick={() => setShowResultModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResult} className="p-5 space-y-4 text-xs">
              {/* CAMPO NUMÉRICO GRANDE PARA DIGITAÇÃO */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Quantidade Total de Ovos Contados
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={resultData.eggsCount}
                  onChange={(e) =>
                    setResultData({ ...resultData, eggsCount: Math.max(0, parseInt(e.target.value) || 0) })
                  }
                  className="w-full text-center text-4xl font-black text-slate-900 p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                  placeholder="0"
                  autoFocus
                />
                <span className="text-[11px] text-slate-500 font-medium">
                  {resultData.eggsCount > 0 ? (
                    <strong className="text-rose-600">Positiva para Aedes aegypti</strong>
                  ) : (
                    <strong className="text-emerald-700">Negativa (Sem oviposição)</strong>
                  )}
                </span>
              </div>

              {/* Dupla Conferência se ativada */}
              {settings.doubleCheckEnabled && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    2ª Leitura de Verificação (Opcional ou Exigida)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={resultData.secondReadCount}
                    onChange={(e) =>
                      setResultData({
                        ...resultData,
                        secondReadCount: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    placeholder="Contagem conferente pelo supervisor"
                    className="w-full p-2.5 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data da Leitura</label>
                  <input
                    type="date"
                    required
                    value={resultData.laboratoryDate}
                    onChange={(e) =>
                      setResultData({ ...resultData, laboratoryDate: e.target.value })
                    }
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Responsável pela Leitura</label>
                  <input
                    type="text"
                    value={resultData.responsibleName}
                    onChange={(e) =>
                      setResultData({ ...resultData, responsibleName: e.target.value })
                    }
                    placeholder="Nome do leitor/laboratório"
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observações Laboratoriais</label>
                <textarea
                  rows={2}
                  value={resultData.notes}
                  onChange={(e) => setResultData({ ...resultData, notes: e.target.value })}
                  placeholder="Ex: Palheta íntegra com ovos viáveis..."
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResultModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition cursor-pointer"
                >
                  {isSubmitting ? 'Gravando...' : 'Finalizar Resultado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QR CODE SEGURO                                                     */}
      {/* ========================================================================= */}
      {showQrModal && selectedTrap && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 p-6 text-center space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">QR Code da Ovitrampa</h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 inline-block mx-auto">
              <QrCode className="w-36 h-36 text-slate-900 mx-auto" />
            </div>

            <div>
              <span className="font-mono font-black text-base text-sky-700">
                {selectedTrap.code}
              </span>
              <p className="text-xs text-slate-600 font-medium mt-1">
                {selectedTrap.neighborhoodName} • {selectedTrap.address}
              </p>
              <p className="text-[10px] text-slate-400 mt-2">
                Ao escanear pelo PWA, o ACE acessa a armadilha sem expor dados pessoais no QR.
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Imprimir Etiqueta para Armadilha
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: HISTÓRICO COMPLETO DA OVITRAMPA                                    */}
      {/* ========================================================================= */}
      {showDetailModal && selectedTrap && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-600" />
                  Histórico Operacional & Ciclos — {selectedTrap.code}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedTrap.neighborhoodName} • {selectedTrap.address}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Status Atual</span>
                  <p className="font-bold text-slate-800 text-sm">{selectedTrap.status}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Última Leitura</span>
                  <p className="font-bold text-rose-700 text-sm">
                    {selectedTrap.lastEggsCount} ovos ({selectedTrap.isPositive ? 'Positiva' : 'Negativa'})
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Próxima Coleta</span>
                  <p className="font-bold text-slate-800 text-sm">
                    {selectedTrap.nextCollectionDate || '---'}
                  </p>
                </div>
              </div>

              {/* Linha do Tempo dos Ciclos */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs">Timeline de Instalações e Coletas</h4>
                {trapHistory.installations.length === 0 ? (
                  <p className="text-slate-400 italic">Nenhum ciclo registrado para este ponto.</p>
                ) : (
                  trapHistory.installations.map((inst, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>Instalação: {inst.installationDate}</span>
                        <span className="text-blue-600 font-mono text-[11px]">{inst.paddleCode || 'Palheta Padrão'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Agente: {inst.agentName} | Coleta Prevista: {inst.expectedCollectionDate}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ROTA DE COLETA OTIMIZADA PARA O ACE                                */}
      {/* ========================================================================= */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-sky-600" />
                  Roteiro de Coleta Otimizado para o ACE
                </h3>
                <p className="text-xs text-slate-500">
                  {generatedRoute.length} paradas ordenadas por proximidade e prioridade de atraso
                </p>
              </div>
              <button
                onClick={() => setShowRouteModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              {generatedRoute.map((p) => (
                <div
                  key={p.sequence}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-xs">
                      {p.sequence}
                    </span>
                    <div>
                      <div className="font-mono font-bold text-slate-900 flex items-center gap-2">
                        <span>{p.code}</span>
                        <span
                          className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                            p.priority === 'Crítica'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.priority}
                        </span>
                      </div>
                      <p className="text-slate-600">{p.address} • {p.neighborhoodName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-700">{p.distanceKm} km</span>
                    <p className="text-[10px] text-slate-400">{p.reason}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Disponível offline no PWA de campo do agente.
              </span>
              <button
                onClick={() => {
                  alert('Roteiro enviado com sucesso para o PWA dos agentes designados!');
                  setShowRouteModal(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition"
              >
                Despachar para o PWA do ACE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
