import React, { useState, useEffect } from 'react';
import { Send, Plus, CheckCircle, Clock, Building, MapPin, X, Filter, Search, ShieldCheck } from 'lucide-react';
import { db } from '../../services/storage';
import { supabase } from '../../services/supabaseClient';
import { IntersectoralReferral } from '../../types';

const DEFAULT_MUN_ID = '00000000-0000-0000-0000-000000000001';

export const ReferralsView: React.FC = () => {
  const [referrals, setReferrals] = useState<IntersectoralReferral[]>(db.getReferrals());
  const [showModal, setShowModal] = useState(false);
  const [targetSector, setTargetSector] = useState<IntersectoralReferral['targetSector']>('LIMPEZA_URBANA');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('Centro');
  const [description, setDescription] = useState('');
  const [filterSector, setFilterSector] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentUser = db.getCurrentUser();
  const munId = currentUser?.municipalityId || DEFAULT_MUN_ID;

  // Sincronizar com audit_logs / storage
  useEffect(() => {
    const localRefs = db.getReferrals();
    setReferrals(localRefs);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyAddress.trim() || !description.trim()) return;

    setSubmitting(true);
    const newRef: IntersectoralReferral = {
      id: `ref-${Date.now()}`,
      protocol: `ENC-2026-00${referrals.length + 12}`,
      municipalityId: munId,
      propertyAddress: propertyAddress.trim(),
      neighborhood: neighborhood.trim(),
      targetSector,
      description: description.trim(),
      issuedByAgentName: currentUser?.name ? `${currentUser.name} (${currentUser.role})` : 'Equipe de Endemias',
      status: 'ENVIADO',
      createdAt: new Date().toISOString().split('T')[0],
    };

    // Registrar no audit_logs do Supabase para rastreabilidade institucional
    try {
      await supabase.from('audit_logs').insert({
        user_id: currentUser?.id && currentUser.id.length === 36 ? currentUser.id : null,
        action: 'INTERSECTORAL_REFERRAL_CREATED',
        entity_type: 'referrals',
        entity_id: newRef.protocol,
        details: {
          protocol: newRef.protocol,
          target_sector: targetSector,
          address: propertyAddress,
          neighborhood,
          description,
        },
      });
    } catch (err) {
      console.warn('Erro ao salvar auditoria no Supabase:', err);
    }

    const updated = [newRef, ...referrals];
    setReferrals(updated);
    try {
      localStorage.setItem('endemias_referrals', JSON.stringify(updated));
    } catch {
      // ignore
    }

    setShowModal(false);
    setPropertyAddress('');
    setDescription('');
    setSubmitting(false);
  };

  const handleToggleStatus = async (refId: string) => {
    const updated = referrals.map(r => {
      if (r.id === refId) {
        const nextStatus: IntersectoralReferral['status'] = r.status === 'ENVIADO' ? 'RESOLVIDO' : 'ENVIADO';
        return { ...r, status: nextStatus };
      }
      return r;
    });
    setReferrals(updated);
    try {
      localStorage.setItem('endemias_referrals', JSON.stringify(updated));
      await supabase.from('audit_logs').insert({
        user_id: currentUser?.id && currentUser.id.length === 36 ? currentUser.id : null,
        action: 'INTERSECTORAL_REFERRAL_UPDATED',
        entity_type: 'referrals',
        entity_id: refId,
        details: { updated_at: new Date().toISOString() },
      });
    } catch {
      // ignore
    }
  };

  const filteredReferrals = referrals.filter(ref => {
    const matchesSector = filterSector === 'ALL' || ref.targetSector === filterSector;
    const matchesSearch =
      ref.propertyAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.protocol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSector && matchesSearch;
  });

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
            Comunicação oficial com Vigilância Sanitária (VISA), Limpeza Urbana, Meio Ambiente e Obras
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

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por endereço, protocolo ou descrição..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setFilterSector('ALL')}
            className={`px-2.5 py-1 rounded-md transition ${filterSector === 'ALL' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Todos ({referrals.length})
          </button>
          <button
            onClick={() => setFilterSector('LIMPEZA_URBANA')}
            className={`px-2.5 py-1 rounded-md transition ${filterSector === 'LIMPEZA_URBANA' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Limpeza Urbana
          </button>
          <button
            onClick={() => setFilterSector('VIGILANCIA_SANITARIA')}
            className={`px-2.5 py-1 rounded-md transition ${filterSector === 'VIGILANCIA_SANITARIA' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            VISA
          </button>
          <button
            onClick={() => setFilterSector('MEIO_AMBIENTE')}
            className={`px-2.5 py-1 rounded-md transition ${filterSector === 'MEIO_AMBIENTE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Meio Ambiente
          </button>
          <button
            onClick={() => setFilterSector('OBRAS')}
            className={`px-2.5 py-1 rounded-md transition ${filterSector === 'OBRAS' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Obras
          </button>
        </div>
      </div>

      {/* Referrals List */}
      <div className="space-y-3">
        {filteredReferrals.map(ref => (
          <div key={ref.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-extrabold uppercase text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                {ref.targetSector.replace('_', ' ')}
              </span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                  ref.status === 'RESOLVIDO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {ref.status}
                </span>
                <button
                  onClick={() => handleToggleStatus(ref.id)}
                  className="text-[10px] text-indigo-600 hover:underline font-semibold"
                >
                  {ref.status === 'ENVIADO' ? 'Marcar Resolvido' : 'Reabrir'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-700">{ref.protocol}</span>
              <p className="font-bold text-slate-900">{ref.propertyAddress} ({ref.neighborhood})</p>
            </div>
            <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg">{ref.description}</p>

            <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
              <span>Encaminhado em: {ref.createdAt}</span>
              <span className="font-semibold text-indigo-700">Por: {ref.issuedByAgentName}</span>
            </div>
          </div>
        ))}

        {filteredReferrals.length === 0 && (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
            Nenhum encaminhamento encontrado para os filtros selecionados.
          </div>
        )}
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
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-medium text-slate-800"
                >
                  <option value="LIMPEZA_URBANA">Secretaria de Limpeza Urbana (SLU)</option>
                  <option value="VIGILANCIA_SANITARIA">Vigilância Sanitária Municipal (VISA)</option>
                  <option value="MEIO_AMBIENTE">Secretaria do Meio Ambiente (SMA)</option>
                  <option value="OBRAS">Secretaria Municipal de Obras</option>
                  <option value="DEFESA_CIVIL">Defesa Civil</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Endereço do Imóvel *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Rua Floriano Peixoto, 120"
                  value={propertyAddress}
                  onChange={e => setPropertyAddress(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bairro *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Centro"
                  value={neighborhood}
                  onChange={e => setNeighborhood(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Motivação Técnica e Descrição *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Justifique o encaminhamento (ex: acúmulo severo de entulho, piscina abandonada sem acesso, imóvel interditado)..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-medium text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs transition"
                >
                  {submitting ? 'Encaminhando...' : 'Oficializar Encaminhamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
