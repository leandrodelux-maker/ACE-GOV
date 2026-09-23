import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  CheckCircle,
  AlertTriangle,
  Clock,
  Car,
  Tablet,
  Search,
  Filter,
  ArrowRightLeft,
  Calendar,
  History,
  QrCode,
  Shield,
  Eye,
  Check,
} from 'lucide-react';
import {
  equipmentService,
  EquipmentItem,
  EquipmentCategory,
  EquipmentStatus,
  EquipmentAlert,
  MovementType,
  MaintenanceType,
} from '../../services/equipmentService';
import { qrCodeService } from '../../services/qrCodeService';
import { supabase } from '../../services/supabaseClient';
import { PageHeader } from '../ui';

interface EquipmentViewProps {
  municipalityId: string;
}

export const EquipmentView: React.FC<EquipmentViewProps> = ({ municipalityId }) => {
  const [equipments, setEquipments] = useState<EquipmentItem[]>([]);
  const [alerts, setAlerts] = useState<EquipmentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filterCategory, setFilterCategory] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEq, setSelectedEq] = useState<EquipmentItem | null>(null);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<{ movements: any[]; maintenance: any[] }>({
    movements: [],
    maintenance: [],
  });
  const [isQrOpen, setIsQrOpen] = useState(false);

  // Form states para novo equipamento
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<EquipmentCategory>('bomba_costal');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formSerial, setFormSerial] = useState('');
  const [formCode, setFormCode] = useState('');

  // Form states para movimentação
  const [movType, setMovType] = useState<MovementType>('entrega');
  const [movNotes, setMovNotes] = useState('');

  // Form states para manutenção
  const [maintType, setMaintType] = useState<MaintenanceType>('preventiva');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintProvider, setMaintProvider] = useState('');
  const [maintCost, setMaintCost] = useState<number>(0);
  const [maintNextDate, setMaintNextDate] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [items, alertsList] = await Promise.all([
        equipmentService.getEquipments(municipalityId, {
          category: filterCategory,
          status: filterStatus,
          search: searchTerm,
        }),
        equipmentService.getEquipmentAlerts(municipalityId),
      ]);
      setEquipments(items);
      setAlerts(alertsList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [municipalityId, filterCategory, filterStatus]);

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await equipmentService.saveEquipment(
      {
        name: formName,
        category: formCategory,
        brand: formBrand,
        model: formModel,
        serialNumber: formSerial,
        code: formCode || undefined,
      },
      municipalityId
    );

    if (res.success) {
      setIsCreateOpen(false);
      setFormName('');
      setFormBrand('');
      setFormModel('');
      setFormSerial('');
      setFormCode('');
      loadData();
    } else {
      alert(`Erro: ${res.error}`);
    }
  };

  const handleRegisterMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEq) return;

    const res = await equipmentService.registerMovement({
      equipmentId: selectedEq.id,
      movementType: movType,
      notes: movNotes,
      registeredBy: 'Supervisor Operacional',
    });

    if (res.success) {
      setIsMovementOpen(false);
      setMovNotes('');
      loadData();
    } else {
      alert(`Erro: ${res.error}`);
    }
  };

  const handleRegisterMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEq) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const res = await equipmentService.recordMaintenance({
      equipmentId: selectedEq.id,
      maintenanceType: maintType,
      description: maintDesc,
      provider: maintProvider,
      cost: maintCost,
      sentAt: todayStr,
      nextMaintenance: maintNextDate || undefined,
      status: 'em_manutencao',
    });

    if (res.success) {
      setIsMaintenanceOpen(false);
      setMaintDesc('');
      setMaintProvider('');
      loadData();
    } else {
      alert(`Erro: ${res.error}`);
    }
  };

  const openHistory = async (eq: EquipmentItem) => {
    setSelectedEq(eq);
    const data = await equipmentService.getEquipmentHistory(eq.id);
    setHistoryData(data);
    setIsHistoryOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        icon={Wrench}
        title="Gestão Operacional de Equipamentos"
        subtitle="Termonebulizadores costais, bombas aspersoras, microscópios, tablets e frotas de apoio com QR Code e cautelas"
        actions={
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Equipamento
          </button>
        }
      />

      {/* Alertas Operacionais de Manutenção */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Alertas de Manutenção e Equipamentos ({alerts.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map(al => (
              <div
                key={al.id}
                className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-amber-200 dark:border-amber-800/60 text-xs shadow-2xs flex items-start gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {al.equipmentCode} • {al.equipmentName}
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">{al.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros e Busca */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, código, número de série..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Filter className="w-4 h-4" />
            <span>Filtros:</span>
          </div>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            <option value="todos">Todas as Categorias</option>
            <option value="bomba_costal">Bomba Costal</option>
            <option value="nebulizador">Nebulizador UBV</option>
            <option value="pulverizador">Pulverizador</option>
            <option value="tablet">Tablet</option>
            <option value="smartphone">Smartphone</option>
            <option value="GPS">GPS</option>
            <option value="microscopio">Microscópio</option>
            <option value="armadilha">Armadilha</option>
            <option value="veiculo_operacional">Veículo Operacional</option>
            <option value="EPI">EPI</option>
            <option value="outros">Outros</option>
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            <option value="todos">Todos os Status</option>
            <option value="disponivel">Disponível</option>
            <option value="em_uso">Em Uso / Cautela</option>
            <option value="manutencao">Em Manutenção</option>
            <option value="danificado">Danificado</option>
            <option value="baixado">Baixado</option>
          </select>
        </div>
      </div>

      {/* Grid de Equipamentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-sm text-slate-500">
            Carregando inventário de equipamentos...
          </div>
        ) : equipments.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-sm text-slate-500">
            Nenhum equipamento encontrado com os filtros selecionados.
          </div>
        ) : (
          equipments.map(eq => {
            const isAvailable = eq.status === 'disponivel';
            const inMaintenance = eq.status === 'manutencao';
            const isDamaged = eq.status === 'danificado';

            return (
              <div
                key={eq.id}
                className={`bg-white dark:bg-slate-800 rounded-xl border p-5 shadow-sm space-y-3 transition-colors ${
                  inMaintenance
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50/10'
                    : isDamaged
                    ? 'border-rose-300 dark:border-rose-700'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                      {eq.code}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{eq.name}</h3>
                    <p className="text-xs text-slate-500 capitalize">
                      {eq.category.replace('_', ' ')} {eq.brand ? `• ${eq.brand}` : ''} {eq.serialNumber ? `• S/N: ${eq.serialNumber}` : ''}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded capitalize ${
                      isAvailable
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : inMaintenance
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        : isDamaged
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                    }`}
                  >
                    {eq.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg text-xs space-y-1.5 border border-slate-100 dark:border-slate-700/50">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Última Revisão:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {eq.lastMaintenance ? new Date(eq.lastMaintenance).toLocaleDateString('pt-BR') : 'Em dia'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Próxima Manutenção:</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {eq.nextMaintenance ? new Date(eq.nextMaintenance).toLocaleDateString('pt-BR') : 'Não agendada'}
                    </span>
                  </div>
                  {eq.assignedToAgentName && (
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500">Cautelado com:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{eq.assignedToAgentName}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSelectedEq(eq);
                        setIsQrOpen(true);
                      }}
                      title="Ver QR Code do Equipamento"
                      className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openHistory(eq)}
                      title="Ver Histórico de Movimentações"
                      className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedEq(eq);
                        setIsMovementOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded transition-colors"
                    >
                      Transferir
                    </button>
                    <button
                      onClick={() => {
                        setSelectedEq(eq);
                        setIsMaintenanceOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                    >
                      Manutenção
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Novo Equipamento */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-600" />
              Cadastrar Novo Equipamento
            </h3>

            <form onSubmit={handleSaveEquipment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Ativo / Equipamento
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Bomba Costal Motorizada Stihl SR 420"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as EquipmentCategory)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="bomba_costal">Bomba Costal</option>
                    <option value="nebulizador">Nebulizador UBV</option>
                    <option value="pulverizador">Pulverizador</option>
                    <option value="tablet">Tablet</option>
                    <option value="smartphone">Smartphone</option>
                    <option value="GPS">GPS</option>
                    <option value="microscopio">Microscópio</option>
                    <option value="armadilha">Armadilha</option>
                    <option value="veiculo_operacional">Veículo Operacional</option>
                    <option value="EPI">EPI</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Código de Patrimônio (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-gerado se vazio"
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Marca / Fabricante
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Stihl, Guarany, Samsung"
                    value={formBrand}
                    onChange={e => setFormBrand(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Número de Série
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: SN-9872124"
                    value={formSerial}
                    onChange={e => setFormSerial(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Salvar Equipamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transferência / Cautela */}
      {isMovementOpen && selectedEq && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
              Transferência / Cautela ({selectedEq.code})
            </h3>
            <p className="text-xs text-slate-500 mb-4">{selectedEq.name}</p>

            <form onSubmit={handleRegisterMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Movimentação
                </label>
                <select
                  value={movType}
                  onChange={e => setMovType(e.target.value as MovementType)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                >
                  <option value="entrega">Entrega / Cautela com ACE</option>
                  <option value="devolucao">Devolução ao Almoxarifado</option>
                  <option value="transferencia">Transferência entre Agentes</option>
                  <option value="manutencao">Envio para Manutenção</option>
                  <option value="baixa">Baixa de Patrimônio</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Observações e Termo de Responsabilidade
                </label>
                <textarea
                  value={movNotes}
                  onChange={e => setMovNotes(e.target.value)}
                  rows={3}
                  placeholder="Ex: Cautelado em perfeitas condições de uso para o Ciclo 01..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsMovementOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Confirmar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manutenção */}
      {isMaintenanceOpen && selectedEq && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-600" />
              Agendar / Registrar Manutenção ({selectedEq.code})
            </h3>
            <p className="text-xs text-slate-500 mb-4">{selectedEq.name}</p>

            <form onSubmit={handleRegisterMaintenance} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Manutenção
                </label>
                <select
                  value={maintType}
                  onChange={e => setMaintType(e.target.value as MaintenanceType)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                >
                  <option value="preventiva">Preventiva Periódica</option>
                  <option value="corretiva">Corretiva / Reparo</option>
                  <option value="calibracao">Calibração de Vazão / Bicos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Descrição do Serviço Necessário
                </label>
                <textarea
                  value={maintDesc}
                  required
                  onChange={e => setMaintDesc(e.target.value)}
                  rows={3}
                  placeholder="Ex: Limpeza de carburador, troca de vedação e calibração de bicos aspersores..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Oficina / Prestador
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Mecânica Autorizada SUS"
                    value={maintProvider}
                    onChange={e => setMaintProvider(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Próxima Revisão Prevista
                  </label>
                  <input
                    type="date"
                    value={maintNextDate}
                    onChange={e => setMaintNextDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsMaintenanceOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Registrar Ordem de Manutenção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: QR Code do Equipamento */}
      {isQrOpen && selectedEq && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl text-center">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              {selectedEq.name}
            </h3>
            <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {selectedEq.code}
            </span>

            <div className="my-4 flex justify-center">
              <img
                src={qrCodeService.getQrCodeImageUrl(
                  qrCodeService.generateQrUrl('equipment', selectedEq.id, selectedEq.code),
                  180
                )}
                alt="QR Code Equipamento"
                className="border p-2 rounded bg-white"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Etiqueta de identificação de patrimônio conforme padrão institucional Endemias GOV.
            </p>

            <button
              onClick={() => setIsQrOpen(false)}
              className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg text-xs font-semibold"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal: Histórico de Movimentações e Manutenções */}
      {isHistoryOpen && selectedEq && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  Histórico do Ativo: {selectedEq.code}
                </h3>
                <p className="text-xs text-slate-500">{selectedEq.name}</p>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Transferências e Cautelas
              </h4>
              {historyData.movements.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhuma movimentação registrada.</p>
              ) : (
                <div className="space-y-2">
                  {historyData.movements.map((mov: any) => (
                    <div
                      key={mov.id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <div className="flex justify-between font-semibold">
                        <span className="capitalize text-indigo-600">{mov.movement_type}</span>
                        <span className="text-slate-400">
                          {new Date(mov.date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      {mov.notes && <p className="text-slate-600 dark:text-slate-300 mt-1">{mov.notes}</p>}
                    </div>
                  ))}
                </div>
              )}

              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider pt-2 border-t border-slate-200 dark:border-slate-700">
                Manutenções
              </h4>
              {historyData.maintenance.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhum reparo ou revisão registrado.</p>
              ) : (
                <div className="space-y-2">
                  {historyData.maintenance.map((m: any) => (
                    <div
                      key={m.id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <div className="flex justify-between font-semibold">
                        <span className="capitalize text-amber-600">{m.maintenance_type}</span>
                        <span className="text-slate-400">
                          {new Date(m.sent_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5">{m.description}</p>
                      {m.provider && <p className="text-slate-500 mt-0.5">Oficina: {m.provider}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg text-xs font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
