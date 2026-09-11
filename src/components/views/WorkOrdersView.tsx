import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  UserCheck,
  Building,
  Calendar,
  Layers,
  Sparkles,
  Check,
  X,
  FileCheck,
  Send,
  Eye,
} from 'lucide-react';
import {
  workOrderService,
  WorkOrderItem,
  WorkOrderType,
  WorkOrderPriority,
  WorkOrderStatus,
} from '../../services/workOrderService';
import { PageHeader } from '../ui';

interface WorkOrdersViewProps {
  municipalityId?: string;
}

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({ municipalityId }) => {
  const [orders, setOrders] = useState<WorkOrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterType, setFilterType] = useState('todos');
  const [filterPriority, setFilterPriority] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAutoGenerateOpen, setIsAutoGenerateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrderItem | null>(null);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Form states para criação
  const [formType, setFormType] = useState<WorkOrderType>('vistoria');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<WorkOrderPriority>('normal');
  const [formPlannedDate, setFormPlannedDate] = useState(new Date().toISOString().split('T')[0]);

  // Form states para conclusão
  const [completionResult, setCompletionResult] = useState('Serviço Concluído com Êxito');
  const [completionNotes, setCompletionNotes] = useState('');
  const [actionsDone, setActionsDone] = useState<string[]>([
    'Vistoria peridomiciliar',
    'Eliminação mecânica de depósitos',
  ]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await workOrderService.getWorkOrders(municipalityId, {
        status: filterStatus,
        type: filterType,
        priority: filterPriority,
        search: searchTerm,
      });
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [municipalityId, filterStatus, filterType, filterPriority]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await workOrderService.createWorkOrder({
      municipalityId,
      type: formType,
      title: formTitle,
      description: formDescription,
      priority: formPriority,
      plannedDate: formPlannedDate,
    });

    if (res.success) {
      setIsCreateOpen(false);
      setFormTitle('');
      setFormDescription('');
      loadOrders();
    } else {
      alert(`Erro: ${res.error}`);
    }
  };

  const handleAutoGenerate = async (
    source: 'denuncia' | 'foco' | 'caso_sinan' | 'reincidencia' | 'pe_vencido' | 'alerta',
    title: string,
    desc: string,
    priority: WorkOrderPriority = 'alta'
  ) => {
    const res = await workOrderService.createAutoOrderFromTrigger({
      source,
      sourceId: `trig-${Date.now()}`,
      title,
      description: desc,
      priority,
      municipalityId,
    });

    if (res.success) {
      setIsAutoGenerateOpen(false);
      loadOrders();
      alert(`Ordem de Serviço ${res.orderNumber} gerada com sucesso!`);
    } else {
      alert('Falha ao gerar OS automática.');
    }
  };

  const handleCompleteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const res = await workOrderService.completeWorkOrder({
      orderId: selectedOrder.id,
      completionResult,
      completionNotes,
      actionsExecuted: actionsDone,
    });

    if (res.success) {
      setIsCompleteOpen(false);
      setCompletionNotes('');
      loadOrders();
    } else {
      alert(`Erro: ${res.error}`);
    }
  };

  const priorityBadge = (priority: WorkOrderPriority) => {
    switch (priority) {
      case 'critica':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">Crítica</span>;
      case 'urgente':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300">Urgente</span>;
      case 'alta':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">Alta</span>;
      case 'normal':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">Normal</span>;
      case 'baixa':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Baixa</span>;
    }
  };

  const statusBadge = (status: WorkOrderStatus) => {
    switch (status) {
      case 'aberta':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Aberta</span>;
      case 'atribuida':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">Atribuída</span>;
      case 'em_execucao':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300">Em Execução</span>;
      case 'concluida':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">Concluída</span>;
      case 'cancelada':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">Cancelada</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={ClipboardList}
        title="Ordens de Serviço Operacionais (OS)"
        subtitle="Expedição, despacho automático por gatilhos, execução em campo e comprovação técnica"
        actions={
          <>
            <button
              onClick={() => setIsAutoGenerateOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Gerar OS Automática
            </button>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nova OS Manual
            </button>
          </>
        }
      />

      {/* Filtros e Busca */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número, título, bairro..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Filter className="w-4 h-4" />
            <span>Filtros:</span>
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            <option value="todos">Todos os Status</option>
            <option value="aberta">Aberta</option>
            <option value="atribuida">Atribuída</option>
            <option value="em_execucao">Em Execução</option>
            <option value="concluida">Concluída</option>
          </select>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="vistoria">Vistoria</option>
            <option value="bloqueio">Bloqueio</option>
            <option value="denuncia">Denúncia</option>
            <option value="ponto_estrategico">Ponto Estratégico</option>
            <option value="imovel_especial">Imóvel Especial</option>
            <option value="reincidencia">Reincidência</option>
            <option value="controle_vetorial">Controle Vetorial</option>
          </select>

          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            <option value="todos">Todas as Prioridades</option>
            <option value="critica">Crítica</option>
            <option value="urgente">Urgente</option>
            <option value="alta">Alta</option>
            <option value="normal">Normal</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      </div>

      {/* Tabela de Ordens de Serviço */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Número</th>
                <th className="py-3 px-4">Tipo & Título</th>
                <th className="py-3 px-4">Prioridade</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Responsável Designado</th>
                <th className="py-3 px-4">Data Planejada</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Carregando ordens de serviço...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhuma ordem de serviço encontrada.
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {order.number}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {order.title}
                        </span>
                        <div className="text-xs text-slate-500 capitalize">
                          Tipo: {order.type.replace('_', ' ')} {order.neighborhoodName ? `• Bairro: ${order.neighborhoodName}` : ''}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">{priorityBadge(order.priority)}</td>
                    <td className="py-3 px-4">{statusBadge(order.status)}</td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {order.assignedAgentName || order.assignedTeamName || (
                        <span className="text-slate-400 italic">Aguardando atribuição</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                      {order.plannedDate ? new Date(order.plannedDate).toLocaleDateString('pt-BR') : 'Hoje'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsDetailsOpen(true);
                          }}
                          title="Visualizar Detalhes"
                          className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {order.status !== 'concluida' && order.status !== 'cancelada' && (
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsCompleteOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                          >
                            Concluir OS
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Gerar OS Automática a partir de Gatilhos */}
      {isAutoGenerateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Geração Automática de Ordem de Serviço
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Selecione o gatilho operacional para despachar uma OS prioritária de campo:
            </p>

            <div className="space-y-3">
              {[
                {
                  source: 'caso_sinan' as const,
                  title: 'Bloqueio Imediato: Caso Suspeito de Dengue com Sinal de Alarme',
                  desc: 'Paciente residente na Rua das Flores, 420. Requer bloqueio perifocal em raio de 150m.',
                  priority: 'critica' as const,
                  label: 'Caso Epidemiológico SINAN',
                },
                {
                  source: 'denuncia' as const,
                  title: 'Atendimento à Denúncia: Piscina Abandonada com Larvas',
                  desc: 'Protocolo de Ouvidoria #842. Terreno baldio ao lado do Colégio São Pedro.',
                  priority: 'urgente' as const,
                  label: 'Denúncia de Cidadão',
                },
                {
                  source: 'foco' as const,
                  title: 'Controle Vetorial: Foco Positivo de Aedes Confirmado',
                  desc: 'Laudo entomológico ENT-2026-000001 confirmou Aedes aegypti. Tratamento focal com larvicida.',
                  priority: 'alta' as const,
                  label: 'Foco Ativo Confirmado',
                },
                {
                  source: 'reincidencia' as const,
                  title: 'Reincidência de Criadouros em Imóvel Comercial',
                  desc: 'Imóvel com 3 ciclos consecutivos de focos de pernilongo/Aedes. Notificação e termo sanitário.',
                  priority: 'alta' as const,
                  label: 'Imóvel Reincidente',
                },
                {
                  source: 'pe_vencido' as const,
                  title: 'Inspeção em Ponto Estratégico com Prazo Vencido',
                  desc: 'Ferro-velho Central sem inspeção quinzenal há 18 dias.',
                  priority: 'alta' as const,
                  label: 'Ponto Estratégico (PE) Vencido',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-start gap-3"
                >
                  <div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {item.label}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>

                  <button
                    onClick={() =>
                      handleAutoGenerate(item.source, item.title, item.desc, item.priority)
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded shrink-0"
                  >
                    Gerar OS
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={() => setIsAutoGenerateOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova OS Manual */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Criar Nova Ordem de Serviço Manual
            </h3>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Título da OS
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Vistoria Especial pós-chuva no Bairro São José"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tipo
                  </label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as WorkOrderType)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="vistoria">Vistoria</option>
                    <option value="bloqueio">Bloqueio</option>
                    <option value="denuncia">Denúncia</option>
                    <option value="ponto_estrategico">Ponto Estratégico</option>
                    <option value="imovel_especial">Imóvel Especial</option>
                    <option value="reincidencia">Reincidência</option>
                    <option value="controle_vetorial">Controle Vetorial</option>
                    <option value="levantamento">Levantamento</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Prioridade
                  </label>
                  <select
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value as WorkOrderPriority)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Descrição / Instruções da Ação
                </label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  rows={3}
                  placeholder="Descreva as instruções operacionais para o ACE ou equipe de campo..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Data Planejada
                </label>
                <input
                  type="date"
                  value={formPlannedDate}
                  onChange={e => setFormPlannedDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Expedir Ordem de Serviço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Conclusão de OS */}
      {isCompleteOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Conclusão da Ordem de Serviço: {selectedOrder.number}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{selectedOrder.title}</p>

            <form onSubmit={handleCompleteOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Resultado Oficial da Intervenção
                </label>
                <input
                  type="text"
                  required
                  value={completionResult}
                  onChange={e => setCompletionResult(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Observações Técnicas de Campo
                </label>
                <textarea
                  value={completionNotes}
                  onChange={e => setCompletionNotes(e.target.value)}
                  rows={3}
                  placeholder="Ex: Todos os 12 imóveis do quarteirão foram tratados. Criadouros eliminados com larvicida biológico..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCompleteOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Confirmar e Concluir OS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detalhes da OS */}
      {isDetailsOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {selectedOrder.number}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedOrder.title}
                </h3>
              </div>
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-lg text-xs space-y-2 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Tipo:</span>
                <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                  {selectedOrder.type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Prioridade:</span>
                <span>{priorityBadge(selectedOrder.priority)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span>{statusBadge(selectedOrder.status)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Responsável:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedOrder.assignedAgentName || selectedOrder.assignedTeamName || 'Não atribuído'}
                </span>
              </div>
              {selectedOrder.description && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 block mb-1">Descrição:</span>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line">
                    {selectedOrder.description}
                  </p>
                </div>
              )}
              {selectedOrder.completionResult && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 block mb-1">Resultado de Conclusão:</span>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {selectedOrder.completionResult}
                  </p>
                  {selectedOrder.completionNotes && (
                    <p className="text-slate-600 dark:text-slate-300 mt-1">
                      {selectedOrder.completionNotes}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg text-xs font-semibold"
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
