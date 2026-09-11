import React, { useState, useEffect } from 'react';
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  FileSpreadsheet,
  Server,
  Upload,
  ExternalLink,
  ShieldCheck,
  Play,
  History,
  FileText,
  Lock,
} from 'lucide-react';
import {
  integrationService,
  IntegrationConfigItem,
  IntegrationJobItem,
  IntegrationProvider,
  OFFICIAL_PROVIDERS,
} from '../../services/integrationService';
import { PageHeader } from '../ui';

interface IntegrationsViewProps {
  municipalityId?: string;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({ municipalityId }) => {
  const [integrations, setIntegrations] = useState<IntegrationConfigItem[]>([]);
  const [jobs, setJobs] = useState<IntegrationJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningProvider, setRunningProvider] = useState<string | null>(null);

  // Modal de Importação Manual Estruturada
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [selectedProviderForImport, setSelectedProviderForImport] = useState<IntegrationProvider>('sinan');
  const [manualFileName, setManualFileName] = useState('');
  const [isProcessingManual, setIsProcessingManual] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [intList, jobList] = await Promise.all([
        integrationService.getIntegrations(municipalityId),
        integrationService.getIntegrationJobs(municipalityId),
      ]);
      setIntegrations(intList);
      setJobs(jobList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [municipalityId]);

  const handleRunSync = async (provider: IntegrationProvider) => {
    setRunningProvider(provider);
    try {
      const res = await integrationService.runIntegrationJob(provider, municipalityId);
      if (res.success) {
        loadData();
      } else {
        alert(`Erro na sincronização: ${res.error}`);
      }
    } finally {
      setRunningProvider(null);
    }
  };

  const handleToggleStatus = async (item: IntegrationConfigItem) => {
    const nextStatus = item.status === 'ativo' ? 'inativo' : 'ativo';
    const res = await integrationService.updateIntegrationStatus(
      item.provider,
      nextStatus,
      municipalityId
    );
    if (res.success) {
      loadData();
    }
  };

  const handleManualImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFileName) return;

    setIsProcessingManual(true);
    try {
      const res = await integrationService.runIntegrationJob(selectedProviderForImport, municipalityId);
      if (res.success) {
        setIsManualOpen(false);
        setManualFileName('');
        loadData();
        alert('Arquivo estruturado processado com sucesso e deduplicação aplicada!');
      }
    } finally {
      setIsProcessingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        icon={Server}
        title="Central de Integrações Governamentais"
        subtitle="Conectores oficiais com e-SUS APS, SINAN, GAL, SIVEP, CNES e IBGE com deduplicação segura"
        actions={
          <>
            <button
              onClick={() => setIsManualOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-medium transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importação Estruturada (CSV/XLSX)
            </button>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </>
        }
      />

      {/* Alerta de Diretriz Governamental */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold block text-sm">
            Diretrizes Oficiais do Ministério da Saúde & DATASUS
          </span>
          <p>
            O Endemias GOV opera em conformidade estrita com a interoperabilidade do SUS. Nenhum banco externo é modificado sem permissão explícita, chaves de autenticação são criptografadas e todos os registros passam por pipeline de deduplicação automática.
          </p>
        </div>
      </div>

      {/* Catálogo de Integrações */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map(item => {
          const isRunning = runningProvider === item.provider;
          const isActive = item.status === 'ativo';

          return (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {item.integrationType.replace('_', ' ').toUpperCase()}
                  </span>

                  <button
                    onClick={() => handleToggleStatus(item)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isActive ? 'Ativo' : 'Inativo'}
                  </button>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2">
                  {item.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {item.description}
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Última Sincronização:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {item.lastSync ? new Date(item.lastSync).toLocaleString('pt-BR') : 'Nunca executada'}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <a
                    href={
                      OFFICIAL_PROVIDERS.find(p => p.provider === item.provider)?.officialDocUrl ||
                      '#'
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Padrão Oficial
                  </a>

                  <button
                    onClick={() => handleRunSync(item.provider)}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
                    {isRunning ? 'Sincronizando...' : 'Sincronizar'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Histórico de Jobs e Processamento ETL */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-600" />
            Histórico Recente de Jobs de Interoperabilidade
          </h3>
          <span className="text-xs text-slate-500">{jobs.length} execuções registradas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold uppercase">
                <th className="py-2.5 px-4">Provedor / Sistema</th>
                <th className="py-2.5 px-4">Início</th>
                <th className="py-2.5 px-4">Término</th>
                <th className="py-2.5 px-4">Registros Lidos</th>
                <th className="py-2.5 px-4">Criados</th>
                <th className="py-2.5 px-4">Atualizados</th>
                <th className="py-2.5 px-4">Erros</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400 italic">
                    Nenhum job de integração executado recentemente.
                  </td>
                </tr>
              ) : (
                jobs.map(job => (
                  <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                    <td className="py-2.5 px-4 font-bold uppercase text-slate-900 dark:text-white">
                      {job.provider}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {new Date(job.startedAt).toLocaleTimeString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {job.finishedAt ? new Date(job.finishedAt).toLocaleTimeString('pt-BR') : '---'}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {job.recordsRead}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-emerald-600 font-semibold">
                      +{job.recordsCreated}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-blue-600 font-semibold">
                      ~{job.recordsUpdated}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-rose-600">
                      {job.errors}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {job.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Importação Estruturada Manual */}
      {isManualOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-600" />
              Importação Estruturada Manual
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Faça a carga de arquivos oficiais do SINAN, e-SUS APS ou planilhas de agentes com validação de layout:
            </p>

            <form onSubmit={handleManualImportSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Provedor / Sistema de Origem
                </label>
                <select
                  value={selectedProviderForImport}
                  onChange={e => setSelectedProviderForImport(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="sinan">SINAN - Notificações de Dengue/Chikungunya (CSV)</option>
                  <option value="esus_aps">e-SUS APS - Cadastros Domiciliares (XML/JSON)</option>
                  <option value="gal">GAL - Laudos de Lacen (CSV/XLSX)</option>
                  <option value="cnes">CNES - Estabelecimentos de Saúde</option>
                  <option value="ibge">IBGE - Malha Censitária</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Arquivo Oficial (.csv, .xlsx, .zip)
                </label>
                <input
                  type="file"
                  required
                  onChange={e => setManualFileName(e.target.files?.[0]?.name || '')}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 dark:file:bg-cyan-950 dark:file:text-cyan-300 hover:file:bg-cyan-100"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400">
                ✓ Deduplicação por chave natural SUS<br />
                ✓ Validação de schema oficial MS<br />
                ✓ Registro em trilha de auditoria
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsManualOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessingManual}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-semibold transition-colors"
                >
                  {isProcessingManual ? 'Processando ETL...' : 'Iniciar Carga'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
