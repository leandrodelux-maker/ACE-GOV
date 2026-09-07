import React, { useState } from 'react';
import { Shield, Clock, Search, Filter, Lock, User } from 'lucide-react';
import { db } from '../../services/storage';
import { AuditLog } from '../../types';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>(db.getAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = logs.filter(
    l =>
      l.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.entity.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-700" />
            <span>Auditoria de Conformidade & Trilha Imutável de Logs</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro detalhado e cronológico de todas as ações de usuários, alterações de cadastros e despachos
          </p>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Filtrar logs..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="p-2 pl-8 rounded-lg border border-slate-300 text-xs w-64"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Data/Hora</th>
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">Ação</th>
                <th className="py-3 px-4">Entidade</th>
                <th className="py-3 px-4">Detalhes</th>
                <th className="py-3 px-4">IP / Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                  <td className="py-3 px-4 font-sans font-semibold text-slate-900">
                    {log.userName}
                    <span className="block text-[10px] font-mono text-slate-400">{log.userRole}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-semibold">{log.entity}</td>
                  <td className="py-3 px-4 font-sans text-slate-600 max-w-xs truncate">{log.details}</td>
                  <td className="py-3 px-4 text-slate-400 text-[10px]">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
