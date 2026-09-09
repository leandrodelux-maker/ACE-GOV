import React, { useState, useEffect } from 'react';
import {
  Flame,
  Activity,
  Calendar,
  Clock,
  MapPin,
  Truck,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Plus,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Navigation,
  Droplets,
  Package,
  Wind
} from 'lucide-react';
import {
  chemicalOperationsService,
  ChemicalOperation,
} from '../../services/chemicalOperationsService';
import { stockService, Product } from '../../services/stockService';

export const ChemicalOperationsView: React.FC = () => {
  const [operations, setOperations] = useState<ChemicalOperation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedOp, setSelectedOp] = useState<ChemicalOperation | null>(null);

  // Formulário de Nova Operação
  const [formData, setFormData] = useState({
    type: 'ubv_costal',
    disease: 'Dengue',
    start_date: new Date().toISOString().split('T')[0],
    start_time: '06:00',
    end_time: '08:30',
    equipment_type: 'ubv_costal',
    operational_conditions: 'Vento calmo (< 6 km/h), temperatura 23°C, umidade 78%',
    batch_id: '',
    product_consumed_liters: 1.5,
    route_distance_km: 4.2,
    execution_time_minutes: 150,
    worked_area_hectares: 12.5,
    target_properties_count: 120,
    worked_properties_count: 98,
    notes: '',
  });

  // Formulário de Conclusão
  const [completionData, setCompletionData] = useState({
    worked_properties_count: 98,
    closed_properties_count: 18,
    refusal_properties_count: 4,
    focus_found_count: 3,
    notes: '',
  });

  // Formulário de Cancelamento
  const [cancelData, setCancelData] = useState<{
    cancellation_reason: 'chuva' | 'vento' | 'equipamento' | 'produto' | 'equipe' | 'outro';
    notes: string;
  }>({
    cancellation_reason: 'chuva',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [ops, prods] = await Promise.all([
        chemicalOperationsService.getOperations(),
        stockService.getProductsWithBatches(),
      ]);

      setOperations(ops);
      setProducts(prods);

      // Pré-selecionar primeiro lote disponível de inseticida/larvicida
      const insecticide = prods.find((p) => p.category === 'inseticida' || p.category === 'larvicida');
      if (insecticide && insecticide.batches && insecticide.batches.length > 0) {
        const availableBatch = insecticide.batches.find((b) => b.current_quantity > 0);
        if (availableBatch) {
          setFormData((prev) => ({ ...prev, batch_id: availableBatch.id }));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar operações químicas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batch_id) {
      alert('Selecione obrigatoriamente um lote válido de produto químico do estoque.');
      return;
    }

    const res = await chemicalOperationsService.createOperation(formData);
    if (res.success) {
      alert(res.message);
      setShowCreateModal(false);
      loadData();
    } else {
      alert(res.message);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOp) return;

    const res = await chemicalOperationsService.completeOperation(selectedOp.id, completionData);
    if (res.success) {
      alert(res.message);
      setShowCompleteModal(false);
      setSelectedOp(null);
      loadData();
    } else {
      alert(res.message);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOp) return;

    const res = await chemicalOperationsService.cancelOperation(selectedOp.id, cancelData);
    if (res.success) {
      alert(res.message);
      setShowCancelModal(false);
      setSelectedOp(null);
      loadData();
    } else {
      alert(res.message);
    }
  };

  // Coleta todos os lotes com saldo positivo para seleção
  const availableBatches = products.flatMap((p) =>
    (p.batches || [])
      .filter((b) => b.current_quantity > 0)
      .map((b) => ({
        ...b,
        productName: p.name,
        unit: p.unit,
        category: p.category,
      }))
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
              CONTROLE VETORIAL
            </span>
            <span className="text-xs text-slate-400">• Operações Químicas & UBV</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Flame className="w-7 h-7 text-cyan-400" />
            Controle Químico e UBV
          </h1>
          <p className="text-sm text-slate-500">
            Planejamento de rotas UBV, tratamento perifocal, controle estrito de lotes e baixa automática de estoque.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium border border-slate-200 flex items-center gap-2 transition shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Atualizar</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Operação Química</span>
          </button>
        </div>
      </div>

      {/* Tabela de Operações */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Operação / Tipo</th>
                <th className="py-3 px-4">Doença / Data</th>
                <th className="py-3 px-4">Equipamento & Condições</th>
                <th className="py-3 px-4">Lote & Consumo</th>
                <th className="py-3 px-4">Rota UBV (Dist/Área)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {operations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhuma operação química registrada até o momento.
                  </td>
                </tr>
              ) : (
                operations.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 text-xs capitalize">
                        {op.type.replace('_', ' ')}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">ID: {op.id.substring(0, 8)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {op.disease}
                      </span>
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(op.start_date).toLocaleDateString('pt-BR')} {op.start_time ? `às ${op.start_time}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-slate-700 capitalize font-medium flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-cyan-400" />
                        {op.equipment_type?.replace('_', ' ') || 'UBV Costal'}
                      </div>
                      {op.operational_conditions && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5" title={op.operational_conditions}>
                          {op.operational_conditions}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-slate-700 font-medium">
                        {op.batch?.product?.name || 'Inseticida'}
                      </div>
                      <div className="text-[11px] text-cyan-400 font-mono">
                        Lote: {op.batch?.batch_number || 'S/N'} • Consumo: {op.product_consumed_liters || 0} L
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono">
                      <div className="text-slate-300">
                        {op.route_distance_km || 0} km • {op.worked_area_hectares || 0} ha
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        {op.execution_time_minutes || 0} min • {op.worked_properties_count || 0} imóveis
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          op.status === 'concluida'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : op.status === 'em_andamento'
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse'
                            : op.status === 'cancelada'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {op.status.replace('_', ' ')}
                      </span>
                      {op.cancellation_reason && (
                        <div className="text-[10px] text-rose-400 mt-0.5">
                          Motivo: {op.cancellation_reason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {op.status === 'em_andamento' && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedOp(op);
                              setShowCompleteModal(true);
                            }}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
                            title="Concluir Operação"
                          >
                            Finalizar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOp(op);
                              setShowCancelModal(true);
                            }}
                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-rose-500 rounded transition"
                            title="Interromper / Cancelar Operação"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Nova Operação Química */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-cyan-400" />
                Registrar Operação Química / UBV
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700 text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Tipo de Operação *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  >
                    <option value="ubv_costal">UBV Costal (Nebulização manual)</option>
                    <option value="ubv_veicular">UBV Veicular / Pesado (Fumacê)</option>
                    <option value="tratamento_focal">Tratamento Focal (Larvicida)</option>
                    <option value="tratamento_perifocal">Tratamento Perifocal (Pontos Estratégicos)</option>
                    <option value="nebulizacao">Nebulização Residual</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-600 block mb-1">Doença Relacionada *</label>
                  <select
                    value={formData.disease}
                    onChange={(e) => setFormData({ ...formData, disease: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  >
                    <option value="Dengue">Dengue</option>
                    <option value="Zika">Zika</option>
                    <option value="Chikungunya">Chikungunya</option>
                    <option value="Febre Amarela">Febre Amarela</option>
                    <option value="Leishmaniose">Leishmaniose</option>
                  </select>
                </div>
              </div>

              {/* Vínculo de Lote Obrigatório (Estoque FEFO) */}
              <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                <label className="text-xs font-semibold text-cyan-800 block mb-1 flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  Lote do Produto Químico no Estoque (Obrigatório) *
                </label>
                <select
                  required
                  value={formData.batch_id}
                  onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-cyan-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  <option value="">Selecione o lote com saldo no estoque...</option>
                  {availableBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.productName} • Lote {b.batch_number} (Saldo: {b.current_quantity} {b.unit}) - Validade: {b.expiration_date}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-cyan-700 mt-1">
                  Não é permitida operação química sem vínculo a lote ativo. Baixa de estoque é automática.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Data da Aplicação *</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Hora Inicial *</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Hora Final *</label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Rota UBV e Consumo */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider block mb-2">
                  Métricas Operacionais da Rota UBV
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">Consumo (Litros) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.product_consumed_liters}
                      onChange={(e) => setFormData({ ...formData, product_consumed_liters: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">Distância (km)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.route_distance_km}
                      onChange={(e) => setFormData({ ...formData, route_distance_km: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">Área (Hectares)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.worked_area_hectares}
                      onChange={(e) => setFormData({ ...formData, worked_area_hectares: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">Imóveis Alvo</label>
                    <input
                      type="number"
                      value={formData.target_properties_count}
                      onChange={(e) => setFormData({ ...formData, target_properties_count: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">Condições Climáticas e Operacionais</label>
                <input
                  type="text"
                  value={formData.operational_conditions}
                  onChange={(e) => setFormData({ ...formData, operational_conditions: e.target.value })}
                  placeholder="Vento, temperatura, umidade, velocidade da viatura..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium shadow-md transition"
                >
                  Iniciar Operação Química
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Concluir Operação */}
      {showCompleteModal && selectedOp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Finalizar Operação Química
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Registro final de cobertura e produtividade para a operação {selectedOp.id.substring(0, 8)}
            </p>

            <form onSubmit={handleCompleteSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Imóveis Trabalhados</label>
                  <input
                    type="number"
                    value={completionData.worked_properties_count}
                    onChange={(e) => setCompletionData({ ...completionData, worked_properties_count: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Imóveis Fechados</label>
                  <input
                    type="number"
                    value={completionData.closed_properties_count}
                    onChange={(e) => setCompletionData({ ...completionData, closed_properties_count: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Recusas</label>
                  <input
                    type="number"
                    value={completionData.refusal_properties_count}
                    onChange={(e) => setCompletionData({ ...completionData, refusal_properties_count: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Focos Eliminados</label>
                  <input
                    type="number"
                    value={completionData.focus_found_count}
                    onChange={(e) => setCompletionData({ ...completionData, focus_found_count: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">Observações Técnicas / Relatório</label>
                <textarea
                  rows={2}
                  value={completionData.notes}
                  onChange={(e) => setCompletionData({ ...completionData, notes: e.target.value })}
                  placeholder="Relato de intercorrências ou observações operacionais..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
                >
                  Concluir Operação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cancelar / Interromper Operação */}
      {showCancelModal && selectedOp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              Interromper / Cancelar Operação
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Registro obrigatório de motivo de cancelamento conforme protocolo do Ministério da Saúde.
            </p>

            <form onSubmit={handleCancelSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Motivo do Cancelamento *</label>
                <select
                  value={cancelData.cancellation_reason}
                  onChange={(e) => setCancelData({ ...cancelData, cancellation_reason: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                >
                  <option value="chuva">Chuva / Precipitação pluvial</option>
                  <option value="vento">Vento excessivo (&gt; 10 km/h) ou inversão térmica</option>
                  <option value="equipamento">Falha mecânica do equipamento / UBV</option>
                  <option value="produto">Inconsistência ou falta de produto / diluente</option>
                  <option value="equipe">Imprevisto operacional da equipe</option>
                  <option value="outro">Outro motivo operacional</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">Justificativa Detalhada</label>
                <textarea
                  rows={3}
                  value={cancelData.notes}
                  onChange={(e) => setCancelData({ ...cancelData, notes: e.target.value })}
                  placeholder="Descreva as circunstâncias que impediram a execução da rota..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium"
                >
                  Confirmar Interrupção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
