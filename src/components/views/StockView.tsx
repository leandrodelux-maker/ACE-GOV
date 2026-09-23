import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Send,
  Calendar,
  Layers,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Tag,
  Boxes,
} from 'lucide-react';
import {
  stockService,
  Product,
  ProductBatch,
  StockMovement,
  StockAlerts,
} from '../../services/stockService';
import { PageHeader, StatCard } from '../ui';
import { useMunicipalityId } from '../../contexts/AuthContext';

export const StockView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [alerts, setAlerts] = useState<StockAlerts | null>(null);
  const [activeTab, setActiveTab] = useState<'PRODUTOS' | 'LOTES' | 'MOVIMENTACOES' | 'ALERTAS'>('PRODUTOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  // Modais
  const [showDispatchModal, setShowDispatchModal] = useState<Product | null>(null);
  const [dispatchQty, setDispatchQty] = useState<number>(1);
  const [dispatchType, setDispatchType] = useState<'saida' | 'perda' | 'vencimento' | 'ajuste'>('saida');
  const [dispatchAgent, setDispatchAgent] = useState('ACE de Campo');
  const [dispatchNotes, setDispatchNotes] = useState('');

  const [showEntryModal, setShowEntryModal] = useState<Product | null>(null);
  const [batchNumber, setBatchNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [entryQty, setEntryQty] = useState<number>(10);
  const [entryNotes, setEntryNotes] = useState('');

  useEffect(() => {
    loadStockData();
  }, []);

  const loadStockData = async () => {
    setLoading(true);
    const [prods, moves] = await Promise.all([
      stockService.getProductsWithBatches(municipalityId),
      stockService.getMovements(municipalityId),
    ]);
    setProducts(prods);
    setMovements(moves);
    setAlerts(stockService.calculateStockAlerts(prods));
    setLoading(false);
  };

  const handleDispatchFEFO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDispatchModal) return;

    const res = await stockService.dispatchProductFEFO({
      municipalityId,
      productId: showDispatchModal.id,
      quantity: dispatchQty,
      movementType: dispatchType,
      notes: `${dispatchAgent ? `Destino: ${dispatchAgent}. ` : ''}${dispatchNotes}`,
    });

    alert(res.message);
    if (res.success) {
      setShowDispatchModal(null);
      setDispatchQty(1);
      setDispatchNotes('');
      loadStockData();
    }
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEntryModal) return;

    const res = await stockService.addBatchEntry({
      municipalityId,
      productId: showEntryModal.id,
      batchNumber,
      expirationDate,
      quantity: entryQty,
      notes: entryNotes,
    });

    alert(res.message);
    if (res.success) {
      setShowEntryModal(null);
      setBatchNumber('');
      setExpirationDate('');
      setEntryQty(10);
      setEntryNotes('');
      loadStockData();
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.active_ingredient || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        icon={Boxes}
        title="Estoque Operacional, Insumos & Critério FEFO"
        subtitle="Controle automatizado de lotes sanitários, validade, distribuição para ACEs e bloqueio de saldo negativo"
        badge={{ label: 'FIRST EXPIRE, FIRST OUT', tone: 'success' }}
        actions={
          <button
            onClick={() => setActiveTab('ALERTAS')}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold flex items-center gap-1.5 transition text-xs"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{(alerts?.lowStockCount || 0) + (alerts?.nearExpirationCount || 0)} Alertas Ativos</span>
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard tone="neutral" label="Catálogo de Produtos" value={products.length} caption="Larvicidas, inseticidas e EPIs" />
        <StatCard tone="warning" label="Estoque Crítico / Baixo" value={alerts?.lowStockCount || 0} caption="Abaixo da cota de segurança" />
        <StatCard tone="warning" label="Próximos do Vencimento" value={alerts?.nearExpirationCount || 0} caption="Vencem em ≤ 60 dias (Prioridade FEFO)" />
        <StatCard tone="danger" label="Lotes Vencidos" value={alerts?.expiredCount || 0} caption="Aguardando descarte sanitário" />
      </div>

      {/* Tabs Menu */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('PRODUTOS')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeTab === 'PRODUTOS' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Produtos & Saldo ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('LOTES')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeTab === 'LOTES' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Lotes & Validades (FEFO)
          </button>
          <button
            onClick={() => setActiveTab('MOVIMENTACOES')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeTab === 'MOVIMENTACOES' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Histórico de Movimentações ({movements.length})
          </button>
          <button
            onClick={() => setActiveTab('ALERTAS')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeTab === 'ALERTAS' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Central de Alertas ({alerts?.alertsList.length || 0})
          </button>
        </div>

        {/* Busca e Filtro de Categoria */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="p-1.5 px-3 rounded-lg border border-slate-300 text-xs w-44"
          />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 bg-white"
          >
            <option value="ALL">Todas Categorias</option>
            <option value="larvicida">Larvicidas</option>
            <option value="inseticida">Inseticidas</option>
            <option value="EPI">EPIs</option>
            <option value="material_de_campo">Material de Campo</option>
          </select>
        </div>
      </div>

      {/* TAB 1: PRODUTOS */}
      {activeTab === 'PRODUTOS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(prod => {
            const isLow = (prod.total_stock || 0) <= prod.minimum_stock;
            const isZero = (prod.total_stock || 0) === 0;

            return (
              <div
                key={prod.id}
                className={`bg-white rounded-xl border p-5 shadow-xs space-y-3 transition ${
                  isZero
                    ? 'border-rose-300 bg-rose-50/10'
                    : isLow
                    ? 'border-amber-300 bg-amber-50/10'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                      {prod.category}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">{prod.name}</h3>
                    <p className="text-[11px] text-slate-500">Princípio: {prod.active_ingredient || '—'}</p>
                  </div>

                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                    isZero
                      ? 'bg-rose-100 text-rose-800'
                      : isLow
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {isZero ? 'ESGOTADO' : isLow ? 'ESTOQUE BAIXO' : 'REGULAR'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Saldo Total Disponível:</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {prod.total_stock || 0} {prod.unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Estoque Mínimo:</span>
                    <span className="text-slate-600 font-semibold">{prod.minimum_stock} {prod.unit}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Lotes Ativos:</span>
                    <span className="text-blue-700 font-bold">{prod.batches?.length || 0} lote(s)</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setShowEntryModal(prod)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Nova Entrada</span>
                  </button>

                  <button
                    onClick={() => setShowDispatchModal(prod)}
                    disabled={(prod.total_stock || 0) <= 0}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition flex items-center gap-1 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Saída FEFO</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: LOTES & VALIDADES (FEFO) */}
      {activeTab === 'LOTES' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Ordem de Despacho Sanitário por Validade (Critério FEFO)</span>
            </h3>
            <span className="text-xs text-slate-500">Lotes que vencem antes são consumidos com prioridade</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Produto</th>
                  <th className="py-2.5 px-3">Lote</th>
                  <th className="py-2.5 px-3">Validade</th>
                  <th className="py-2.5 px-3">Prazo</th>
                  <th className="py-2.5 px-3">Saldo Disponível</th>
                  <th className="py-2.5 px-3">Status Sanitário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {products.flatMap(p => (p.batches || []).map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900">{p.name}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-700">{b.batch_number}</td>
                    <td className="py-2.5 px-3">{b.expiration_date}</td>
                    <td className="py-2.5 px-3 font-semibold">
                      {b.is_expired ? (
                        <span className="text-rose-600 font-bold">VENCIDO</span>
                      ) : (
                        <span className={b.is_near_expiration ? 'text-amber-600 font-bold' : 'text-slate-700'}>
                          {b.days_to_expiration} dias
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {b.current_quantity} {p.unit}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        b.is_expired
                          ? 'bg-rose-100 text-rose-800'
                          : b.is_near_expiration
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {b.is_expired ? 'VENCIDO' : b.is_near_expiration ? 'VENCIMENTO PRÓXIMO' : 'APTO PARA USO'}
                      </span>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MOVIMENTAÇÕES */}
      {activeTab === 'MOVIMENTACOES' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
            <span>Trilha Cronológica de Movimentações de Estoque</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Data/Hora</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Produto</th>
                  <th className="py-2.5 px-3">Lote</th>
                  <th className="py-2.5 px-3">Quantidade</th>
                  <th className="py-2.5 px-3">Justificativa / Destino</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.movement_type === 'entrada'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.movement_type === 'saida'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {m.movement_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900">{m.product?.name || 'Insumo'}</td>
                    <td className="py-2.5 px-3 text-slate-700">{m.batch?.batch_number || '—'}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {m.movement_type === 'saida' ? `-${m.quantity}` : `+${m.quantity}`} {m.product?.unit}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 max-w-xs truncate">{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ALERTAS */}
      {activeTab === 'ALERTAS' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Alertas de Estoque e Validades Críticas</span>
          </h3>

          <div className="space-y-3">
            {(alerts?.alertsList || []).map((alt, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                  alt.severity === 'danger'
                    ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                    : 'bg-amber-50/60 border-amber-200 text-amber-900'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 shrink-0 ${alt.severity === 'danger' ? 'text-rose-600' : 'text-amber-600'}`} />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm">{alt.productName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-white/70">
                      {alt.type}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-700 font-medium">{alt.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Saída Rápida com FEFO */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex justify-between items-center">
              <span>Saída com Critério FEFO: {showDispatchModal.name}</span>
              <button onClick={() => setShowDispatchModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </h3>

            <div className="p-3 bg-emerald-50 rounded-lg text-xs text-emerald-800 space-y-1">
              <p className="font-bold">Regra FEFO Ativa:</p>
              <p>O sistema debitará automaticamente do lote com vencimento mais próximo primeiro.</p>
              <p className="font-mono">Saldo disponível no almoxarifado: <strong>{showDispatchModal.total_stock} {showDispatchModal.unit}</strong></p>
            </div>

            <form onSubmit={handleDispatchFEFO} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantidade a Despachar ({showDispatchModal.unit})</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={showDispatchModal.total_stock}
                  value={dispatchQty}
                  onChange={e => setDispatchQty(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold text-slate-900 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Movimentação</label>
                <select
                  value={dispatchType}
                  onChange={e => setDispatchType(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold text-slate-800"
                >
                  <option value="saida">Saída para Agente (ACE) / Equipe</option>
                  <option value="perda">Perda / Avaria</option>
                  <option value="vencimento">Baixa por Vencimento / Descarte</option>
                  <option value="ajuste">Ajuste de Inventário</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Agente / Responsável / Equipe</label>
                <input
                  type="text"
                  value={dispatchAgent}
                  onChange={e => setDispatchAgent(e.target.value)}
                  placeholder="Nome do ACE ou Equipe..."
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações Sanitárias</label>
                <textarea
                  value={dispatchNotes}
                  onChange={e => setDispatchNotes(e.target.value)}
                  placeholder="Justificativa da entrega ou atividade programada..."
                  className="w-full p-2 rounded-lg border border-slate-300"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Confirmar Saída FEFO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Entrada de Novo Lote */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex justify-between items-center">
              <span>Entrada de Lote: {showEntryModal.name}</span>
              <button onClick={() => setShowEntryModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </h3>

            <form onSubmit={handleAddBatch} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Número do Lote</label>
                <input
                  type="text"
                  placeholder="Ex: LOTE-2026-BR-01"
                  value={batchNumber}
                  onChange={e => setBatchNumber(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Data de Validade</label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={e => setExpirationDate(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantidade Recebida ({showEntryModal.unit})</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={entryQty}
                  onChange={e => setEntryQty(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nota Fiscal / Remessa / Origem</label>
                <input
                  type="text"
                  placeholder="Ex: Ministério da Saúde / SES Nota 4599"
                  value={entryNotes}
                  onChange={e => setEntryNotes(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Registrar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
