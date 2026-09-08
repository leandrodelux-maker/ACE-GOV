import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  CheckCircle2,
  ShieldAlert,
  HelpCircle,
  FileText,
  Calendar,
  Layers,
  Database,
  Check,
} from 'lucide-react';
import { aiQueryService, StructuredAiResponse } from '../../services/aiQueryService';

interface ChatMessage {
  role: 'ai' | 'user';
  structuredData?: StructuredAiResponse;
  rawText?: string;
  time: string;
}

export const AiAssistantView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'ai',
      rawText:
        'Olá! Sou o Assistente Oficial de Inteligência de Endemias. Minhas respostas utilizam uma camada segura de consulta sobre a base municipal em tempo real, respeitando estritamente a LGPD e o sigilo sanitário. Como posso apoiar sua tomada de decisão hoje?',
      time: '08:00',
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const quickSuggestions = [
    'Qual bairro está mais crítico hoje?',
    'Quantos imóveis faltam para atingir 90% de cobertura?',
    'Quais pontos estratégicos estão vencidos?',
    'Existe aumento de dengue nas últimas semanas?',
    'Quais áreas deveriam receber prioridade amanhã?',
    'Como está o ciclo atual e as pendências de retorno?',
  ];

  const handleAsk = async (questionText: string) => {
    if (!questionText.trim()) return;

    const userMsg: ChatMessage = {
      role: 'user',
      rawText: questionText,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuestion('');
    setIsThinking(true);

    try {
      const response = await aiQueryService.processManagerQuestion(questionText);
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          structuredData: response,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error('Erro ao consultar IA:', err);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header Institucional */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              Assistente de Inteligência Sanitária & Tomada de Decisão
            </h1>
            <p className="text-xs text-slate-500">
              Camada segura de consulta analítica: respostas baseadas em dados reais com justificativa técnica e anonimização LGPD
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
          <Database className="w-3.5 h-3.5" />
          <span>Camada Segura Ativa</span>
        </div>
      </div>

      {/* Sugestões Rápidas */}
      <div className="flex flex-wrap gap-1.5">
        {quickSuggestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleAsk(q)}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-slate-700 text-xs font-medium transition shadow-2xs text-left"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 min-h-[460px] max-h-[620px] overflow-y-auto">
        {messages.map((msg, idx) => {
          const isAi = msg.role === 'ai';

          return (
            <div
              key={idx}
              className={`flex gap-3 text-xs ${isAi ? 'items-start' : 'items-start flex-row-reverse'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs ${
                  isAi ? 'bg-indigo-600' : 'bg-slate-900'
                }`}
              >
                {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-2xs space-y-3 ${
                  isAi
                    ? 'bg-slate-50 border border-slate-200 text-slate-800'
                    : 'bg-indigo-600 text-white'
                }`}
              >
                {/* Mensagem Texto Simples */}
                {msg.rawText && <p className="leading-relaxed">{msg.rawText}</p>}

                {/* Resposta Estruturada Oficial */}
                {msg.structuredData && (
                  <div className="space-y-3 text-xs">
                    {/* 1. Resumo */}
                    <div className="p-3 bg-white rounded-xl border border-indigo-100 space-y-1">
                      <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider block">
                        1. Resumo Executivo
                      </span>
                      <p className="font-semibold text-slate-900 leading-relaxed">
                        {msg.structuredData.summary}
                      </p>
                    </div>

                    {/* 2. Dados Utilizados & Período */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-100/70 p-2.5 rounded-lg font-mono">
                      <div>
                        <span className="text-slate-500 block font-sans font-semibold">Dados Utilizados:</span>
                        <span className="text-slate-800">{msg.structuredData.dataUsed}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block font-sans font-semibold">Período Considerado:</span>
                        <span className="text-slate-800">{msg.structuredData.periodConsidered}</span>
                      </div>
                    </div>

                    {/* 3. Explicação */}
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-0.5">
                        2. Diagnóstico & Explicação Técnica
                      </span>
                      <p className="text-slate-700 leading-relaxed">{msg.structuredData.explanation}</p>
                    </div>

                    {/* 4. Recomendação */}
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                      <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block mb-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        3. Recomendação Sanitária Operacional
                      </span>
                      <p className="font-medium leading-relaxed">{msg.structuredData.recommendation}</p>
                    </div>
                  </div>
                )}

                <span
                  className={`text-[9px] block text-right font-mono ${
                    isAi ? 'text-slate-400' : 'text-indigo-200'
                  }`}
                >
                  {msg.time}
                </span>
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="flex gap-3 text-xs items-center">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-slate-500 italic">
              Consultando camada analítica e calculando indicadores municipais...
            </div>
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
          value={inputQuestion}
          onChange={e => setInputQuestion(e.target.value)}
          placeholder="Pergunte sobre cobertura, bairros críticos, pendências ou planeje o próximo dia..."
          className="flex-1 p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs"
        />
        <button
          type="submit"
          disabled={!inputQuestion.trim() || isThinking}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-2 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>Consultar</span>
        </button>
      </form>
    </div>
  );
};
