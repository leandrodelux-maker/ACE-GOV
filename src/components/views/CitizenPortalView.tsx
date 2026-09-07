import React, { useState } from 'react';
import {
  AlertCircle,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Camera,
  MapPin,
  Send,
  User,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { db } from '../../services/storage';
import { CitizenComplaint } from '../../types';

export const CitizenPortalView: React.FC = () => {
  const [complaints, setComplaints] = useState<CitizenComplaint[]>(db.getComplaints());
  const [activeTab, setActiveTab] = useState<'internal' | 'public_form' | 'search_protocol'>('internal');

  // Public form states
  const [complaintType, setComplaintType] = useState<CitizenComplaint['type']>('TERRENO_BALDIO');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('Vila Nova');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [generatedProtocol, setGeneratedProtocol] = useState<string | null>(null);

  // Search protocol state
  const [searchProtocolInput, setSearchProtocolInput] = useState('');
  const [foundComplaint, setFoundComplaint] = useState<CitizenComplaint | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  const handleRegisterComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !description) return;

    const newProtocol = `END-2026-000${complaints.length + 101}`;
    const newComplaint: CitizenComplaint = {
      id: `comp-${Date.now()}`,
      protocol: newProtocol,
      municipalityId: 'mun-santacruz',
      type: complaintType,
      address,
      neighborhood,
      description,
      citizenName: isAnonymous ? undefined : reporterName,
      status: 'RECEBIDA',
      createdAt: new Date().toISOString().split('T')[0],
      assignedAgentName: 'Equipe de Triagem',
      resolutionNotes: 'Denúncia recebida. Equipe de ACE escalada para inspeção sanitária.',
    };

    const updated = [newComplaint, ...complaints];
    setComplaints(updated);
    localStorage.setItem('endemias_complaints', JSON.stringify(updated));
    setGeneratedProtocol(newProtocol);
    setAddress('');
    setDescription('');
    setReporterName('');
  };

  const handleSearchProtocol = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchAttempted(true);
    const found = complaints.find(c => c.protocol.toLowerCase() === searchProtocolInput.trim().toLowerCase());
    setFoundComplaint(found || null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <span>Portal do Cidadão & Ouvidoria de Endemias</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Canal de denúncias públicas de focos de mosquito com protocolo oficial e triagem municipal
          </p>
        </div>

        {/* View mode switcher */}
        <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('internal')}
            className={`px-3 py-1.5 rounded-md transition ${activeTab === 'internal' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
          >
            Gestão Interna ({complaints.length})
          </button>
          <button
            onClick={() => setActiveTab('public_form')}
            className={`px-3 py-1.5 rounded-md transition ${activeTab === 'public_form' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
          >
            Formulário Cidadão
          </button>
          <button
            onClick={() => setActiveTab('search_protocol')}
            className={`px-3 py-1.5 rounded-md transition ${activeTab === 'search_protocol' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
          >
            Consultar Protocolo
          </button>
        </div>
      </div>

      {/* Mode 1: Internal Oversight List */}
      {activeTab === 'internal' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Denúncias Registradas pela População
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
              {complaints.filter(c => c.status !== 'RESOLVIDA').length} em andamento
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {complaints.map(comp => (
              <div key={comp.id} className="p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {comp.protocol}
                    </span>
                    <span className="font-bold text-slate-800 text-sm">{comp.type}</span>
                    <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-amber-100 text-amber-800">
                      Prioridade {comp.priority}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-slate-500 text-[11px]">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {comp.address} ({comp.neighborhood})
                    </span>
                    <span>•</span>
                    <span>Registrada em: {comp.createdAt}</span>
                    <span>•</span>
                    <span className="text-blue-700 font-medium">ACE: {comp.assignedAgentName || 'Triagem'}</span>
                  </div>

                  <p className="text-slate-600 bg-slate-50 p-2 rounded text-[11px]">
                    "{comp.description}"
                  </p>

                  {comp.resolutionNotes && (
                    <p className="text-[11px] text-emerald-800 bg-emerald-50 p-1.5 rounded font-medium">
                      Resposta ao Cidadão: {comp.resolutionNotes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                    comp.status === 'RESOLVIDA'
                      ? 'bg-emerald-100 text-emerald-800'
                      : comp.status === 'VISTORIA_REALIZADA'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {comp.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode 2: Public Complaint Form */}
      {activeTab === 'public_form' && (
        <div className="max-w-xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Registrar Denúncia de Foco de Mosquito</h2>
            <p className="text-xs text-slate-500">
              Ajude a combater o Aedes aegypti em nosso município. A denúncia gera um protocolo oficial de acompanhamento.
            </p>
          </div>

          {generatedProtocol ? (
            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl space-y-3 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-emerald-900">Denúncia Registrada com Sucesso!</h3>
              <p className="text-xs text-emerald-800">
                Guarde o seu número de protocolo para acompanhar a vistoria dos agentes de endemias:
              </p>
              <div className="p-3 bg-white rounded-lg border border-emerald-300 font-mono text-lg font-black text-emerald-900">
                {generatedProtocol}
              </div>
              <button
                onClick={() => setGeneratedProtocol(null)}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition"
              >
                Fazer Outra Denúncia
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegisterComplaint} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Local / Foco</label>
                <select
                  value={complaintType}
                  onChange={e => setComplaintType(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-medium text-slate-800"
                >
                  <option value="TERRENO_BALDIO">Terreno Baldio com Lixo e Água Parada</option>
                  <option value="IMOVEL_ABANDONADO">Imóvel Abandonado / Desocupado</option>
                  <option value="PISCINA_ABANDONADA">Piscina Sem Tratamento / Abandonada</option>
                  <option value="PNEUS">Depósito de Pneus / Borracharia</option>
                  <option value="AGUA_PARADA">Caixa d'Água / Tambores com Água Parada</option>
                  <option value="POSSIVEL_FOCO">Outro Criadouro</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Endereço Completo com Número</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Rua Marechal Deodoro, 450"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bairro</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Vila Nova"
                  value={neighborhood}
                  onChange={e => setNeighborhood(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição Detalhada da Situação</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva onde estão os focos, se há presença de larvas ou mosquitos adultos..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-medium text-slate-800"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={e => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Desejo realizar a denúncia de forma anônima</span>
                </label>
              </div>

              {!isAnonymous && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Seu Nome Completo (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Nome do denunciante"
                    value={reporterName}
                    onChange={e => setReporterName(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-medium text-slate-800"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Enviar Denúncia e Gerar Protocolo</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* Mode 3: Search Protocol */}
      {activeTab === 'search_protocol' && (
        <div className="max-w-xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Consultar Andamento da Denúncia</h2>
            <p className="text-xs text-slate-500">
              Digite o código do protocolo recebido no momento do cadastro (ex: END-2026-000101)
            </p>
          </div>

          <form onSubmit={handleSearchProtocol} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="END-2026-..."
              value={searchProtocolInput}
              onChange={e => setSearchProtocolInput(e.target.value)}
              className="flex-1 p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-xs uppercase"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition"
            >
              Consultar
            </button>
          </form>

          {searchAttempted && !foundComplaint && (
            <p className="text-xs text-rose-600 bg-rose-50 p-3 rounded-lg font-medium">
              Nenhuma denúncia encontrada com este número de protocolo. Verifique o código e tente novamente.
            </p>
          )}

          {foundComplaint && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="font-mono font-bold text-slate-900">{foundComplaint.protocol}</span>
                <span className="px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800">
                  {foundComplaint.status}
                </span>
              </div>
              <p><strong>Tipo:</strong> {foundComplaint.type}</p>
              <p><strong>Local:</strong> {foundComplaint.address} ({foundComplaint.neighborhood})</p>
              <p><strong>Data de Registro:</strong> {foundComplaint.createdAt}</p>
              <div className="p-3 bg-white rounded-lg border border-slate-200 mt-2">
                <strong className="text-slate-900 block mb-1">Parecer da Equipe de Endemias:</strong>
                <p className="text-slate-700">{foundComplaint.resolutionNotes || 'Em análise técnica pela equipe de campo.'}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
