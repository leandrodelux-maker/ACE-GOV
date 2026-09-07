import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, CheckCircle2, ShieldAlert } from 'lucide-react';
import { db } from '../../services/storage';

export const AiAssistantView: React.FC = () => {
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string; time: string }[]>([
    {
      role: 'ai',
      text: 'Olá! Sou o Assistente de Inteligência de Endemias do Município de Santa Cruz do Sul. Analisei os dados em tempo real do 1º Ciclo 2026. Como posso ajudar na tomada de decisão sanitária hoje?',
      time: '08:00',
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const neighborhoods = db.getNeighborhoods();
  const criticalNeigh = neighborhoods.find(n => n.riskLevel === 'CRITICO') || neighborhoods[0];

  const quickQuestions = [
    'Qual bairro precisa de atenção prioritária amanhã?',
    'Quais pontos estratégicos estão irregulares?',
    'Qual o principal tipo de criadouro encontrado nos imóveis?',
    'Qual sugestão de despacho para o Secretário de Saúde?',
  ];

  const handleAsk = (questionText: string) => {
    if (!questionText.trim()) return;

    const userMsg = {
      role: 'user' as const,
      text: questionText,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuestion('');
    setIsThinking(true);

    setTimeout(() => {
      let aiResponse = '';
      const q = questionText.toLowerCase();

      if (q.includes('qual bairro') || q.includes('atenção') || q.includes('prioritária')) {
        aiResponse = `📊 **Análise Territorial Imediata:**\nO bairro com maior criticidade hoje é o **${criticalNeigh.name}** (Índice de Risco ${criticalNeigh.riskScore}/100 - Crítico).\n\n**Motivos detectados:**\n1. Cobertura de visitas em apenas ${criticalNeigh.coveragePercentage}%, aquém da meta municipal.\n2. Presença de ${criticalNeigh.fociCount} focos confirmados de Aedes aegypti.\n3. Operação de bloqueio BLQ-2026-014 com 22 imóveis ainda pendentes de vistoria no raio de 150m.\n\n**Recomendação:** Deslocar 3 agentes de apoio para zerar as pendências de bloqueio nas próximas 24 horas.`;
      } else if (q.includes('pontos estratégicos') || q.includes('estratégico') || q.includes('irregular')) {
        aiResponse = `🔍 **Vigilância de Pontos Estratégicos (PE):**\nConstatamos 2 estabelecimentos com inspeção quinzenal vencida:\n- **Borracharia Central** (Rua Marechal Deodoro, 1020) — 18 dias sem vistoria.\n- **Ferro Velho Rodoviário** — 16 dias sem vistoria.\n\n**Conduta:** Escalar o ACE Carlos Silva para inspeção imediata e notificação de cobertura de pneus e descarte de água pluvial.`;
      } else if (q.includes('criadouro') || q.includes('depósito') || q.includes('larvas')) {
        aiResponse = `🐛 **Distribuição de Criadouros (Padrão MS / LIRAa):**\nO criadouro mais frequente no município são os **recipientes do Tipo B (Vasos de plantas, pratinhos e garrafas no peridomicílio)**, respondendo por 38% dos focos, seguidos pelo **Tipo A2 (Tonéis e tambores de captação de água de chuva)** com 29%.\n\n**Ação:** Reforçar a orientação aos moradores sobre colocação de areia grossa nos pratos e vedação com telas nos tambores.`;
      } else {
        aiResponse = `📋 **Síntese de Governança para o Secretário:**\nO município mantém 71% de cobertura no 1º Ciclo de 2026. A situação geral é de alerta moderado (nível 2), com foco isolado em Vila Nova.\n\n**Decisões sugeridas:**\n1. Publicar portaria de apoio intersetorial com a Secretaria de Obras para coleta de entulhos em áreas críticas.\n2. Manter 100% de celeridade no protocolo de bloqueio de 48h para casos de dengue notificados pelo Sinan.\n3. Solicitar à VISA vistoria conjunta nos estabelecimentos comerciais reincidentes.`;
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: aiResponse,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setIsThinking(false);
    }, 800);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-sky-600 text-white flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900">Assistente de Inteligência Sanitária & Endemias</h1>
          <p className="text-xs text-slate-500">
            Análises preditivas, dimensionamento de risco e recomendações técnicas baseadas nos dados oficiais do município
          </p>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {quickQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleAsk(q)}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 min-h-[420px] max-h-[560px] overflow-y-auto">
        {messages.map((msg, idx) => {
          const isAi = msg.role === 'ai';

          return (
            <div
              key={idx}
              className={`flex gap-3 text-xs ${isAi ? 'justify-start' : 'justify-end'}`}
            >
              {isAi && (
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-bold">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`p-4 rounded-2xl max-w-lg space-y-1.5 leading-relaxed ${
                  isAi
                    ? 'bg-slate-50 border border-slate-200 text-slate-800'
                    : 'bg-blue-600 text-white'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>
                <span className={`block text-[10px] text-right ${isAi ? 'text-slate-400' : 'text-blue-200'}`}>
                  {msg.time}
                </span>
              </div>

              {!isAi && (
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center flex-shrink-0 font-bold">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isThinking && (
          <div className="flex gap-3 text-xs items-center text-slate-400">
            <Bot className="w-5 h-5 text-blue-600 animate-spin" />
            <span>Consultando dados de vigilância entomológica e calculando recomendações...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleAsk(inputQuestion);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          placeholder="Pergunte ao assistente sobre áreas de risco, focos, equipes..."
          value={inputQuestion}
          onChange={e => setInputQuestion(e.target.value)}
          className="flex-1 p-3 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 outline-none focus:border-blue-600"
        />
        <button
          type="submit"
          className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
        >
          <Send className="w-4 h-4" />
          <span>Perguntar</span>
        </button>
      </form>
    </div>
  );
};
