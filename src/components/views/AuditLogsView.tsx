import React, { useState, useEffect } from 'react';
import { Shield, Clock, Search, Filter, Lock, User } from 'lucide-react';
import { db } from '../../services/storage';
import { AuditLog } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { PageHeader } from '../ui';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>(db.getAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadSupabaseAuditLogs() {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && data && data.length > 0) {
          const mapped: AuditLog[] = data.map((log: any) => ({
            id: log.id,
            municipalityId: log.municipality_id,
            userId: log.user_id || 'usr-adm-01',
            userName: 'Administrador / Sistema',
            userRole: 'ENDEMIAS_COORDINATOR',
            action: log.action || 'OPERACAO',
            operation: log.action || 'SISTEMA',
            module: log.module || 'SEGURANCA',
            entity: log.entity || 'Registro',
            recordIdentifier: log.new_data ? JSON.stringify(log.new_data) : log.entity_id || '—',
            details: log.new_data ? JSON.stringify(log.new_data) : '—',
            timestamp: new Date(log.created_at).toLocaleString('pt-BR'),
            ipAddress: log.ip_address || '127.0.0.1 (Local)',
            device: 'Navegador Web / Desktop',
          }));
          setLogs(mapped);
        }
      } catch (err) {
        console.warn('Fallback para logs de auditoria locais:', err);
      }
    }
    loadSupabaseAuditLogs();
  }, []);

  const filtered = logs.filter(
    l =>
      (l.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((l as any).operation || (l as any).action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((l as any).module || (l as any).entity || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((l as any).recordIdentifier || (l as any).details || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={Lock}
        title="Auditoria de Conformidade & Trilha Imutável de Logs"
        subtitle="Registro detalhado e cronológico de todas as ações de usuários, alterações de cadastros e despachos"
        actions={
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
        }
      />

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
                      {(log as any).operation || (log as any).action || 'REGISTRO'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-semibold">{(log as any).module || (log as any).entity || 'Sistema'}</td>
                  <td className="py-3 px-4 font-sans text-slate-600 max-w-xs truncate">{(log as any).recordIdentifier || (log as any).details || '—'}</td>
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
