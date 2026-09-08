import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Calendar,
  Clock,
  Shield,
  AlertOctagon,
  Flame,
  Bug,
  Users,
  Target,
  CloudRain,
  MapPin,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { dailyBriefingService, DailyBriefingData } from '../../services/dailyBriefingService';

export const DailyBriefingView: React.FC = () => {
  const municipalityId = '00000000-0000-0000-0000-000000000001';
  const [briefing, setBriefing] = useState<DailyBriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBriefing();
  }, []);

  const loadBriefing = async () => {
    setLoading(true);
    try {
      const data = await dailyBriefingService.getDailyBriefing(municipalityId);
      setBriefing(data);
    } catch (err) {
      console.error('Erro ao compilar briefing diário:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  if (loading || !briefing) {
    return (
      <div className="py-24 text-center text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
        <p className="text-xs">Compilando síntese executiva do dia com dados reais do Supabase...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 print:space-y-4 print:pb-0 print:text-black">
      {/* Topo do Briefing com Ações (oculto na impressão para o PDF ser limpo) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white">
            <FileText className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Briefing Diário de Vigilância</h1>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                Relatório Executivo Matinal
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Síntese automatizada para o Secretário Municipal de Saúde e Coordenação de Endemias
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadBriefing}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
          <button
            onClick={handlePrintPdf}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Gerar PDF do Briefing</span>
          </button>
        </div>
      </div>

      {/* DOCUMENTO OFICIAL DO BRIEFING (Formatado para tela e impressão PDF) */}
      <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
        {/* Cabeçalho do Documento */}
        <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-widest">
              <Shield className="w-4 h-4" />
              <span>Vigilância em Saúde • Controle de Endemias</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mt-1">Briefing Executivo Diário</h2>
            <p className="text-xs text-slate-600 font-medium">
              {briefing.municipalityName} • {briefing.cycleName}
            </p>
          </div>

          <div className="text-right text-xs">
            <span className="font-bold text-slate-900 block capitalize">{briefing.dateFormatted}</span>
            <span className="text-[11px] text-slate-500 font-mono">Gerado às {briefing.generatedAt}</span>
          </div>
        </div>

        {/* Linha 1: Situação Geral e Mudanças desde Ontem */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Visitas de Campo Hoje</span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{briefing.stats.visitsToday}</div>
            <span className="text-[10px] text-emerald-700 font-bold">
              {briefing.stats.visitsDelta >= 0 ? `+${briefing.stats.visitsDelta}` : briefing.stats.visitsDelta} vs ontem
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Focos Novos Hoje</span>
            <div className="text-2xl font-black text-rose-600 mt-0.5">{briefing.stats.newFociToday}</div>
            <span className="text-[10px] text-slate-500">Tratamento focal executado</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Bloqueios Ativos</span>
            <div className="text-2xl font-black text-blue-700 mt-0.5">{briefing.stats.activeBlockades}</div>
            <span className="text-[10px] text-slate-500">Peridomiciliares (UBV)</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Cobertura do Ciclo</span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{briefing.stats.coveragePercent}%</div>
            <span className="text-[10px] text-slate-500">Meta recomendada: ≥ 85%</span>
          </div>
        </div>

        {/* SEÇÃO NOBRE: O QUE MERECE ATENÇÃO HOJE? (MÁXIMO 5 ITENS) */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-rose-600" />
              <span>O que merece atenção hoje?</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">
              5 Prioridades Táticas Selecionadas
            </span>
          </div>

          <div className="space-y-4">
            {briefing.attentionItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border space-y-2.5 ${
                  item.priority === 'critica'
                    ? 'border-rose-200 bg-rose-50/30'
                    : item.priority === 'alta'
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-slate-200 bg-slate-50/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${
                        item.priority === 'critica'
                          ? 'bg-rose-600'
                          : item.priority === 'alta'
                          ? 'bg-amber-600'
                          : 'bg-slate-700'
                      }`}
                    >
                      {item.order}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-slate-200 text-slate-700">
                    {item.territoryTag}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Problema</span>
                    <p className="text-slate-800 mt-0.5 leading-snug">{item.problema}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Evidência</span>
                    <p className="text-slate-600 mt-0.5 leading-snug">{item.evidencia}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Impacto em Saúde</span>
                    <p className="text-slate-600 mt-0.5 leading-snug">{item.impacto}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-emerald-800 block">Ação Possível</span>
                    <p className="text-slate-900 font-semibold mt-0.5 leading-snug">{item.acaoPossivel}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quadro Complementar: Clima & Áreas Críticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <CloudRain className="w-4 h-4 text-blue-600" />
                <span>Condição Meteorológica Vigente</span>
              </span>
              <span className="font-mono text-[10px] text-slate-500">Fonte: INMET</span>
            </div>
            <p className="text-slate-600">{briefing.climateSummary.tendencyDescription}</p>
            <div className="flex gap-4 pt-1 text-[11px] font-mono text-slate-700">
              <span>Chuva 7d: <strong>{briefing.climateSummary.rainfall7d}mm</strong></span>
              <span>Chuva 30d: <strong>{briefing.climateSummary.rainfall30d}mm</strong></span>
              <span>Temp. Média: <strong>{briefing.climateSummary.avgTempRecent}°C</strong></span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-rose-600" />
              <span>Bairros em Estado de Atenção</span>
            </span>
            <div className="space-y-1.5">
              {briefing.criticalAreas.map((area, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-800">{area.name}</span>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                    {area.riskBadge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé de Autenticidade do Documento */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>Endemias GOV © 2026 • Plataforma de Gestão e Inteligência Epidemiológica Municipal</span>
          <span className="font-mono">Documento Autenticado para Decisão em Saúde Pública</span>
        </div>
      </div>
    </div>
  );
};
