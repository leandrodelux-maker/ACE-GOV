import React, { useState } from 'react';
import { CheckSquare, Search, Filter, Calendar, MapPin, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { db } from '../../services/storage';
import { Visit } from '../../types';

export const VisitsView: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>(db.getVisits());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSituation, setFilterSituation] = useState('ALL');

  const filteredVisits = visits.filter(v => {
    const matchesSearch =
      v.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.neighborhood.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filterSituation === 'ALL') return true;
    if (filterSituation === 'FOCO') return v.fociFound;
    return v.situation === filterSituation;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600" />
            <span>Visitas Domiciliares & Inspeções Entomológicas</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro unificado de vistorias de rotina, pesquisa larvária e tratamento focal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por endereço, ACE..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="p-2 pl-8 rounded-lg border border-slate-300 text-xs w-56 font-medium"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <select
            value={filterSituation}
            onChange={e => setFilterSituation(e.target.value)}
            className="p-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
          >
            <option value="ALL">Todas as Situações</option>
            <option value="TRABALHADO">Trabalhado</option>
            <option value="FECHADO">Fechado</option>
            <option value="RECUSADO">Recusa</option>
            <option value="FOCO">Com Foco de Larvas</option>
          </select>
        </div>
      </div>

      {/* Visits Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Imóvel / Endereço</th>
                <th className="py-3 px-4">Bairro</th>
                <th className="py-3 px-4">Agente (ACE)</th>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4">Depósitos & Conduta</th>
                <th className="py-3 px-4 text-right">Foco</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisits.map(v => (
                <tr key={v.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {v.propertyAddress}
                    <span className="block font-mono text-[10px] text-slate-400 font-normal">
                      {v.propertyCode}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{v.neighborhood}</td>
                  <td className="py-3 px-4 font-medium text-slate-800">{v.agentName}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {v.date} <span className="text-[10px] text-slate-400 font-mono">{v.time}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                      v.situation === 'TRABALHADO'
                        ? 'bg-emerald-100 text-emerald-800'
                        : v.situation === 'FECHADO'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {v.situation}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs">
                    {v.notes || `${v.depositsInspected} depósitos inspecionados`}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {v.fociFound ? (
                      <span className="px-2 py-0.5 rounded font-black text-[10px] bg-rose-600 text-white animate-pulse">
                        FOCO DETECTADO
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Negativo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
