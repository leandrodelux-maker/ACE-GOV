import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Flame,
  Bug,
  Users,
  Clock,
  Radio,
  MapPin,
  TrendingUp,
  AlertOctagon,
  CheckCircle,
  Activity,
  Layers,
  PhoneCall,
  Target,
  RefreshCw,
  Compass
} from 'lucide-react';
import { commandCenterService, CommandCenterData } from '../../services/commandCenterService';
import { useMunicipalityId } from '../../contexts/AuthContext';

export const CommandCenterView: React.FC = () => {
  const municipalityId = useMunicipalityId();
    const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('pt-BR'));
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    // Relógio vivo
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await commandCenterService.getCommandCenterData(municipalityId);
      setData(res);
      if (res.mapLayers.neighborhoods.length > 0) {
        setSelectedNeighborhoodId(res.mapLayers.neighborhoods[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do centro de comando:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedNeighborhood = data?.mapLayers.neighborhoods.find(n => n.id === selectedNeighborhoodId);

  return (
    <div className="space-y-6 pb-12">
      {/* Topo do Centro de Comando (Cockpit Gerencial) */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight">Centro de Comando de Endemias</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                TEMPO REAL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {data?.municipalityName} • {data?.currentCycle}
            </p>
          </div>
        </div>

        {/* Relógio e Ações */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Horário Operacional</span>
            <span className="text-lg font-mono font-bold text-slate-100">{currentTime}</span>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Painel</span>
          </button>
        </div>
      </div>

      {/* Indicadores Principais em Tempo Real */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase">Cobertura do Ciclo</span>
            <Target className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">{typeof data?.stats.coveragePercent === 'number' ? `${data.stats.coveragePercent}%` : '—'}</div>
          <span className="text-[11px] text-slate-400">Meta recomendada: ≥ 80%</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase">ACEs em Campo Hoje</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">{data?.stats.activeAcesToday || 0}</div>
          <span className="text-[11px] text-slate-400">{data?.stats.visitsToday || 0} visitas realizadas hoje</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase">Bloqueios Ativos</span>
            <Flame className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">{data?.stats.activeBlocks || 0}</div>
          <span className="text-[11px] text-slate-400">Contenções químicas UBV em andamento</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase">Alertas Críticos</span>
            <AlertOctagon className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">{data?.stats.criticalAlertsCount || 0}</div>
          <span className="text-[11px] text-slate-400">
            {data?.stats.overduePeCount || 0} PEs atrasados • {data?.stats.pendingComplaintsCount || 0} denúncias na fila
          </span>
        </div>
      </div>

      {/* SEÇÃO PRINCIPAL: TOP 5 PRIORIDADES DO DIA */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Top Prioridades Estratégicas de Hoje</span>
            </h2>
            <p className="text-xs text-slate-500">
              Diretrizes de comando calculadas a partir de densidade vetorial, casos notificados e prazos regulatórios
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
            {data?.topPriorities.length || 0} Decisões Pendentes
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.topPriorities || []).map((prio, idx) => (
            <div
              key={prio.id}
              className={`p-5 rounded-2xl border flex flex-col justify-between space-y-3 transition ${
                prio.level === 'critico'
                  ? 'bg-rose-50/50 border-rose-200 ring-1 ring-rose-300'
                  : prio.level === 'alto'
                  ? 'bg-amber-50/50 border-amber-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${
                      prio.level === 'critico'
                        ? 'bg-rose-600 text-white'
                        : prio.level === 'alto'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-700 text-white'
                    }`}
                  >
                    Nível {prio.level}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700">{prio.metricBadge}</span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{prio.title}</h3>
                  <p className="text-xs font-medium text-emerald-800 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {prio.neighborhood}
                  </p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{prio.reason}</p>
              </div>

              <div className="pt-3 border-t border-slate-200/60 text-xs">
                <span className="font-bold text-slate-800 block text-[11px] mb-1">Ação de Comando Recomendada:</span>
                <p className="text-slate-700 bg-white/80 p-2 rounded-lg border border-slate-200 font-medium">
                  {prio.suggestedAction}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MAPA OPERACIONAL E TERRITORIAL MULTICAMADAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel do Mapa e Bairros */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-600" />
              <span>Mapa de Calor e Camadas de Vigilância por Bairro</span>
            </h3>
            <span className="text-xs text-slate-400">Selecione para ver detalhes táticos</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto">
            {(data?.mapLayers.neighborhoods || []).map(neigh => {
              const isSelected = selectedNeighborhoodId === neigh.id;
              return (
                <div
                  key={neigh.id}
                  onClick={() => setSelectedNeighborhoodId(neigh.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs truncate">{neigh.name}</span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        neigh.riskLevel === 'critico'
                          ? 'bg-rose-500'
                          : neigh.riskLevel === 'alto'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    ></span>
                  </div>

                  <div className="mt-2 text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className={isSelected ? 'text-slate-400' : 'text-slate-500'}>Focos:</span>
                      <span className="font-mono font-bold text-rose-400">{neigh.fociCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isSelected ? 'text-slate-400' : 'text-slate-500'}>Casos Notificados:</span>
                      <span className="font-mono font-bold">{neigh.casesCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ficha Tática do Bairro Selecionado */}
        <div className="lg:col-span-4 bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col justify-between">
          {selectedNeighborhood ? (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  Situação Territorial
                </span>
                <h3 className="text-xl font-black mt-1">{selectedNeighborhood.name}</h3>
                <p className="text-xs text-slate-400">Zona {selectedNeighborhood.zone}</p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-slate-400">Classificação de Risco:</span>
                  <span className="font-bold uppercase text-amber-400">{selectedNeighborhood.riskLevel}</span>
                </div>

                <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-slate-400">Focos Detectados:</span>
                  <span className="font-mono font-bold text-rose-400">{selectedNeighborhood.fociCount}</span>
                </div>

                <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-slate-400">Casos Notificados:</span>
                  <span className="font-mono font-bold text-blue-400">{selectedNeighborhood.casesCount}</span>
                </div>

                <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-slate-400">Bloqueio Ativo:</span>
                  <span className="font-bold text-emerald-400">
                    {selectedNeighborhood.hasActiveBlockade ? 'Sim (Em Execução)' : 'Não requerido'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-12">Selecione um bairro no painel ao lado.</p>
          )}

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Painel com atualização em tempo real para tomada rápida de decisões de saúde pública.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
