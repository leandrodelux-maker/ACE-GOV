import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, ShieldCheck, Users, MapPin, AlertCircle, Phone, Calendar, RefreshCw } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { SpecialProperty } from '../../types';
import { PageHeader } from '../ui';

export const SpecialPropertiesView: React.FC = () => {
  const [properties, setProperties] = useState<SpecialProperty[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [inspectingId, setInspectingId] = useState<string | null>(null);

  const loadSpecialProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      const muni = await supabaseService.getMunicipality();
      const muniId = muni?.id || '00000000-0000-0000-0000-000000000001';

      const data = await supabaseService.getSpecialProperties(muniId);
      setProperties(data);
    } catch (err) {
      console.error('Erro ao carregar imóveis especiais:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRegisterInspection = async (ie: SpecialProperty) => {
    setInspectingId(ie.id);
    try {
      const success = await supabaseService.registerSpecialPropertyInspection({
        specialPropertyId: ie.id,
        findings: 'Vistoria bimestral realizada em áreas comuns, pátio e caixas d água.',
        actions: 'Eliminação mecânica e aplicação de larvicida.',
        notes: `Inspeção do Imóvel Especial ${ie.name} persistida com sucesso no banco.`,
      });

      if (success) {
        await loadSpecialProperties();
      }
    } catch (err) {
      console.error('Erro ao registrar vistoria de IE:', err);
    } finally {
      setInspectingId(null);
    }
  };

  useEffect(() => {
    loadSpecialProperties();
  }, [loadSpecialProperties]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title="Imóveis Especiais (IE) — Alta Circulação"
        subtitle="Escolas, creches, Unidades Básicas de Saúde, hospitais, terminais e locais de aglomeração pública"
        actions={
          <button
            onClick={loadSpecialProperties}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        }
      />

      {isLoading ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
          <p className="text-xs">Carregando imóveis especiais do banco...</p>
        </div>
      ) : properties.length === 0 ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
          Nenhum imóvel especial cadastrado no município.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(ie => (
            <div key={ie.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                    {ie.type.replace('_', ' ')}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1.5">{ie.name}</h3>
                  <p className="text-xs text-slate-500">{ie.address} • {ie.neighborhood}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Responsável:</span>
                  <span className="font-semibold text-slate-800">{ie.responsiblePerson}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Telefone:</span>
                  <span className="font-semibold text-slate-800">{ie.contactPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Última Vistoria:</span>
                  <span className="font-bold text-slate-800">
                    {ie.lastInspectionDate ? new Date(ie.lastInspectionDate).toLocaleDateString('pt-BR') : 'Pendente'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Histórico de Focos:</span>
                  <span className={`font-bold ${ie.fociCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {ie.fociCount} focos registrados
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => handleRegisterInspection(ie)}
                  disabled={inspectingId === ie.id}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                >
                  {inspectingId === ie.id ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Salvando no banco...</span>
                    </>
                  ) : (
                    <span>Vistoriar Imóvel Especial</span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
