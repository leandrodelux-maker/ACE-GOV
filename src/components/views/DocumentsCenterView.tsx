import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  CheckCircle2,
  ShieldCheck,
  Search,
  KeyRound,
  FileCheck,
  Sparkles,
  Lock,
  ExternalLink,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  documentTemplateService,
  DocumentTemplate,
} from '../../services/documentTemplateService';
import {
  signatureService,
  DocumentSignature,
} from '../../services/signatureService';
import { PageHeader } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES_REGISTRY } from '../../services/rbac';

interface DocumentsCenterViewProps {
  municipalityId?: string;
}

export const DocumentsCenterView: React.FC<DocumentsCenterViewProps> = ({ municipalityId }) => {
  const { user: sessionUser, municipality: sessionMunicipality } = useAuth();
  const [activeTab, setActiveTab] = useState<'gerador' | 'verificador'>('gerador');
  const templates = documentTemplateService.getTemplates();

  // Seleção e preenchimento
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate>(templates[0]);
  // Valores iniciais: apenas o que vem da sessão; os demais campos são preenchidos pelo usuário.
  const buildDefaultVariables = (): Record<string, string> => ({
    municipio: sessionMunicipality ? `Município de ${sessionMunicipality.name}` : '',
    data: new Date().toLocaleDateString('pt-BR'),
    agente: sessionUser?.name || '',
    supervisor: '',
    bairro: '',
    imovel: '',
    ciclo: '',
    resultado: '',
    numero_protocolo: '',
    motivo_denuncia: '',
    situacao_encontrada: '',
    providencias: '',
    ponto_estrategico: '',
    categoria_pe: '',
    criadouros_encontrados: '',
    tratamento_realizado: '',
    iip_geral: '',
    classificacao_risco: '',
    estratos_criticos: '',
    tipo_deposito_predominante: '',
    codigo_amostra: '',
    agente_coletor: sessionUser?.name || '',
    biologo_analista: '',
    origem_amostra: '',
    especies_identificadas: '',
    conclusao_laudo: '',
    numero_os: '',
    tipo_os: '',
    prioridade: '',
    equipe_designada: '',
    local_execucao: '',
    objetivo_acao: '',
  });
  const [variables, setVariables] = useState<Record<string, string>>(() => buildDefaultVariables());

  const [generatedDoc, setGeneratedDoc] = useState<string>('');
  const [signature, setSignature] = useState<DocumentSignature | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  // Verificador de autenticidade
  const [verificationInput, setVerificationInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    signature?: DocumentSignature;
    message: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Gerar o documento dinamicamente ao selecionar
  const handleSelectTemplate = (tmpl: DocumentTemplate) => {
    setSelectedTemplate(tmpl);
    setSignature(null);

    // Pré-preenche apenas dados da sessão (sem valores de exemplo)
    const baseVars: Record<string, string> = buildDefaultVariables();

    setVariables(baseVars);
    const rendered = documentTemplateService.renderDocument(tmpl.id, baseVars);
    setGeneratedDoc(rendered);
  };

  const handleVariableChange = (key: string, value: string) => {
    const updated = { ...variables, [key]: value };
    setVariables(updated);
    setGeneratedDoc(documentTemplateService.renderDocument(selectedTemplate.id, updated));
    setSignature(null); // Alterar variáveis invalida a assinatura anterior
  };

  const handleSignDocument = async () => {
    // A assinatura é sempre do usuário autenticado
    if (!generatedDoc || !sessionUser) return;
    setIsSigning(true);
    try {
      const res = await signatureService.signDocument({
        documentId: `DOC-${selectedTemplate.id}-${Date.now()}`,
        documentType: selectedTemplate.name,
        documentContent: generatedDoc,
        userId: sessionUser.id,
        userName: sessionUser.name,
        userRole: ROLES_REGISTRY[sessionUser.role]?.name || sessionUser.role,
        municipalityId,
      });

      if (res.success && res.signature) {
        setSignature(res.signature);
      } else {
        alert(`Erro na assinatura: ${res.error}`);
      }
    } finally {
      setIsSigning(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationInput) return;
    setIsVerifying(true);
    try {
      const res = await signatureService.verifySignatureByCode(verificationInput);
      setVerificationResult(res);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="print:hidden">
        <PageHeader
          icon={FileText}
          title="Central de Documentos & Assinatura Eletrônica"
          subtitle="Geração de laudos, certidões e relatórios com substituição dinâmica e carimbo digital imutável SHA-256"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('gerador')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'gerador' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Gerador de Documentos
              </button>
              <button
                onClick={() => setActiveTab('verificador')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'verificador' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Verificar Autenticidade
              </button>
            </div>
          }
        />
      </div>

      {activeTab === 'gerador' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna Esquerda: Catálogo de Modelos (4 colunas) */}
          <div className="lg:col-span-4 space-y-3 print:hidden">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Modelos Oficiais do SUS ({templates.length})
              </h3>

              <div className="space-y-1.5 max-h-[580px] overflow-y-auto">
                {templates.map(tmpl => {
                  const isSelected = selectedTemplate.id === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className={`w-full text-left p-3 rounded-lg text-xs transition-colors border ${
                        isSelected
                          ? 'bg-teal-50 border-teal-300 text-teal-900 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-200 font-semibold'
                          : 'border-slate-200 dark:border-slate-700/70 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold">{tmpl.name}</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        {tmpl.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Painel de Variáveis Dinâmicas */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Variáveis do Modelo
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedTemplate.variables.map(v => (
                  <div key={v}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                      {`{{${v}}}`}
                    </label>
                    <input
                      type="text"
                      value={variables[v] || ''}
                      onChange={e => handleVariableChange(v, e.target.value)}
                      disabled={!!signature}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Visualização do Documento & Assinatura (8 colunas) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Modelo: {selectedTemplate.name}
                </span>
                {signature ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <Lock className="w-3 h-3" />
                    Assinado e Imutável
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Rascunho Editável
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!signature ? (
                  <button
                    onClick={handleSignDocument}
                    disabled={isSigning}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {isSigning ? 'Assinando...' : 'Assinar Eletronicamente'}
                  </button>
                ) : null}

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / PDF
                </button>
              </div>
            </div>

            {/* FOLHA OFICIAL DO DOCUMENTO */}
            <div className="bg-white p-8 rounded-xl border-2 border-slate-300 text-slate-900 shadow-md font-serif text-sm leading-relaxed min-h-[500px] flex flex-col justify-between">
              <div>
                {/* Brasão / Cabeçalho SUS */}
                <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                  <span className="block text-xs font-black uppercase tracking-wider text-slate-600">
                    REPÚBLICA FEDERATIVA DO BRASIL • SISTEMA ÚNICO DE SAÚDE
                  </span>
                  <h2 className="text-base font-bold text-slate-900 mt-1 uppercase">
                    {variables.municipio || 'MUNICÍPIO DE ENDEMIAS GOV'}
                  </h2>
                  <span className="block text-xs font-semibold text-slate-700">
                    SECRETARIA MUNICIPAL DE SAÚDE • VIGILÂNCIA AMBIENTAL EM SAÚDE
                  </span>
                </div>

                {/* Conteúdo Renderizado */}
                <div className="whitespace-pre-line text-slate-800">
                  {generatedDoc || documentTemplateService.renderDocument(selectedTemplate.id, variables)}
                </div>
              </div>

              {/* Bloco de Assinatura Eletrônica Imutável */}
              {signature && (
                <div className="mt-8 pt-4 border-t-2 border-slate-800 bg-slate-50 p-4 rounded-lg font-sans text-xs">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-8 h-8 text-teal-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 block text-sm">
                        DOCUMENTO ASSINADO ELETRONICAMENTE
                      </span>
                      <p className="text-slate-700">
                        <strong>Signatário:</strong> {signature.userName} ({signature.userRole})
                      </p>
                      <p className="text-slate-600">
                        <strong>Data/Hora Oficial:</strong> {new Date(signature.signedAt).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-slate-600 font-mono text-[11px]">
                        <strong>Hash Criptográfico SHA-256:</strong> {signature.documentHash}
                      </p>
                      <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                        <span>Código Verificador: <strong>{signature.verificationCode}</strong></span>
                        <span>Autenticação Interna Lei Federal nº 14.063/2020</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ABA: VERIFICADOR DE AUTENTICIDADE */
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Validação de Assinatura Eletrônica
            </h2>
            <p className="text-xs text-slate-500">
              Digite o código de verificação impresso no rodapé do documento para atestar a autenticidade e integridade pública do laudo
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Código Verificador (Ex: END-SIG-2026-XXXX-YYYY)
              </label>
              <input
                type="text"
                required
                placeholder="END-SIG-2026-..."
                value={verificationInput}
                onChange={e => setVerificationInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm font-mono text-center text-slate-900 dark:text-white uppercase tracking-widest focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
            >
              {isVerifying ? 'Verificando no Registro Municipal...' : 'Validar Documento'}
            </button>
          </form>

          {verificationResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                verificationResult.isValid
                  ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {verificationResult.isValid ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Documento Autêntico e Válido</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                    <span>Assinatura Inválida ou Não Encontrada</span>
                  </>
                )}
              </div>
              <p>{verificationResult.message}</p>

              {verificationResult.signature && (
                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/60 font-mono text-[11px] space-y-1 text-slate-700 dark:text-slate-300">
                  <p><strong>Signatário:</strong> {verificationResult.signature.userName}</p>
                  <p><strong>Cargo:</strong> {verificationResult.signature.userRole}</p>
                  <p><strong>Data/Hora:</strong> {new Date(verificationResult.signature.signedAt).toLocaleString('pt-BR')}</p>
                  <p className="truncate"><strong>SHA-256:</strong> {verificationResult.signature.documentHash}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
