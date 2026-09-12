import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  MapPin,
  Clock,
  PieChart,
  ShieldAlert,
  Bell,
  Boxes,
  Smartphone,
  Map,
  FileText,
  Share2,
  Cpu,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Layers,
} from 'lucide-react';
import { systemSettingsService, DEFAULT_SETTINGS } from '../../services/systemSettingsService';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../ui';
import { MultiDiseaseSettingsView } from '../views/MultiDiseaseSettingsView';

interface SystemSettingsViewProps {
  initialTab?: string;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({ initialTab = 'GERAL' }) => {
  const { municipality } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [settingsData, setSettingsData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const tabs = [
    { id: 'GERAL', label: 'Geral & Município', icon: Building2 },
    { id: 'TERRITORIO', label: 'Território', icon: MapPin },
    { id: 'CICLOS', label: 'Ciclos Censitários', icon: Clock },
    { id: 'LIRAA', label: 'LIRAa / LIA', icon: PieChart },
    { id: 'RISCO', label: 'Motor de Risco', icon: ShieldAlert },
    { id: 'ALERTAS', label: 'Alertas Sanitários', icon: Bell },
    { id: 'ESTOQUE', label: 'Insumos & Estoque', icon: Boxes },
    { id: 'PWA', label: 'PWA de Campo', icon: Smartphone },
    { id: 'MAPA', label: 'Mapas & Camadas', icon: Map },
    { id: 'RELATORIOS', label: 'Relatórios Oficiais', icon: FileText },
    { id: 'INTEGRACOES', label: 'Integrações (Sinan/e-SUS)', icon: Share2 },
    { id: 'SISTEMA', label: 'Sistema & Auditoria', icon: Cpu },
    { id: 'MULTI_DISEASE', label: 'Módulos de Endemias', icon: Layers },
  ];

  useEffect(() => {
    // Módulos de Endemias gerencia seu próprio carregamento/gravação — não usa o formulário genérico de parâmetros.
    if (activeTab === 'MULTI_DISEASE') {
      setIsLoading(false);
      return;
    }
    loadTabSettings(activeTab);
  }, [activeTab, municipality?.id]);

  const loadTabSettings = async (category: string) => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const data = await systemSettingsService.getCategorySettings(category, municipality?.id);
      setSettingsData(data);
    } catch (err) {
      console.error(`Erro ao carregar configurações de ${category}:`, err);
      setFeedback({
        type: 'error',
        message: 'Não foi possível carregar as configurações do servidor. Exibindo padrões.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setSettingsData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await systemSettingsService.saveCategorySettings(
        activeTab,
        settingsData,
        municipality?.id
      );

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message,
        });
        setTimeout(() => setFeedback(null), 5000);
      } else {
        setFeedback({
          type: 'error',
          message: res.message,
        });
      }
    } catch (err: any) {
      console.error('Erro ao gravar configurações:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Falha inesperada ao tentar gravar no banco de dados.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm(`Deseja restaurar os padrões recomendados para a categoria "${activeTab}"?`)) {
      setSettingsData(DEFAULT_SETTINGS[activeTab] || {});
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        icon={Settings}
        title="Central de Configurações & Parâmetros Municipais"
        subtitle="Parametrização institucional das 13 áreas críticas do Endemias GOV persistidas no banco PostgreSQL"
        actions={
          feedback ? (
            <div
              className={`p-2.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-2xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          ) : undefined
        }
      />

      {/* Navegação das 12 Abas */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1 min-w-[1040px]">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ABA: MÓDULOS DE ENDEMIAS (gerencia seu próprio estado, fora do formulário genérico) */}
      {activeTab === 'MULTI_DISEASE' && <MultiDiseaseSettingsView />}

      {/* FORMULÁRIO DE CONFIGURAÇÕES DA ABA ATIVA */}
      {activeTab !== 'MULTI_DISEASE' && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        {isLoading ? (
          <div className="text-center py-12 text-xs text-slate-500">Carregando configurações...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* ABA: GERAL */}
            {activeTab === 'GERAL' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Identificação do Município e Órgão de Saúde</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nome do Município:</label>
                    <input
                      type="text"
                      value={settingsData.municipalityName || ''}
                      onChange={e => handleInputChange('municipalityName', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Código IBGE (7 dígitos):</label>
                    <input
                      type="text"
                      value={settingsData.ibgeCode || ''}
                      onChange={e => handleInputChange('ibgeCode', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Unidade Federativa (UF):</label>
                    <input
                      type="text"
                      value={settingsData.stateUf || ''}
                      onChange={e => handleInputChange('stateUf', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Secretaria Responsável:</label>
                    <input
                      type="text"
                      value={settingsData.healthSecretaryName || ''}
                      onChange={e => handleInputChange('healthSecretaryName', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Código CNES da Vigilância:</label>
                    <input
                      type="text"
                      value={settingsData.cnesCode || ''}
                      onChange={e => handleInputChange('cnesCode', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">E-mail Institucional de Contato:</label>
                    <input
                      type="email"
                      value={settingsData.contactEmail || ''}
                      onChange={e => handleInputChange('contactEmail', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA: CICLOS */}
            {activeTab === 'CICLOS' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Parâmetros Oficiais de Ciclos Censitários</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Meta Padrão de Cobertura (%):</label>
                    <input
                      type="number"
                      value={settingsData.standardCoverageTarget || 85}
                      onChange={e => handleInputChange('standardCoverageTarget', Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Quantidade de Ciclos por Ano:</label>
                    <input
                      type="number"
                      value={settingsData.cyclesPerYear || 6}
                      onChange={e => handleInputChange('cyclesPerYear', Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Duração do Ciclo (Semanas):</label>
                    <input
                      type="number"
                      value={settingsData.cycleDurationWeeks || 8}
                      onChange={e => handleInputChange('cycleDurationWeeks', Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA: LIRAA */}
            {activeTab === 'LIRAA' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Classificação de Risco Entomológico (Ministério da Saúde)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Limite Risco Baixo (IIP &lt; %):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settingsData.lowRiskThreshold || 1.0}
                      onChange={e => handleInputChange('lowRiskThreshold', Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Limite Risco Médio (IIP &lt; %):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settingsData.mediumRiskThreshold || 3.9}
                      onChange={e => handleInputChange('mediumRiskThreshold', Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Amostragem Padrão (% imóveis):</label>
                    <input
                      type="number"
                      value={settingsData.sampleSizePercentage || 20}
                      onChange={e => handleInputChange('sampleSizePercentage', Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA: RISCO */}
            {activeTab === 'RISCO' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Pesos Algorítmicos do Motor de Risco (0-100)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Peso Focos Ativos (%):</label>
                    <input
                      type="number"
                      value={settingsData.fociWeight || 35}
                      onChange={e => handleInputChange('fociWeight', Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Peso Densidade de Ovos (%):</label>
                    <input
                      type="number"
                      value={settingsData.densityWeight || 25}
                      onChange={e => handleInputChange('densityWeight', Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Peso Notificações Sinan (%):</label>
                    <input
                      type="number"
                      value={settingsData.sinanWeight || 20}
                      onChange={e => handleInputChange('sinanWeight', Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Peso Reincidência (%):</label>
                    <input
                      type="number"
                      value={settingsData.recurrenceWeight || 10}
                      onChange={e => handleInputChange('recurrenceWeight', Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA: MAPA & CAMADAS */}
            {activeTab === 'MAPA' && (
              <div className="space-y-5">
                <div className="border-b pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Georreferenciamento & Cartografia Municipal</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define o ponto central geográfico (latitude/longitude) e o nível de zoom inicial aplicados em todos os mapas operacionais do município.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Latitude Central (Graus Decimais):</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="-16.54832"
                      value={settingsData.centerLatitude !== undefined ? settingsData.centerLatitude : ''}
                      onChange={e => handleInputChange('centerLatitude', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">Ex: -16.54832 (Centro da cidade de Moiporá)</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Longitude Central (Graus Decimais):</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="-50.73675"
                      value={settingsData.centerLongitude !== undefined ? settingsData.centerLongitude : ''}
                      onChange={e => handleInputChange('centerLongitude', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">Ex: -50.73675</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Zoom Inicial do Mapa (10 a 18):</label>
                    <input
                      type="number"
                      min={10}
                      max={18}
                      value={settingsData.defaultZoom || 13}
                      onChange={e => handleInputChange('defaultZoom', Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">Recomendado: 13 ou 14 para visão municipal completa</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Camada Territorial Padrão:</label>
                    <select
                      value={settingsData.defaultLayer || 'RISK_HEATMAP'}
                      onChange={e => handleInputChange('defaultLayer', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white"
                    >
                      <option value="RISK_HEATMAP">Mapa de Risco & Calor Entomológico</option>
                      <option value="PROPERTIES">Imóveis, Focos e Reincidências</option>
                      <option value="BLOCKS">Raios de Bloqueio Epidemiológico</option>
                      <option value="OVITRAPS">Rede de Ovitrampas Censitárias</option>
                      <option value="STRATEGIC_POINTS">Pontos Estratégicos & Imóveis Especiais</option>
                    </select>
                    <span className="text-[11px] text-slate-400 mt-1 block">Camada em destaque ao abrir o mapa</span>
                  </div>
                </div>

                {/* Ações auxiliares de Georreferenciamento */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            pos => {
                              handleInputChange('centerLatitude', Number(pos.coords.latitude.toFixed(6)));
                              handleInputChange('centerLongitude', Number(pos.coords.longitude.toFixed(6)));
                            },
                            err => {
                              alert(`Não foi possível obter a posição GPS: ${err.message}`);
                            }
                          );
                        } else {
                          alert('Geolocalização não suportada neste navegador.');
                        }
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-lg font-semibold flex items-center gap-1.5 shadow-2xs transition"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Capturar Meu GPS Atual</span>
                    </button>

                    {settingsData.centerLatitude && settingsData.centerLongitude && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${settingsData.centerLatitude}&mlon=${settingsData.centerLongitude}#map=${settingsData.defaultZoom || 14}/${settingsData.centerLatitude}/${settingsData.centerLongitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-semibold flex items-center gap-1.5 shadow-2xs transition"
                      >
                        <Map className="w-3.5 h-3.5 text-slate-500" />
                        <span>Ver no OpenStreetMap ↗</span>
                      </a>
                    )}
                  </div>

                  <div className="text-slate-500 font-mono text-[11px]">
                    Centro configurado: {settingsData.centerLatitude ?? 'N/A'}, {settingsData.centerLongitude ?? 'N/A'} (zoom: {settingsData.defaultZoom || 13})
                  </div>
                </div>
              </div>
            )}

            {/* DEMAIS ABAS: CAMPOS DINÂMICOS */}
            {!['GERAL', 'CICLOS', 'LIRAA', 'RISCO', 'MAPA'].includes(activeTab) && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Parâmetros de {activeTab}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {Object.entries(settingsData).map(([k, v]) => (
                    <div key={k}>
                      <label className="block font-semibold text-slate-700 mb-1 font-mono">{k}:</label>
                      {typeof v === 'boolean' ? (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            checked={v}
                            onChange={e => handleInputChange(k, e.target.checked)}
                            className="w-4 h-4 rounded text-indigo-600"
                          />
                          <span className="text-slate-600">{v ? 'Habilitado' : 'Desabilitado'}</span>
                        </div>
                      ) : (
                        <input
                          type={typeof v === 'number' ? 'number' : 'text'}
                          value={v}
                          onChange={e =>
                            handleInputChange(k, typeof v === 'number' ? Number(e.target.value) : e.target.value)
                          }
                          className="w-full p-2 border border-slate-200 rounded-lg"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BOTÕES DE SALVAR E RESTAURAR */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Padrões</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSaving ? 'Salvando no Banco...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
      )}
    </div>
  );
};
