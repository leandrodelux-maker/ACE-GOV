import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, Search, Activity, Eye, X, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMunicipalityId } from '../../contexts/AuthContext';
import { auditLogService, AuditLogEntry } from '../../services/auditLogService';
import { PageHeader } from '../ui';

const PAGE_SIZE = 50;

function formatPayload(value: unknown, emptyText: string): string {
  if (value === null || value === undefined || value === '') return emptyText;
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

const badgeForAction = (action: string) => {
  switch (action) {
    case 'CADASTRO':
    case 'INSERT':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'EDICAO':
    case 'UPDATE':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'EXCLUSAO':
    case 'DESATIVACAO':
    case 'DELETE':
      return 'bg-rose-100 text-rose-800 border-rose-300';
    case 'LOGIN':
      return 'bg-sky-100 text-sky-800 border-sky-300';
    default:
      return 'bg-purple-100 text-purple-800 border-purple-300';
  }
};

export const AuditLogsAdminView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [viewDetailLog, setViewDetailLog] = useState<AuditLogEntry | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await auditLogService.list(municipalityId, { page, pageSize: PAGE_SIZE, search });
    setLogs(res.items);
    setTotal(res.total);
    setLoadError(res.error ? 'Não foi possível carregar a trilha de auditoria.' : null);
    setIsLoading(false);
  }, [municipalityId, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Busca com pequeno atraso para não consultar a cada tecla
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldAlert}
        title="Trilha de Auditoria, Conformidade e Segurança (LGPD)"
        subtitle="Registro cronológico das ações administrativas e alterações de dados do município"
        actions={
          <>
            <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700">
              {isLoading ? '...' : `${total.toLocaleString('pt-BR')} eventos`}
            </div>
            <button
              onClick={load}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              aria-label="Atualizar trilha de auditoria"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por módulo, entidade ou identificador do registro..."
            aria-label="Pesquisar na auditoria"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3.5 pl-5">Data / Hora</th>
                <th className="p-3.5">Usuário</th>
                <th className="p-3.5">Ação</th>
                <th className="p-3.5">Módulo</th>
                <th className="p-3.5">Registro</th>
                <th className="p-3.5 text-right pr-5">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400" role="status">
                    Carregando trilha de auditoria...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-rose-600" role="alert">
                    {loadError}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    {search ? 'Nenhum evento corresponde à pesquisa.' : 'Sem eventos de auditoria registrados.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3.5 pl-5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">{log.userName || 'Não identificado'}</td>
                    <td className="p-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badgeForAction(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-medium text-slate-800">{log.module}</td>
                    <td className="p-3.5">
                      <p className="font-mono text-slate-700 truncate max-w-xs">
                        {log.entity}
                        {log.entityId ? ` · ${log.entityId}` : ''}
                      </p>
                    </td>
                    <td className="p-3.5 text-right pr-5">
                      <button
                        onClick={() => setViewDetailLog(log)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition"
                        title="Ver dados antes e depois"
                        aria-label="Ver detalhes do evento"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-600">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                aria-label="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {viewDetailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 id="audit-detail-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span>Evento de auditoria: {viewDetailLog.action}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {new Date(viewDetailLog.createdAt).toLocaleString('pt-BR')} · {viewDetailLog.module}
                </p>
              </div>
              <button onClick={() => setViewDetailLog(null)} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-700 block mb-1">Antes</span>
                <pre className="p-3 rounded-xl bg-slate-950 text-rose-300 font-mono text-[11px] overflow-x-auto max-h-64 border border-slate-800">
                  {formatPayload(viewDetailLog.oldData, '// Sem estado anterior (criação)')}
                </pre>
              </div>
              <div>
                <span className="font-bold text-slate-700 block mb-1">Depois</span>
                <pre className="p-3 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-64 border border-slate-800">
                  {formatPayload(viewDetailLog.newData, '// Sem novo estado registrado')}
                </pre>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewDetailLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
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
