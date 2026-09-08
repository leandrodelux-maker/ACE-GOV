import React, { useState } from 'react';
import {
  Shield,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Key,
  FileText,
  MapPin,
  Calendar,
  Layers
} from 'lucide-react';
import { publicPortalService, PublicComplaintTrackingResult } from '../../services/publicPortalService';

interface PublicComplaintTrackingViewProps {
  initialProtocol?: string;
  onBackToPortal?: () => void;
  onNavigateToForm?: () => void;
}

export const PublicComplaintTrackingView: React.FC<PublicComplaintTrackingViewProps> = ({
  initialProtocol = '',
  onBackToPortal,
  onNavigateToForm
}) => {
  const [protocol, setProtocol] = useState(initialProtocol);
  const [token, setToken] = useState('');
  const [result, setResult] = useState<PublicComplaintTrackingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!protocol || !token) {
      setErrorMsg('Informe o número do protocolo e a chave de acompanhamento.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await publicPortalService.trackComplaint(protocol, token);
      setResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Denúncia não localizada com os dados informados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Header Institucional */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToPortal}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Voltar ao portal público"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white">Consulta Pública de Protocolo</h1>
              <p className="text-[11px] text-slate-400">Acompanhe o andamento da sua manifestação</p>
            </div>
          </div>

          <button
            onClick={onNavigateToForm}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            Nova Denúncia
          </button>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="max-w-2xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {/* Formulário de Busca */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-600" />
              <span>Dados para Consulta</span>
            </h2>
            <p className="text-xs text-slate-500">
              Para sua privacidade e segurança, digite o protocolo oficial e a chave de 6 dígitos gerada no registro.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSearch} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Protocolo Oficial</label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="END-2026-123456"
                    value={protocol}
                    onChange={e => setProtocol(e.target.value.toUpperCase())}
                    required
                    className="w-full py-2.5 pl-9 pr-3 rounded-xl border border-slate-200 uppercase font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Chave de Acompanhamento</label>
                <div className="relative">
                  <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Ex: A9B8C7"
                    value={token}
                    onChange={e => setToken(e.target.value.toUpperCase())}
                    required
                    className="w-full py-2.5 pl-9 pr-3 rounded-xl border border-slate-200 uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-xs transition flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>{loading ? 'Consultando...' : 'Localizar Protocolo'}</span>
            </button>
          </form>
        </div>

        {/* Resultado com Linha do Tempo de Status */}
        {result && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Protocolo</span>
                <h3 className="text-xl font-black text-slate-900 font-mono">{result.protocol}</h3>
                <p className="text-xs text-slate-500">{result.problemType} • {result.neighborhood}</p>
              </div>

              <div className="self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {result.statusLabel}
                </span>
              </div>
            </div>

            {/* Linha do Tempo Visual */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800">Evolução do Atendimento</h4>
              <div className="relative pl-6 space-y-6 border-l-2 border-slate-200 ml-2">
                {result.timeline.map((step, idx) => (
                  <div key={idx} className="relative">
                    <div
                      className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                        step.completed
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : step.current
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-slate-300'
                      }`}
                    >
                      {step.completed && <CheckCircle2 className="w-3 h-3" />}
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${step.completed || step.current ? 'text-slate-800' : 'text-slate-400'}`}>
                          {step.step}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{step.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Observações Públicas */}
            {result.publicNotes && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-700 block">Status Operacional:</span>
                <p>{result.publicNotes}</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
