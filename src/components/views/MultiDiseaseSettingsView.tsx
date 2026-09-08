import React, { useState, useEffect } from 'react';
import {
  Layers,
  Bug,
  ShieldAlert,
  Activity,
  Flame,
  Waves,
  Radio,
  CheckCircle,
  Save,
  Info
} from 'lucide-react';
import { multiDiseaseService, DiseaseModuleConfig, DiseaseModuleId } from '../../services/multiDiseaseService';

export const MultiDiseaseSettingsView: React.FC = () => {
  const municipalityId = '00000000-0000-0000-0000-000000000001';
  const [modules, setModules] = useState<DiseaseModuleConfig[]>([]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const loaded = multiDiseaseService.getEnabledModules(municipalityId);
    setModules(loaded);
  }, []);

  const handleToggleModule = (id: DiseaseModuleId) => {
    // Não permite desativar Arboviroses (obrigatório base)
    if (id === 'arboviroses') return;

    setModules(prev =>
      prev.map(m => (m.id === id ? { ...m, active: !m.active } : m))
    );
  };

  const handleSave = () => {
    const activeIds = modules.filter(m => m.active).map(m => m.id);
    multiDiseaseService.saveEnabledModules(municipalityId, activeIds);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Bug': return <Bug className="w-6 h-6 text-emerald-600" />;
      case 'ShieldAlert': return <ShieldAlert className="w-6 h-6 text-amber-600" />;
      case 'Activity': return <Activity className="w-6 h-6 text-violet-600" />;
      case 'Flame': return <Flame className="w-6 h-6 text-rose-600" />;
      case 'Waves': return <Waves className="w-6 h-6 text-cyan-600" />;
      default: return <Radio className="w-6 h-6 text-orange-600" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Configuração Multi-Endemias Municipal</h1>
            <p className="text-xs text-slate-500">
              Adapte o Endemias GOV ao perfil epidemiológico do seu município além do Aedes aegypti
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 self-start md:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>Salvar Módulos Ativos</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>Configuração salva com sucesso! Os formulários de campo foram adaptados aos módulos selecionados.</span>
        </div>
      )}

      {/* Grid de Módulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map(mod => {
          return (
            <div
              key={mod.id}
              className={`p-6 rounded-2xl border transition flex flex-col justify-between ${
                mod.active
                  ? 'bg-white border-slate-300 shadow-sm'
                  : 'bg-slate-50/70 border-slate-200 opacity-75'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                    {getIcon(mod.icon)}
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mod.active}
                      disabled={mod.id === 'arboviroses'}
                      onChange={() => handleToggleModule(mod.id)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{mod.name}</h3>
                  <p className="text-[11px] font-mono text-slate-500 italic mt-0.5">{mod.scientificName}</p>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Vetor Principal:</span>
                    <span className="font-semibold text-slate-800">{mod.vector}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Tipo de Vigilância:</span>
                    <span className="uppercase text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {mod.surveillanceType}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <span className="text-[11px] font-bold text-slate-700 block">Atividades de Campo Vinculadas:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {mod.fieldActivities.map((act, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className={mod.active ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                  {mod.active ? 'Módulo Ativo no Município' : 'Módulo Inativo'}
                </span>
                {mod.id === 'arboviroses' && (
                  <span className="text-[10px] text-slate-400 font-medium">Módulo Obrigatório</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
