import React from 'react';
import {
  Crown,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  FileText,
  Shield,
  ArrowRight,
  Activity,
  Users,
} from 'lucide-react';
import { db } from '../../services/storage';

export const ExecutiveDashboardView: React.FC = () => {
  const municipality = db.getMunicipality();
  const cycle = db.getCycle();

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="bg-gradient-to-r from-purple-900 to-slate-900 text-white p-6 rounded-2xl shadow-md space-y-2">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
            Gabinete da Secretaria Municipal de Saúde
          </span>
        </div>
        <h1 className="text-xl font-black">
          Painel Executivo de Endemias & Arboviroses — {municipality.name}
        </h1>
        <p className="text-xs text-purple-200">
          Visão de alta governança: "O que precisa da minha atenção em 30 segundos para tomada de decisão?"
        </p>
      </div>

      {/* Semáforo Municipal (Prompt 22) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-2xl shadow-md">
            🟡
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Semáforo Epidemiológico Municipal
            </span>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              ESTADO DE ALERTA MODERADO (Nível 2)
            </h2>
            <p className="text-xs text-slate-500">
              Dispersão vetorial concentrada em Vila Nova e Centro; transmissão viral sob bloqueio focal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="text-right">
            <span className="text-slate-400 block text-[10px]">Taxa de Cobertura</span>
            <span className="font-extrabold text-blue-700 text-base">71% da Meta</span>
          </div>
          <div className="h-8 w-px bg-slate-200 mx-2" />
          <div className="text-right">
            <span className="text-slate-400 block text-[10px]">Tempo Médio Resposta</span>
            <span className="font-extrabold text-emerald-700 text-base">28 horas</span>
          </div>
        </div>
      </div>

      {/* 3 Recomendações Decisórias Diretas (Prompt 22) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Decisões Recomendadas para Despacho Imediato</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1.5">
            <span className="font-bold text-rose-700 uppercase text-[10px]">Decisão 1 (Prioridade 1)</span>
            <h4 className="font-bold text-sm">Reforço de ACEs no Bairro Vila Nova</h4>
            <p className="text-rose-800 text-[11px]">
              Transferir 4 agentes da Zona Rural para concluir o bloqueio viral de Dengue antes de completar 72 horas.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5">
            <span className="font-bold text-amber-700 uppercase text-[10px]">Decisão 2 (Jurídico / VISA)</span>
            <h4 className="font-bold text-sm">Autuação Sanitária de 2 Pontos Estratégicos</h4>
            <p className="text-amber-800 text-[11px]">
              Expedir termo conjunto com a Vigilância Sanitária para a Borracharia Central e Ferro Velho com vistorias vencidas.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1.5">
            <span className="font-bold text-blue-700 uppercase text-[10px]">Decisão 3 (Comunicação)</span>
            <h4 className="font-bold text-sm">Campanha de Coleta de Pneus e Entulho</h4>
            <p className="text-blue-800 text-[11px]">
              Articular com a Secretaria de Obras e Meio Ambiente mutirão de recolhimento nas áreas de maior reincidência.
            </p>
          </div>
        </div>
      </div>

      {/* Resumo Executivo em 3 Parágrafos para Reunião de Gabinete */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
          <FileText className="w-4 h-4 text-purple-600" />
          <span>Texto Síntese para Reunião de Gabinete / Prefeito</span>
        </div>

        <div className="text-xs text-slate-700 space-y-3 leading-relaxed">
          <p>
            <strong>1. Cenário Geral e Vetorial:</strong> O município de Santa Cruz do Sul encerrou a quarta semana do 1º Ciclo de 2026 com 71% de cobertura dos imóveis programados e 6 equipes em plena atividade. Os índices de ovitrampas apontam aceleração na densidade de ovos de Aedes aegypti no setor leste da cidade, impulsionada por chuvas recentes intercaladas com altas temperaturas.
          </p>
          <p>
            <strong>2. Focos e Bloqueios em Execução:</strong> Identificamos 5 focos ativos de transmissão de Dengue, dos quais 4 já se encontram com bloqueio focal e químico em andamento com prazo inferior a 48 horas da notificação. Dois imóveis foram enquadrados no protocolo de reincidência grave (mais de 3 focos nos últimos 90 dias) e foram encaminhados para intimação formal.
          </p>
          <p>
            <strong>3. Encaminhamentos Estratégicos:</strong> O estoque de larvicida BTI e Pyriproxyfen encontra-se em patamar seguro para os próximos 60 dias. Recomenda-se a assinatura do decreto de autorização para fiscalização reforçada nos 12 Pontos Estratégicos municipais e o apoio da Secretaria de Obras para coleta extraordinária de descartáveis.
          </p>
        </div>
      </div>
    </div>
  );
};
