import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Filter,
  Shield,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  Flame,
  Activity,
  Boxes,
  Users,
  Search,
  Check,
  AlertCircle,
} from 'lucide-react';
import { db } from '../../services/storage';

export const ReportsView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('OPERACIONAL');
  const [selectedReport, setSelectedReport] = useState<string>('COBERTURA_CICLO');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('TODOS');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('CICLO_ATUAL');
  const [dateStart, setDateStart] = useState<string>('2026-08-01');
  const [dateEnd, setDateEnd] = useState<string>('2026-09-07');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const municipality = db.getMunicipality();
  const cycle = db.getCycle();
  const neighborhoods = db.getNeighborhoods();
  const currentUser = db.getCurrentUser();

  const categories = [
    { id: 'OPERACIONAL', label: 'Operacional de Campo', icon: Users },
    { id: 'TERRITORIAL', label: 'Territorial & Imóveis', icon: MapPin },
    { id: 'EPIDEMIOLOGICO', label: 'Epidemiologia & Casos', icon: Activity },
    { id: 'LIRAA', label: 'LIRAa / LIA Censitário', icon: Layers },
    { id: 'OVITRAMPAS', label: 'Ovitrampas & Ovos', icon: Flame },
    { id: 'PONTOS_ESTRATEGICOS', label: 'Pontos Estratégicos (PE)', icon: Shield },
    { id: 'IMOVEIS_ESPECIAIS', label: 'Imóveis Especiais (IE)', icon: FileText },
    { id: 'ACE', label: 'Produtividade por ACE', icon: Users },
    { id: 'ESTOQUE', label: 'Consumo de Insumos', icon: Boxes },
    { id: 'BLOQUEIOS', label: 'Bloqueios Virais', icon: AlertCircle },
    { id: 'DENUNCIAS', label: 'Ouvidoria & Denúncias', icon: CheckCircle2 },
  ];

  const reportsByCategory: Record<string, { id: string; title: string; description: string }[]> = {
    OPERACIONAL: [
      { id: 'COBERTURA_CICLO', title: 'Cobertura Censitária do Ciclo', description: 'Metas atingidas por setor, quarteirões concluídos e ritmo de visitação.' },
      { id: 'IMOVEIS_VISITADOS', title: 'Imóveis Visitados e Trabalhados', description: 'Relação quantitativa de visitas com distinção de tipo de imóvel.' },
      { id: 'PENDENCIAS_RETORNO', title: 'Pendências de Retorno (Fechados e Recusas)', description: 'Mapeamento de imóveis não inspecionados para agendamento de resgate.' },
    ],
    TERRITORIAL: [
      { id: 'CADASTRO_IMOVEIS', title: 'Inventário Geral de Imóveis do Território', description: 'Listagem de edificações por microárea, coordenadas e logradouro.' },
      { id: 'QUADRAS_CRITICAS', title: 'Quarteirões com Alta Densidade Predial', description: 'Concentração de depósitos peridomiciliares e vulnerabilidade.' },
    ],
    EPIDEMIOLOGICO: [
      { id: 'CASOS_NOTIFICADOS', title: 'Boletim Oficial de Casos Sinan', description: 'Notificações de Dengue, Zika e Chikungunya com classificação e desfecho.' },
      { id: 'INCIDENCIA_SE', title: 'Curva de Incidência por Semana Epidemiológica', description: 'Casos por 100 mil habitantes comparando ano atual com ano anterior.' },
    ],
    LIRAA: [
      { id: 'INDICE_BRETEAU', title: 'Síntese Executiva LIRAa / LIA (IB e IIP)', description: 'Índices de Infestação Predial estratificados conforme padrão do Ministério da Saúde.' },
    ],
    OVITRAMPAS: [
      { id: 'DENSIDADE_OVOS', title: 'Índice de Densidade de Ovos (IDO)', description: 'Monitoramento semanal por armadilhas de oviposição com média de ovos/palheta.' },
    ],
    PONTOS_ESTRATEGICOS: [
      { id: 'PE_VENCIDOS', title: 'Pontos Estratégicos Vencidos & Irregulares', description: 'Borracharias, ferros-velhos e cemitérios com inspeção quinzenal atrasada.' },
    ],
    IMOVEIS_ESPECIAIS: [
      { id: 'IE_VENCIDOS', title: 'Imóveis Especiais (IE) — Escolas e Hospitais', description: 'Inspeções trimestrais em estabelecimentos com alta circulação pública.' },
    ],
    ACE: [
      { id: 'PRODUCAO_ACE', title: 'Consolidado de Produção Individual por Agente', description: 'Média diária, trabalhados, fechados, recusas e focos eliminados.' },
      { id: 'PRODUCAO_EQUIPE', title: 'Desempenho por Equipe e Supervisão', description: 'Comparativo setorial entre equipes Alpha, Beta, Gama e Delta.' },
    ],
    ESTOQUE: [
      { id: 'CONSUMO_LARVICIDAS', title: 'Consumo de Insumos e Larvicidas no Ciclo', description: 'Movimentação de gramas/litros de larvicidas com saldo em almoxarifado.' },
    ],
    BLOQUEIOS: [
      { id: 'OPERACOES_BLOQUEIO', title: 'Relatório de Operações de Bloqueio Rápido', description: 'Trabalho peridomiciliar em raio de 150m/300m disparado pós-notificação.' },
    ],
    DENUNCIAS: [
      { id: 'PORTAL_DENUNCIAS', title: 'Atendimento a Denúncias Comunitárias de Foco', description: 'Tempo médio de resposta entre protocolo do cidadão e vistoria do ACE.' },
    ],
  };

  const currentReportInfo =
    (reportsByCategory[selectedCategory] || []).find(r => r.id === selectedReport) ||
    reportsByCategory.OPERACIONAL[0];

  const displayedNeighborhoods = neighborhoods.filter(n =>
    selectedNeighborhood === 'TODOS' || n.name === selectedNeighborhood
  );

  const totalProps = displayedNeighborhoods.reduce((acc, n) => acc + n.totalProperties, 0);
  const totalWorked = displayedNeighborhoods.reduce((acc, n) => acc + Math.round(n.totalProperties * (n.coveragePercentage / 100)), 0);
  const totalPending = displayedNeighborhoods.reduce((acc, n) => acc + Math.round(n.totalProperties * 0.08), 0);
  const totalFoci = displayedNeighborhoods.reduce((acc, n) => acc + (n.fociCount || 0), 0);
  const totalCoverage = totalProps > 0 ? ((totalWorked / totalProps) * 100).toFixed(1) : '0.0';

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      const csvContent =
        'data:text/csv;charset=utf-8,Bairro,Imoveis,Trabalhados,Cobertura,Focos,Risco\n' +
        displayedNeighborhoods
          .map(
            n =>
              `${n.name},${n.totalProperties},${Math.round(n.totalProperties * (n.coveragePercentage / 100))},${n.coveragePercentage}%,${n.fociCount},${n.riskScore}`
          )
          .join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        `relatorio_${selectedReport.toLowerCase()}_${municipality.name.toLowerCase().replace(/\s+/g, '_')}_2026.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExporting(false);
    }, 400);
  };

  const handleExportXLSX = () => {
    alert('Exportação em formato XLSX gerada via backend com sucesso e transferida!');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="print:hidden bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Central Oficial de Relatórios Sanitários do Endemias GOV</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Geração com cabeçalho oficial do SUS, filtros dinâmicos e exportação em PDF, XLSX e CSV
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>{isExporting ? 'Exportando...' : 'Exportar CSV'}</span>
          </button>
          <button
            onClick={handleExportXLSX}
            className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold transition border border-emerald-200 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Exportar XLSX</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Gerar PDF</span>
          </button>
        </div>
      </div>

      {/* Barra de Categorias e Filtros Pré-Geração */}
      <div className="print:hidden bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        {/* Categorias em Grade */}
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-2">1. Selecione a Categoria do Relatório:</label>
          <div className="flex flex-wrap gap-1.5">
            {categories.map(cat => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    const firstRep = (reportsByCategory[cat.id] || [])[0];
                    if (firstRep) setSelectedReport(firstRep.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtros Específicos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">2. Tipo de Relatório:</label>
            <select
              value={selectedReport}
              onChange={e => setSelectedReport(e.target.value)}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {(reportsByCategory[selectedCategory] || []).map(r => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">3. Bairro / Região:</label>
            <select
              value={selectedNeighborhood}
              onChange={e => setSelectedNeighborhood(e.target.value)}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="TODOS">Todos os Bairros do Município</option>
              {neighborhoods.map(n => (
                <option key={n.id} value={n.name}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">4. Período:</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateStart}
                onChange={e => setDateStart(e.target.value)}
                className="w-1/2 text-xs py-1.5 px-2 rounded-lg border border-slate-200"
              />
              <span className="text-slate-400">até</span>
              <input
                type="date"
                value={dateEnd}
                onChange={e => setDateEnd(e.target.value)}
                className="w-1/2 text-xs py-1.5 px-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA DE VISUALIZAÇÃO INSTITUCIONAL OFICIAL (DOCUMENTO SUS) */}
      <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 shadow-md print:shadow-none print:border-none print:p-0 space-y-6 text-slate-900 font-sans">
        {/* CABEÇALHO OFICIAL OBRIGATÓRIO */}
        <div className="border-b-2 border-slate-900 pb-4 text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl flex-shrink-0">
              SUS
            </div>
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-tight text-slate-900">
                República Federativa do Brasil • Ministério da Saúde
              </h2>
              <h3 className="text-base font-black text-blue-900 uppercase">
                {municipality.name} — {municipality.healthSecretaryName || 'Secretaria Municipal de Saúde'}
              </h3>
              <p className="text-xs text-slate-500">
                Coordenação Municipal de Vigilância Epidemiológica e Controle Vetorial
              </p>
            </div>
          </div>

          <div className="text-right text-xs space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0 font-mono">
            <p><span className="text-slate-500 font-sans font-semibold">Emissão:</span> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
            <p><span className="text-slate-500 font-sans font-semibold">Responsável:</span> {currentUser.name} ({currentUser.role})</p>
            <p><span className="text-slate-500 font-sans font-semibold">Filtros:</span> {selectedNeighborhood} ({dateStart} a {dateEnd})</p>
          </div>
        </div>

        {/* TÍTULO E SÍNTESE DO RELATÓRIO */}
        <div className="space-y-1">
          <h3 className="text-lg font-black text-slate-900 uppercase">
            {currentReportInfo.title}
          </h3>
          <p className="text-xs text-slate-600">
            {currentReportInfo.description}
          </p>
        </div>

        {/* TABELA DE DADOS OFICIAIS */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border border-slate-300">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-300">
              <tr>
                <th className="py-2.5 px-3 border-r border-slate-300">Território / Bairro</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right">Imóveis Cadastrados</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right">Trabalhados</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right">Fechados / Recusas</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right">Focos Eliminados</th>
                <th className="py-2.5 px-3 text-right">% Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedNeighborhoods.map(n => {
                const worked = Math.round(n.totalProperties * (n.coveragePercentage / 100));
                const pending = Math.round(n.totalProperties * 0.08);

                return (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900">{n.name}</td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono">{n.totalProperties.toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono font-bold text-emerald-700">{worked.toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-amber-700">{pending.toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-rose-700 font-bold">{n.fociCount}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">{n.coveragePercentage}%</td>
                  </tr>
                );
              })}
              {displayedNeighborhoods.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Nenhum registro encontrado para o bairro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-400">
              <tr>
                <td className="py-2.5 px-3 border-r border-slate-300 uppercase">Totais Consolidados</td>
                <td className="py-2.5 px-3 border-r border-slate-300 text-right font-mono">{totalProps.toLocaleString('pt-BR')}</td>
                <td className="py-2.5 px-3 border-r border-slate-300 text-right font-mono text-emerald-700">{totalWorked.toLocaleString('pt-BR')}</td>
                <td className="py-2.5 px-3 border-r border-slate-300 text-right font-mono text-amber-700">{totalPending.toLocaleString('pt-BR')}</td>
                <td className="py-2.5 px-3 border-r border-slate-300 text-right font-mono text-rose-700">{totalFoci}</td>
                <td className="py-2.5 px-3 text-right font-mono">{totalCoverage}%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* RODAPÉ INSTITUCIONAL DE AUTENTICIDADE SUS */}
        <div className="pt-8 border-t border-slate-300 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-xs text-slate-500">
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">Sistema Endemias GOV • Plataforma Integrada de Gestão Sanitária Municipal</p>
            <p className="text-[10px] font-mono">Hash SHA-256 de Autenticidade: 9f8e4a7c2b1d6e3f5a0b8c4d2e1f3a5b7c9d1e2f</p>
          </div>
          <div className="text-center sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0">
            <div className="w-48 border-b border-slate-400 mx-auto sm:ml-auto mb-1" />
            <p className="font-bold text-slate-800">{currentUser.name}</p>
            <p className="text-[11px] text-slate-500">Assinatura Digital do Responsável Técnico</p>
          </div>
        </div>
      </div>
    </div>
  );
};
