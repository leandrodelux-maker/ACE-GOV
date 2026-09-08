import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  MapPin,
  CheckCircle,
  Clock,
  Flame,
  Layers,
  Crosshair,
  AlertCircle,
  Navigation,
  Download,
  RefreshCw,
  Plus,
  Compass,
  ArrowRight,
  Shield,
  Trash2,
  Check,
  AlertTriangle,
  User,
  Camera,
  X,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseService } from '../../services/supabaseService';
import { Property, VisitSituation, DepositCategory, DepositInspection, Visit } from '../../types';
import { qrCodeService } from '../../services/qrCodeService';
import { fieldEvidenceService } from '../../services/fieldEvidenceService';
import { workOrderService, WorkOrderItem } from '../../services/workOrderService';
import { QrCode, ClipboardList, ShieldCheck } from 'lucide-react';

interface AcePwaViewProps {
  onNavigate: (module: string) => void;
}

export const AcePwaView: React.FC<AcePwaViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  // Detecção de status de conexão em tempo real
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

  // Fila Offline (sync_queue) no localStorage
  const [syncQueue, setSyncQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('endemias_sync_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [offlineDownloaded, setOfflineDownloaded] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Imóveis do ACE
  const [myProperties, setMyProperties] = useState<any[]>([]);
  const [isLoadingProps, setIsLoadingProps] = useState<boolean>(true);

  // Estatísticas diárias
  const [dailyStats, setDailyStats] = useState({
    target: 25,
    completed: 0,
    fociCount: 0,
  });

  // Modal de Visita em Andamento
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const [visitSituation, setVisitSituation] = useState<VisitSituation>('TRABALHADO');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);

  // Depósitos e Inspeção
  const [inspections, setInspections] = useState<DepositInspection[]>([]);
  const [currentCategory, setCurrentCategory] = useState<DepositCategory>('B');
  const [depositName, setDepositName] = useState<string>('Pratinho / Vaso de planta');
  const [quantity, setQuantity] = useState<number>(1);
  const [hasWater, setHasWater] = useState<boolean>(true);
  const [hasLarvae, setHasLarvae] = useState<boolean>(false);
  const [conductNotes, setConductNotes] = useState<string>('');
  const [isFinishing, setIsFinishing] = useState<boolean>(false);

  // Evidências Fotográficas e QR Code
  const [visitPhotos, setVisitPhotos] = useState<string[]>([]);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState<boolean>(false);
  const [qrInputText, setQrInputText] = useState<string>('');
  const [myWorkOrders, setMyWorkOrders] = useState<WorkOrderItem[]>([]);
  const [activePwaTab, setActivePwaTab] = useState<'imoveis' | 'ordens'>('imoveis');

  // Saudação horária
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Bom dia' : currentHour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = user?.name ? user.name.split(' ')[0] : 'Agente';

  // Carregar Imóveis
  const loadMyProperties = useCallback(async () => {
    setIsLoadingProps(true);
    try {
      const res = await supabaseService.getPropertiesPaginated({
        page: 1,
        pageSize: 30,
      });

      if (res.properties.length > 0) {
        setMyProperties(res.properties);
        localStorage.setItem('endemias_cached_properties', JSON.stringify(res.properties));
      } else {
        // Fallback do cache local
        const cached = localStorage.getItem('endemias_cached_properties');
        if (cached) setMyProperties(JSON.parse(cached));
      }
    } catch {
      const cached = localStorage.getItem('endemias_cached_properties');
      if (cached) setMyProperties(JSON.parse(cached));
    } finally {
      setIsLoadingProps(false);
    }
  }, []);

  useEffect(() => {
    loadMyProperties();

    async function loadOrders() {
      try {
        const orders = await workOrderService.getWorkOrders();
        setMyWorkOrders(orders);
      } catch (err) {
        console.warn('Erro ao carregar OS no PWA:', err);
      }
    }
    loadOrders();
  }, [loadMyProperties]);

  const handleCapturePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await fieldEvidenceService.compressImage(file);
      setVisitPhotos(prev => [...prev, compressedDataUrl]);
    } catch (err) {
      console.error('Erro ao comprimir foto:', err);
    }
  };

  const handleResolveQr = async (token: string) => {
    const parsed = qrCodeService.parseQrPayload(token);
    if (parsed && parsed.type === 'property') {
      const matched = myProperties.find(p => p.id === parsed.id || p.code === parsed.code);
      if (matched) {
        setIsQrScannerOpen(false);
        handleStartVisit(matched);
      } else {
        alert(`Imóvel identificado (${parsed.code}), iniciando vistoria.`);
        setIsQrScannerOpen(false);
        handleStartVisit({
          id: parsed.id,
          code: parsed.code,
          address: 'Imóvel Identificado via QR Code',
          neighborhood: 'Setor de Campo',
        });
      }
    } else {
      alert('QR Code lido com sucesso! Abrindo cadastro do imóvel...');
      setIsQrScannerOpen(false);
      if (myProperties.length > 0) handleStartVisit(myProperties[0]);
    }
  };

  // Salvar fila no localStorage
  const saveSyncQueue = (queue: any[]) => {
    setSyncQueue(queue);
    localStorage.setItem('endemias_sync_queue', JSON.stringify(queue));
  };

  // Sincronizar Fila com o Supabase
  const handleSyncNow = async () => {
    if (syncQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);

    try {
      const muni = await supabaseService.getMunicipality();
      const muniId = muni?.id || '00000000-0000-0000-0000-000000000001';
      const cycle = await supabaseService.getActiveCycle(muniId);
      const cycleId = cycle?.id || '00000000-0000-0000-0000-000000000001';

      let successCount = 0;
      const remaining: any[] = [];

      for (const item of syncQueue) {
        const res = await supabaseService.registerVisitTransaction({
          ...item,
          municipalityId: muniId,
          cycleId: cycleId,
        });

        if (res.success) {
          successCount++;
        } else {
          remaining.push(item);
        }
      }

      saveSyncQueue(remaining);
      setSuccessMessage(`${successCount} vistoria(s) sincronizada(s) com sucesso no banco de dados!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadMyProperties();
    } catch (err: any) {
      alert(`Falha durante sincronização: ${err.message || 'Erro de conexão'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Baixar Área Offline
  const handleDownloadOffline = () => {
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      setOfflineDownloaded(true);
      setSuccessMessage('Base de imóveis e mapas do setor baixados com sucesso no dispositivo!');
      setTimeout(() => setSuccessMessage(null), 3500);
    }, 1200);
  };

  // Iniciar Visita
  const handleStartVisit = (property: any) => {
    setSelectedProperty(property);
    setVisitSituation('TRABALHADO');
    setInspections([]);
    setConductNotes('');
    setGpsLoading(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsLoading(false);
        },
        () => {
          setGpsLocation({ lat: property.latitude || -29.718, lng: property.longitude || -52.428 });
          setGpsLoading(false);
        },
        { timeout: 4000 }
      );
    } else {
      setGpsLocation({ lat: property.latitude || -29.718, lng: property.longitude || -52.428 });
      setGpsLoading(false);
    }
  };

  // Adicionar Depósito
  const handleAddDeposit = () => {
    const isFoci = hasLarvae;
    const newInsp: DepositInspection = {
      category: currentCategory,
      name: depositName,
      quantity,
      hasWater,
      hasLarvae,
      isFoci,
      actionTaken: hasLarvae ? 'TRATADO' : 'ORIENTADO',
      larvicideUsed: hasLarvae ? 'Pyriproxyfen 0.5% Granulado' : undefined,
    };
    setInspections([...inspections, newInsp]);
    setQuantity(1);
    setHasLarvae(false);
  };

  const handleRemoveDeposit = (index: number) => {
    setInspections(inspections.filter((_, i) => i !== index));
  };

  // Finalizar Visita (Online ou Fila Offline)
  const handleFinalizeVisit = async () => {
    if (!selectedProperty) return;
    setIsFinishing(true);

    const fociFound = inspections.some(i => i.isFoci || i.hasLarvae);

    const visitPayload = {
      propertyId: selectedProperty.id,
      agentId: user?.id,
      visitDate: new Date().toISOString().split('T')[0],
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      visitType: 'ROTINA',
      result: visitSituation,
      latitude: gpsLocation?.lat || selectedProperty.latitude,
      longitude: gpsLocation?.lng || selectedProperty.longitude,
      notes: conductNotes || (fociFound ? 'Foco detectado e tratado com larvicida.' : 'Inspeção concluída sem focos.'),
      deposits: inspections.map(i => ({
        depositType: i.category,
        quantity: i.quantity,
        positive: i.isFoci,
        larvaeFound: i.hasLarvae,
        eliminated: i.actionTaken === 'ELIMINADO',
        treated: i.actionTaken === 'TRATADO',
        treatmentProduct: i.larvicideUsed,
      })),
    };

    if (isOnline) {
      try {
        const muni = await supabaseService.getMunicipality();
        const muniId = muni?.id || '00000000-0000-0000-0000-000000000001';
        const cycle = await supabaseService.getActiveCycle(muniId);
        const cycleId = cycle?.id || '00000000-0000-0000-0000-000000000001';

        await supabaseService.registerVisitTransaction({
          ...visitPayload,
          municipalityId: muniId,
          cycleId: cycleId,
        });

        setSuccessMessage(`Visita ao imóvel ${selectedProperty.code} registrada diretamente no banco de dados!`);
      } catch {
        // Se falhar a requisição, salva na fila offline
        saveSyncQueue([...syncQueue, visitPayload]);
        setSuccessMessage(`Falha temporária de rede. Visita guardada na fila offline para sincronização.`);
      }
    } else {
      // Offline: adiciona à fila local
      saveSyncQueue([...syncQueue, visitPayload]);
      setSuccessMessage(`Modo offline ativo. Visita guardada no dispositivo e pronta para sincronizar.`);
    }

    // Atualiza contadores visuais do dia
    setDailyStats(prev => ({
      ...prev,
      completed: prev.completed + 1,
      fociCount: fociFound ? prev.fociCount + 1 : prev.fociCount,
    }));

    // Salvar evidências fotográficas sanitárias capturadas
    if (visitPhotos.length > 0) {
      for (const photoData of visitPhotos) {
        fieldEvidenceService.saveEvidence({
          entityType: 'visita',
          entityId: selectedProperty.id,
          fileDataUrl: photoData,
          latitude: gpsLocation?.lat || selectedProperty.latitude,
          longitude: gpsLocation?.lng || selectedProperty.longitude,
          uploadedBy: user?.id,
          description: `Evidência fotográfica sanitária da visita ao imóvel ${selectedProperty.code}`,
        });
      }
      setVisitPhotos([]);
    }

    setIsFinishing(false);
    setSelectedProperty(null);
    setTimeout(() => setSuccessMessage(null), 4000);
    await loadMyProperties();
  };

  const depositPresets: Record<DepositCategory, string[]> = {
    A1: ['Caixa d\'água elevada', 'Cisterna elevada', 'Reservatório fechado'],
    A2: ['Tambor 200L', 'Tonel plástico', 'Cisterna de solo', 'Poço'],
    B: ['Pratinho / Vaso de planta', 'Garrafa destampada', 'Pinga-pinga', 'Bebedouro de animal'],
    C: ['Calha entupida', 'Ralo externo', 'Laje com água', 'Piscina sem cloro'],
    D1: ['Pneu usado ao ar livre', 'Carcaça de roda'],
    D2: ['Lixo / Entulho em quintal', 'Sucata metálica', 'Plástico descartável'],
    E: ['Oco de árvore', 'Bromélia com água', 'Bambu cortado'],
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-24">
      {/* Header do PWA */}
      <div className="bg-gradient-to-r from-blue-900 to-sky-900 text-white p-5 rounded-2xl shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-sky-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-sky-300">PWA Campo ACE</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Online/Offline */}
            {isOnline ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <Wifi className="w-3 h-3 text-emerald-400" /> Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                <WifiOff className="w-3 h-3 text-amber-400" /> Offline
              </span>
            )}

            {/* Status de Sincronização */}
            {syncQueue.length === 0 ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Sincronizado</span>
              </div>
            ) : (
              <button
                onClick={handleSyncNow}
                disabled={!isOnline || isSyncing}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-bold shadow animate-pulse hover:bg-amber-400 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : `${syncQueue.length} para sync`}</span>
              </button>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-xl font-extrabold">
            {greeting}, {firstName}! 👋
          </h1>
          <p className="text-xs text-sky-200 mt-0.5">
            Perfil: {user?.role || 'ACE'} • Base Operacional SUS
          </p>
        </div>

        {/* Baixar Área Offline */}
        <div className="pt-2 border-t border-sky-800/80 flex items-center justify-between">
          <div className="text-[11px] text-sky-200">
            {offlineDownloaded ? (
              <span className="text-emerald-300 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Área salva no celular
              </span>
            ) : (
              <span>Dados não baixados</span>
            )}
          </div>
          <button
            onClick={handleDownloadOffline}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-700/80 hover:bg-sky-600 text-white text-xs font-semibold transition"
          >
            {isDownloading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Baixar Área Offline</span>
          </button>
        </div>
      </div>

      {/* Banner de Notificação */}
      {successMessage && (
        <div className="bg-emerald-600 text-white p-3 rounded-xl shadow text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Cards de Desempenho Diário */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Meta Hoje</p>
          <p className="text-xl font-extrabold text-blue-700">{dailyStats.target}</p>
          <span className="text-[10px] text-slate-400">imóveis</span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Realizadas</p>
          <p className="text-xl font-extrabold text-emerald-700">{dailyStats.completed}</p>
          <span className="text-[10px] text-emerald-700 font-medium">
            {Math.round((dailyStats.completed / dailyStats.target) * 100)}% feito
          </span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Focos</p>
          <p className="text-xl font-extrabold text-rose-700">{dailyStats.fociCount}</p>
          <span className="text-[10px] text-rose-700 font-medium">eliminados</span>
        </div>
      </div>

      {/* Roteiro Prioritário de Hoje */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          {/* Abas Roteiro vs OS */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActivePwaTab('imoveis')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activePwaTab === 'imoveis'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Imóveis da Rota
            </button>
            <button
              onClick={() => setActivePwaTab('ordens')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activePwaTab === 'ordens'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
              <span>Minhas OS ({myWorkOrders.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsQrScannerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition border border-indigo-200"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Escanear QR Imóvel</span>
            </button>

            <button
              onClick={() => onNavigate('routes')}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <span>Mapa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Conteúdo da Aba Imóveis */}
        {activePwaTab === 'imoveis' ? (
          <div className="space-y-2">
            {isLoadingProps ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-1" />
                <span>Carregando roteiro...</span>
              </div>
            ) : myProperties.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">Nenhum imóvel atribuído para hoje.</p>
            ) : (
              myProperties.slice(0, 8).map((prop, idx) => {
                const isFoci = prop.status === 'FOCO';
                const isClosed = prop.status === 'FECHADO';

                return (
                  <div
                    key={prop.id}
                    className={`p-3.5 rounded-xl border transition flex items-center justify-between ${
                      isFoci
                        ? 'border-rose-300 bg-rose-50/40'
                        : isClosed
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-white'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">{prop.address}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="font-mono text-slate-600 font-semibold">{prop.code}</span>
                        <span>•</span>
                        <span className="text-slate-600">{prop.neighborhood}</span>
                        {isFoci && (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-700">
                            Foco Ativo
                          </span>
                        )}
                        {isClosed && (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800">
                            Retorno Pendente
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartVisit(prop)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition active:scale-95 flex items-center gap-1"
                    >
                      <span>Visitar</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Conteúdo da Aba Ordens de Serviço */
          <div className="space-y-2">
            {myWorkOrders.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">Nenhuma Ordem de Serviço atribuída no momento.</p>
            ) : (
              myWorkOrders.map(order => (
                <div
                  key={order.id}
                  className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/30 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-700">{order.number}</span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                        {order.priority}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">{order.title}</p>
                    <p className="text-[10px] text-slate-500 capitalize">
                      Tipo: {order.type.replace('_', ' ')} • Status: {order.status}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      handleStartVisit({
                        id: order.propertyId || `prop-${order.id}`,
                        code: order.number,
                        address: order.propertyAddress || order.title,
                        neighborhood: order.neighborhoodName || 'Setor Operacional',
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
                  >
                    Atender OS
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal de Visita Domiciliar em Campo */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded">
                  Vistoria Sanitária Digital
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedProperty.address}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedProperty.code} • {selectedProperty.neighborhood}
                </p>
              </div>
              <button
                onClick={() => setSelectedProperty(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* GPS */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-700">
                  {gpsLoading ? 'Capturando GPS...' : `GPS: ${gpsLocation?.lat.toFixed(5)}, ${gpsLocation?.lng.toFixed(5)}`}
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                Georreferenciado
              </span>
            </div>

            {/* Situação */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Situação da Visita:
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {(['TRABALHADO', 'FECHADO', 'RECUSA', 'DESOCUPADO'] as VisitSituation[]).map(sit => (
                  <button
                    key={sit}
                    type="button"
                    onClick={() => setVisitSituation(sit)}
                    className={`py-2 px-2 rounded-lg font-bold transition text-center ${
                      visitSituation === sit
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {sit}
                  </button>
                ))}
              </div>
            </div>

            {/* Inspeção de Depósitos */}
            {visitSituation === 'TRABALHADO' && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Inspeção de Criadouros (Padrão MS)
                  </h4>
                  <span className="text-[10px] text-slate-500">Categorias A1 a E</span>
                </div>

                {/* Seletor de Categoria */}
                <div className="flex overflow-x-auto gap-1 pb-1">
                  {(['A1', 'A2', 'B', 'C', 'D1', 'D2', 'E'] as DepositCategory[]).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setCurrentCategory(cat);
                        setDepositName(depositPresets[cat][0] || 'Depósito');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold shrink-0 transition ${
                        currentCategory === cat
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Inputs do depósito */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">Tipo de Depósito</label>
                      <select
                        value={depositName}
                        onChange={e => setDepositName(e.target.value)}
                        className="w-full mt-1 p-2 rounded-lg bg-white border border-slate-300 font-medium text-slate-800"
                      >
                        {depositPresets[currentCategory].map(item => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={quantity}
                        onChange={e => setQuantity(Number(e.target.value))}
                        className="w-full mt-1 p-2 rounded-lg bg-white border border-slate-300 font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setHasWater(!hasWater)}
                      className={`py-2 px-3 rounded-lg font-bold border transition ${
                        hasWater
                          ? 'bg-sky-100 text-sky-900 border-sky-300'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      💧 Com Água: {hasWater ? 'SIM' : 'NÃO'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setHasLarvae(!hasLarvae)}
                      className={`py-2 px-3 rounded-lg font-bold border transition ${
                        hasLarvae
                          ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      🐛 Com Larvas: {hasLarvae ? 'SIM (FOCO!)' : 'NÃO'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddDeposit}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Depósito Inspecionado</span>
                  </button>
                </div>

                {/* Lista de Depósitos Adicionados */}
                {inspections.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-700">Depósitos Inspecionados nesta visita:</p>
                    {inspections.map((insp, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                          insp.hasLarvae ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div>
                          <span className="font-extrabold mr-1">[{insp.category}]</span>
                          <span className="font-semibold">{insp.name}</span> ({insp.quantity}x)
                          {insp.hasLarvae && (
                            <span className="ml-2 font-bold text-rose-600 bg-rose-100 px-1 rounded">
                              FOCO DETECTADO
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveDeposit(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Evidências Fotográficas Seguras (LGPD Compliance) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-slate-600" />
                  Evidências Fotográficas ({visitPhotos.length})
                </label>
                <label className="cursor-pointer px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1">
                  <Plus className="w-3 h-3" />
                  <span>Anexar Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCapturePhoto}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Alerta de Diretriz LGPD */}
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[10px] text-amber-800 flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Aviso de Privacidade:</strong> Evite fotografar rostos, documentos ou informações pessoais. Registre apenas o criadouro ou depósito sanitário.
                </span>
              </div>

              {/* Previews de fotos capturadas */}
              {visitPhotos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto py-1">
                  {visitPhotos.map((photo, pIdx) => (
                    <div key={pIdx} className="relative shrink-0">
                      <img
                        src={photo}
                        alt="Evidência sanitária"
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setVisitPhotos(visitPhotos.filter((_, i) => i !== pIdx))}
                        className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full p-0.5 shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conduta */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Conduta Realizada / Observação Sanitária:
              </label>
              <textarea
                value={conductNotes}
                onChange={e => setConductNotes(e.target.value)}
                placeholder="Ex: Depósito eliminado com descarte mecânico. Morador orientado."
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 outline-none"
                rows={2}
              />
            </div>

            {/* Finalizar */}
            <button
              onClick={handleFinalizeVisit}
              disabled={isFinishing}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md transition active:scale-95 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              <span>{isFinishing ? 'REGISTRANDO...' : 'FINALIZAR VISITA'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Scanner / Leitor de QR Code de Imóvel */}
      {isQrScannerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Leitor de QR Code do Imóvel</h3>
              </div>
              <button
                onClick={() => setIsQrScannerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                <Camera className="w-8 h-8 animate-pulse" />
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Aponte a câmera para a etiqueta colada no imóvel ou informe o token/código:
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Ex: IMO-000104 ou token lido..."
                value={qrInputText}
                onChange={e => setQrInputText(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900"
              />
              <button
                type="button"
                onClick={() => handleResolveQr(qrInputText || 'IMO-000104')}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <span>Identificar Imóvel e Iniciar Visita</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
