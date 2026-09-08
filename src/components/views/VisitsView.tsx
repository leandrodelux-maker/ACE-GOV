import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  Search,
  Filter,
  Calendar,
  MapPin,
  CheckCircle,
  AlertTriangle,
  X,
  Plus,
  RefreshCw,
  Clock,
  Flame,
  Save,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseService } from '../../services/supabaseService';
import { Visit, FieldCycle } from '../../types';

export const VisitsView: React.FC = () => {
  const { user, can } = useAuth();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [activeCycle, setActiveCycle] = useState<FieldCycle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSituation, setFilterSituation] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Modal de Nova Visita
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Lista de imóveis para seleção no modal
  const [availableProperties, setAvailableProperties] = useState<any[]>([]);

  // Formulário de Visita
  const [formData, setFormData] = useState({
    propertyId: '',
    visitType: 'ROTINA',
    result: 'TRABALHADO',
    visitDate: new Date().toISOString().split('T')[0],
    notes: '',
    // Depósitos (A1-E)
    deposits: [
      { depositType: 'A1', quantity: 0, positive: false, larvaeFound: false, eliminated: false, treated: false, treatmentProduct: '' },
      { depositType: 'A2', quantity: 0, positive: false, larvaeFound: false, eliminated: false, treated: false, treatmentProduct: '' },
      { depositType: 'B', quantity: 0, positive: false, larvaeFound: false, eliminated: false, treated: false, treatmentProduct: '' },
      { depositType: 'C', quantity: 0, positive: false, larvaeFound: false, eliminated: false, treated: false, treatmentProduct: '' },
      { depositType: 'D1', quantity: 0, positive: false, larvaeFound: false, eliminated: false, treated: false, treatmentProduct: '' },
      { depositType: 'D2', quantity: 0, positive: false, larvaeFound: false, eliminated: false, treated: false, treatmentProduct: '' },
      { depositType: 'E', quantity: 0, positive: false, larvaeFound: false, eliminated: false, treated: false, treatmentProduct: '' },
    ],
  });

  // Carregar dados iniciais
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const muni = await supabaseService.getMunicipality();
      const muniId = muni?.id || '00000000-0000-0000-0000-000000000001';

      const [cycle, visitsList, propsData] = await Promise.all([
        supabaseService.getActiveCycle(muniId),
        supabaseService.getVisits({
          municipalityId: muniId,
          searchTerm,
          situation: filterSituation,
          limit: 100,
        }),
        supabaseService.getPropertiesPaginated({ page: 1, pageSize: 50 }),
      ]);

      setActiveCycle(cycle);
      setVisits(visitsList);
      setAvailableProperties(propsData.properties);

      if (propsData.properties.length > 0 && !formData.propertyId) {
        setFormData(prev => ({ ...prev, propertyId: propsData.properties[0].id }));
      }
    } catch (err) {
      console.error('Erro ao carregar visitas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, filterSituation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDepositChange = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const updated = [...prev.deposits];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, deposits: updated };
    });
  };

  const handleSubmitVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.propertyId) {
      setErrorToast('Por favor, selecione um imóvel para registrar a vistoria.');
      return;
    }

    setIsSubmitting(true);
    setErrorToast(null);

    try {
      const muni = await supabaseService.getMunicipality();
      const muniId = muni?.id || '00000000-0000-0000-0000-000000000001';
      const cycleId = activeCycle?.id || '00000000-0000-0000-0000-000000000001';

      // Filtrar depósitos com quantidade > 0
      const activeDeposits = formData.deposits.filter(d => d.quantity > 0);

      const res = await supabaseService.registerVisitTransaction({
        municipalityId: muniId,
        cycleId: cycleId,
        propertyId: formData.propertyId,
        agentId: user?.id,
        visitDate: formData.visitDate,
        visitType: formData.visitType,
        result: formData.result,
        latitude: -29.718 + (Math.random() - 0.5) * 0.005,
        longitude: -52.428 + (Math.random() - 0.5) * 0.005,
        notes: formData.notes,
        deposits: activeDeposits,
      });

      if (res.success) {
        setSuccessToast('Vistoria domiciliar registrada com sucesso no banco!');
        setTimeout(() => setSuccessToast(null), 3500);
        setIsModalOpen(false);
        // Reset form
        setFormData({
          propertyId: availableProperties[0]?.id || '',
          visitType: 'ROTINA',
          result: 'TRABALHADO',
          visitDate: new Date().toISOString().split('T')[0],
          notes: '',
          deposits: formData.deposits.map(d => ({
            ...d,
            quantity: 0,
            positive: false,
            larvaeFound: false,
            eliminated: false,
            treated: false,
            treatmentProduct: '',
          })),
        });
        await loadData();
      } else {
        setErrorToast(res.error || 'Falha ao registrar visita.');
      }
    } catch (err: any) {
      setErrorToast(err.message || 'Erro inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toasts */}
      {successToast && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-semibold shadow-xs animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-semibold shadow-xs animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600" />
            <span>Visitas Domiciliares & Inspeções Entomológicas</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro unificado de vistorias de rotina, pesquisa larvária (A1 a E) e tratamento focal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {can('visits.create') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Visita</span>
            </button>
          )}

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

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
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
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    <span>Carregando inspeções do banco de dados...</span>
                  </td>
                </tr>
              ) : visits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <CheckSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">Nenhuma vistoria encontrada.</p>
                  </td>
                </tr>
              ) : (
                visits.map(v => (
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
                      {new Date(v.date).toLocaleDateString('pt-BR')} <span className="text-[10px] text-slate-400 font-mono">{v.time}</span>
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
                      {v.conduct || `${v.totalDepositsInspected || 0} depósitos inspecionados`}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Registrar Visita Domiciliar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-400" />
                <span>Nova Vistoria Sanitária & Inspeção Entomológica</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitVisit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-600 font-semibold mb-1">Imóvel a ser inspecionado *</label>
                  <select
                    required
                    value={formData.propertyId}
                    onChange={e => setFormData({ ...formData, propertyId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
                  >
                    {availableProperties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.address} ({p.neighborhood})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Data da Visita</label>
                  <input
                    type="date"
                    required
                    value={formData.visitDate}
                    onChange={e => setFormData({ ...formData, visitDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Resultado / Situação *</label>
                  <select
                    value={formData.result}
                    onChange={e => setFormData({ ...formData, result: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold"
                  >
                    <option value="TRABALHADO">Trabalhado / Inspecionado</option>
                    <option value="FECHADO">Fechado / Morador Ausente</option>
                    <option value="RECUSADO">Recusa de Acesso</option>
                    <option value="DESABITADO">Desabitado / Desocupado</option>
                  </select>
                </div>
              </div>

              {/* Seção de Depósitos SUS (A1 a E) */}
              {formData.result === 'TRABALHADO' && (
                <div className="space-y-3 pt-2">
                  <label className="block text-slate-800 font-bold text-xs uppercase tracking-wider">
                    Pesquisa Entomológica & Depósitos de Água (Padrão Ministério da Saúde)
                  </label>

                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                    <div className="bg-slate-50 px-3 py-2 grid grid-cols-6 gap-2 font-bold text-slate-600 text-[11px]">
                      <span className="col-span-2">Tipo de Depósito</span>
                      <span>Qtd</span>
                      <span>Com Foco?</span>
                      <span>Eliminado?</span>
                      <span>Tratado?</span>
                    </div>

                    {formData.deposits.map((dep, idx) => {
                      const labels: Record<string, string> = {
                        A1: 'A1 - Caixa d\'água elevada',
                        A2: 'A2 - Tanque / Cisterna ao solo',
                        B: 'B - Vasos / Pingadeiras / Garrafas',
                        C: 'C - Calhas / Ralos / Lajes',
                        D1: 'D1 - Pneus / Rodantes',
                        D2: 'D2 - Sucatas / Entulhos',
                        E: 'E - Naturais (Ocos, bromélias)',
                      };

                      return (
                        <div key={dep.depositType} className="px-3 py-2.5 grid grid-cols-6 gap-2 items-center text-xs">
                          <span className="col-span-2 font-semibold text-slate-800">
                            {labels[dep.depositType]}
                          </span>

                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={dep.quantity}
                            onChange={e => handleDepositChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-14 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-center font-bold text-slate-900"
                          />

                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dep.positive}
                              onChange={e => {
                                handleDepositChange(idx, 'positive', e.target.checked);
                                handleDepositChange(idx, 'larvaeFound', e.target.checked);
                              }}
                              className="rounded text-rose-600"
                            />
                            <span className={dep.positive ? 'text-rose-600 font-bold' : 'text-slate-500'}>Foco</span>
                          </label>

                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dep.eliminated}
                              onChange={e => handleDepositChange(idx, 'eliminated', e.target.checked)}
                              className="rounded text-emerald-600"
                            />
                            <span className="text-slate-600">Sim</span>
                          </label>

                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dep.treated}
                              onChange={e => handleDepositChange(idx, 'treated', e.target.checked)}
                              className="rounded text-blue-600"
                            />
                            <span className="text-slate-600">Sim</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Conduta Sanitária & Observações</label>
                <textarea
                  rows={2}
                  placeholder="Descreva orientações passadas ao morador, tipo de larvicida aplicado, etc."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Salvando Vistoria...' : 'Salvar no Banco'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
