import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Wrench,
  FileSearch,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import { dataQualityService, DataQualityReport, DataQualityIssue } from '../../services/dataQualityService';
import { PageHeader } from '../ui';
import { useMunicipalityId, useAuth } from '../../contexts/AuthContext';

export const DataQualityView: React.FC = () => {
  const { user: sessionUser } = useAuth();
  const municipalityId = useMunicipalityId();
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<'TODOS' | 'CRITICO' | 'AVISO' | 'SUGESTAO'>('TODOS');
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    runAudit();
  }, []);

  const runAudit = async () => {
    setLoading(true);
    setActionSuccess('');
    try {
      const res = await dataQualityService.runAudit(municipalityId);
      setReport(res);
    } catch (err) {
      console.error('Falha ao auditar qualidade de dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveIssue = async (issue: DataQualityIssue) => {
    const res = await dataQualityService.resolveIssue(issue.id, issue.suggestedAction, sessionUser?.name || 'Usuário autenticado', municipalityId);
    setActionSuccess(res.message);
    setTimeout(() => setActionSuccess(''), 4000);
    runAudit();
  };

  const filteredIssues = (report?.issues || []).filter(i => {
    if (filterCategory === 'TODOS') return true;
    return i.category === filterCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        icon={ShieldCheck}
        title="Módulo de Qualidade e Integridade dos Dados Sanitários"
        subtitle="Diagnóstico contínuo da higidez cadastral: prevenção de duplicidades, coordenadas faltantes e inconsistências operacionais"
        actions={
          <button
            onClick={runAudit}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Auditando Base...' : 'Recalcular Indicador'}</span>
          </button>
        }
      />
      {report?.error && (
        <div role="alert" className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs">{report.error}</div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Card do Indicador de Qualidade (0 a 100) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Score Principal */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Índice de Qualidade dos Dados</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span
              className={`text-4xl sm:text-5xl font-black ${
                (report?.score || 0) >= 85
                  ? 'text-emerald-600'
                  : (report?.score || 0) >= 70
                  ? 'text-amber-600'
                  : 'text-rose-600'
              }`}
            >
              {report?.score || 0}
            </span>
            <span className="text-sm font-bold text-slate-400">/ 100</span>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (report?.score || 0) >= 85
                  ? 'bg-emerald-600'
                  : (report?.score || 0) >= 70
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${report?.score || 0}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-2">
            {(report?.score || 0) >= 85 ? 'Base em Excelente Estado' : 'Necessita Ajustes Cadastrais'}
          </span>
        </div>

        {/* Erros Críticos */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/15">
          <span className="text-xs font-bold uppercase text-rose-800">Erros Críticos</span>
          <p className="text-3xl font-black text-rose-600 mt-2">{report?.criticalCount || 0}</p>
          <p className="text-xs text-rose-700 mt-2">Duplicidades e ausência de identificadores chave</p>
        </div>

        {/* Avisos */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/15">
          <span className="text-xs font-bold uppercase text-amber-800">Avisos / Atenção</span>
          <p className="text-3xl font-black text-amber-600 mt-2">{report?.warningCount || 0}</p>
          <p className="text-xs text-amber-700 mt-2">Coordenadas pendentes e prazos em aberto</p>
        </div>

        {/* Sugestões */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-xs bg-blue-50/15">
          <span className="text-xs font-bold uppercase text-blue-800">Sugestões de Melhoria</span>
          <p className="text-3xl font-black text-blue-600 mt-2">{report?.suggestionCount || 0}</p>
          <p className="text-xs text-blue-700 mt-2">Refinamento de tempo de visita e quadras</p>
        </div>
      </div>

      {/* Lista de Inconsistências Detectadas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-indigo-600" />
              <span>Diagnósticos & Recomendações de Retificação Assistida</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Todas as correções efetuadas são registradas automaticamente no histórico de auditoria municipal
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {(['TODOS', 'CRITICO', 'AVISO', 'SUGESTAO'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  filterCategory === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredIssues.map(issue => (
            <div
              key={issue.id}
              className={`p-4 rounded-xl border transition ${
                issue.category === 'CRITICO'
                  ? 'border-rose-300 bg-rose-50/20'
                  : issue.category === 'AVISO'
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-blue-200 bg-blue-50/20'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        issue.category === 'CRITICO'
                          ? 'bg-rose-100 text-rose-700'
                          : issue.category === 'AVISO'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {issue.category}
                    </span>
                    <span className="font-bold text-slate-900 text-xs">{issue.title}</span>
                    <span className="text-[10px] font-mono text-slate-400">({issue.entity})</span>
                  </div>

                  <p className="text-xs text-slate-700">{issue.description}</p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Ação Recomendada: <strong className="text-slate-800">{issue.suggestedAction}</strong>
                  </p>
                </div>

                <button
                  onClick={() => handleResolveIssue(issue)}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Retificar Registro</span>
                </button>
              </div>
            </div>
          ))}

          {filteredIssues.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400">
              Nenhuma inconsistência encontrada nesta categoria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
