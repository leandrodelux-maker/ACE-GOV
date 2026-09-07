import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { db } from '../../services/storage';
import {
  Property,
  VisitSituation,
  DepositCategory,
  DepositInspection,
  Visit,
} from '../../types';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface AcePwaViewProps {
  onNavigate: (module: string) => void;
}

export const AcePwaView: React.FC<AcePwaViewProps> = ({ onNavigate }) => {
  const isOnline = useOnlineStatus();
  const currentUser = db.getCurrentUser();
  const [offlineDownloaded, setOfflineDownloaded] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<Visit[]>(db.getOfflineQueue());

  // Active visit modal state
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [visitSituation, setVisitSituation] = useState<VisitSituation>('TRABALHADO');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Inspections
  const [inspections, setInspections] = useState<DepositInspection[]>([]);
  const [currentCategory, setCurrentCategory] = useState<DepositCategory>('B');
  const [depositName, setDepositName] = useState('Pratinho / Vaso de planta');
  const [quantity, setQuantity] = useState(1);
  const [hasWater, setHasWater] = useState(true);
  const [hasLarvae, setHasLarvae] = useState(false);
  const [actionTaken, setActionTaken] = useState<DepositInspection['actionTaken']>('ORIENTADO');
  const [conductNotes, setConductNotes] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sub-tab for ACE bottom menu
  const [activeSubTab, setActiveSubTab] = useState<'home' | 'route' | 'visits' | 'tasks' | 'profile'>('home');

  const properties = db.getProperties();
  const tasks = db.getTasks().filter(t => t.assignedAgentId === currentUser.id || t.assignedAgentName.includes(currentUser.name.split(' ')[0]));
  const myProperties = properties.filter(p => p.responsibleAgentId === currentUser.id || p.neighborhood === 'Vila Nova');

  // Simulated ACE greetings
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Bom dia' : currentHour < 18 ? 'Boa tarde' : 'Boa noite';

  const handleDownloadOffline = () => {
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      setOfflineDownloaded(true);
      setSuccessMessage('Área Vila Nova (Setor 01) e 42 imóveis baixados para trabalho offline.');
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 1200);
  };

  const handleSyncNow = () => {
    const res = db.syncOfflineQueue();
    setOfflineQueue(db.getOfflineQueue());
    setSuccessMessage(`${res.syncedCount} visitas sincronizadas com sucesso com o servidor municipal!`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Start visit
  const handleStartVisit = (property: Property) => {
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
          // Fallback to property coords
          setGpsLocation({ lat: property.latitude, lng: property.longitude });
          setGpsLoading(false);
        },
        { timeout: 4000 }
      );
    } else {
      setGpsLocation({ lat: property.latitude, lng: property.longitude });
      setGpsLoading(false);
    }
  };

  const handleAddDeposit = () => {
    const isFoci = hasLarvae;
    const newInsp: DepositInspection = {
      category: currentCategory,
      name: depositName,
      quantity,
      hasWater,
      hasLarvae,
      isFoci,
      actionTaken: hasLarvae ? 'TRATADO' : actionTaken,
      larvicideUsed: hasLarvae ? 'Pyriproxyfen 0.5% Granulado' : undefined,
      larvicideQuantityGrams: hasLarvae ? 2 : undefined,
    };
    setInspections([...inspections, newInsp]);
    // reset form
    setQuantity(1);
    setHasLarvae(false);
  };

  const handleRemoveDeposit = (index: number) => {
    setInspections(inspections.filter((_, i) => i !== index));
  };

  const handleFinalizeVisit = () => {
    if (!selectedProperty) return;
    setIsFinishing(true);

    const fociFound = inspections.some(i => i.isFoci || i.hasLarvae);
    const fociEliminated = fociFound;

    const visitData: Omit<Visit, 'id' | 'createdAt'> = {
      municipalityId: 'mun-santacruz-01',
      cycleId: 'cycle-2026-01',
      propertyId: selectedProperty.id,
      propertyCode: selectedProperty.code,
      propertyAddress: `${selectedProperty.address}, ${selectedProperty.number}`,
      propertyType: selectedProperty.type,
      neighborhood: selectedProperty.neighborhood,
      agentId: currentUser.id,
      agentName: currentUser.name,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      situation: visitSituation,
      latitude: gpsLocation?.lat || selectedProperty.latitude,
      longitude: gpsLocation?.lng || selectedProperty.longitude,
      inspections,
      totalDepositsInspected: inspections.reduce((acc, i) => acc + i.quantity, 0),
      fociFound,
      fociEliminated,
      conduct: conductNotes || (fociFound ? 'Eliminação física e tratamento com larvicida. Morador orientado.' : 'Inspeção concluída sem focos.'),
      syncStatus: isOnline ? 'SYNCED' : 'PENDING',
    };

    // Register visit in storage (auto queues if offline)
    db.registerVisit(visitData, !isOnline);
    setOfflineQueue(db.getOfflineQueue());

    setIsFinishing(false);
    setSelectedProperty(null);
    setSuccessMessage(`Visita ao imóvel ${selectedProperty.code} finalizada com sucesso!`);
    setTimeout(() => setSuccessMessage(null), 4000);
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
      {/* PWA Mobile Header Badge */}
      <div className="bg-gradient-to-r from-blue-900 to-sky-900 text-white p-5 rounded-2xl shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-sky-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-sky-300">PWA Campo ACE</span>
          </div>

          {/* Sync status pill */}
          {offlineQueue.length === 0 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Sincronizado</span>
            </div>
          ) : (
            <button
              onClick={handleSyncNow}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-bold shadow animate-pulse hover:bg-amber-400"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{offlineQueue.length} aguardando sync</span>
            </button>
          )}
        </div>

        <div>
          <h1 className="text-xl font-extrabold">
            {greeting}, {currentUser.name.split(' ')[0]}! 👋
          </h1>
          <p className="text-xs text-sky-200 mt-0.5">
            Matrícula: {currentUser.registrationNumber || 'ACE-4821'} • Setor 01 (Vila Nova)
          </p>
        </div>

        {/* Offline Area Downloader */}
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

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-emerald-600 text-white p-3 rounded-xl shadow text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Primary Action Button: "Minha Rota de Hoje" */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Roteiro Prioritário de Hoje</h2>
            <p className="text-xs text-slate-500">Ordenado por gravidade de risco e proximidade</p>
          </div>
          <button
            onClick={() => onNavigate('routes')}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            <span>Ver no Mapa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Route Cards */}
        <div className="space-y-2">
          {myProperties.slice(0, 4).map((prop, idx) => {
            const isFoci = prop.status === 'FOCO';
            const isRecurrent = prop.isRecurrent;
            const isClosed = prop.status === 'FECHADO';

            return (
              <div
                key={prop.id}
                className={`p-3.5 rounded-xl border transition flex items-center justify-between ${
                  isFoci
                    ? 'border-rose-300 bg-rose-50/40'
                    : isRecurrent
                    ? 'border-purple-300 bg-purple-50/40'
                    : 'border-slate-200 bg-slate-50/70 hover:bg-white'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900 text-xs">{prop.address}, {prop.number}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="font-mono text-slate-600 font-semibold">{prop.code}</span>
                    <span>•</span>
                    <span className="text-slate-600">{prop.block}</span>
                    {isFoci && (
                      <span className="px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-700">
                        Foco Ativo
                      </span>
                    )}
                    {isRecurrent && (
                      <span className="px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-700">
                        Reincidente
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
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95 flex items-center gap-1"
                >
                  <span>Visitar</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ACE Daily Tasks Summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Meta Hoje</p>
          <p className="text-xl font-extrabold text-blue-700">25</p>
          <span className="text-[10px] text-slate-400">imóveis</span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Realizadas</p>
          <p className="text-xl font-extrabold text-emerald-700">14</p>
          <span className="text-[10px] text-emerald-700 font-medium">56% feito</span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Focos</p>
          <p className="text-xl font-extrabold text-rose-700">2</p>
          <span className="text-[10px] text-rose-700 font-medium">eliminados</span>
        </div>
      </div>

      {/* Active Visit Modal (Prompt 08 - Visita Domiciliar Digital) */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded">
                  Inspeção Domiciliar Digital
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedProperty.address}, {selectedProperty.number}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedProperty.code} • {selectedProperty.neighborhood} • {selectedProperty.block}
                </p>
              </div>
              <button
                onClick={() => setSelectedProperty(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* GPS confirmation */}
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

            {/* Situação do Imóvel */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Situação da Visita:
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {(['TRABALHADO', 'FECHADO', 'RECUSA', 'DESOCUPADO', 'TERRENO'] as VisitSituation[]).map(sit => (
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

            {/* If Trabalhado: Inspeção de Depósitos A1 - E */}
            {visitSituation === 'TRABALHADO' && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Inspeção de Criadouros (Padrão MS)
                  </h4>
                  <span className="text-[10px] text-slate-500">Categorias A1 a E</span>
                </div>

                {/* Category selector */}
                <div className="flex overflow-x-auto gap-1 pb-1">
                  {(['A1', 'A2', 'B', 'C', 'D1', 'D2', 'E'] as DepositCategory[]).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setCurrentCategory(cat);
                        setDepositName(depositPresets[cat][0] || 'Depósito');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex-shrink-0 transition ${
                        currentCategory === cat
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Deposit inputs */}
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

                  {/* Toggles: Água & Larvas */}
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

                  {/* Add to list button */}
                  <button
                    type="button"
                    onClick={handleAddDeposit}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Depósito Inspecionado</span>
                  </button>
                </div>

                {/* List of Added Deposits */}
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

            {/* Condutas & Observações */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Conduta Realizada / Observação Sanitária:
              </label>
              <textarea
                value={conductNotes}
                onChange={e => setConductNotes(e.target.value)}
                placeholder="Ex: Depósito eliminado com descarte em saco plástico. Caixa d'água vedada. Morador orientado."
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 outline-none"
                rows={2}
              />
            </div>

            {/* Finalize Button */}
            <button
              onClick={handleFinalizeVisit}
              disabled={isFinishing}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md transition active:scale-95 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              <span>FINALIZAR VISITA</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
