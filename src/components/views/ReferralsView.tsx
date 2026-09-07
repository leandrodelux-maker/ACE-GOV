import React, { useState } from 'react';
import { Send, Plus, CheckCircle, Clock, Building, MapPin, X, Search } from 'lucide-react';
import { db } from '../../services/storage';
import { IntersectoralReferral } from '../../types';

export const ReferralsView: React.FC = () => {
  const [referrals, setReferrals] = useState<IntersectoralReferral[]>(db.getReferrals());
  const [showModal, setShowModal] = useState(false);
  const [targetSector, setTargetSector] = useState<IntersectoralReferral['targetSector']>('LIMPEZA_URBANA');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSector, setFilterSector] = useState('ALL');

  const filteredReferrals = referrals.filter(ref => {
    const matchesSearch =
      ref.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.protocol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.issuedByAgentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || ref.status === filterStatus;
    const matchesSector = filterSector === 'ALL' || ref.targetSector === filterSector;
    return matchesSearch && matchesStatus && matchesSector;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newRef: IntersectoralReferral = {
      id: `ref-${Date.now()}`,
      protocol: `ENC-2026-00${referrals.length + 12}`,
      municipalityId: 'mun-santacruz',
      propertyAddress,
      neighborhood: 'Vila Nova',
      targetSector,
      description,
      issuedByAgentName: 'Carlos Silva (ACE)',
      status: 'ENVIADO',
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updated = [newRef, ...referrals];
    setReferrals(updated);
    localStorage.setItem('endemias_referrals', JSON.stringify(updated));
    setShowModal(false);
    setPropertyAddress('');
    setDescription('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-600" />
            <span>Encaminhamentos Intersetoriais</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comunicação direta com Vigilância Sanitária (VISA), Limpeza Urbana, Meio Ambiente e Obras
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Encaminhamento</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex-1 min-w-[240px] text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por endereço, protocolo ou agente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-medium text-slate-700 text-xs outline-none cursor-pointer"
        >
          <option value="ALL">Todos os Status</option>
          <option value="ENVIADO">Enviado</option>
          <option value="RESOLVIDO">Resolvido</option>
        </select>
        <select
          value={filterSector}
          onChange={e => setFilterSector(e.target.value)}
          className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-medium text-slate-700 text-xs outline-none cursor-pointer"
        >
          <option value="ALL">Todos os Órgãos</option>
          <option value="LIMPEZA_URBANA">Limpeza Urbana</option>
          <option value="VIGILANCIA_SANITARIA">Vigilância Sanitária</option>
          <option value="MEIO_AMBIENTE">Meio Ambiente</option>
          <option value="OBRAS_PUBLICAS">Obras Públicas</option>
          <option value="ATENCAO_PRIMARIA">Atenção Primária</option>
        </select>
      </div>

      {/* Referrals List */}
      <div className="space-y-3">
        {filteredReferrals.map(ref => (
          <div key={ref.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-extrabold uppercase text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                {ref.targetSector.replace('_', ' ')}
              </span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                ref.status === 'RESOLVIDO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {ref.status}
              </span>
            </div>

            <p className="font-bold text-slate-900">{ref.propertyAddress} ({ref.neighborhood})</p>
            <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg">{ref.description}</p>

            <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
              <span>Encaminhado em: {ref.createdAt}</span>
              <span className="font-semibold text-indigo-700">Por: {ref.issuedByAgentName}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Novo Encaminhamento Intersetorial</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Órgão Destino</label>
                <select
                  value={targetSector}
                  onChange={e => setTargetSector(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-bold text-slate-800"
                >
                  <option value="LIMPEZA_URBANA">Secretaria de Limpeza Urbana (Remoção de Entulho)</option>
                  <option value="VIGILANCIA_SANITARIA">Vigilância Sanitária (VISA - Autuação/Interdição)</option>
                  <option value="MEIO_AMBIENTE">Secretaria de Meio Ambiente (Terrenos / Áreas de Preservação)</option>
                  <option value="OBRAS_PUBLICAS">Secretaria de Obras (Bueiros / Drenagem Pluvial)</option>
                  <option value="ATENCAO_PRIMARIA">Atenção Primária à Saúde (UBS / ACS)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Endereço do Local</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Av. Independência, 890"
                  value={propertyAddress}
                  onChange={e => setPropertyAddress(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Motivo / Descrição da Situação</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descreva o problema encontrado (ex: acúmulo de sucatas, necessidade de caçamba ou autuação de proprietário recalcitrante)..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-medium text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs"
                >
                  Encaminhar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
