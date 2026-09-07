import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Maximize,
  Minimize,
  RefreshCw,
  Clock,
  Flame,
  Activity,
  CheckCircle,
  Users,
  ShieldAlert,
  MapPin,
} from 'lucide-react';
import { db } from '../../services/storage';

export const OperationsRoomView: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(60);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('pt-BR'));

  const municipality = db.getMunicipality();
  const cycle = db.getCycle();
  const neighborhoods = db.getNeighborhoods();
  const visits = db.getVisits();
  const blocks = db.getEpidemiologyBlocks();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('pt-BR'));
      setSecondsUntilRefresh(prev => (prev <= 1 ? 60 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="bg-slate-950 text-white p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-6">
      {/* Top Bar for Operations Screen */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
            <Monitor className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <h1 className="text-lg font-black tracking-tight uppercase">
                Central de Operações de Endemias — Sala de Situação
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              {municipality.name} ({municipality.state}) • Monitoramento Contínuo em Tempo Real • {cycle.name}
            </p>
          </div>
        </div>

        {/* Live Clock & Controls */}
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Horário de Brasília</span>
            <span className="font-mono text-xl font-black text-sky-400">{currentTime}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right text-[11px] text-slate-400 hidden sm:block">
              Auto-atualização em: <strong className="text-white">{secondsUntilRefresh}s</strong>
            </div>

            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              title="Alternar Tela Cheia"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Screen Blocks */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cobertura Geral</span>
          <p className="text-3xl font-black text-sky-400 mt-2">71.4%</p>
          <span className="text-xs text-emerald-400 font-semibold">Meta do Ciclo: 85%</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Visitas Hoje</span>
          <p className="text-3xl font-black text-emerald-400 mt-2">142</p>
          <span className="text-xs text-slate-400">42 ACEs ativos em campo</span>
        </div>

        <div className="bg-slate-900/80 border border-rose-900/40 p-5 rounded-xl bg-rose-950/20">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Focos Ativos</span>
          <p className="text-3xl font-black text-rose-500 mt-2 animate-pulse">5</p>
          <span className="text-xs text-rose-400">Tratamento focal imediato</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bloqueios Ativos</span>
          <p className="text-3xl font-black text-amber-400 mt-2">{blocks.length}</p>
          <span className="text-xs text-amber-400">100% no prazo de 48h</span>
        </div>
      </div>

      {/* Real-time Feeds & Operations Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-time Live Visits Stream */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Transmissão ao Vivo das Vistorias dos Agentes (ACE)</span>
            </h3>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              STREAM ATIVO
            </span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {visits.map(v => (
              <div key={v.id} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 font-bold text-slate-200">
                    <span>{v.propertyAddress}</span>
                    <span className="text-slate-500 text-[10px] font-normal font-mono">({v.propertyCode})</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{v.neighborhood} • ACE {v.agentName}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    v.fociFound ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-emerald-950 text-emerald-400'
                  }`}>
                    {v.situation}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">{v.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Territory Critical Alert Blocks */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Alerta Crítico por Território</span>
            </h3>
          </div>

          <div className="space-y-2.5">
            {neighborhoods.slice(0, 3).map(n => (
              <div key={n.id} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-200">{n.name}</p>
                  <p className="text-[11px] text-slate-400">Cobertura: {n.coveragePercentage}% • {n.fociCount} focos</p>
                </div>
                <div className="text-right">
                  <span className="font-black text-rose-400 text-sm">{n.riskScore}/100</span>
                  <p className="text-[10px] text-slate-400">{n.riskLevel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
