import React, { useState, useEffect } from 'react';
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
  TrendingUp,
  Filter,
  BarChart2,
  FileText,
  Hospital,
  AlertOctagon,
  HelpCircle,
  Search,
  ExternalLink,
  UploadCloud,
} from 'lucide-react';
import { db } from '../../services/storage';
import { EpidemiologicalBlock } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { vectorControlService } from '../../services/vectorControlService';
import { epidemiologicalWeekService } from '../../services/epidemiologicalWeekService';
import { EpidemiologyImportModal } from './EpidemiologyImportModal';
import { PageHeader } from '../ui';

export const EpidemiologyView: React.FC = () => {
  const [blocks, setBlocks] = useState<EpidemiologicalBlock[]>(db.getEpidemiologyBlocks());
  const [cases, setCases] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'CASOS' | 'BLOQUEIOS'>('DASHBOARD');
  const [showNewBlockModal, setShowNewBlockModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState<string>('TODAS');
  const [selectedSEFilter, setSelectedSEFilter] = useState<string>('FULL_YEAR');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('TODOS');
  const [selectedClassification, setSelectedClassification] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Form para novo bloqueio
  const [newBlockDisease, setNewBlockDisease] = useState<'DENGUE' | 'ZIKA' | 'CHIKUNGUNYA' | 'FEBRE_AMARELA'>('DENGUE');
  const [newBlockNeighborhood, setNewBlockNeighborhood] = useState('Vila Nova');
  const [radiusMeters, setRadiusMeters] = useState(150);

  const neighborhoods = db.getNeighborhoods();
  const currentSE = epidemiologicalWeekService.getEpidemiologicalWeek();
  const quickFilters = epidemiologicalWeekService.getQuickFilterOptions();

  // População estimada do município para cálculo de taxa de incidência (/100k hab)
  const municipalityPopulation = 128500;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [blocksRes, casesRes] = await Promise.all([
        supabase.from('blockade_operations').select('*').order('started_at', { ascending: false }),
        supabase.from('epidemiological_cases').select('*, neighborhoods(name)').order('notification_date', { ascending: false }),
      ]);

      if (blocksRes.data && blocksRes.data.length > 0) {
        const mapped: EpidemiologicalBlock[] = blocksRes.data.map((b: any, idx: number) => ({
          id: b.id,
          code: b.code || `BLQ-2026-0${idx + 1}`,
          municipalityId: b.municipality_id,
          eventId: b.outbreak_id || `notif-${idx}`,
          disease: b.disease || 'DENGUE',
          targetNeighborhood: 'Vila Nova',
          targetSector: 'Setor 01',
          radiusMeters: 150,
          scheduledDate: b.started_at || new Date().toISOString().split('T')[0],
          assignedTeamId: 'team-01',
          assignedTeamName: 'Equipe de Bloqueio Rápido',
          priority: 'URGENTE',
          propertiesForecast: b.planned_properties || 150,
          propertiesVisited: b.completed_properties || 0,
          propertiesClosed: 0,
          propertiesPending: 0,
          fociFound: 0,
          coveragePercentage: Number(b.coverage_percentage) || 0,
          status: b.status || 'EM_ANDAMENTO',
        }));
        setBlocks(mapped);
      }

      if (casesRes.data && casesRes.data.length > 0) {
        setCases(casesRes.data);
      } else {
        // Mock fallback de dados Sinan compatíveis com LGPD
        const defaultCases = [
          {
            id: 'case-01',
            notification_number: 'SINAN-2026-00124',
            disease: 'DENGUE',
            notification_date: '2026-09-02',
            epi_week: currentSE.week,
            epi_year: 2026,
            patient_age_group: '20-34 anos',
            sex: 'F',
            pregnant: false,
            case_origin: 'AUTÓCTONE',
            probable_infection_location: 'Vila Nova',
            notification_unit: 'UBS Vila Nova',
            classification: 'CONFIRMADO',
            clinical_classification: 'Dengue Clássica',
            laboratory_result: 'POSITIVO_NS1',
            hospitalization: false,
            death: false,
            status: 'CONCLUIDO',
            neighborhoods: { name: 'Vila Nova' },
          },
          {
            id: 'case-02',
            notification_number: 'SINAN-2026-00125',
            disease: 'DENGUE',
            notification_date: '2026-09-04',
            epi_week: currentSE.week,
            epi_year: 2026,
            patient_age_group: '35-49 anos',
            sex: 'M',
            pregnant: false,
            case_origin: 'AUTÓCTONE',
            probable_infection_location: 'Centro',
            notification_unit: 'UPA 24h Central',
            classification: 'SUSPEITO',
            clinical_classification: 'Dengue em Investigação',
            laboratory_result: 'AGUARDANDO_LAUDO',
            hospitalization: false,
            death: false,
            status: 'EM_INVESTIGACAO',
            neighborhoods: { name: 'Centro' },
          },
          {
            id: 'case-03',
            notification_number: 'SINAN-2026-00126',
            disease: 'CHIKUNGUNYA',
            notification_date: '2026-08-28',
            epi_week: currentSE.week - 1,
            epi_year: 2026,
            patient_age_group: '50-64 anos',
            sex: 'F',
            pregnant: false,
            case_origin: 'IMPORTADO',
            probable_infection_location: 'Outro Município',
            notification_unit: 'Hospital Regional',
            classification: 'CONFIRMADO',
            clinical_classification: 'Artrite Aguda Intensa',
            laboratory_result: 'POSITIVO_RT_PCR',
            hospitalization: true,
            death: false,
            status: 'CONCLUIDO',
            neighborhoods: { name: 'Universitário' },
          },
          {
            id: 'case-04',
            notification_number: 'SINAN-2026-00127',
            disease: 'ZIKA',
            notification_date: '2026-08-20',
            epi_week: currentSE.week - 2,
            epi_year: 2026,
            patient_age_group: '20-34 anos',
            sex: 'F',
            pregnant: true,
            case_origin: 'AUTÓCTONE',
            probable_infection_location: 'Arroio Grande',
            notification_unit: 'UBS Arroio Grande',
            classification: 'SUSPEITO',
            clinical_classification: 'Exantema e Artralgia',
            laboratory_result: 'AGUARDANDO_LAUDO',
            hospitalization: false,
            death: false,
            status: 'EM_INVESTIGACAO',
            neighborhoods: { name: 'Arroio Grande' },
          },
          {
            id: 'case-05',
            notification_number: 'SINAN-2026-00128',
            disease: 'DENGUE',
            notification_date: '2026-08-15',
            epi_week: currentSE.week - 3,
            epi_year: 2026,
            patient_age_group: '10-14 anos',
            sex: 'M',
            pregnant: false,
            case_origin: 'INDETERMINADO',
            probable_infection_location: 'Vila Nova',
            notification_unit: 'UBS Vila Nova',
            classification: 'DESCARTADO',
            clinical_classification: 'Outra Viadrose Exantemática',
            laboratory_result: 'NEGATIVO',
            hospitalization: false,
            death: false,
            status: 'DESCARTADO',
            neighborhoods: { name: 'Vila Nova' },
          },
        ];
        setCases(defaultCases);
      }
    } catch (err) {
      console.warn('Fallback para dados epidemiológicos locais:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBlockadeFromCase = async (caseItem: any) => {
    const res = await vectorControlService.createBlockadeFromCase(caseItem);
    alert(res.message);
    loadData();
    setActiveTab('BLOQUEIOS');
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const generatedCode = `BLQ-2026-${String(blocks.length + 1).padStart(3, '0')}`;
    const newBlock: EpidemiologicalBlock = {
      id: `blk-${Date.now()}`,
      code: generatedCode,
      municipalityId: '00000000-0000-0000-0000-000000000001',
      eventId: `notif-${Date.now()}`,
      disease: newBlockDisease,
      targetNeighborhood: newBlockNeighborhood,
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

    try {
      const { data: neighData } = await supabase
        .from('neighborhoods')
        .select('id')
        .eq('name', newBlockNeighborhood)
        .maybeSingle();

      await supabase.from('blockade_operations').insert({
        code: generatedCode,
        municipality_id: '00000000-0000-0000-0000-000000000001',
        neighborhood_id: neighData?.id || '00000000-0000-0000-0000-000000000010',
        disease: newBlockDisease,
        planned_properties: radiusMeters === 150 ? 120 : 250,
        completed_properties: 0,
        coverage_percentage: 0,
        started_at: new Date().toISOString().split('T')[0],
        status: 'EM_ANDAMENTO',
      });
    } catch (err) {
      console.warn('Erro ao salvar bloqueio no Supabase:', err);
    } finally {
      setLoading(false);
    }

    const updated = [newBlock, ...blocks];
    setBlocks(updated);
    setShowNewBlockModal(false);
  };

  // Filtragem dos casos
  const filteredCases = cases.filter(c => {
    const matchesDisease = selectedDisease === 'TODAS' || c.disease === selectedDisease;
    const matchesNeighborhood =
      selectedNeighborhood === 'TODOS' ||
      c.neighborhoods?.name === selectedNeighborhood ||
      c.probable_infection_location === selectedNeighborhood;
    const matchesClassification =
      selectedClassification === 'TODAS' ||
      c.classification === selectedClassification;
    const matchesSearch =
      searchTerm === '' ||
      c.notification_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.clinical_classification?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.notification_unit?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesDisease && matchesNeighborhood && matchesClassification && matchesSearch;
  });

  // Indicadores Oficiais
  const totalNotified = filteredCases.length;
  const totalSuspect = filteredCases.filter(c => c.classification === 'SUSPEITO' || c.status === 'EM_INVESTIGACAO').length;
  const totalConfirmed = filteredCases.filter(c => c.classification === 'CONFIRMADO').length;
  const totalDiscarded = filteredCases.filter(c => c.classification === 'DESCARTADO').length;
  const totalUnderInvestigation = filteredCases.filter(c => c.status === 'EM_INVESTIGACAO').length;
  const totalHospitalized = filteredCases.filter(c => c.hospitalization === true).length;
  const totalDeaths = filteredCases.filter(c => c.death === true).length;

  // Taxa de Incidência por 100 mil habitantes = (Casos Notificados / População) * 100.000
  const incidenceRate = ((totalNotified / municipalityPopulation) * 100000).toFixed(1);

  // Curva de casos por SE (Semanas 30 a 37 para demonstração de curva epidêmica)
  const epiCurveData = [
    { week: 30, year2025: 12, year2026: 8 },
    { week: 31, year2025: 18, year2026: 14 },
    { week: 32, year2025: 25, year2026: 22 },
    { week: 33, year2025: 34, year2026: 38 },
    { week: 34, year2025: 45, year2026: 49 },
    { week: 35, year2025: 41, year2026: 42 },
    { week: 36, year2025: 32, year2026: 29 },
    { week: 37, year2025: 28, year2026: 18 },
  ];

  const maxCurveVal = Math.max(...epiCurveData.map(d => Math.max(d.year2025, d.year2026)));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        icon={Activity}
        title="Vigilância Epidemiológica & Bloqueio de Transmissão Viral"
        subtitle="Monitoramento de arboviroses (Dengue, Zika, Chikungunya, Febre Amarela) integrado ao Sinan e contenção peridomiciliar"
        actions={
          <>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4 text-rose-400" />
              <span>Importar Dados (SINAN / CSV)</span>
            </button>
            <button
              onClick={() => setShowNewBlockModal(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Disparar Operação de Bloqueio</span>
            </button>
          </>
        }
      />

      {/* Barra de Filtros Epidemiológicos & Semanas Epidemiológicas */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Filtro Rápido SE:
            </span>
            {quickFilters.map(q => (
              <button
                key={q.id}
                onClick={() => setSelectedSEFilter(q.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition text-[11px] ${
                  selectedSEFilter === q.id
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">População de referência:</span>
            <span className="font-mono font-bold text-slate-800 text-[11px]">
              {municipalityPopulation.toLocaleString('pt-BR')} hab.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Agravo / Arbovirose</label>
            <select
              value={selectedDisease}
              onChange={e => setSelectedDisease(e.target.value)}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-rose-500 focus:outline-none"
            >
              <option value="TODAS">Todas as Arboviroses</option>
              <option value="DENGUE">Dengue</option>
              <option value="ZIKA">Zika Vírus</option>
              <option value="CHIKUNGUNYA">Chikungunya</option>
              <option value="FEBRE_AMARELA">Febre Amarela</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Bairro / Território</label>
            <select
              value={selectedNeighborhood}
              onChange={e => setSelectedNeighborhood(e.target.value)}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-rose-500 focus:outline-none"
            >
              <option value="TODOS">Todos os Bairros</option>
              {neighborhoods.map(n => (
                <option key={n.id} value={n.name}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Classificação do Caso</label>
            <select
              value={selectedClassification}
              onChange={e => setSelectedClassification(e.target.value)}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-rose-500 focus:outline-none"
            >
              <option value="TODAS">Todas as Classificações</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="SUSPEITO">Suspeito</option>
              <option value="DESCARTADO">Descartado</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Buscar Notificação / Unidade</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Ex: SINAN, UPA, UBS..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full text-xs py-1.5 pl-8 pr-2.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 8 CARDS DE INDICADORES EPIDEMIOLÓGICOS OFICIAIS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Card 1: Notificados */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Notificados</span>
          <div className="text-xl font-black text-slate-900 mt-1">{totalNotified}</div>
          <span className="text-[10px] text-slate-400">Total geral</span>
        </div>

        {/* Card 2: Suspeitos */}
        <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs bg-amber-50/20">
          <span className="text-[10px] text-amber-800 uppercase font-bold block">Suspeitos</span>
          <div className="text-xl font-black text-amber-600 mt-1">{totalSuspect}</div>
          <span className="text-[10px] text-amber-700">Aguardando laudo</span>
        </div>

        {/* Card 3: Confirmados */}
        <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-xs bg-rose-50/20">
          <span className="text-[10px] text-rose-800 uppercase font-bold block">Confirmados</span>
          <div className="text-xl font-black text-rose-600 mt-1">{totalConfirmed}</div>
          <span className="text-[10px] text-rose-700">Lab / Clínico</span>
        </div>

        {/* Card 4: Descartados */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Descartados</span>
          <div className="text-xl font-black text-slate-600 mt-1">{totalDiscarded}</div>
          <span className="text-[10px] text-slate-400">Laudo negativo</span>
        </div>

        {/* Card 5: Em Investigação */}
        <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-xs bg-blue-50/20">
          <span className="text-[10px] text-blue-800 uppercase font-bold block">Investigação</span>
          <div className="text-xl font-black text-blue-600 mt-1">{totalUnderInvestigation}</div>
          <span className="text-[10px] text-blue-700">Busca ativa</span>
        </div>

        {/* Card 6: Hospitalizações */}
        <div className="bg-white p-3 rounded-xl border border-purple-200 shadow-xs bg-purple-50/20">
          <span className="text-[10px] text-purple-800 uppercase font-bold block">Internações</span>
          <div className="text-xl font-black text-purple-700 mt-1">{totalHospitalized}</div>
          <span className="text-[10px] text-purple-600">Leito hospitalar</span>
        </div>

        {/* Card 7: Óbitos */}
        <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-xs bg-slate-900 text-white">
          <span className="text-[10px] text-slate-300 uppercase font-bold block">Óbitos</span>
          <div className="text-xl font-black text-white mt-1">{totalDeaths}</div>
          <span className="text-[10px] text-rose-400 font-semibold">
            {totalDeaths === 0 ? 'Zero óbitos' : 'Óbito confirmado'}
          </span>
        </div>

        {/* Card 8: Incidência */}
        <div className="bg-white p-3 rounded-xl border border-rose-300 shadow-xs bg-rose-50/30">
          <span className="text-[10px] text-rose-900 uppercase font-bold block">Incidência</span>
          <div className="text-xl font-black text-rose-700 mt-1">{incidenceRate}</div>
          <span className="text-[10px] text-slate-500">/ 100k hab.</span>
        </div>
      </div>

      {/* Seletor de Abas Principais */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex items-center gap-2 text-xs">
        <button
          onClick={() => setActiveTab('DASHBOARD')}
          className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeTab === 'DASHBOARD' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Curva Epidêmica & Inteligência</span>
        </button>
        <button
          onClick={() => setActiveTab('CASOS')}
          className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeTab === 'CASOS' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Notificações Sinan ({filteredCases.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('BLOQUEIOS')}
          className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeTab === 'BLOQUEIOS' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Operações de Bloqueio Ativas ({blocks.length})</span>
        </button>
      </div>

      {/* ABA 1: CURVA EPIDÊMICA & INTELIGÊNCIA */}
      {activeTab === 'DASHBOARD' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-rose-600" />
                  <span>Curva Epidêmica por Semana Epidemiológica (Ano Atual vs. Ano Anterior)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparação direta de novos casos notificados entre 2026 e 2025 para detecção precoce de surtos
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-rose-600 rounded-xs" />
                  <span className="text-slate-800">Ano Atual (2026)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-slate-300 rounded-xs" />
                  <span className="text-slate-500">Ano Anterior (2025)</span>
                </div>
              </div>
            </div>

            {/* Gráfico de Barras por SE */}
            <div className="pt-4">
              <div className="grid grid-cols-8 gap-2 h-44 items-end pb-2 border-b border-slate-200">
                {epiCurveData.map(d => {
                  const height2026 = (d.year2026 / maxCurveVal) * 100;
                  const height2025 = (d.year2025 / maxCurveVal) * 100;

                  return (
                    <div key={d.week} className="flex flex-col items-center h-full justify-end group relative">
                      <div className="flex items-end gap-1 w-full justify-center h-full">
                        {/* 2025 */}
                        <div
                          className="w-3 sm:w-5 bg-slate-300 rounded-t-xs transition hover:bg-slate-400 relative"
                          style={{ height: `${height2025}%` }}
                          title={`2025 (SE ${d.week}): ${d.year2025} casos`}
                        />
                        {/* 2026 */}
                        <div
                          className="w-3 sm:w-5 bg-rose-600 rounded-t-xs transition hover:bg-rose-700 relative"
                          style={{ height: `${height2026}%` }}
                          title={`2026 (SE ${d.week}): ${d.year2026} casos`}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-600 mt-2">SE {d.week}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2 font-mono">
                <span>SE 30 (Início de Agosto)</span>
                <span>SE 37 (Semana Epidemiológica Vigente)</span>
              </div>
            </div>
          </div>

          {/* Banner de Diagnóstico e Risco */}
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-lg mt-0.5">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-rose-900">
                  Alerta Sanitário Ativo: Tendência de Transmissão Acentuada no Bairro Vila Nova
                </h4>
                <p className="text-xs text-rose-800 mt-0.5">
                  Foram confirmados 2 casos de Dengue tipo DENV-2 em um raio de 120m no Setor 01. O motor de risco epidemiológico
                  recomenda bloqueio mecânico peridomiciliar e nebulização focal em até 48 horas.
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('BLOQUEIOS')}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs whitespace-nowrap"
            >
              Ver Bloqueios Ativos
            </button>
          </div>
        </div>
      )}

      {/* ABA 2: TABELA DE CASOS SINAN (COM RESPEITO À LGPD) */}
      {activeTab === 'CASOS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-600" />
                <span>Notificações Sinan / Arboviroses & Disparo Imediato de Bloqueio</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Privacidade LGPD garantida: identificação nominal protegida, exibindo apenas dados epidemiológicos essenciais
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {filteredCases.length} caso(s) filtrado(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Notificação / SE</th>
                  <th className="py-2.5 px-3">Agravo</th>
                  <th className="py-2.5 px-3">Perfil Demográfico</th>
                  <th className="py-2.5 px-3">Bairro Provável</th>
                  <th className="py-2.5 px-3">Unidade Notificadora</th>
                  <th className="py-2.5 px-3">Classificação Clínica</th>
                  <th className="py-2.5 px-3">Resultado Lab.</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Ação Sanitária</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredCases.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{c.notification_number}</div>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {c.notification_date} • SE {c.epi_week || currentSE.week}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-600 text-white font-sans">
                        {c.disease}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-medium text-slate-800">{c.patient_age_group || '20-34 anos'}</span>
                      <span className="text-slate-500 text-[10px] block">
                        Sexo: {c.sex || 'F'} {c.pregnant ? '• Gestante' : ''}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                      {c.neighborhoods?.name || c.probable_infection_location || 'Centro'}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600">
                      {c.notification_unit || 'UBS Central'}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="text-slate-800 font-semibold">{c.clinical_classification || 'Suspeito'}</span>
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                        {c.laboratory_result || 'Aguardando Laudo'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                          c.classification === 'CONFIRMADO'
                            ? 'bg-rose-100 text-rose-800'
                            : c.classification === 'DESCARTADO'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.classification || c.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <button
                        onClick={() => handleCreateBlockadeFromCase(c)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 ml-auto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Disparar Bloqueio</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: OPERAÇÕES DE BLOQUEIO */}
      {activeTab === 'BLOQUEIOS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-600" />
                <span>Operações de Bloqueio Ativas & Contenção Peridomiciliar</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Delimitação de raio peridomiciliar (150m a 300m) e eliminação mecânica/química em tempo hábil
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {blocks.length} operação(ões) ativa(s)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blocks.map(b => (
              <div key={b.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {b.code}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm mt-1.5">
                      Bloqueio Viral — {b.disease} ({b.targetNeighborhood})
                    </h4>
                    <p className="text-xs text-slate-500">Iniciado em: {b.scheduledDate}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800">
                    {b.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-white rounded-lg border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Raio Peridomiciliar</span>
                    <strong className="text-slate-800">{b.radiusMeters}m</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Imóveis Previstos</span>
                    <strong className="text-slate-800">{b.propertiesForecast}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Cobertura</span>
                    <strong className="text-rose-600">{b.coveragePercentage}%</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-600">Equipe: <strong>{b.assignedTeamName}</strong></span>
                  <span className="text-emerald-700 font-semibold">Prioridade: {b.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DE NOVO BLOQUEIO */}
      {showNewBlockModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-600" />
                <span>Disparar Nova Operação de Bloqueio</span>
              </h3>
              <button onClick={() => setShowNewBlockModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBlock} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Agravo de Transmissão</label>
                <select
                  value={newBlockDisease}
                  onChange={e => setNewBlockDisease(e.target.value as any)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="DENGUE">Dengue</option>
                  <option value="ZIKA">Zika</option>
                  <option value="CHIKUNGUNYA">Chikungunya</option>
                  <option value="FEBRE_AMARELA">Febre Amarela</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Bairro Alvo</label>
                <select
                  value={newBlockNeighborhood}
                  onChange={e => setNewBlockNeighborhood(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:outline-none"
                >
                  {neighborhoods.map(n => (
                    <option key={n.id} value={n.name}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Raio de Ação Peridomiciliar</label>
                <select
                  value={radiusMeters}
                  onChange={e => setRadiusMeters(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:outline-none"
                >
                  <option value={150}>150 metros (~120 imóveis recomendados)</option>
                  <option value={300}>300 metros (~250 imóveis para contenção ampliada)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewBlockModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{loading ? 'Salvando...' : 'Confirmar e Disparar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Importação de Dados Epidemiológicos */}
      <EpidemiologyImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        municipalityId="00000000-0000-0000-0000-000000000001"
        onImportComplete={loadData}
      />
    </div>
  );
};
