import React, { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle2, AlertCircle, RefreshCw, Layers, Plus } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { FieldCycle } from '../../types';
import { PageHeader } from '../ui';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';

export const CyclesView: React.FC = () => {
  const { municipality: sessionMunicipality } = useAuth();
  const municipalityId = useMunicipalityId();
  const [cycles, setCycles] = useState<FieldCycle[]>([]);
  const [activeCycle, setActiveCycle] = useState<FieldCycle | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadCycles = async () => {
    setIsLoading(true);
    try {
      const muni = sessionMunicipality;
      const muniId = municipalityId;

      const [allCycles, current] = await Promise.all([
        supabaseService.getCycles(muniId),
        supabaseService.getActiveCycle(muniId),
      ]);

      setCycles(allCycles);
      setActiveCycle(current || allCycles[0] || null);
    } catch (err) {
      console.error('Erro ao carregar ciclos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCycles();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={Clock}
        title="Ciclos Operacionais & Cronograma LIRAa / LIA"
        subtitle="Gerenciamento dos ciclos bimestrais de visitas e metas pactuadas com o Ministério da Saúde"
        actions={
          <button
            onClick={loadCycles}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
            title="Atualizar ciclos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        }
      />

      {isLoading ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-xs">Carregando cronograma de ciclos do banco...</p>
        </div>
      ) : (
        <>
          {/* Ciclo Ativo em Destaque */}
          {activeCycle && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                    Ciclo Ativo em Andamento
                  </span>
                  <h2 className="text-lg font-black text-slate-900 mt-1">{activeCycle.name}</h2>
                  <p className="text-xs text-slate-500">Status: {activeCycle.status} • Ano: {activeCycle.year}</p>
                </div>

                <div className="text-right text-xs">
                  <span className="text-slate-400">Vigência</span>
                  <p className="font-bold text-slate-900">
                    {new Date(activeCycle.startDate).toLocaleDateString('pt-BR')} a {new Date(activeCycle.endDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl text-center text-xs">
                <div>
                  <span className="text-slate-500 font-semibold">Imóveis Trabalhados</span>
                  <p className="text-xl font-extrabold text-blue-700 mt-1">{(activeCycle.visitedProperties ?? 0).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Cobertura Atual</span>
                  <p className="text-xl font-extrabold text-emerald-700 mt-1">{activeCycle.currentCoveragePercentage !== undefined ? `${activeCycle.currentCoveragePercentage}%` : '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Imóveis Alvo</span>
                  <p className="text-xl font-extrabold text-slate-800 mt-1">{activeCycle.totalTargetProperties !== undefined ? activeCycle.totalTargetProperties.toLocaleString('pt-BR') : 'Não definido'}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Focos no Ciclo</span>
                  <p className="text-xl font-extrabold text-rose-700 mt-1">{activeCycle.fociCount ?? 0}</p>
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Progresso da Cobertura Municipal</span>
                  <span>{activeCycle.currentCoveragePercentage !== undefined ? `${activeCycle.currentCoveragePercentage}% dos imóveis-alvo` : 'Sem meta de imóveis definida para o ciclo'}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, activeCycle.currentCoveragePercentage ?? 0)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Histórico e Próximos Ciclos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Todos os Ciclos Cadastrados no Município ({cycles.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nome do Ciclo</th>
                    <th className="py-3 px-4">Ano / Número</th>
                    <th className="py-3 px-4">Período</th>
                    <th className="py-3 px-4">Imóveis Alvo</th>
                    <th className="py-3 px-4">Cobertura</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cycles.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-4 text-slate-700">{c.year} • Ciclo {c.number}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(c.startDate).toLocaleDateString('pt-BR')} a {new Date(c.endDate).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-semibold">{c.totalTargetProperties ?? '—'}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-blue-700">{c.currentCoveragePercentage !== undefined ? `${c.currentCoveragePercentage}%` : '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === 'EM_ANDAMENTO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'CONCLUIDO'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
