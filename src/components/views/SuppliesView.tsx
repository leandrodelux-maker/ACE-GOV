import React, { useState } from 'react';
import {
  Package,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Send,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { db } from '../../services/storage';
import { SupplyItem } from '../../types';

export const SuppliesView: React.FC = () => {
  const [supplies, setSupplies] = useState<SupplyItem[]>(db.getSupplies());

  const lowStockCount = supplies.filter(s => s.isLowStock || s.currentStock <= s.minimumStock).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            <span>Gestão de Insumos Químicos, Larvicidas & EPIs</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Controle de lotes, datas de validade, estoque mínimo de segurança e distribuição para ACEs
          </p>
        </div>

        {lowStockCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{lowStockCount} insumo(s) em estoque crítico!</span>
          </div>
        )}
      </div>

      {/* Supplies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {supplies.map(item => {
          const isLow = item.isLowStock || item.currentStock <= item.minimumStock;
          const mainBatch = item.batches?.[0];

          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl border p-5 shadow-xs space-y-3 transition ${
                isLow ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                    {item.category.replace('_', ' ')}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1.5">{item.name}</h3>
                </div>

                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                  isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {isLow ? 'ESTOQUE BAIXO' : 'REGULAR'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Disponível:</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {item.currentStock} {item.unit}
                  </span>
                </div>
                {mainBatch && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lote Principal:</span>
                      <span className="font-mono font-bold text-slate-700">{mainBatch.batchNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Validade:</span>
                      <span className={`font-semibold ${mainBatch.isNearExpiration ? 'text-amber-700 font-bold' : 'text-slate-800'}`}>
                        {mainBatch.expirationDate}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Mínimo: {item.minimumStock} {item.unit}</span>
                <button className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition">
                  Cautela / Entregar ao ACE
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
