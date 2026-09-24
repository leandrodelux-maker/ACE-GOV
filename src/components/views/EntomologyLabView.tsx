import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Microscope,
  Send,
  Eye,
  Check,
  ChevronRight,
  ShieldCheck,
  Building,
  UserCheck,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  entomologyService,
  EntomologicalSample,
  EntomologyKPIs,
  CollectionType,
  SampleStatus,
} from '../../services/entomologyService';
import { PageHeader } from '../ui';

interface EntomologyLabViewProps {
  municipalityId: string;
}

export const EntomologyLabView: React.FC<EntomologyLabViewProps> = ({ municipalityId }) => {
  const [samples, setSamples] = useState<EntomologicalSample[]>([]);
  const [kpis, setKpis] = useState<EntomologyKPIs>({
    totalReceived: 0,
    pending: 0,
    inAnalysis: 0,
    positiveAedes: 0,
    finalized: 0,
    avgAnalysisHours: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterType, setFilterType] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<EntomologicalSample | null>(null);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isIdentifyOpen, setIsIdentifyOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  // Form states
  const [newCollectionType, setNewCollectionType] = useState<CollectionType>('larva');
  const [newOriginType, setNewOriginType] = useState<'visita' | 'ovitrampa' | 'liraa' | 'pe' | 'denuncia'>('visita');
  const [newNotes, setNewNotes] = useState('');

  // Identificação form
  const [identSpecies, setIdentSpecies] = useState('Aedes aegypti');
  const [identStage, setIdentStage] = useState<'larva' | 'pupa' | 'ovo' | 'adulto'>('larva');
  const [identQuantity, setIdentQuantity] = useState(12);
  const [identNotes, setIdentNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, kpiData] = await Promise.all([
        entomologyService.getSamples(municipalityId, {
          status: filterStatus,
          collectionType: filterType,
        }),
        entomologyService.getKPIs(municipalityId),
      ]);
      setSamples(data);
      setKpis(kpiData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [municipalityId, filterStatus, filterType]);

  const handleCreateSample = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await entomologyService.createSample({
      municipalityId,
      collectionType: newCollectionType,
      originType: newOriginType,
      notes: newNotes,
    });
    if (res.success) {
      setIsCreateOpen(false);
      setNewNotes('');
      loadData();
    } else {
      alert(`Erro: ${res.error}`);
    }
  };

  const handleReceive = async () => {
    if (!selectedSample) return;
    const res = await entomologyService.receiveSample(selectedSample.id, undefined, 'Conferido na triagem');
    if (res.success) {
      setIsReceiveOpen(false);
      loadData();
    } else {
      alert(`Erro: ${res.error}`);
    }
  };

  const handleStartAnalysis = async (sample: EntomologicalSample) => {
    const res = await entomologyService.startAnalysis(sample.id);
    if (res.success) {
      loadData();
    }
  };

  const handleSaveIdentification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSample) return;

    const isAedes = identSpecies.toLowerCase().includes('aedes');
    const res = await entomologyService.addIdentification({
      sampleId: selectedSample.id,
      species: identSpecies,
      stage: identStage,
      quantity: Number(identQuantity),
      positiveForAedes: isAedes,
      notes: identNotes,
    });

    if (res.success) {
      // Finalizar amostra e emitir laudo
      await entomologyService.finalizeSample(selectedSample.id, identNotes);
      setIsIdentifyOpen(false);
      loadData();
    } else {
      alert(`Erro: ${res.error}`);
    }
  };

  const filteredSamples = samples.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.sampleCode.toLowerCase().includes(term) ||
      (s.propertyAddress && s.propertyAddress.toLowerCase().includes(term)) ||
      (s.agentName && s.agentName.toLowerCase().includes(term)) ||
      s.status.toLowerCase().includes(term)
    );
  });

  // Timeline steps
  const getStepIndex = (status: SampleStatus) => {
    switch (status) {
      case 'coletada': return 0;
      case 'em_transporte': return 1;
      case 'recebida': return 2;
      case 'em_analise': return 3;
      case 'identificada': return 4;
      case 'finalizada': return 5;
      default: return 0;
    }
  };

  const statusBadge = (status: SampleStatus) => {
    switch (status) {
      case 'coletada':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Coletada</span>;
      case 'em_transporte':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Em Transporte</span>;
      case 'recebida':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Recebida</span>;
      case 'em_analise':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Em Análise</span>;
      case 'identificada':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">Identificada</span>;
      case 'finalizada':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Finalizada</span>;
      case 'descartada':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">Descartada</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={FlaskConical}
        title="Laboratório Entomológico"
        subtitle="Triagem, microscopia taxonômica, identificação de vetores e emissão de laudos oficiais"
        actions={
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Amostra
          </button>
        }
      />

      {/* KPI Cards Clean & Executivos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recebidas</span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {kpis.totalReceived}
          </div>
          <span className="text-[10px] text-slate-400 font-medium block">Total triado</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pendentes</span>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {kpis.pending}
          </div>
          <span className="text-[10px] text-amber-600/80 font-medium block">Aguardando triagem</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Em Análise</span>
          <div className="text-2xl font-black text-sky-600 tracking-tight">
            {kpis.inAnalysis}
          </div>
          <span className="text-[10px] text-sky-600/80 font-medium block">Microscópio/Lupa</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Positivas Aedes</span>
          <div className="text-2xl font-black text-rose-600 tracking-tight">
            {kpis.positiveAedes}
          </div>
          <span className="text-[10px] text-rose-600/80 font-medium block">Vetor confirmado</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Finalizadas</span>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">
            {kpis.finalized}
          </div>
          <span className="text-[10px] text-emerald-600/80 font-medium block">Laudo emitido</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tempo Médio</span>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            {kpis.avgAnalysisHours}h
          </div>
          <span className="text-[10px] text-slate-400 font-medium block">Prazo de laudo</span>
        </div>
      </div>

      {/* Fluxo Visual Interativo */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600" />
          Fluxo de Rastreabilidade Entomológica
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { step: '1. Coleta', desc: 'Campo / Foco / Armadilha' },
            { step: '2. Transporte', desc: 'Maleta Térmica Lacrada' },
            { step: '3. Recebimento', desc: 'Bancada e Triagem' },
            { step: '4. Microscopia', desc: 'Lupa / Identificação' },
            { step: '5. Laudo Taxonômico', desc: 'Aedes / Culex / Outros' },
            { step: '6. Repercussão', desc: 'Foco / Alerta / LIRAa' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <span>{item.step}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar código, endereço, ACE..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Filter className="w-4 h-4" />
            <span>Filtros:</span>
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            <option value="todos">Todos os Status</option>
            <option value="coletada">Coletada</option>
            <option value="recebida">Recebida</option>
            <option value="em_analise">Em Análise</option>
            <option value="identificada">Identificada</option>
            <option value="finalizada">Finalizada</option>
          </select>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="larva">Larva</option>
            <option value="pupa">Pupa</option>
            <option value="ovo">Ovo</option>
            <option value="mosquito_adulto">Mosquito Adulto</option>
            <option value="outro">Outro</option>
          </select>
        </div>
      </div>

      {/* Tabela de Amostras */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Origem / Local</th>
                <th className="py-3 px-4">Coleta</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Espécies Identificadas</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Carregando amostras do laboratório...
                  </td>
                </tr>
              ) : filteredSamples.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Nenhuma amostra encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredSamples.map(sample => {
                  const hasAedes = (sample.identifications || []).some(
                    i => i.positiveForAedes || i.species.toLowerCase().includes('aedes')
                  );

                  return (
                    <tr
                      key={sample.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        {sample.sampleCode}
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-700 dark:text-slate-300">
                        {sample.collectionType.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        <div>
                          <span className="font-medium text-slate-900 dark:text-white">
                            {sample.propertyAddress || 'Ponto Territorial'}
                          </span>
                          <p className="text-xs text-slate-500">
                            Origem: {sample.originType || 'visita'} | ACE: {sample.agentName || 'Equipe Campo'}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                        {new Date(sample.collectionDate).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4">{statusBadge(sample.status)}</td>
                      <td className="py-3 px-4">
                        {sample.identifications && sample.identifications.length > 0 ? (
                          <div className="space-y-1">
                            {sample.identifications.map(idItem => (
                              <div
                                key={idItem.id}
                                className={`text-xs font-medium px-2 py-0.5 rounded inline-block mr-1 ${
                                  idItem.positiveForAedes
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {idItem.species} ({idItem.quantity})
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Pendente de identificação</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedSample(sample);
                              setIsTimelineOpen(true);
                            }}
                            title="Ver Rastreabilidade / Linha do Tempo"
                            className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {sample.status === 'coletada' && (
                            <button
                              onClick={() => {
                                setSelectedSample(sample);
                                setIsReceiveOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                              Receber
                            </button>
                          )}

                          {sample.status === 'recebida' && (
                            <button
                              onClick={() => handleStartAnalysis(sample)}
                              className="px-2.5 py-1 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                            >
                              Iniciar Análise
                            </button>
                          )}

                          {(sample.status === 'em_analise' || sample.status === 'identificada') && (
                            <button
                              onClick={() => {
                                setSelectedSample(sample);
                                setIsIdentifyOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                            >
                              Identificar / Laudo
                            </button>
                          )}

                          {sample.status === 'finalizada' && (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Laudado
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Nova Amostra */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-emerald-600" />
              Cadastrar Nova Amostra Entomológica
            </h3>

            <form onSubmit={handleCreateSample} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Coleta
                </label>
                <select
                  value={newCollectionType}
                  onChange={e => setNewCollectionType(e.target.value as CollectionType)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="larva">Larva</option>
                  <option value="pupa">Pupa</option>
                  <option value="ovo">Ovo</option>
                  <option value="mosquito_adulto">Mosquito Adulto</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Origem da Coleta
                </label>
                <select
                  value={newOriginType}
                  onChange={e => setNewOriginType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="visita">Visita Domiciliar / Foco</option>
                  <option value="ovitrampa">Armadilha Ovitrampa</option>
                  <option value="liraa">Levantamento LIRAa / LIA</option>
                  <option value="pe">Ponto Estratégico (PE)</option>
                  <option value="denuncia">Atendimento a Denúncia</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Observações / Localização do Criadouro
                </label>
                <textarea
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  rows={3}
                  placeholder="Ex: Coletado em tambor de 200L nos fundos do quintal..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Gerar Código e Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Receber Amostra */}
      {isReceiveOpen && selectedSample && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              Confirmar Recebimento de Amostra
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Código: <strong className="text-slate-900 dark:text-white">{selectedSample.sampleCode}</strong>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Ao confirmar, a amostra dará entrada na bancada de triagem do laboratório com data e carimbo de recebimento auditável.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsReceiveOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReceive}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Confirmar Recebimento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Identificação Taxonômica & Emissão de Laudo */}
      {isIdentifyOpen && selectedSample && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Microscope className="w-5 h-5 text-emerald-600" />
              Identificação Taxonômica ({selectedSample.sampleCode})
            </h3>

            <form onSubmit={handleSaveIdentification} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Espécie Identificada
                </label>
                <select
                  value={identSpecies}
                  onChange={e => setIdentSpecies(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="Aedes aegypti">Aedes aegypti (Vetor Principal)</option>
                  <option value="Aedes albopictus">Aedes albopictus</option>
                  <option value="Culex spp.">Culex spp. (Pernilongo comum)</option>
                  <option value="Anopheles spp.">Anopheles spp. (Vetor da Malária)</option>
                  <option value="Outros">Outros / Não vetor</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Estágio Biológico
                  </label>
                  <select
                    value={identStage}
                    onChange={e => setIdentStage(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="larva">Larva (L3/L4)</option>
                    <option value="pupa">Pupa</option>
                    <option value="ovo">Ovo</option>
                    <option value="adulto">Mosquito Adulto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Quantidade de Espécimes
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={identQuantity}
                    onChange={e => setIdentQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Parecer Técnico e Recomendações
                </label>
                <textarea
                  value={identNotes}
                  onChange={e => setIdentNotes(e.target.value)}
                  rows={3}
                  placeholder="Laudo técnico: espécimes confirmados. Recomenda-se tratamento focal..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Ao finalizar este laudo, caso positivo para <em>Aedes</em>, o foco territorial será automaticamente marcado como confirmado, o cálculo de risco do setor será atualizado e um alerta sanitário será emitido.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsIdentifyOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Gravar Laudo e Finalizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Timeline e Rastreabilidade Completa */}
      {isTimelineOpen && selectedSample && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Rastreabilidade Completa: {selectedSample.sampleCode}
                </h3>
                <p className="text-xs text-slate-500">Histórico cronológico imutável com carimbos e auditoria</p>
              </div>
              <button
                onClick={() => setIsTimelineOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Timeline Visual */}
            <div className="relative pl-6 border-l-2 border-emerald-500/40 space-y-6">
              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">1. Coleta em Campo</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Data: {new Date(selectedSample.collectionDate).toLocaleDateString('pt-BR')} | ACE: {selectedSample.agentName || 'Agente de Campo'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Local: {selectedSample.propertyAddress || 'Território Municipal'} (Origem: {selectedSample.originType})
                </p>
              </div>

              <div className="relative">
                <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full ${
                  getStepIndex(selectedSample.status) >= 2 ? 'bg-emerald-500' : 'bg-slate-300'
                } border-2 border-white dark:border-slate-800`} />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">2. Recebimento no Laboratório</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {selectedSample.receivedAt
                    ? `Recebido em: ${new Date(selectedSample.receivedAt).toLocaleString('pt-BR')} por ${selectedSample.receivedByName || 'Técnico de Laboratório'}`
                    : 'Aguardando entrega na bancada de triagem'}
                </p>
              </div>

              <div className="relative">
                <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full ${
                  getStepIndex(selectedSample.status) >= 3 ? 'bg-emerald-500' : 'bg-slate-300'
                } border-2 border-white dark:border-slate-800`} />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">3. Análise Microscópica / Triagem</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {getStepIndex(selectedSample.status) >= 3
                    ? 'Amostra processada em estereomicroscópio óptico sob chave dicotômica oficial'
                    : 'Pendente de microscopia'}
                </p>
              </div>

              <div className="relative">
                <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full ${
                  getStepIndex(selectedSample.status) >= 4 ? 'bg-emerald-500' : 'bg-slate-300'
                } border-2 border-white dark:border-slate-800`} />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">4. Identificação de Espécies</h4>
                {selectedSample.identifications && selectedSample.identifications.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {selectedSample.identifications.map(ident => (
                      <div
                        key={ident.id}
                        className="p-2.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <div className="flex justify-between font-semibold">
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {ident.species} (Estágio: {ident.stage})
                          </span>
                          <span>Quantidade: {ident.quantity}</span>
                        </div>
                        {ident.notes && <p className="text-slate-500 mt-1">{ident.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Ainda sem identificação finalizada</p>
                )}
              </div>

              <div className="relative">
                <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full ${
                  selectedSample.status === 'finalizada' ? 'bg-emerald-500' : 'bg-slate-300'
                } border-2 border-white dark:border-slate-800`} />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">5. Conclusão & Repercussão</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {selectedSample.status === 'finalizada'
                    ? `Laudo finalizado em ${new Date(selectedSample.updatedAt).toLocaleString('pt-BR')}. Repercussões territoriais aplicadas.`
                    : 'Aguardando conclusão'}
                </p>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setIsTimelineOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg text-sm font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
