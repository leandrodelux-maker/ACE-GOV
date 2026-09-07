import React, { useState } from 'react';
import { Building2, Plus, ShieldCheck, Users, MapPin, AlertCircle, Phone, Calendar, Search } from 'lucide-react';
import { db } from '../../services/storage';
import { SpecialProperty } from '../../types';

export const SpecialPropertiesView: React.FC = () => {
  const allProperties: SpecialProperty[] = db.getSpecialProperties();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  const properties = allProperties.filter(ie => {
    const matchesSearch =
      ie.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ie.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ie.neighborhood.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ie.responsiblePerson.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || ie.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span>Imóveis Especiais (IE) — Alta Circulação</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Escolas, creches, Unidades Básicas de Saúde, hospitais, terminais e locais de aglomeração pública
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
          {properties.length} imóveis especiais
        </span>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex-1 min-w-[240px] text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, endereço, bairro ou responsável..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-medium text-slate-700 text-xs outline-none cursor-pointer"
        >
          <option value="ALL">Todos os Tipos</option>
          <option value="ESCOLA">Escolas</option>
          <option value="CRECHE">Creches</option>
          <option value="UBS">Unidades Básicas de Saúde</option>
          <option value="HOSPITAL">Hospitais</option>
          <option value="TERMINAL">Terminais</option>
          <option value="OUTROS">Outros</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {properties.map(ie => (
          <div key={ie.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                  {ie.type.replace('_', ' ')}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1.5">{ie.name}</h3>
                <p className="text-xs text-slate-500">{ie.address} • {ie.neighborhood}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Responsável:</span>
                <span className="font-semibold text-slate-800">{ie.responsiblePerson}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Telefone:</span>
                <span className="font-semibold text-slate-800">{ie.contactPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Última Vistoria:</span>
                <span className="font-bold text-slate-800">{ie.lastInspectionDate || 'Pendente'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Histórico de Focos:</span>
                <span className={`font-bold ${ie.fociCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {ie.fociCount} focos registrados
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition">
                Vistoriar Imóvel Especial
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
