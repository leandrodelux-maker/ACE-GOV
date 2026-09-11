import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Calendar,
  User,
  FileText,
  Activity,
  ArrowRight,
  Eye,
  X,
  Clock,
  Layers,
} from 'lucide-react';
import { db } from '../../services/storage';
import { AuditLog } from '../../types';
import { PageHeader } from '../ui';

export const AuditLogsAdminView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>(db.getAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [viewDetailLog, setViewDetailLog] = useState<AuditLog | null>(null);

  // Módulos únicos para filtro
  const modules = Array.from(new Set(logs.map((l) => l.module).filter(Boolean)));
  const actions = Array.from(new Set(logs.map((l) => l.operation).filter(Boolean)));

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.recordIdentifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.ipAddress && log.ipAddress.includes(searchTerm));

    const matchesModule = selectedModule === 'ALL' || log.module === selectedModule;
    const matchesAction = selectedAction === 'ALL' || log.operation === selectedAction;

    let matchesPeriod = true;
    if (selectedPeriod !== 'ALL') {
      const logDate = new Date(log.timestamp).getTime();
      const now = Date.now();
      if (selectedPeriod === 'TODAY') {
        matchesPeriod = now - logDate <= 24 * 60 * 60 * 1000;
      } else if (selectedPeriod === '7DAYS') {
        matchesPeriod = now - logDate <= 7 * 24 * 60 * 60 * 1000;
      } else if (selectedPeriod === '30DAYS') {
        matchesPeriod = now - logDate <= 30 * 24 * 60 * 60 * 1000;
      }
    }

    return matchesSearch && matchesModule && matchesAction && matchesPeriod;
  });

  const getBadgeColorForAction = (op: string) => {
    switch (op) {
      case 'CADASTRO':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'EDICAO':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'EXCLUSAO':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'LOGIN':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'LOGOUT':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-purple-100 text-purple-800 border-purple-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <PageHeader
        icon={ShieldAlert}
        title="Trilha de Auditoria, Conformidade e Segurança (LGPD)"
        subtitle="Registro cronológico imutável de todas as ações administrativas, alterações de estado e acessos"
        actions={
          <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700">
            {filteredLogs.length} eventos auditados
          </div>
        }
      />

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 flex-1 min-w-[260px] text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por servidor, módulo, registro ou IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Filtro de Período */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">Todo o Histórico</option>
            <option value="TODAY">Últimas 24 Horas</option>
            <option value="7DAYS">Últimos 7 Dias</option>
            <option value="30DAYS">Últimos 30 Dias</option>
          </select>

          {/* Filtro de Módulo */}
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Módulos</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Filtro de Ação */}
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">Todas as Ações</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela de Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3.5 pl-5">Data / Hora</th>
                <th className="p-3.5">Usuário / Papel</th>
                <th className="p-3.5">Ação Realizada</th>
                <th className="p-3.5">Módulo</th>
                <th className="p-3.5">Registro Alterado</th>
                <th className="p-3.5">Endereço IP</th>
                <th className="p-3.5 text-right pr-5">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Nenhum registro de auditoria localizado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3.5 pl-5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>

                    <td className="p-3.5">
                      <div>
                        <p className="font-bold text-slate-900 leading-tight">{log.userName}</p>
                        <p className="text-[10px] text-slate-400">{log.userRole}</p>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeColorForAction(
                          log.operation
                        )}`}
                      >
                        {log.operation}
                      </span>
                    </td>

                    <td className="p-3.5 font-medium text-slate-800">{log.module}</td>

                    <td className="p-3.5">
                      <p className="font-mono text-slate-700 truncate max-w-xs">{log.recordIdentifier}</p>
                    </td>

                    <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                      {log.ipAddress || '127.0.0.1'}
                    </td>

                    <td className="p-3.5 text-right pr-5">
                      <button
                        onClick={() => setViewDetailLog(log)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition"
                        title="Ver payload antes e depois"
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
      </div>

      {/* Modal de Detalhes com Antes e Depois */}
      {viewDetailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span>Inspeção de Auditoria: {viewDetailLog.operation}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ID do Log: {viewDetailLog.id} • {new Date(viewDetailLog.timestamp).toLocaleString('pt-BR')}
                </p>
              </div>
              <button
                onClick={() => setViewDetailLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Servidor</span>
                  <p className="font-semibold text-slate-800">{viewDetailLog.userName}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Papel</span>
                  <p className="font-semibold text-slate-800">{viewDetailLog.userRole}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Módulo</span>
                  <p className="font-semibold text-slate-800">{viewDetailLog.module}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Endereço IP</span>
                  <p className="font-mono text-slate-800">{viewDetailLog.ipAddress || '127.0.0.1'}</p>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Registro / Identificador:</span>
                <div className="p-2.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs">
                  {viewDetailLog.recordIdentifier}
                </div>
              </div>

              {/* Comparação Antes e Depois */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Estado Anterior (Antes):</span>
                  <pre className="p-3 rounded-xl bg-slate-950 text-rose-300 font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                    {viewDetailLog.previousValue
                      ? JSON.stringify(JSON.parse(viewDetailLog.previousValue), null, 2)
                      : '// Nenhum estado anterior registrado (Criação)'}
                  </pre>
                </div>

                <div>
                  <span className="font-bold text-slate-700 block mb-1">Novo Estado (Depois):</span>
                  <pre className="p-3 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                    {viewDetailLog.newValue
                      ? JSON.stringify(JSON.parse(viewDetailLog.newValue), null, 2)
                      : '// Nenhum estado novo registrado'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewDetailLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Fechar Inspeção
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
