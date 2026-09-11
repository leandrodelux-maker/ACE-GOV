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
} from 'lucide-react';
import { systemSettingsService, DEFAULT_SETTINGS } from '../../services/systemSettingsService';
import { PageHeader } from '../ui';

export const SystemSettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('GERAL');
  const [settingsData, setSettingsData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');

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
  ];

  useEffect(() => {
    loadTabSettings(activeTab);
  }, [activeTab]);

  const loadTabSettings = async (category: string) => {
    setIsLoading(true);
    try {
      const data = await systemSettingsService.getCategorySettings(category);
      setSettingsData(data);
    } catch (err) {
      console.error(`Erro ao carregar configurações de ${category}:`, err);
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
    setFeedbackMessage('');

    try {
      const res = await systemSettingsService.saveCategorySettings(activeTab, settingsData);
      if (res.success) {
        setFeedbackMessage(`Configurações de "${activeTab}" salvas e aplicadas com sucesso no banco de dados!`);
        setTimeout(() => setFeedbackMessage(''), 4000);
      } else {
        alert(res.message);
      }
    } catch (err) {
      console.error('Erro ao gravar configurações:', err);
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
        subtitle="Parametrização institucional das 12 áreas críticas do Endemias GOV persistidas no banco PostgreSQL"
        actions={
          feedbackMessage ? (
            <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{feedbackMessage}</span>
            </div>
          ) : undefined
        }
      />

      {/* Navegação das 12 Abas */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1 min-w-[960px]">
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

      {/* FORMULÁRIO DE CONFIGURAÇÕES DA ABA ATIVA */}
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

            {/* DEMAIS ABAS: CAMPOS DINÂMICOS */}
            {!['GERAL', 'CICLOS', 'LIRAA', 'RISCO'].includes(activeTab) && (
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
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Salvando no Banco...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
