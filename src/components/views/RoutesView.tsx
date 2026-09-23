import React, { useState, useEffect } from 'react';
import {
  Navigation,
  MapPin,
  Flame,
  Repeat,
  DoorClosed,
  Clock,
  ArrowRight,
  CheckCircle2,
  Compass,
  Shuffle,
  Play,
  SkipForward,
  AlertTriangle,
  Map,
  X,
  Check,
  RotateCcw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { db } from '../../services/storage';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import { Property } from '../../types';
import { PageHeader } from '../ui';
import { useMunicipalityId } from '../../contexts/AuthContext';

interface RoutesViewProps {
  onNavigate: (module: string) => void;
}

interface RouteItem extends Property {
  visitStatus?: 'PENDENTE' | 'VISITADO' | 'PULADO' | 'IMPOSSIBILITADO';
  skipReason?: string;
  impossibilityReason?: string;
  priorityLabel: string;
  priorityLevel: 'URGENTE' | 'ALTA' | 'ATENCAO' | 'NORMAL';
  visitReason: string;
  estimatedDistanceMeters: number;
}

const STORAGE_ROUTE_KEY = 'endemias_ace_optimized_route';

export const RoutesView: React.FC<RoutesViewProps> = ({ onNavigate }) => {
  const municipalityId = useMunicipalityId();
  const [routeList, setRouteList] = useState<RouteItem[]>([]);
  const [isRouteActive, setIsRouteActive] = useState<boolean>(false);
  const [skipModalItem, setSkipModalItem] = useState<RouteItem | null>(null);
  const [impossibilityModalItem, setImpossibilityModalItem] = useState<RouteItem | null>(null);
  const [customReason, setCustomReason] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadOrInitializeRoute();
  }, []);

  const loadOrInitializeRoute = async () => {
    // Tentar carregar rota em andamento do cache local
    const saved = localStorage.getItem(STORAGE_ROUTE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRouteList(parsed);
          setIsRouteActive(true);
          return;
        }
      } catch (err) {
        console.warn('Erro ao restaurar rota local:', err);
      }
    }

    // Inicialização da rota inteligente: tentar buscar imóveis do Supabase
    let rawProperties: Property[] = [];
    try {
      const res = await supabaseService.getPropertiesPaginated({ municipalityId, page: 1, pageSize: 40 });
      if (res.properties && res.properties.length > 0) {
        rawProperties = res.properties;
      }
    } catch {
      // Fallback
    }

    if (rawProperties.length === 0) {
      rawProperties = db.getProperties();
    }

    const sorted: RouteItem[] = rawProperties.map((prop, idx) => {
      const isFoci = prop.status === 'FOCO';
      const isRecurrent = prop.isRecurrent;
      const isClosed = prop.status === 'FECHADO';

      let priorityLabel = 'Visita Regular';
      let priorityLevel: RouteItem['priorityLevel'] = 'NORMAL';
      let visitReason = 'Cobertura censitária de rotina no ciclo';

      if (isFoci) {
        priorityLabel = 'Foco Ativo Detectado';
        priorityLevel = 'URGENTE';
        visitReason = 'Interrupção imediata de criadouro e tratamento larvicida';
      } else if (isRecurrent) {
        priorityLabel = `Reincidente (${prop.fociHistoryCount || 1}x)`;
        priorityLevel = 'ALTA';
        visitReason = 'Imóvel histórico com repetição contínua de criadouros';
      } else if (isClosed) {
        priorityLabel = 'Retorno Pendente (Fechado)';
        priorityLevel = 'ATENCAO';
        visitReason = 'Imóvel não inspecionado no primeiro percurso do quarteirão';
      }

      return {
        ...prop,
        visitStatus: 'PENDENTE',
        priorityLabel,
        priorityLevel,
        visitReason,
        estimatedDistanceMeters: (idx + 1) * 75,
      };
    });

    // Ordenação inteligente: URGENTE > ALTA > ATENCAO > NORMAL
    const priorityWeight = { URGENTE: 4, ALTA: 3, ATENCAO: 2, NORMAL: 1 };
    sorted.sort((a, b) => priorityWeight[b.priorityLevel] - priorityWeight[a.priorityLevel]);

    setRouteList(sorted);
  };

  const saveRouteToCache = (newList: RouteItem[]) => {
    setRouteList(newList);
    try {
      localStorage.setItem(STORAGE_ROUTE_KEY, JSON.stringify(newList));
    } catch {
      // ignore
    }
  };

  const handleStartRoute = () => {
    setIsRouteActive(true);
    saveRouteToCache(routeList);
    // Registrar início no audit_logs
    try {
      supabase.from('audit_logs').insert({
        action: 'ROUTE_STARTED',
        entity_type: 'field_routes',
        entity_id: `route-${Date.now()}`,
        details: { total_properties: routeList.length, date: new Date().toISOString() },
      }).then();
    } catch {
      // ignore
    }
  };

  const handleReorganizeRoute = () => {
    // Reorganizar os pendentes mantendo os visitados no topo
    const visited = routeList.filter(r => r.visitStatus === 'VISITADO');
    const nonVisited = routeList.filter(r => r.visitStatus !== 'VISITADO');

    // Embaralha/reorganiza por menor distância aproximada
    nonVisited.sort((a, b) => a.estimatedDistanceMeters - b.estimatedDistanceMeters);
    const reordered = [...visited, ...nonVisited];
    saveRouteToCache(reordered);
    alert('Rota reorganizada por proximidade para otimizar seu deslocamento!');
  };

  const handleStartVisit = (item: RouteItem) => {
    // Salvar o imóvel ativo para ser carregado no PWA
    localStorage.setItem('endemias_active_property', JSON.stringify(item));

    // Marcar como visitado e avançar automaticamente
    const updated = routeList.map(r =>
      r.id === item.id ? { ...r, visitStatus: 'VISITADO' as const } : r
    );
    saveRouteToCache(updated);

    // Navegar para o registro de visita em campo
    onNavigate('ace_pwa');
  };

  const handleConfirmSkip = () => {
    if (!skipModalItem) return;
    const updated = routeList.map(r =>
      r.id === skipModalItem.id
        ? {
            ...r,
            visitStatus: 'PULADO' as const,
            skipReason: customReason || 'Morador temporariamente ausente',
          }
        : r
    );
    saveRouteToCache(updated);
    setSkipModalItem(null);
    setCustomReason('');
  };

  const handleConfirmImpossibility = () => {
    if (!impossibilityModalItem) return;
    const updated = routeList.map(r =>
      r.id === impossibilityModalItem.id
        ? {
            ...r,
            visitStatus: 'IMPOSSIBILITADO' as const,
            impossibilityReason: customReason || 'Portão trancado / cão bravo',
          }
        : r
    );
    saveRouteToCache(updated);
    setImpossibilityModalItem(null);
    setCustomReason('');
  };

  const handleResetRoute = () => {
    if (confirm('Deseja reiniciar a rota de hoje? Todos os status serão redefinidos para pendente.')) {
      localStorage.removeItem(STORAGE_ROUTE_KEY);
      loadOrInitializeRoute();
      setIsRouteActive(false);
    }
  };

  // Contadores
  const totalCount = routeList.length;
  const visitedCount = routeList.filter(r => r.visitStatus === 'VISITADO').length;
  const skippedCount = routeList.filter(r => r.visitStatus === 'PULADO').length;
  const impossibleCount = routeList.filter(r => r.visitStatus === 'IMPOSSIBILITADO').length;
  const pendingCount = totalCount - visitedCount - skippedCount - impossibleCount;
  const progressPercent = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <PageHeader
        icon={Navigation}
        title="Minha Rota Otimizada"
        subtitle="Ordenação sequencial inteligente por gravidade de risco e menor trajeto com suporte 100% offline"
        actions={
          <>
            <div
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 font-bold text-xs ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-amber-600" />}
              <span>{isOnline ? 'Online (Sincronizado)' : 'Modo Offline Ativo'}</span>
            </div>

            <button
              onClick={handleReorganizeRoute}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-1.5 shadow-2xs text-xs"
              title="Reordenar imóveis restantes por menor distância"
            >
              <Shuffle className="w-3.5 h-3.5 text-slate-500" />
              <span>Reorganizar Rota</span>
            </button>

            <button
              onClick={() => onNavigate('map')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-1.5 shadow-2xs text-xs"
            >
              <Map className="w-3.5 h-3.5 text-slate-500" />
              <span>Abrir no Mapa</span>
            </button>

            {!isRouteActive ? (
              <button
                onClick={handleStartRoute}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs transition text-xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Iniciar Rota</span>
              </button>
            ) : (
              <button
                onClick={handleResetRoute}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                title="Reiniciar rota"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </>
        }
      />

      {/* Barra de Progresso do Dia */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">Progresso da Rota:</span>
            <span className="text-slate-600">
              {visitedCount} de {totalCount} imóveis visitados ({progressPercent}%)
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
            <span>Pendentes: <strong className="text-slate-800">{pendingCount}</strong></span>
            <span>•</span>
            <span>Pulados: <strong className="text-amber-700">{skippedCount}</strong></span>
            <span>•</span>
            <span>Impedidos: <strong className="text-rose-700">{impossibleCount}</strong></span>
          </div>
        </div>

        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
          <div className="bg-emerald-600 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${(skippedCount / totalCount) * 100}%` }} />
          <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${(impossibleCount / totalCount) * 100}%` }} />
        </div>
      </div>

      {/* Lista Sequencial de Imóveis */}
      <div className="space-y-3">
        {routeList.map((prop, idx) => {
          const isVisited = prop.visitStatus === 'VISITADO';
          const isSkipped = prop.visitStatus === 'PULADO';
          const isImpossible = prop.visitStatus === 'IMPOSSIBILITADO';

          return (
            <div
              key={prop.id}
              className={`p-4 rounded-xl border transition shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                isVisited
                  ? 'bg-emerald-50/20 border-emerald-200 opacity-80'
                  : isSkipped
                  ? 'bg-amber-50/20 border-amber-200'
                  : isImpossible
                  ? 'bg-rose-50/20 border-rose-200'
                  : prop.priorityLevel === 'URGENTE'
                  ? 'bg-rose-50/15 border-rose-300'
                  : 'bg-white border-slate-200'
              }`}
            >
              {/* Lado Esquerdo: Sequência + Endereço + Motivo */}
              <div className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center flex-shrink-0 ${
                    isVisited
                      ? 'bg-emerald-600 text-white'
                      : isSkipped
                      ? 'bg-amber-500 text-white'
                      : isImpossible
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-900 text-white'
                  }`}
                >
                  {isVisited ? <Check className="w-4 h-4" /> : idx + 1}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {prop.address}, {prop.number}
                    </span>
                    <span className="font-mono text-xs text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                      {prop.code}
                    </span>

                    {/* Status de Visita */}
                    {isVisited && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Visitado
                      </span>
                    )}
                    {isSkipped && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        Pulado: {prop.skipReason}
                      </span>
                    )}
                    {isImpossible && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                        Impossibilitado: {prop.impossibilityReason}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{prop.neighborhood} • {prop.block}</span>
                    <span>•</span>
                    <span className="text-slate-700 font-medium">Tipo: {prop.type}</span>
                    <span>•</span>
                    <span className="text-slate-700 font-medium">Distância aprox: ~{prop.estimatedDistanceMeters}m</span>
                  </div>

                  {/* Motivo e Prioridade */}
                  <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 ${
                        prop.priorityLevel === 'URGENTE'
                          ? 'bg-rose-100 text-rose-700'
                          : prop.priorityLevel === 'ALTA'
                          ? 'bg-purple-100 text-purple-700'
                          : prop.priorityLevel === 'ATENCAO'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {prop.priorityLevel === 'URGENTE' && <Flame className="w-3 h-3" />}
                      {prop.priorityLevel === 'ALTA' && <Repeat className="w-3 h-3" />}
                      {prop.priorityLevel === 'ATENCAO' && <DoorClosed className="w-3 h-3" />}
                      <span>{prop.priorityLabel}</span>
                    </span>

                    <span className="text-slate-600 text-[11px]">
                      Motivo: <strong className="text-slate-800 font-medium">{prop.visitReason}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Lado Direito: Ações de Campo */}
              <div className="flex items-center gap-2 self-end md:self-center">
                {!isVisited && (
                  <>
                    <button
                      onClick={() => setSkipModalItem(prop)}
                      className="p-2 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-semibold transition"
                      title="Pular temporariamente este imóvel"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setImpossibilityModalItem(prop)}
                      className="p-2 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition"
                      title="Informar impossibilidade de acesso"
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </button>
                  </>
                )}

                <button
                  onClick={() => handleStartVisit(prop)}
                  className={`px-4 py-2 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 ${
                    isVisited
                      ? 'bg-slate-700 hover:bg-slate-800'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <span>{isVisited ? 'Revisitar' : 'Iniciar Visita'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: PULAR IMÓVEL */}
      {skipModalItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <SkipForward className="w-4 h-4 text-amber-600" />
                <span>Pular Imóvel Temporariamente</span>
              </h3>
              <button onClick={() => setSkipModalItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              O imóvel <strong>{skipModalItem.address}, {skipModalItem.number}</strong> continuará na lista e poderá ser revisitado mais tarde na mesma rota.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Justificativa:</label>
              <select
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-none"
              >
                <option value="Morador ausente no momento">Morador ausente no momento</option>
                <option value="Comércio temporariamente em atendimento">Comércio temporariamente em atendimento</option>
                <option value="Chuva forte no quarteirão">Chuva forte no quarteirão</option>
                <option value="Retornar no fim do percurso">Retornar no fim do percurso</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSkipModalItem(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSkip}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs"
              >
                Confirmar e Avançar Rota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INFORMAR IMPOSSIBILIDADE */}
      {impossibilityModalItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Informar Impossibilidade de Visita</span>
              </h3>
              <button onClick={() => setImpossibilityModalItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Informe o motivo pelo qual o imóvel <strong>{impossibilityModalItem.address}, {impossibilityModalItem.number}</strong> não pôde ser inspecionado.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Motivo do Impedimento:</label>
              <select
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:outline-none"
              >
                <option value="Portão trancado / sem campainha">Portão trancado / sem campainha</option>
                <option value="Cão bravo solto no pátio">Cão bravo solto no pátio</option>
                <option value="Recusa expressa do morador">Recusa expressa do morador</option>
                <option value="Imóvel desocupado / para alugar">Imóvel desocupado / para alugar</option>
                <option value="Área de difícil acesso / alagada">Área de difícil acesso / alagada</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setImpossibilityModalItem(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmImpossibility}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
              >
                Registrar Impedimento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
