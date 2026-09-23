import React, { useEffect, useState } from 'react';
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
import { PageHeader } from '../ui';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { situationRoomService, NeighborhoodSituation } from '../../services/situationRoomService';
import { ROLES_REGISTRY } from '../../services/rbac';

const isoDate = (d: Date) => d.toISOString().split('T')[0];

export const ReportsView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('OPERACIONAL');
  const [selectedReport, setSelectedReport] = useState<string>('COBERTURA_CICLO');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('TODOS');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('CICLO_ATUAL');
  const [dateStart, setDateStart] = useState<string>(() => isoDate(new Date(Date.now() - 30 * 86400000)));
  const [dateEnd, setDateEnd] = useState<string>(() => isoDate(new Date()));
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { municipality, user: currentUser } = useAuth();
  const municipalityId = useMunicipalityId();
  // Dados reais por bairro (mesma fonte da Sala de Situação, ciclo em andamento)
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodSituation[]>([]);
  const [cycleName, setCycleName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    situationRoomService
      .getSituationData({ municipalityId, periodFilter: 'cycle' })
      .then((data) => {
        if (!active) return;
        setNeighborhoods(data.neighborhoods);
        setCycleName(data.activeCycleName);
        setLoadError(data.failedSources.length > 0 ? `Fontes indisponíveis: ${data.failedSources.join(', ')}.` : null);
      })
      .catch(() => active && setLoadError('Não foi possível carregar os dados do relatório.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [municipalityId]);

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
      { id: 'PRODUCAO_EQUIPE', title: 'Desempenho por Equipe e Supervisão', description: 'Comparativo entre as equipes cadastradas no município.' },
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
  const totalWorked = displayedNeighborhoods.reduce((acc, n) => acc + n.visitedCount, 0);
  const totalPending = displayedNeighborhoods.reduce((acc, n) => acc + n.pendingCount, 0);
  const totalFoci = displayedNeighborhoods.reduce((acc, n) => acc + (n.fociCount || 0), 0);
  const totalCoverage = totalProps > 0 ? ((totalWorked / totalProps) * 100).toFixed(1) : null;
  // Só a cobertura territorial por bairro tem gerador implementado
  const hasDedicatedGenerator = selectedReport === 'COBERTURA_CICLO' || selectedReport === 'IMOVEIS_VISITADOS' || selectedReport === 'PENDENCIAS_RETORNO';
  const municipalityName = municipality?.name || 'Município';

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      const csvContent =
        'data:text/csv;charset=utf-8,Bairro,Imoveis,Trabalhados,Pendencias,Cobertura,Focos,Risco\n' +
        displayedNeighborhoods
          .map(
            n =>
              `"${n.name}",${n.totalProperties},${n.visitedCount},${n.pendingCount},${n.coveragePercentage === null ? '' : `${n.coveragePercentage}%`},${n.fociCount},${n.riskScore}`
          )
          .join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        `relatorio_${selectedReport.toLowerCase()}_${municipalityName.toLowerCase().replace(/\s+/g, '_')}_${isoDate(new Date())}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExporting(false);
    }, 400);
  };


  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="print:hidden">
        <PageHeader
          icon={FileText}
          title="Central Oficial de Relatórios Sanitários do Endemias GOV"
          subtitle="Geração com cabeçalho oficial do SUS, filtros dinâmicos e exportação em PDF, XLSX e CSV"
          actions={
            <>
              <button
                onClick={handleExportCSV}
                disabled={isExporting}
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition flex items-center gap-1.5 text-xs"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>{isExporting ? 'Exportando...' : 'Exportar CSV'}</span>
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1.5 shadow-xs text-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Gerar PDF</span>
              </button>
            </>
          }
        />
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
                {municipalityName} — {municipality?.healthSecretaryName || 'Secretaria Municipal de Saúde'}
              </h3>
              <p className="text-xs text-slate-500">
                Coordenação Municipal de Vigilância Epidemiológica e Controle Vetorial
              </p>
            </div>
          </div>

          <div className="text-right text-xs space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0 font-mono">
            <p><span className="text-slate-500 font-sans font-semibold">Emissão:</span> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
            <p><span className="text-slate-500 font-sans font-semibold">Responsável:</span> {currentUser?.name} ({currentUser ? ROLES_REGISTRY[currentUser.role]?.name || currentUser.role : ''})</p>
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
          <p className="text-[11px] text-slate-500">Base: ciclo {cycleName ? `"${cycleName}"` : 'sem ciclo em andamento (todas as visitas registradas)'}.</p>
          {!hasDedicatedGenerator && (
            <p role="status" className="mt-2 p-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-[11px] print:hidden">
              Este relatório ainda não tem gerador próprio. A tabela abaixo mostra o consolidado territorial por bairro.
            </p>
          )}
          {loadError && (
            <p role="alert" className="mt-2 p-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-[11px]">
              {loadError}
            </p>
          )}
        </div>

        {/* TABELA DE DADOS OFICIAIS */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border border-slate-300">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-300">
              <tr>
                <th className="py-2.5 px-3 border-r border-slate-300">Território / Bairro</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right">Imóveis Cadastrados</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right">Trabalhados</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right">Pendências de Retorno</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right">Focos</th>
                <th className="py-2.5 px-3 text-right">% Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedNeighborhoods.map(n => {
                const worked = n.visitedCount;
                const pending = n.pendingCount;

                return (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900">{n.name}</td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono">{n.totalProperties.toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono font-bold text-emerald-700">{worked.toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-amber-700">{pending.toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-rose-700 font-bold">{n.fociCount}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">{n.coveragePercentage === null ? '—' : `${n.coveragePercentage}%`}</td>
                  </tr>
                );
              })}
              {displayedNeighborhoods.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    {loading ? 'Carregando...' : 'Sem dados registrados para o filtro selecionado.'}
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
                <td className="py-2.5 px-3 text-right font-mono">{totalCoverage === null ? '—' : `${totalCoverage}%`}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* RODAPÉ INSTITUCIONAL DE AUTENTICIDADE SUS */}
        <div className="pt-8 border-t border-slate-300 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-xs text-slate-500">
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">Sistema Endemias GOV • Plataforma Integrada de Gestão Sanitária Municipal</p>
            <p className="text-[10px]">Gerado a partir dos registros do sistema em {new Date().toLocaleString('pt-BR')}. Assinatura digital disponível em Relatórios &gt; Documentos.</p>
          </div>
          <div className="text-center sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0">
            <div className="w-48 border-b border-slate-400 mx-auto sm:ml-auto mb-1" />
            <p className="font-bold text-slate-800">{currentUser?.name}</p>
            <p className="text-[11px] text-slate-500">Assinatura Digital do Responsável Técnico</p>
          </div>
        </div>
      </div>
    </div>
  );
};
