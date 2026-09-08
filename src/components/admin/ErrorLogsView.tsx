import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  FileCode,
  Shield,
  CheckCircle,
  Eye,
  Clock,
  User,
  X,
} from 'lucide-react';
import { errorLoggingService, SystemErrorLog } from '../../services/errorLoggingService';

export const ErrorLogsView: React.FC = () => {
  const [logs, setLogs] = useState<SystemErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<SystemErrorLog | null>(null);
  const [severityFilter, setSeverityFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadLogs();
  }, [severityFilter, statusFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await errorLoggingService.getErrorLogs({
        severity: severityFilter,
        status: statusFilter,
      });
      setLogs(data);
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(l => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      l.request_id.toLowerCase().includes(term) ||
      l.page.toLowerCase().includes(term) ||
      l.action.toLowerCase().includes(term) ||
      l.error_message.toLowerCase().includes(term)
    );
  });

  const handleUpdateStatus = async (logId: string, newStatus: SystemErrorLog['status']) => {
    await errorLoggingService.updateErrorStatus(logId, newStatus);
    loadLogs();
    if (selectedLog && selectedLog.id === logId) {
      setSelectedLog({ ...selectedLog, status: newStatus });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-700">
              Acesso Exclusivo Superadmin
            </span>
          </div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2 mt-1">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span>Central de Tratamento & Log Centralizado de Erros</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rastreamento de exceções com Correlation/Request ID, sem exposição de senhas, tokens ou dados sensíveis
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          title="Recarregar logs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Request ID, página ou erro..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 w-64 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-200"
          >
            <option value="TODOS">Todas as Severidades</option>
            <option value="CRITICAL">Crítico</option>
            <option value="ERROR">Erro</option>
            <option value="WARNING">Aviso</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-200"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="NOVO">Novo</option>
            <option value="EM_INVESTIGACAO">Em Investigação</option>
            <option value="RESOLVIDO">Resolvido</option>
          </select>
        </div>

        <span className="text-slate-500 font-mono text-[11px]">
          {filteredLogs.length} registro(s) encontrado(s)
        </span>
      </div>

      {/* Tabela de Logs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Request ID</th>
                <th className="py-2.5 px-3">Severidade</th>
                <th className="py-2.5 px-3">Página / Ação</th>
                <th className="py-2.5 px-3">Mensagem de Erro</th>
                <th className="py-2.5 px-3">Usuário / Perfil</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredLogs.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-indigo-700">{l.request_id}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                        l.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-700'
                          : l.severity === 'ERROR'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {l.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    <span className="font-semibold text-slate-800">{l.page}</span>
                    <span className="text-slate-400 block text-[10px]">{l.action}</span>
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-700 max-w-xs truncate">
                    {l.error_message}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-600">
                    {l.user_role || 'SISTEMA'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-sans bg-slate-100 text-slate-700">
                      {l.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-sans">
                    <button
                      onClick={() => setSelectedLog(l)}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                    >
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 font-sans">
                    Nenhum log de erro registrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DETALHES DO ERRO COM STACK PROTEGIDA */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Investigação de Erro — {selectedLog.request_id}
                </h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-500 block">Página / Módulo:</span>
                <strong className="text-slate-900">{selectedLog.page}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Ação do Usuário:</span>
                <strong className="text-slate-900">{selectedLog.action}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Severidade:</span>
                <strong className="text-rose-700">{selectedLog.severity}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Status:</span>
                <strong className="text-slate-800">{selectedLog.status}</strong>
              </div>
            </div>

            <div>
              <span className="text-slate-500 font-semibold block mb-1">Mensagem de Erro:</span>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 font-mono text-[11px]">
                {selectedLog.error_message}
              </div>
            </div>

            {selectedLog.stack_trace && (
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Stack Trace (Sanitizada):</span>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {selectedLog.stack_trace}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Alterar Status:</span>
                <button
                  onClick={() => handleUpdateStatus(selectedLog.id!, 'EM_INVESTIGACAO')}
                  className="px-2.5 py-1 rounded bg-amber-100 text-amber-800 font-bold hover:bg-amber-200"
                >
                  Em Investigação
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedLog.id!, 'RESOLVIDO')}
                  className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-200"
                >
                  Resolvido
                </button>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold"
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
