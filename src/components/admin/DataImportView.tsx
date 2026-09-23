import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  RefreshCw,
  Clock,
  Layers,
  History,
  Check,
  FileText,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { dataImportService, ImportJobRecord } from '../../services/dataImportService';
import { PageHeader } from '../ui';
import { useMunicipalityId } from '../../contexts/AuthContext';

export const DataImportView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [entityType, setEntityType] = useState<string>('PROPERTIES');
  const [file, setFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [recentJobs, setRecentJobs] = useState<ImportJobRecord[]>([]);
  const [importResult, setImportResult] = useState<{
    job: ImportJobRecord;
    errors: any[];
  } | null>(null);

  const schema = dataImportService.getEntitySchema(entityType);

  useEffect(() => {
    loadRecentJobs();
  }, []);

  const loadRecentJobs = async () => {
    const jobs = await dataImportService.getRecentJobs(municipalityId);
    setRecentJobs(jobs);
  };

  // Etapa 1 -> 2: Leitura do arquivo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    const reader = new FileReader();

    reader.onload = evt => {
      const text = evt.target?.result as string;
      const { headers, rows } = dataImportService.parseCSV(text);
      setFileHeaders(headers);
      setFileRows(rows);

      // Auto-mapeamento por proximidade de nome
      const initialMap: Record<string, string> = {};
      schema.fields.forEach(f => {
        const found = headers.find(
          h =>
            h.toLowerCase() === f.name.toLowerCase() ||
            h.toLowerCase() === f.label.toLowerCase() ||
            h.toLowerCase().includes(f.name.toLowerCase())
        );
        if (found) initialMap[f.name] = found;
      });
      setMapping(initialMap);

      setCurrentStep(3); // Avança para Mapeamento
    };

    reader.readAsText(uploadedFile);
  };

  // Execução final da importação
  const handleExecuteImport = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      const res = await dataImportService.executeBatchImport(
        entityType,
        file.name,
        file.size,
        fileRows,
        mapping,
        updateExisting,
        municipalityId
      );

      setImportResult({ job: res.job, errors: res.errors });
      setCurrentStep(7); // Etapa de Resultados
      loadRecentJobs();
    } catch (err) {
      console.error('Falha na importação:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadErrorsCSV = () => {
    if (!importResult || importResult.errors.length === 0) return;
    const csvContent =
      'data:text/csv;charset=utf-8,Linha,Motivo\n' +
      importResult.errors.map(e => `${e.line},${e.reason}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `erros_importacao_${file?.name || 'arquivo'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetFlow = () => {
    setCurrentStep(1);
    setFile(null);
    setFileHeaders([]);
    setFileRows([]);
    setMapping({});
    setImportResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Institucional */}
      <PageHeader
        icon={Upload}
        title="Central de Importação e Carga Segura de Dados Municipais"
        subtitle="Carga massiva de Imóveis, Bairros, Quadras, ACEs e Armadilhas com validação prévia e prevenção de duplicidade"
        actions={
          <button
            onClick={loadRecentJobs}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            title="Atualizar histórico"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {/* Barra de Progresso dos 7 Passos */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex items-center justify-between min-w-[640px] text-xs font-semibold">
          {[
            { step: 1, label: '1. Seleção' },
            { step: 2, label: '2. Upload' },
            { step: 3, label: '3. Mapeamento' },
            { step: 4, label: '4. Validação' },
            { step: 5, label: '5. Prévia' },
            { step: 6, label: '6. Processamento' },
            { step: 7, label: '7. Resultado' },
          ].map((s, idx) => (
            <div key={s.step} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  currentStep >= s.step
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {currentStep > s.step ? <Check className="w-4 h-4" /> : s.step}
              </div>
              <span className={currentStep === s.step ? 'text-indigo-900 font-bold' : 'text-slate-500'}>
                {s.label}
              </span>
              {idx < 6 && <ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-1" />}
            </div>
          ))}
        </div>
      </div>

      {/* ÁREA PRINCIPAL DO FLUXO */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        {/* PASSO 1: SELEÇÃO DA ENTIDADE */}
        {currentStep === 1 && (
          <div className="space-y-4 max-w-xl mx-auto text-center py-6">
            <h3 className="text-base font-bold text-slate-900">Qual conjunto de dados você deseja importar?</h3>
            <p className="text-xs text-slate-500">
              O sistema validará a unicidade de chaves primárias e integrará os registros à base oficial do município.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
              {[
                { id: 'PROPERTIES', label: 'Cadastro de Imóveis', desc: 'Endereços, números, quarteirões e GPS' },
                { id: 'NEIGHBORHOODS', label: 'Bairros e Setores', desc: 'Estratificação territorial e população' },
                { id: 'AGENTS', label: 'Agentes Comunitários (ACE)', desc: 'Matrículas funcionais e contatos' },
                { id: 'STRATEGIC_POINTS', label: 'Pontos Estratégicos (PE)', desc: 'Borracharias, cemitérios e ferros-velhos' },
                { id: 'OVITRAMPAS', label: 'Armadilhas (Ovitrampas)', desc: 'Códigos de armadilhas e logradouros' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setEntityType(opt.id);
                    setCurrentStep(2);
                  }}
                  className={`p-4 rounded-xl border text-left transition hover:border-indigo-500 hover:shadow-xs ${
                    entityType === opt.id ? 'border-indigo-600 bg-indigo-50/40' : 'border-slate-200'
                  }`}
                >
                  <strong className="text-xs text-slate-900 block">{opt.label}</strong>
                  <span className="text-[11px] text-slate-500">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASSO 2: UPLOAD DO ARQUIVO */}
        {currentStep === 2 && (
          <div className="space-y-4 max-w-lg mx-auto text-center py-6">
            <h3 className="text-base font-bold text-slate-900">Upload de Arquivo ({schema.label})</h3>
            <p className="text-xs text-slate-500">
              Formatos aceitos: <strong>CSV</strong> ou <strong>XLSX</strong>. Codificação recomendada: UTF-8.
            </p>

            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 text-center transition cursor-pointer relative bg-slate-50/50">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <FileSpreadsheet className="w-12 h-12 text-indigo-500 mx-auto" />
              <p className="text-sm font-bold text-slate-800 mt-2">Clique ou arraste o arquivo aqui</p>
              <p className="text-xs text-slate-400 mt-1">Limite máximo de 20 MB por arquivo</p>
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Voltar
              </button>
            </div>
          </div>
        )}

        {/* PASSO 3: MAPEAMENTO DE COLUNAS */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Mapeamento de Colunas ({file?.name})</h3>
                <p className="text-xs text-slate-500">
                  Associe as colunas da sua planilha com os campos obrigatórios do banco de dados municipal.
                </p>
              </div>
              <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded font-bold">
                {fileRows.length} linhas detectadas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {schema.fields.map(f => (
                <div key={f.name} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      {f.label} {f.required && <span className="text-rose-600">*</span>}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{f.name}</span>
                  </div>
                  <select
                    value={mapping[f.name] || ''}
                    onChange={e => setMapping({ ...mapping, [f.name]: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Não mapeado --</option>
                    {fileHeaders.map(h => (
                      <option key={h} value={h}>
                        Coluna: {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                onClick={() => setCurrentStep(5)} // Avança para Prévia
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <span>Avançar para Pré-Visualização</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PASSO 5: PRÉ-VISUALIZAÇÃO DOS DADOS */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pré-Visualização dos Registros (Primeiras 5 linhas)</h3>
                <p className="text-xs text-slate-500">Confira a correspondência dos dados antes de confirmar a importação em lotes.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                  <tr>
                    {schema.fields.map(f => (
                      <th key={f.name} className="py-2 px-3 border-r border-slate-200">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fileRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 font-mono text-[11px]">
                      {schema.fields.map(f => (
                        <td key={f.name} className="py-2 px-3 border-r border-slate-100">
                          {row[mapping[f.name]] || <span className="text-slate-400 font-sans italic">vazio</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Opção de Atualização de Existentes */}
            <div className="p-3.5 bg-indigo-50/50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chkUpdate"
                  checked={updateExisting}
                  onChange={e => setUpdateExisting(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <label htmlFor="chkUpdate" className="font-semibold text-slate-800 cursor-pointer">
                  Atualizar registros existentes se o identificador já estiver cadastrado (evita duplicação)
                </label>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Recomendado</span>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Voltar ao Mapeamento
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>{isProcessing ? 'Importando Lotes...' : 'Confirmar e Iniciar Importação'}</span>
              </button>
            </div>
          </div>
        )}

        {/* PASSO 7: RESULTADOS E RELATÓRIO DE ERROS */}
        {currentStep === 7 && importResult && (
          <div className="space-y-6 text-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">Importação Concluída com Sucesso!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Os registros foram processados e associados à jurisdição municipal em conformidade com as regras de RLS.
              </p>
            </div>

            {/* Painel de Métricas do Job */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-left text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Processado</span>
                <p className="text-xl font-black text-slate-900 mt-1">{importResult.job.total_records}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800">Registros Válidos</span>
                <p className="text-xl font-black text-emerald-700 mt-1">{importResult.job.valid_records}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-800">Atualizados / Dup</span>
                <p className="text-xl font-black text-amber-700 mt-1">{importResult.job.duplicate_records}</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-[10px] uppercase font-bold text-rose-800">Inválidos / Erros</span>
                <p className="text-xl font-black text-rose-700 mt-1">{importResult.job.invalid_records}</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={handleDownloadErrorsCSV}
                  className="px-4 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Relatório de Erros ({importResult.errors.length}) em CSV</span>
                </button>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex justify-center gap-3">
              <button
                onClick={handleResetFlow}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                Realizar Nova Importação
              </button>
            </div>
          </div>
        )}
      </div>

      {/* HISTÓRICO RECENTE DE JOBS DE IMPORTAÇÃO */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <span>Histórico de Importações Recentes (import_jobs)</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">{recentJobs.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Arquivo</th>
                <th className="py-2.5 px-3">Entidade</th>
                <th className="py-2.5 px-3">Total</th>
                <th className="py-2.5 px-3">Válidos</th>
                <th className="py-2.5 px-3">Erros</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {recentJobs.map(j => (
                <tr key={j.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900 font-sans">{j.file_name}</td>
                  <td className="py-2.5 px-3">{j.entity_type}</td>
                  <td className="py-2.5 px-3">{j.total_records}</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">{j.valid_records}</td>
                  <td className="py-2.5 px-3 text-rose-600 font-bold">{j.invalid_records}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                      j.status === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 font-sans text-xs">
                    {j.created_at ? new Date(j.created_at).toLocaleDateString('pt-BR') : 'Hoje'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
