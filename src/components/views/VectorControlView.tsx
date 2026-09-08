import React, { useState, useEffect } from 'react';
import {
  Activity,
  Plus,
  Flame,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Calendar,
  Users,
  Shield,
  Crosshair,
  Radio,
  Send,
  CheckCircle2,
  Package,
} from 'lucide-react';
import {
  vectorControlService,
  VectorControlOperation,
  ChemicalApplication,
} from '../../services/vectorControlService';
import { stockService, Product } from '../../services/stockService';
import { db } from '../../services/storage';

export const VectorControlView: React.FC = () => {
  const [operations, setOperations] = useState<VectorControlOperation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [showNewOpModal, setShowNewOpModal] = useState(false);
  const [opType, setOpType] = useState<VectorControlOperation['type']>('tratamento_focal');
  const [disease, setDisease] = useState('DENGUE');
  const [neighborhood, setNeighborhood] = useState('Centro');
  const [radiusMeters, setRadiusMeters] = useState(150);
  const [opNotes, setOpNotes] = useState('');

  const [showChemicalModal, setShowChemicalModal] = useState<VectorControlOperation | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [chemicalAppType, setChemicalAppType] = useState<ChemicalApplication['application_type']>('FOCAL');
  const [chemicalQty, setChemicalQty] = useState<number>(0.5);
  const [chemicalNotes, setChemicalNotes] = useState('');

  const neighborhoods = db.getNeighborhoods();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [ops, prods] = await Promise.all([
      vectorControlService.getOperations(),
      stockService.getProductsWithBatches(),
    ]);
    setOperations(ops);
    setProducts(prods);
    if (prods.length > 0) {
      setSelectedProductId(prods[0].id);
    }
    setLoading(false);
  };

  const handleCreateOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await vectorControlService.createOperation({
      type: opType,
      disease,
      radiusMeters,
      notes: opNotes,
    });

    if (created) {
      alert('Operação de controle vetorial iniciada com sucesso!');
      setShowNewOpModal(false);
      setOpNotes('');
      loadData();
    }
  };

  const handleApplyChemical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showChemicalModal || !selectedProductId) return;

    const prod = products.find(p => p.id === selectedProductId);
    const res = await vectorControlService.registerChemicalApplication({
      operationId: showChemicalModal.id,
      productId: selectedProductId,
      applicationType: chemicalAppType,
      quantity: chemicalQty,
      unit: prod?.unit || 'kg',
      notes: chemicalNotes,
    });

    alert(res.message);
    if (res.success) {
      setShowChemicalModal(null);
      setChemicalNotes('');
      loadData();
    }
  };

  const handleFinish = async (opId: string) => {
    if (confirm('Deseja encerrar esta operação de controle vetorial?')) {
      const ok = await vectorControlService.finishOperation(opId);
      if (ok) {
        alert('Operação concluída com sucesso!');
        loadData();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Crosshair className="w-5 h-5 text-rose-600" />
              <span>Tratamento, Bloqueio Químico & Controle Vetorial</span>
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800">
              RESPOSTA RÁPIDA
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tratamento focal, perifocal, nebulização UBV costal/veicular e bloqueio de transmissão viral com consumo integrado ao estoque FEFO
          </p>
        </div>

        <button
          onClick={() => setShowNewOpModal(true)}
          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Disparar Operação de Campo</span>
        </button>
      </div>

      {/* Operações List */}
      <div className="space-y-4">
        {operations.map(op => {
          const m = op.metrics || {
            plannedProperties: 120,
            completedProperties: 0,
            coveragePercentage: 0,
            closedCount: 0,
            refusalCount: 0,
            chemicalUsedCount: 0,
          };

          return (
            <div
              key={op.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
            >
              {/* Top info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-black bg-rose-600 text-white uppercase">
                    {op.type.replace('_', ' ')}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                    Agravo: {op.disease}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    Raio: {op.radius_meters}m peridomiciliar
                  </span>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  op.status === 'CONCLUIDA'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-700 animate-pulse'
                }`}>
                  {op.status === 'EM_ANDAMENTO' ? 'EM ANDAMENTO' : 'CONCLUÍDA'}
                </span>
              </div>

              {op.notes && (
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg font-medium">
                  {op.notes}
                </p>
              )}

              {/* Métricas do Dashboard da Operação */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs">
                <div>
                  <span className="text-slate-500">Imóveis Trabalhados:</span>
                  <p className="font-bold text-slate-900">{m.completedProperties} / {m.plannedProperties}</p>
                </div>
                <div>
                  <span className="text-slate-500">Cobertura:</span>
                  <p className="font-bold text-rose-600">{m.coveragePercentage}%</p>
                </div>
                <div>
                  <span className="text-slate-500">Fechados & Recusas:</span>
                  <p className="font-bold text-slate-700">{m.closedCount} fech. | {m.refusalCount} rec.</p>
                </div>
                <div>
                  <span className="text-slate-500">Aplicações Químicas:</span>
                  <p className="font-bold text-blue-600">{m.chemicalUsedCount} registros</p>
                </div>
                <div>
                  <span className="text-slate-500">Início da Operação:</span>
                  <p className="font-bold text-slate-900">{op.start_date}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                  <span>Progresso da Operação de Bloqueio</span>
                  <span>{m.coveragePercentage}% concluído</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m.coveragePercentage >= 80 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(m.coveragePercentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* Ações de Campo */}
              <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 gap-2">
                <div className="flex items-center gap-2">
                  {op.status === 'EM_ANDAMENTO' && (
                    <button
                      onClick={() => setShowChemicalModal(op)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Registrar Aplicação Química & Baixa no Estoque</span>
                    </button>
                  )}
                </div>

                {op.status === 'EM_ANDAMENTO' && (
                  <button
                    onClick={() => handleFinish(op.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-xs"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Concluir Operação</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Nova Operação de Controle Vetorial */}
      {showNewOpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex justify-between items-center">
              <span>Disparar Operação de Controle Vetorial</span>
              <button onClick={() => setShowNewOpModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </h3>

            <form onSubmit={handleCreateOperation} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Ação</label>
                <select
                  value={opType}
                  onChange={e => setOpType(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold text-slate-800"
                >
                  <option value="tratamento_focal">Tratamento Focal (Larvicida em depósitos)</option>
                  <option value="tratamento_perifocal">Tratamento Perifocal (Pontos Estratégicos)</option>
                  <option value="bloqueio">Bloqueio de Casos Notificados</option>
                  <option value="nebulizacao">Nebulização Costal</option>
                  <option value="fumace">Fumacê / UBV Pesado Veicular</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Agravo / Doença Notificada</label>
                <select
                  value={disease}
                  onChange={e => setDisease(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                >
                  <option value="DENGUE">Dengue</option>
                  <option value="CHIKUNGUNYA">Chikungunya</option>
                  <option value="ZIKA">Zika Vírus</option>
                  <option value="FEBRE_AMARELA">Febre Amarela Urbana</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Raio de Ação Peridomiciliar</label>
                <select
                  value={radiusMeters}
                  onChange={e => setRadiusMeters(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                >
                  <option value={150}>150 metros (~120 imóveis / 9 quadras)</option>
                  <option value={300}>300 metros (~250 imóveis)</option>
                  <option value={500}>500 metros (Surto / Bloqueio amplo)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações da Operação</label>
                <textarea
                  value={opNotes}
                  onChange={e => setOpNotes(e.target.value)}
                  placeholder="Justificativa da ação, equipe responsável e equipamentos destacados..."
                  className="w-full p-2 rounded-lg border border-slate-300"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewOpModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Disparar Operação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registro de Aplicação Química com Baixa no Estoque */}
      {showChemicalModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex justify-between items-center">
              <span>Aplicação Química & Baixa no Estoque (FEFO)</span>
              <button onClick={() => setShowChemicalModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </h3>

            <form onSubmit={handleApplyChemical} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Produto Sanitário</label>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold text-slate-800"
                  required
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Saldo: {p.total_stock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Modalidade de Aplicação</label>
                <select
                  value={chemicalAppType}
                  onChange={e => setChemicalAppType(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                >
                  <option value="FOCAL">Aplicação Focal (Em depósitos de água)</option>
                  <option value="PERIFOCAL">Aplicação Perifocal (Superfícies de PE)</option>
                  <option value="NEBULIZACAO_COSTAL">Nebulização Costal</option>
                  <option value="UBV_PESADO">UBV Pesado Veicular</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantidade Aplicada</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={chemicalQty}
                  onChange={e => setChemicalQty(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-slate-300 font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Anotações da Aplicação</label>
                <input
                  type="text"
                  value={chemicalNotes}
                  onChange={e => setChemicalNotes(e.target.value)}
                  placeholder="Ex: Pulverizado em 14 depósitos na Rua Ramiro Barcelos"
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowChemicalModal(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Confirmar Aplicação e Baixa FEFO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
