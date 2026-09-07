import React, { useState } from 'react';
import {
  Home,
  Search,
  Filter,
  Plus,
  MapPin,
  Clock,
  Flame,
  CheckCircle,
  Repeat,
  AlertCircle,
  Eye,
  X,
  FileText,
  Camera,
  Activity,
  User,
  Phone,
} from 'lucide-react';
import { db } from '../../services/storage';
import { Property, PropertyType } from '../../types';

export const PropertiesView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [activeTab, setActiveTab] = useState<'geral' | 'local' | 'visitas' | 'focos' | 'pendencias' | 'denuncias' | 'bloqueios' | 'timeline'>('geral');

  const properties = db.getProperties();
  const neighborhoods = db.getNeighborhoods();
  const visits = db.getVisits();
  const complaints = db.getComplaints();
  const blocks = db.getEpidemiologyBlocks();

  const filteredProperties = properties.filter(prop => {
    const matchesSearch =
      prop.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prop.residentName && prop.residentName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesNeighborhood =
      selectedNeighborhood === 'ALL' || prop.neighborhoodId === selectedNeighborhood || prop.neighborhood === selectedNeighborhood;
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'FOCO' && prop.status === 'FOCO') ||
      (selectedStatus === 'REINCIDENTE' && prop.isRecurrent) ||
      (selectedStatus === 'FECHADO' && prop.status === 'FECHADO') ||
      (selectedStatus === 'PENDENTE' && prop.status === 'PENDENTE') ||
      (selectedStatus === 'TRABALHADO' && prop.lastVisitStatus === 'TRABALHADO');

    return matchesSearch && matchesNeighborhood && matchesStatus;
  });

  // Data for the selected property
  const propertyVisits = selectedProperty ? visits.filter(v => v.propertyId === selectedProperty.id) : [];
  const propertyComplaints = selectedProperty ? complaints.filter(c => c.neighborhood === selectedProperty.neighborhood) : [];
  const propertyBlocks = selectedProperty ? blocks.filter(b => b.targetNeighborhood === selectedProperty.neighborhood) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-600" />
            <span>Cadastro Sanitário e Ficha de Imóveis</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Base territorial com histórico sanitário, geolocalização, reincidências e intervenções
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
            {filteredProperties.length} imóveis listados
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex-1 min-w-[240px] text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código, logradouro ou proprietário..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={selectedNeighborhood}
            onChange={e => setSelectedNeighborhood(e.target.value)}
            className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Bairros</option>
            {neighborhoods.map(n => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">Todas as Situações</option>
            <option value="FOCO">Com Foco Ativo (Aedes)</option>
            <option value="REINCIDENTE">Reincidentes (≥3 focos)</option>
            <option value="FECHADO">Fechados / Pendentes</option>
            <option value="TRABALHADO">Trabalhados no Ciclo</option>
          </select>
        </div>
      </div>

      {/* Properties Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Código / Imóvel</th>
                <th className="py-3 px-4">Endereço</th>
                <th className="py-3 px-4">Bairro / Quadra</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4">Reincidência</th>
                <th className="py-3 px-4 text-right">Ficha Completa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProperties.map(prop => {
                const isFoci = prop.status === 'FOCO';
                const isRecurrent = prop.isRecurrent;
                const isClosed = prop.status === 'FECHADO';

                return (
                  <tr key={prop.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {prop.code}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{prop.address}, {prop.number}</p>
                      {prop.complement && <p className="text-[10px] text-slate-400">{prop.complement}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-700">{prop.neighborhood}</p>
                      <p className="text-[10px] text-slate-400">{prop.block}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {prop.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {isFoci ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                          FOCO DETECTADO
                        </span>
                      ) : isClosed ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          FECHADO / AUSENTE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          {prop.lastVisitStatus || 'TRABALHADO'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isRecurrent ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-700 flex items-center gap-1 w-fit">
                          <Repeat className="w-3 h-3" />
                          <span>{prop.fociHistoryCount}x Foco</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedProperty(prop);
                          setActiveTab('geral');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold transition text-xs flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Abrir Ficha</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ficha Completa do Imóvel Modal (Prompt 06 Requirements) */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded border border-sky-400/30">
                    {selectedProperty.code}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {selectedProperty.type}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">
                  {selectedProperty.address}, {selectedProperty.number}
                </h2>
                <p className="text-xs text-slate-400">
                  {selectedProperty.neighborhood} • {selectedProperty.block} • CEP 96810-150
                </p>
              </div>

              <button
                onClick={() => setSelectedProperty(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas da Ficha do Imóvel */}
            <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('geral')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'geral' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Dados Gerais
              </button>
              <button
                onClick={() => setActiveTab('local')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'local' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Localização & GPS
              </button>
              <button
                onClick={() => setActiveTab('visitas')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'visitas' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                3. Histórico de Visitas ({propertyVisits.length})
              </button>
              <button
                onClick={() => setActiveTab('focos')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'focos' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                4. Focos & Reincidência
              </button>
              <button
                onClick={() => setActiveTab('pendencias')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'pendencias' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                5. Pendências
              </button>
              <button
                onClick={() => setActiveTab('denuncias')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'denuncias' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                6. Denúncias
              </button>
              <button
                onClick={() => setActiveTab('bloqueios')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'bloqueios' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                7. Bloqueios
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'timeline' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                8. Linha do Tempo
              </button>
            </div>

            {/* Conteúdo da Aba Ativa */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs text-slate-700">
              {/* Aba 1: Dados Gerais */}
              {activeTab === 'geral' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Proprietário / Morador</span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedProperty.residentName || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Telefone de Contato</span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedProperty.residentPhone || '(51) 98765-4321'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Moradores Estimados</span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">4 pessoas</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Animais Domésticos</span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">Possui cão de guarda</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Vulnerabilidade Sanitária</span>
                      <p className="font-bold text-amber-600 text-sm mt-0.5">Média (Presença de piscina/recipientes)</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">ACE Responsável</span>
                      <p className="font-bold text-blue-700 text-sm mt-0.5">Carlos Silva (ACE-4821)</p>
                    </div>
                  </div>

                  {selectedProperty.notes && (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                      <span className="font-bold text-amber-900 text-xs">Observações do Agente de Campo:</span>
                      <p className="text-amber-800 mt-1">{selectedProperty.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Aba 2: Localização */}
              {activeTab === 'local' && (
                <div className="space-y-3">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 font-semibold">Latitude:</span>
                      <p className="font-mono font-bold text-slate-900">{selectedProperty.latitude}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Longitude:</span>
                      <p className="font-mono font-bold text-slate-900">{selectedProperty.longitude}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Setor Censitário:</span>
                      <p className="font-bold text-slate-900">Setor 01</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Quadra:</span>
                      <p className="font-bold text-slate-900">{selectedProperty.block}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Localização capturada com precisão GPS de 4.2m pelo aplicativo do ACE.
                  </p>
                </div>
              )}

              {/* Aba 3: Histórico de Visitas */}
              {activeTab === 'visitas' && (
                <div className="space-y-3">
                  {propertyVisits.length === 0 ? (
                    <p className="text-slate-500 text-center py-6">Nenhuma visita registrada no ciclo atual.</p>
                  ) : (
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                      {propertyVisits.map(v => (
                        <div key={v.id} className="p-3 bg-white space-y-1">
                          <div className="flex justify-between font-bold">
                            <span className="text-slate-900">{v.date} às {v.time} — ACE {v.agentName}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              v.fociFound ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {v.situation} {v.fociFound ? '(FOCO ENCONTRADO)' : ''}
                            </span>
                          </div>
                          <p className="text-slate-600">{v.conduct}</p>
                          {v.inspections.length > 0 && (
                            <div className="pt-1 text-[11px] text-slate-500">
                              Depósitos inspecionados: {v.inspections.map(i => `[${i.category}] ${i.name} (${i.quantity}x)`).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Aba 4: Focos & Reincidência */}
              {activeTab === 'focos' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 space-y-1">
                    <p className="font-bold text-sm">Status de Reincidência: {selectedProperty.isRecurrent ? 'REINCIDENTE' : 'NÃO REINCIDENTE'}</p>
                    <p>Total de focos detectados no histórico: <strong>{selectedProperty.fociHistoryCount} focos</strong>.</p>
                    <p className="text-[11px]">
                      Regra municipal: Imóveis com ≥ 3 focos nos últimos 90 dias são classificados com prioridade máxima de retorno sanitário.
                    </p>
                  </div>
                </div>
              )}

              {/* Aba 5: Pendências */}
              {activeTab === 'pendencias' && (
                <div className="space-y-2">
                  {selectedProperty.status === 'FECHADO' || selectedProperty.status === 'PENDENTE' ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                      <p className="font-bold">⚠️ Pendência Ativa: Imóvel Fechado</p>
                      <p className="mt-0.5">Morador ausente na primeira inspeção. Retorno agendado para o próximo sábado.</p>
                    </div>
                  ) : (
                    <p className="text-emerald-700 font-bold p-4 bg-emerald-50 rounded-xl">
                      Nenhuma pendência ativa. Imóvel trabalhado no ciclo.
                    </p>
                  )}
                </div>
              )}

              {/* Aba 6: Denúncias */}
              {activeTab === 'denuncias' && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-800">Denúncias registradas na vizinhança / logradouro:</p>
                  {propertyComplaints.slice(0, 2).map(c => (
                    <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>Protocolo: {c.protocol}</span>
                        <span className="text-amber-700">{c.status}</span>
                      </div>
                      <p className="text-slate-600">{c.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Aba 7: Bloqueios */}
              {activeTab === 'bloqueios' && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-800">Operações de Bloqueio Epidemiológico no Setor:</p>
                  {propertyBlocks.map(b => (
                    <div key={b.id} className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1">
                      <p className="font-bold">{b.code} — Bloqueio de {b.disease}</p>
                      <p>Raio de ação peridomiciliar: {b.radiusMeters} metros.</p>
                      <p className="text-xs font-semibold text-emerald-800">Status da Operação: {b.status}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Aba 8: Linha do Tempo */}
              {activeTab === 'timeline' && (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  <div className="relative space-y-0.5">
                    <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                    <p className="font-bold text-slate-900">1º Ciclo 2026 — Visita Domiciliar Registrada</p>
                    <p className="text-slate-500 text-[11px]">06/01/2026 por ACE Carlos Silva</p>
                  </div>
                  <div className="relative space-y-0.5">
                    <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-rose-600 ring-4 ring-white" />
                    <p className="font-bold text-rose-700">Foco de Aedes aegypti Eliminado</p>
                    <p className="text-slate-500 text-[11px]">Tratamento químico com Pyriproxyfen 0.5%</p>
                  </div>
                  <div className="relative space-y-0.5">
                    <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-slate-400 ring-4 ring-white" />
                    <p className="font-bold text-slate-700">Cadastro Sanitário do Imóvel Criado</p>
                    <p className="text-slate-500 text-[11px]">Geocodificação inicial via base territorial SUS</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedProperty(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs transition"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
