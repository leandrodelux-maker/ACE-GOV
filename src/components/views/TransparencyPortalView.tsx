import React, { useState, useEffect } from 'react';
import { Eye, ShieldCheck, Home, CheckCircle2, Flame, Users, Heart, RefreshCw } from 'lucide-react';
import { db } from '../../services/storage';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import { Neighborhood } from '../../types';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';

export const TransparencyPortalView: React.FC = () => {
  const { municipality: sessionMunicipality } = useAuth();
  const municipalityId = useMunicipalityId();
  const [municipalityName, setMunicipalityName] = useState('Município');
  const [cycleName, setCycleName] = useState('1º Ciclo 2026');
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>(db.getNeighborhoods());
  const [stats, setStats] = useState({
    visitedProperties: 0,
    eliminatedFoci: 0,
    activeAgents: 0,
    responseTimeHours: 0,
    coveragePercent: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTransparencyData();
  }, []);

  const loadTransparencyData = async () => {
    setIsLoading(true);
    try {
      const muni = sessionMunicipality;
      const muniId = municipalityId;

      if (muni) setMunicipalityName(muni.name);

      const [cycle, neighs, visitsRes, fociRes, agentsRes] = await Promise.all([
        supabaseService.getActiveCycle(muniId),
        supabaseService.getNeighborhoods(muniId),
        supabase.from('visits').select('id', { count: 'exact', head: true }).eq('municipality_id', muniId).in('result', ['trabalhado', 'TRABALHADO']),
        supabase.from('breeding_sites').select('id', { count: 'exact', head: true }).eq('municipality_id', muniId).eq('status', 'ELIMINADO'),
        supabase.from('agents').select('id', { count: 'exact', head: true }).eq('municipality_id', muniId).eq('active', true),
      ]);

      if (cycle) setCycleName(cycle.name);
      if (neighs && neighs.length > 0) setNeighborhoods(neighs);

      // Somente contagens reais; sem imóveis cadastrados a cobertura não é calculada
      const visited = visitsRes.count ?? 0;
      const totalProps = (neighs || []).reduce((acc, n) => acc + (n.totalProperties || 0), 0);
      const cov = totalProps > 0 ? Math.min(100, Math.round((visited / totalProps) * 100)) : 0;

      setStats({
        visitedProperties: visited,
        eliminatedFoci: fociRes.count ?? 0,
        activeAgents: agentsRes.count ?? 0,
        responseTimeHours: 0,
        coveragePercent: cov,
      });
    } catch (err) {
      console.warn('Fallback para transparência local:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-900 to-emerald-900 text-white p-6 sm:p-8 rounded-2xl shadow-md space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Transparência Pública Municipal • Lei de Acesso à Informação
            </span>
          </div>
          <button
            onClick={loadTransparencyData}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-200 transition"
            title="Atualizar dados públicos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <h1 className="text-2xl font-black">
          Endemias em Números — {municipalityName}
        </h1>
        <p className="text-xs text-emerald-100 max-w-2xl">
          Acompanhamento público dos esforços municipais no combate à Dengue, Zika e Chikungunya. Dados estatísticos agregados em total conformidade com a LGPD (Lei Geral de Proteção de Dados).
        </p>
      </div>

      {/* Public Aggregated Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 text-center shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase">Imóveis Visitados</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.visitedProperties.toLocaleString('pt-BR')}</p>
          <span className="text-[10px] text-emerald-700 font-bold">{stats.coveragePercent}% de cobertura</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 text-center shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase">Focos Eliminados</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">{stats.eliminatedFoci}</p>
          <span className="text-[10px] text-emerald-700 font-bold">Criadouros neutralizados</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 text-center shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase">Agentes nas Ruas</span>
          <p className="text-2xl font-black text-blue-700 mt-1">{stats.activeAgents} ACEs</p>
          <span className="text-[10px] text-blue-700 font-bold">Força de trabalho ativa</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 text-center shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase">Tempo de Atendimento</span>
          <p className="text-2xl font-black text-purple-700 mt-1">{stats.responseTimeHours > 0 ? `${stats.responseTimeHours}h` : "Sem dados"}</p>
          <span className="text-[10px] text-purple-700 font-bold">Média de resposta municipal</span>
        </div>
      </div>

      {/* Bairros - Dados Agregados Públicos */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Situação por Região / Bairro — {cycleName}
        </h3>

        <div className="divide-y divide-slate-100 text-xs">
          {neighborhoods.map(n => (
            <div key={n.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">{n.name}</p>
                <p className="text-[11px] text-slate-500">{n.totalProperties ?? 'Sem dados de'} imóveis cadastrados</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Cobertura</span>
                  <span className="font-bold text-blue-700">{typeof n.coveragePercentage === 'number' ? `${n.coveragePercentage}%` : '—'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Situação</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    n.riskLevel === 'CRITICO' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {n.riskLevel === 'CRITICO' ? 'Atenção Redobrada' : n.riskLevel ? 'Controlado' : 'Sem dados'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dicas aos Moradores */}
      <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-xs text-amber-900 space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
          <Heart className="w-5 h-5 text-rose-500" />
          <span>Como você pode ajudar a proteger sua família e vizinhos:</span>
        </div>
        <ul className="space-y-1.5 pl-4 list-disc text-amber-800">
          <li>Elimine a água acumulada sobre lajes, calhas entupidas e ralos externos.</li>
          <li>Mantenha caixas d'água e tonéis de chuva completamente vedados com telas milimétricas.</li>
          <li>Coloque areia grossa até a borda nos pratinhos dos vasos de plantas.</li>
          <li>Receba bem o Agente de Combate às Endemias (ACE), devidamente uniformizado e com crachá municipal.</li>
        </ul>
      </div>
    </div>
  );
};
