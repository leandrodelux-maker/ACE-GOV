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
  Settings,
  Sun,
  Moon,
  Shield,
  Home,
  CheckSquare,
  AlertTriangle,
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { db } from '../../services/storage';
import { epidemiologicalWeekService } from '../../services/epidemiologicalWeekService';

export const OperationsRoomView: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('pt-BR'));
  const [currentScreen, setCurrentScreen] = useState<number>(1);
  const [isRotating, setIsRotating] = useState(true);
  const [rotationIntervalSeconds, setRotationIntervalSeconds] = useState(20);
  const [secondsUntilNextScreen, setSecondsUntilNextScreen] = useState(20);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showCoatOfArms, setShowCoatOfArms] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Telas ativas para rotação
  const [activeScreens, setActiveScreens] = useState<number[]>([1, 2, 3, 4, 5]);

  const municipality = db.getMunicipality();
  const cycle = db.getCycle();
  const neighborhoods = db.getNeighborhoods();
  const currentSE = epidemiologicalWeekService.getEpidemiologicalWeek();

  // Relógio e temporizador de rotação automática de telas
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('pt-BR'));

      if (isRotating) {
        setSecondsUntilNextScreen(prev => {
          if (prev <= 1) {
            // Avançar para a próxima tela configurada
            setCurrentScreen(curr => {
              const currentIndex = activeScreens.indexOf(curr);
              const nextIndex = (currentIndex + 1) % activeScreens.length;
              return activeScreens[nextIndex] || 1;
            });
            return rotationIntervalSeconds;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isRotating, activeScreens, rotationIntervalSeconds]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleNextScreen = () => {
    const currentIndex = activeScreens.indexOf(currentScreen);
    const nextIndex = (currentIndex + 1) % activeScreens.length;
    setCurrentScreen(activeScreens[nextIndex] || 1);
    setSecondsUntilNextScreen(rotationIntervalSeconds);
  };

  const handlePrevScreen = () => {
    const currentIndex = activeScreens.indexOf(currentScreen);
    const prevIndex = (currentIndex - 1 + activeScreens.length) % activeScreens.length;
    setCurrentScreen(activeScreens[prevIndex] || 1);
    setSecondsUntilNextScreen(rotationIntervalSeconds);
  };

  const themeClasses = isDarkMode
    ? 'bg-slate-950 text-white border-slate-800'
    : 'bg-slate-100 text-slate-900 border-slate-200';

  const cardClasses = isDarkMode
    ? 'bg-slate-900/90 border-slate-800 text-white'
    : 'bg-white border-slate-200 text-slate-900 shadow-sm';

  return (
    <div className={`min-h-[90vh] p-6 rounded-2xl border transition-colors duration-300 space-y-6 flex flex-col justify-between ${themeClasses}`}>
      {/* Top Header do Telão */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-3">
          {showCoatOfArms && (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow-lg flex-shrink-0">
              <Shield className="w-7 h-7" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <h1 className="text-lg sm:text-xl font-black tracking-tight uppercase">
                Central de Operações de Endemias — Painel Telão TV
              </h1>
            </div>
            <p className="text-xs opacity-70">
              {municipality.name} ({municipality.state}) • Monitoramento Contínuo em Tempo Real • SE {currentSE.week}/{currentSE.year}
            </p>
          </div>
        </div>

        {/* Controles do Telão */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Telas */}
          <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700">
            {[1, 2, 3, 4, 5].map(num => (
              <button
                key={num}
                onClick={() => {
                  setCurrentScreen(num);
                  setSecondsUntilNextScreen(rotationIntervalSeconds);
                }}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                  currentScreen === num
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={`Ir para Tela ${num}`}
              >
                {num}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsRotating(!isRotating)}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-200 transition"
              title={isRotating ? 'Pausar Rotação' : 'Iniciar Rotação'}
            >
              {isRotating ? <Pause className="w-4 h-4 text-emerald-400" /> : <Play className="w-4 h-4 text-amber-400" />}
            </button>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-200 transition"
              title="Alternar Modo Claro/Escuro"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-200 transition"
              title="Configurações do Telão"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-200 transition"
              title="Modo Tela Cheia"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>

          {/* Relógio Brasília */}
          <div className="bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl text-center">
            <span className="text-[9px] uppercase font-semibold text-slate-400 block leading-none">Brasília</span>
            <span className="font-mono text-base font-black text-sky-400 leading-tight">{currentTime}</span>
          </div>
        </div>
      </div>

      {/* ÁREA PRINCIPAL: EXIBIÇÃO DA TELA ATIVA */}
      <div className="flex-1 py-2">
        {/* TELA 1: SITUAÇÃO MUNICIPAL */}
        {currentScreen === 1 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-sky-500/20 text-sky-400 border border-sky-400/30">
                Tela 1 de 5 — Situação Operacional do Município
              </span>
              <span className="text-xs opacity-60 font-mono">Próxima tela em: {secondsUntilNextScreen}s</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className={`p-5 rounded-2xl border ${cardClasses}`}>
                <span className="text-xs uppercase font-bold opacity-60">Cobertura Censitária</span>
                <p className="text-3xl sm:text-4xl font-black text-sky-400 mt-2">71.4%</p>
                <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                  <div className="bg-sky-500 h-full rounded-full" style={{ width: '71.4%' }} />
                </div>
                <span className="text-[11px] text-emerald-400 font-semibold block mt-1.5">Meta SUS: 85%</span>
              </div>

              <div className={`p-5 rounded-2xl border ${cardClasses}`}>
                <span className="text-xs uppercase font-bold opacity-60">Imóveis Visitados</span>
                <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-2">20.280</p>
                <span className="text-[11px] opacity-70 block mt-4">De 28.400 programados</span>
              </div>

              <div className={`p-5 rounded-2xl border ${cardClasses}`}>
                <span className="text-xs uppercase font-bold opacity-60">Pendências</span>
                <p className="text-3xl sm:text-4xl font-black text-amber-400 mt-2">1.840</p>
                <span className="text-[11px] opacity-70 block mt-4">Fechados e recusas de retorno</span>
              </div>

              <div className={`p-5 rounded-2xl border ${cardClasses}`}>
                <span className="text-xs uppercase font-bold opacity-60">Focos Ativos</span>
                <p className="text-3xl sm:text-4xl font-black text-rose-500 mt-2">4</p>
                <span className="text-[11px] text-rose-400 font-semibold block mt-4">100% sob eliminação</span>
              </div>

              <div className={`p-5 rounded-2xl border ${cardClasses}`}>
                <span className="text-xs uppercase font-bold opacity-60">Bairro Crítico</span>
                <p className="text-2xl sm:text-3xl font-black text-rose-400 mt-2">Vila Nova</p>
                <span className="text-[11px] text-amber-400 font-semibold block mt-4">Score de Risco: 82/100</span>
              </div>
            </div>

            {/* Bairros Críticos em Destaque */}
            <div className={`p-5 rounded-2xl border ${cardClasses}`}>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-sky-400" />
                <span>Estratificação de Bairros em Tempo Real</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {neighborhoods.slice(0, 3).map(n => (
                  <div key={n.id} className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-sm">{n.name}</h4>
                      <p className="text-xs opacity-60">{n.totalProperties} imóveis cadastrados</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-sky-400">{n.coveragePercentage}%</span>
                      <span className="text-[10px] text-slate-400 block">cobertura</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TELA 2: MAPA DE RISCO */}
        {currentScreen === 2 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-rose-500/20 text-rose-400 border border-rose-400/30">
                Tela 2 de 5 — Mapa de Risco Epidemiológico & Calor de Arboviroses
              </span>
              <span className="text-xs opacity-60 font-mono">Próxima tela em: {secondsUntilNextScreen}s</span>
            </div>

            <div className={`p-8 rounded-2xl border ${cardClasses} text-center space-y-4`}>
              <div className="max-w-md mx-auto p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto animate-pulse" />
                <h3 className="text-lg font-black mt-2">Visão Geoespacial do Território Municipal</h3>
                <p className="text-xs opacity-70 mt-1">
                  Polígonos de calor integrados com foco nos Setores 01 (Vila Nova) e 02 (Centro Comercial).
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto pt-2">
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300">
                  <span className="text-[10px] uppercase font-bold block">Alta Transmissão</span>
                  <strong className="text-lg">Vila Nova</strong>
                </div>
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-300">
                  <span className="text-[10px] uppercase font-bold block">Alerta / Atenção</span>
                  <strong className="text-lg">Centro</strong>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300">
                  <span className="text-[10px] uppercase font-bold block">Controle Regular</span>
                  <strong className="text-lg">Universitário</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TELA 3: SITUAÇÃO EPIDEMIOLÓGICA */}
        {currentScreen === 3 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-400/30">
                Tela 3 de 5 — Vigilância Epidemiológica de Arboviroses (Sinan)
              </span>
              <span className="text-xs opacity-60 font-mono">Próxima tela em: {secondsUntilNextScreen}s</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-6 rounded-2xl border ${cardClasses} border-l-4 border-l-rose-500`}>
                <span className="text-xs font-black uppercase text-rose-400 tracking-wider">Dengue (DENV)</span>
                <div className="flex items-baseline gap-3 mt-3">
                  <span className="text-4xl font-black text-rose-500">42</span>
                  <span className="text-xs opacity-60">notificações acumuladas</span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/40 text-xs space-y-1 opacity-80">
                  <p>• Confirmados: <strong>14</strong></p>
                  <p>• Em investigação: <strong>21</strong></p>
                  <p>• Descartados: <strong>7</strong></p>
                </div>
              </div>

              <div className={`p-6 rounded-2xl border ${cardClasses} border-l-4 border-l-purple-500`}>
                <span className="text-xs font-black uppercase text-purple-400 tracking-wider">Zika Vírus</span>
                <div className="flex items-baseline gap-3 mt-3">
                  <span className="text-4xl font-black text-purple-400">4</span>
                  <span className="text-xs opacity-60">notificações acumuladas</span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/40 text-xs space-y-1 opacity-80">
                  <p>• Confirmados: <strong>1</strong></p>
                  <p>• Em investigação: <strong>3</strong></p>
                  <p>• Gestantes monitoradas: <strong>1</strong></p>
                </div>
              </div>

              <div className={`p-6 rounded-2xl border ${cardClasses} border-l-4 border-l-amber-500`}>
                <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Chikungunya</span>
                <div className="flex items-baseline gap-3 mt-3">
                  <span className="text-4xl font-black text-amber-400">9</span>
                  <span className="text-xs opacity-60">notificações acumuladas</span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/40 text-xs space-y-1 opacity-80">
                  <p>• Confirmados: <strong>3</strong></p>
                  <p>• Em investigação: <strong>5</strong></p>
                  <p>• Óbitos: <strong>Zero</strong></p>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${cardClasses} text-xs flex items-center justify-between`}>
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Taxa de Letalidade Municipal: 0.0% (Zero óbitos confirmados)
              </span>
              <span className="opacity-60">Dados consolidados pela Vigilância Epidemiológica Municipal</span>
            </div>
          </div>
        )}

        {/* TELA 4: PRODUTIVIDADE OPERACIONAL */}
        {currentScreen === 4 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
                Tela 4 de 5 — Produtividade e Força de Trabalho em Campo
              </span>
              <span className="text-xs opacity-60 font-mono">Próxima tela em: {secondsUntilNextScreen}s</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-5 rounded-2xl border ${cardClasses}`}>
                <span className="text-xs uppercase font-bold opacity-60">Equipes em Campo</span>
                <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-2">4</p>
                <span className="text-[11px] opacity-70 block mt-2">Equipes Alpha, Beta, Gama, Delta</span>
              </div>

              <div className={`p-5 rounded-2xl border ${cardClasses}`}>
                <span className="text-xs uppercase font-bold opacity-60">ACEs Ativos Hoje</span>
                <p className="text-3xl sm:text-4xl font-black text-sky-400 mt-2">16</p>
                <span className="text-[11px] opacity-70 block mt-2">100% de assiduidade</span>
              </div>

              <div className={`p-5 rounded-2xl border ${cardClasses}`}>
                <span className="text-xs uppercase font-bold opacity-60">Visitas Concluídas Hoje</span>
                <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-2">348</p>
                <span className="text-[11px] opacity-70 block mt-2">Média: 21.7 imóveis / agente</span>
              </div>

              <div className={`p-5 rounded-2xl border ${cardClasses}`}>
                <span className="text-xs uppercase font-bold opacity-60">Sincronização PWA</span>
                <p className="text-3xl sm:text-4xl font-black text-sky-400 mt-2">98.5%</p>
                <span className="text-[11px] opacity-70 block mt-2">Conexão móvel estável</span>
              </div>
            </div>
          </div>
        )}

        {/* TELA 5: ALERTAS SANITÁRIOS */}
        {currentScreen === 5 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-rose-500/20 text-rose-400 border border-rose-400/30">
                Tela 5 de 5 — Alertas Sanitários & Pontos Críticos do Dia
              </span>
              <span className="text-xs opacity-60 font-mono">Próxima tela em: {secondsUntilNextScreen}s</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`p-5 rounded-2xl border ${cardClasses} border-l-4 border-l-rose-500`}>
                <span className="text-xs font-black uppercase text-rose-400">Bloqueios Ativos</span>
                <p className="text-3xl font-black mt-2">2</p>
                <p className="text-xs opacity-70 mt-1">Raio de 150m e 300m em execução</p>
              </div>

              <div className={`p-5 rounded-2xl border ${cardClasses} border-l-4 border-l-amber-500`}>
                <span className="text-xs font-black uppercase text-amber-400">PEs Vencidos</span>
                <p className="text-3xl font-black mt-2">2</p>
                <p className="text-xs opacity-70 mt-1">Inspeção quinzenal atrasada</p>
              </div>

              <div className={`p-5 rounded-2xl border ${cardClasses} border-l-4 border-l-purple-500`}>
                <span className="text-xs font-black uppercase text-purple-400">Ovitrampas Positivas</span>
                <p className="text-3xl font-black mt-2">6</p>
                <p className="text-xs opacity-70 mt-1">Índice médio: 42 ovos/palheta</p>
              </div>

              <div className={`p-5 rounded-2xl border ${cardClasses} border-l-4 border-l-blue-500`}>
                <span className="text-xs font-black uppercase text-blue-400">Denúncias Críticas</span>
                <p className="text-3xl font-black mt-2">3</p>
                <p className="text-xs opacity-70 mt-1">Aguardando vistoria no portal</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra Inferior com Indicadores e Navegação Manual */}
      <div className={`pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs ${isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
        <div className="flex items-center gap-2">
          <button onClick={handlePrevScreen} className="p-1 rounded hover:bg-slate-800 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Tela <strong>{currentScreen}</strong> de 5</span>
          <button onClick={handleNextScreen} className="p-1 rounded hover:bg-slate-800 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="mx-2">•</span>
          <span className="text-emerald-400 font-medium">Modo Telão Contínuo Ativo</span>
        </div>

        <div className="text-[11px] font-mono">
          LGPD: Painel gerencial restrito com proteção estrita a dados pessoais de cidadãos
        </div>
      </div>

      {/* MODAL DE CONFIGURAÇÃO DO TELÃO */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl border p-6 max-w-md w-full space-y-4 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-sky-400" />
                <span>Configurações da Central TV / Telão</span>
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-xs opacity-70 hover:opacity-100">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Tempo de Rotação entre Telas:</label>
                <select
                  value={rotationIntervalSeconds}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setRotationIntervalSeconds(val);
                    setSecondsUntilNextScreen(val);
                  }}
                  className={`w-full p-2 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                >
                  <option value={10}>10 segundos (Rápido)</option>
                  <option value={20}>20 segundos (Padrão)</option>
                  <option value={30}>30 segundos (Recomendado)</option>
                  <option value={60}>60 segundos (Analítico)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span>Mostrar Brasão Institucional:</span>
                <input
                  type="checkbox"
                  checked={showCoatOfArms}
                  onChange={e => setShowCoatOfArms(e.target.checked)}
                  className="w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <span>Modo Escuro (Contraste para TV):</span>
                <input
                  type="checkbox"
                  checked={isDarkMode}
                  onChange={e => setIsDarkMode(e.target.checked)}
                  className="w-4 h-4"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-700/50">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs"
              >
                Salvar Preferências
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
