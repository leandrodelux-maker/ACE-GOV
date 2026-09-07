import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Filter,
  Shield,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { db } from '../../services/storage';

export const ReportsView: React.FC = () => {
  const [reportType, setReportType] = useState<'BOLETIM' | 'LIRAA' | 'PRODUTIVIDADE' | 'CRIADOUROS'>('BOLETIM');
  const municipality = db.getMunicipality();
  const cycle = db.getCycle();
  const neighborhoods = db.getNeighborhoods();
  const visits = db.getVisits();

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Bairro,Imoveis,Cobertura,Focos,Risco\n' +
      neighborhoods.map(n => `${n.name},${n.totalProperties},${n.coveragePercentage}%,${n.fociCount},${n.riskScore}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_endemias_${municipality.name.toLowerCase().replace(/\s+/g, '_')}_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Action Header (Hidden during print) */}
      <div className="print:hidden bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Central de Relatórios Oficiais & Boletins SUS</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Geração padronizada de documentos sanitários, LIRAa, boletins epidemiológicos e produtividade
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Salvar PDF</span>
          </button>
        </div>
      </div>

      {/* Selectors (Hidden in print) */}
      <div className="print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-700 mr-2">Tipo de Documento:</span>
        <button
          onClick={() => setReportType('BOLETIM')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
            reportType === 'BOLETIM' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
          }`}
        >
          Boletim Epidemiológico Oficial
        </button>
        <button
          onClick={() => setReportType('LIRAA')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
            reportType === 'LIRAA' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
          }`}
        >
          Relatório Síntese LIRAa / LIA
        </button>
        <button
          onClick={() => setReportType('PRODUTIVIDADE')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
            reportType === 'PRODUTIVIDADE' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
          }`}
        >
          Produtividade por Agente (ACE)
        </button>
      </div>

      {/* Official SUS Document Viewport (Formatted for screen and print) */}
      <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 shadow-md print:shadow-none print:border-none print:p-0 space-y-6 text-slate-900">
        {/* Institutional Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              República Federativa do Brasil • Sistema Único de Saúde (SUS)
            </p>
            <h2 className="text-base font-black text-slate-900 uppercase">
              Prefeitura Municipal de {municipality.name} — Estado do {municipality.state}
            </h2>
            <p className="text-xs text-slate-700 font-semibold">
              Secretaria Municipal de Saúde • Departamento de Vigilância em Saúde • Setor de Controle de Endemias
            </p>
          </div>

          <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 font-bold text-xs text-center p-1">
            Brasão Oficial
          </div>
        </div>

        {/* Title of Document */}
        <div className="text-center space-y-1 py-2">
          <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
            {reportType === 'BOLETIM' && 'Boletim Oficial de Vigilância Entomológica e Arboviroses'}
            {reportType === 'LIRAA' && 'Relatório Oficial de Levantamento Rápido de Índices (LIRAa)'}
            {reportType === 'PRODUTIVIDADE' && 'Demonstrativo de Produtividade Operacional dos Agentes (ACE)'}
          </h3>
          <p className="text-xs text-slate-500">
            Período de Referência: {cycle.name} ({cycle.startDate} a {cycle.endDate}) • Emitido em: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>

        {/* General Metadata */}
        <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Município</span>
            <strong className="text-slate-900">{municipality.name} ({municipality.state})</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Código IBGE</span>
            <strong className="text-slate-900">{municipality.ibgeCode}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total de Imóveis</span>
            <strong className="text-slate-900">{municipality.totalProperties.toLocaleString('pt-BR')} imóveis</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Ciclo Vigente</span>
            <strong className="text-blue-700">{cycle.name}</strong>
          </div>
        </div>

        {/* Territory Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Indicadores Epidemiológicos e Entomológicos Consolidados por Bairro
          </h4>
          <table className="w-full text-xs text-left border border-slate-200">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-2.5">Bairro / Localidade</th>
                <th className="p-2.5">Imóveis Cadastrados</th>
                <th className="p-2.5">Trabalhados (Est.)</th>
                <th className="p-2.5">Cobertura (%)</th>
                <th className="p-2.5">Focos Encontrados</th>
                <th className="p-2.5">Índice Risco</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {neighborhoods.map(n => (
                <tr key={n.id}>
                  <td className="p-2.5 font-semibold text-slate-900">{n.name}</td>
                  <td className="p-2.5 text-slate-700">{n.totalProperties}</td>
                  <td className="p-2.5 text-slate-700">{Math.round((n.totalProperties * n.coveragePercentage) / 100)}</td>
                  <td className="p-2.5 font-bold text-slate-900">{n.coveragePercentage}%</td>
                  <td className="p-2.5 font-bold text-rose-700">{n.fociCount}</td>
                  <td className="p-2.5 font-bold">{n.riskScore}/100 ({n.riskLevel})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Official Signatures */}
        <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs text-slate-700">
          <div className="border-t border-slate-400 pt-2">
            <p className="font-bold text-slate-900">Dra. Mariana Costa</p>
            <p className="text-[11px] text-slate-500">Coordenadora Municipal de Vigilância Epidemiológica e Endemias</p>
          </div>
          <div className="border-t border-slate-400 pt-2">
            <p className="font-bold text-slate-900">Dr. Roberto Albuquerque</p>
            <p className="text-[11px] text-slate-500">Secretário Municipal de Saúde • SUS</p>
          </div>
        </div>
      </div>
    </div>
  );
};
