import React, { useState, useEffect } from 'react';
import { Send, Plus, CheckCircle, Clock, Building, MapPin, X, Filter, Search, ShieldCheck } from 'lucide-react';
import { auditLogService } from '../../services/auditLogService';
import { referralService } from '../../services/referralService';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { IntersectoralReferral } from '../../types';
import { PageHeader } from '../ui';

/**
 * Encaminhamentos intersetoriais.
 * Usa a tabela intersectoral_referrals quando ela existe no banco (migração
 * supabase/migrations/20260923000032). Sem a tabela, funciona em modo local:
 * os registros ficam só neste navegador, com aviso visível na tela. Criação e
 * mudança de status são registradas na auditoria nos dois modos.
 */
const LOCAL_KEY = 'endemias_referrals';

function readLocalReferrals(municipalityId: string): IntersectoralReferral[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((r: IntersectoralReferral) => r.municipalityId === municipalityId) : [];
  } catch {
    return [];
  }
}

function writeLocalReferrals(municipalityId: string, items: IntersectoralReferral[]) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    const others = Array.isArray(all) ? all.filter((r: IntersectoralReferral) => r.municipalityId !== municipalityId) : [];
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...items, ...others]));
  } catch {
    /* armazenamento indisponível */
  }
}

export const ReferralsView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const munId = useMunicipalityId();
  const [referrals, setReferrals] = useState<IntersectoralReferral[]>(() => readLocalReferrals(munId));
  const [showModal, setShowModal] = useState(false);
  const [targetSector, setTargetSector] = useState<IntersectoralReferral['targetSector']>('LIMPEZA_URBANA');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [description, setDescription] = useState('');
  const [filterSector, setFilterSector] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 'db' = tabela do banco; 'local' = sem tabela (só neste navegador); null = verificando
  const [mode, setMode] = useState<'db' | 'local' | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    referralService
      .list(munId)
      .then((res) => {
        if (!active) return;
        if (res.available) {
          setMode('db');
          setReferrals(res.items);
          setLoadError(res.error ? 'Não foi possível carregar os encaminhamentos.' : null);
        } else {
          setMode('local');
          setReferrals(readLocalReferrals(munId));
        }
      })
      .catch(() => {
        if (!active) return;
        setMode('local');
        setReferrals(readLocalReferrals(munId));
      });
    return () => {
      active = false;
    };
  }, [munId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyAddress.trim() || !description.trim()) return;

    setSubmitting(true);
    let newRef: IntersectoralReferral = {
      id: `ref-${Date.now()}`,
      protocol: `ENC-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
      municipalityId: munId,
      propertyAddress: propertyAddress.trim(),
      neighborhood: neighborhood.trim(),
      targetSector,
      description: description.trim(),
      issuedByAgentName: currentUser?.name ? `${currentUser.name} (${currentUser.role})` : 'Equipe de Endemias',
      status: 'ENVIADO',
      createdAt: new Date().toISOString().split('T')[0],
    };

    if (mode === 'db') {
      try {
        newRef = await referralService.create(munId, { ...newRef, issuedBy: currentUser?.id, issuedByName: newRef.issuedByAgentName });
      } catch (err: any) {
        setSubmitting(false);
        alert(`Não foi possível registrar o encaminhamento: ${err?.message || 'erro desconhecido'}`);
        return;
      }
    }

    // Rastreabilidade institucional (tabela audit_logs)
    await auditLogService.log({
      municipalityId: munId,
      userId: currentUser?.id,
      action: 'CADASTRO',
      module: 'Encaminhamentos',
      entity: mode === 'db' ? 'intersectoral_referrals' : 'encaminhamento_local',
      entityId: newRef.protocol,
      newData: { protocol: newRef.protocol, target_sector: targetSector, address: propertyAddress, neighborhood, description },
    });

    const updated = [newRef, ...referrals];
    setReferrals(updated);
    if (mode !== 'db') writeLocalReferrals(munId, updated);

    setShowModal(false);
    setPropertyAddress('');
    setDescription('');
    setSubmitting(false);
  };

  const handleToggleStatus = async (refId: string) => {
    const current = referrals.find((r) => r.id === refId);
    if (!current) return;
    const nextStatus: IntersectoralReferral['status'] = current.status === 'ENVIADO' ? 'RESOLVIDO' : 'ENVIADO';
    if (mode === 'db') {
      try {
        await referralService.setStatus(munId, refId, nextStatus);
      } catch (err: any) {
        alert(`Não foi possível atualizar o status: ${err?.message || 'erro desconhecido'}`);
        return;
      }
    }
    const updated = referrals.map(r => {
      if (r.id === refId) {
        const nextStatus: IntersectoralReferral['status'] = r.status === 'ENVIADO' ? 'RESOLVIDO' : 'ENVIADO';
        return { ...r, status: nextStatus };
      }
      return r;
    });
    setReferrals(updated);
    if (mode !== 'db') writeLocalReferrals(munId, updated);
    const changed = updated.find((r) => r.id === refId);
    await auditLogService.log({
      municipalityId: munId,
      userId: currentUser?.id,
      action: 'EDICAO',
      module: 'Encaminhamentos',
      entity: mode === 'db' ? 'intersectoral_referrals' : 'encaminhamento_local',
      entityId: changed?.protocol || refId,
      newData: { status: changed?.status },
    });
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
      {mode === 'local' && (
        <div role="note" className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs">
          Encaminhamentos ainda não têm tabela no banco: os registros ficam salvos <strong>somente neste navegador</strong> (a criação e as
          mudanças de status vão para a auditoria). Para guardar no banco, aplique a migração proposta de encaminhamentos.
        </div>
      )}
      {loadError && (
        <div role="alert" className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs">{loadError}</div>
      )}
      {/* Header */}
      <PageHeader
        icon={Send}
        title="Encaminhamentos Intersetoriais"
        subtitle="Comunicação oficial com Vigilância Sanitária (VISA), Limpeza Urbana, Meio Ambiente e Obras"
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Encaminhamento</span>
          </button>
        }
      />

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
