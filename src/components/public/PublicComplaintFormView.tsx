import React, { useState } from 'react';
import {
  Shield,
  Send,
  Camera,
  MapPin,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Copy,
  Info,
  Lock
} from 'lucide-react';
import { publicPortalService, PublicComplaintPayload } from '../../services/publicPortalService';

interface PublicComplaintFormViewProps {
  onBackToPortal?: () => void;
  onNavigateToTracking?: (protocol?: string) => void;
}

export const PublicComplaintFormView: React.FC<PublicComplaintFormViewProps> = ({
  onBackToPortal,
  onNavigateToTracking
}) => {
  const municipalityId = '00000000-0000-0000-0000-000000000001';

  const [problemType, setProblemType] = useState<PublicComplaintPayload['problemType']>('terreno_baldinho');
  const [neighborhood, setNeighborhood] = useState('');
  const [approximateAddress, setApproximateAddress] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<{ protocol: string; trackingToken: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!neighborhood || !approximateAddress || !description) {
      setErrorMsg('Por favor, preencha o bairro, o endereço aproximado e a descrição do local.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await publicPortalService.submitPublicComplaint({
        municipalityId,
        problemType,
        neighborhood,
        approximateAddress,
        description,
        photoUrl: photoUrl || undefined,
        isAnonymous,
        reporterName: !isAnonymous ? reporterName : undefined,
        reporterPhone: !isAnonymous ? reporterPhone : undefined
      });

      setSubmittedData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao registrar denúncia. Tente novamente mais tarde.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyProtocol = () => {
    if (!submittedData) return;
    navigator.clipboard.writeText(`Protocolo: ${submittedData.protocol} | Chave: ${submittedData.trackingToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
              <h1 className="text-sm font-black tracking-tight text-white">Canal Cidadão de Notificação de Focos</h1>
              <p className="text-[11px] text-slate-400">Vigilância em Saúde • Denúncia de Criadouros</p>
            </div>
          </div>

          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Sigilo Garantido
          </span>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-2xl mx-auto px-4 py-8 flex-1 w-full">
        {submittedData ? (
          /* Tela de Sucesso com Protocolo e Token */
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900">Notificação Registrada com Sucesso!</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Sua solicitação foi encaminhada diretamente para a fila de triagem da equipe de controle de vetores.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Número do Protocolo</span>
                <div className="text-2xl font-black text-slate-900 tracking-wide font-mono mt-0.5">
                  {submittedData.protocol}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Chave de Acompanhamento</span>
                <div className="text-lg font-bold text-emerald-700 font-mono tracking-widest mt-0.5">
                  {submittedData.trackingToken}
                </div>
              </div>

              <button
                onClick={handleCopyProtocol}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-xs transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'Copiado para a área de transferência!' : 'Copiar Protocolo & Chave'}</span>
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 text-left flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Atenção:</strong> Guarde o protocolo e a chave acima. Você precisará de ambos para consultar o andamento da vistoria sem expor dados pessoais.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => onNavigateToTracking?.(submittedData.protocol)}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                Consultar Andamento Agora
              </button>
              <button
                onClick={onBackToPortal}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Voltar ao Portal Público
              </button>
            </div>
          </div>
        ) : (
          /* Formulário de Denúncia */
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <span>Formulário de Denúncia de Criadouro</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Informe o local suspeito de proliferação de mosquitos. Suas informações ajudam a direcionar vistorias de campo.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo de Criadouro / Problema</label>
                <select
                  value={problemType}
                  onChange={e => setProblemType(e.target.value as any)}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="terreno_baldinho">Terreno Baldio com Mato Alto ou Entulho</option>
                  <option value="piscina_abandonada">Piscina Abandonada ou sem Tratamento Químico</option>
                  <option value="acumulo_lixo">Acúmulo de Lixo, Pneus ou Sucata</option>
                  <option value="caixa_dagua_aberta">Caixa d’Água Destampada ou Danificada</option>
                  <option value="foco_larvas">Presença Visível de Larvas de Mosquito</option>
                  <option value="outro">Outro Tipo de Criadouro</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bairro *</label>
                  <input
                    type="text"
                    placeholder="Ex: Centro, Vila Nova, Alvorada..."
                    value={neighborhood}
                    onChange={e => setNeighborhood(e.target.value)}
                    required
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Endereço Aproximado ou Ponto de Ref. *</label>
                  <input
                    type="text"
                    placeholder="Ex: Rua das Flores, próx. ao nº 120"
                    value={approximateAddress}
                    onChange={e => setApproximateAddress(e.target.value)}
                    required
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição Detalhada da Ocorrência *</label>
                <textarea
                  rows={3}
                  placeholder="Descreva o que foi observado no local (ex: água parada há semanas, cheiro forte, grande quantidade de mosquitos)..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                ></textarea>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-slate-500" />
                  <span>Link da Foto do Local (Opcional)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={photoUrl}
                  onChange={e => setPhotoUrl(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Opção de Anonimato */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Identificação do Denunciante</span>
                    <span className="text-[11px] text-slate-500">
                      Você pode optar por não se identificar (denúncia 100% anônima).
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={e => setIsAnonymous(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {!isAnonymous && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Seu Nome</label>
                      <input
                        type="text"
                        placeholder="Nome completo ou primeiro nome"
                        value={reporterName}
                        onChange={e => setReporterName(e.target.value)}
                        className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Telefone / WhatsApp</label>
                      <input
                        type="tel"
                        placeholder="(DDD) 99999-9999"
                        value={reporterPhone}
                        onChange={e => setReporterPhone(e.target.value)}
                        className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-md transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Registrando Denúncia...' : 'Enviar Denúncia para a Vigilância'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
