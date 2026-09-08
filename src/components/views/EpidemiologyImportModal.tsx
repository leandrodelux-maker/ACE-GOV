import React, { useState } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Info,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import {
  epidemiologyImportService,
  ColumnMapping,
  ImportPreviewResult,
  ImportExecutionResult
} from '../../services/epidemiologyImportService';

interface EpidemiologyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  municipalityId: string;
  onImportComplete: () => void;
}

export const EpidemiologyImportModal: React.FC<EpidemiologyImportModalProps> = ({
  isOpen,
  onClose,
  municipalityId,
  onImportComplete
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'completed'>('upload');
  const [fileName, setFileName] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    notificationNumber: '',
    disease: '',
    notificationDate: '',
    symptomsDate: '',
    neighborhood: '',
    approximateAddress: '',
    classification: '',
    labResult: '',
    status: ''
  });
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<ImportExecutionResult | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setRawContent(text);

      try {
        setLoading(true);
        const { headers, rows } = epidemiologyImportService.parseCSV(text);
        if (headers.length === 0 || rows.length === 0) {
          throw new Error('Arquivo vazio ou formato CSV inválido.');
        }

        const mapping = epidemiologyImportService.detectDefaultMapping(headers);
        setDetectedHeaders(headers);
        setParsedRows(rows);
        setColumnMapping(mapping);

        // Validar e inspecionar duplicidades contra a base
        const preview = await epidemiologyImportService.validateAndPreview(rows, headers, mapping, municipalityId);
        setPreviewResult(preview);
        setStep('preview');
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao processar arquivo.');
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!previewResult) return;
    setStep('importing');
    setLoading(true);

    try {
      const result = await epidemiologyImportService.executeImport(
        previewResult.validRows,
        fileName,
        municipalityId
      );
      setExecutionResult(result);
      setStep('completed');
      onImportComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na execução da importação.');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setRawContent('');
    setPreviewResult(null);
    setErrorMsg(null);
    setExecutionResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Importador Epidemiológico de Notificações</h3>
              <p className="text-xs text-slate-400">Compatível com SINAN / e-SUS (CSV & Planilhas) • Conformidade LGPD</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Indicador de Passos */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className={`flex items-center gap-1.5 font-bold ${step === 'upload' ? 'text-rose-600' : 'text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center border text-[11px] bg-white">1</span>
              Arquivo & Mapeamento
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className={`flex items-center gap-1.5 font-bold ${step === 'preview' ? 'text-rose-600' : 'text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center border text-[11px] bg-white">2</span>
              Validação & Prévia
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className={`flex items-center gap-1.5 font-bold ${step === 'completed' ? 'text-emerald-600' : 'text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center border text-[11px] bg-white">3</span>
              Conclusão
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            Proteção LGPD Ativa: Nomes, CPFs e telefones descartados
          </div>
        </div>

        {/* Corpo Modal */}
        <div className="p-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* PASSO 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-rose-400 transition bg-slate-50/50">
                <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-800 mb-1">Selecione o arquivo de notificações</h4>
                <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
                  Formatos aceitos: CSV exportado do SINAN Web ou e-SUS com delimitador vírgula ou ponto-e-vírgula.
                </p>

                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition">
                  <UploadCloud className="w-4 h-4" />
                  <span>Escolher Arquivo CSV</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                <h5 className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-500" />
                  Campos Reconhecidos Automaticamente:
                </h5>
                <p className="text-slate-600">
                  Número da Notificação (<code>NU_NOTIFIC</code>), Agravo (<code>ID_AGRAVO</code>), Data de Notificação (<code>DT_NOTIFIC</code>), Bairro de Residência (<code>NM_BAIRRO</code>), Sintomas e Classificação Final.
                </p>
              </div>
            </div>
          )}

          {/* PASSO 2: PRÉVIA E DEDUPLICAÇÃO */}
          {step === 'preview' && previewResult && (
            <div className="space-y-5">
              {/* Contadores da Validação */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Novos Casos</span>
                  <span className="text-2xl font-bold text-emerald-800">{previewResult.newRecords}</span>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">Atualizações</span>
                  <span className="text-2xl font-bold text-blue-800">{previewResult.updatedRecords}</span>
                </div>
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-600 block">Duplicados (Ignorados)</span>
                  <span className="text-2xl font-bold text-slate-700">{previewResult.duplicateRecords}</span>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block">Erros de Linha</span>
                  <span className="text-2xl font-bold text-rose-800">{previewResult.errorRecords}</span>
                </div>
              </div>

              {/* Tabela de Amostragem */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span>Prévia das Linhas Validadas (Total: {previewResult.totalRows})</span>
                  <span className="text-[11px] text-slate-500 font-normal">Arquivo: {fileName}</span>
                </h5>

                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Linha</th>
                        <th className="py-2 px-3">Ação</th>
                        <th className="py-2 px-3">Nº Notificação</th>
                        <th className="py-2 px-3">Doença</th>
                        <th className="py-2 px-3">Bairro</th>
                        <th className="py-2 px-3">Data Notif.</th>
                        <th className="py-2 px-3">Classificação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewResult.validRows.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{row.rowIndex || idx + 1}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                row.actionType === 'new'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : row.actionType === 'update'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {(row.actionType || 'NOVO').toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-medium text-slate-800">{row.notificationNumber}</td>
                          <td className="py-2 px-3">{row.disease}</td>
                          <td className="py-2 px-3">{row.neighborhood || 'Não informado'}</td>
                          <td className="py-2 px-3 text-slate-500">{row.notificationDate}</td>
                          <td className="py-2 px-3">{row.classification || 'Suspeito'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {previewResult.validRows.length > 10 && (
                  <p className="text-[11px] text-slate-400 mt-1.5 text-right">
                    Exibindo 10 de {previewResult.validRows.length} registros validados
                  </p>
                )}
              </div>
            </div>
          )}

          {/* PASSO 3: IMPORTANDO */}
          {step === 'importing' && (
            <div className="py-12 text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-rose-600 animate-spin mx-auto" />
              <h4 className="text-base font-bold text-slate-800">Processando e Gravando Notificações</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Inserindo novos casos epidemiológicos e atualizando classificações laboratoriais com garantia de unicidade.
              </p>
            </div>
          )}

          {/* PASSO 4: CONCLUSÃO */}
          {step === 'completed' && executionResult && (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-800">Importação Concluída com Sucesso!</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                {executionResult.importedCount} novos casos inseridos e {executionResult.updatedCount} registros atualizados.
              </p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step === 'preview' ? (
            <>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
              >
                Trocar Arquivo
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={loading || (previewResult?.newRecords === 0 && previewResult?.updatedRecords === 0)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Confirmar & Gravar no Banco</span>
              </button>
            </>
          ) : step === 'completed' ? (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
              >
                Fechar e Atualizar Dashboard
              </button>
            </div>
          ) : (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
