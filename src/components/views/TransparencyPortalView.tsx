import React from 'react';
import { Eye, ShieldCheck, Home, CheckCircle2, Flame, Users, Heart } from 'lucide-react';
import { db } from '../../services/storage';

export const TransparencyPortalView: React.FC = () => {
  const municipality = db.getMunicipality();
  const cycle = db.getCycle();
  const neighborhoods = db.getNeighborhoods();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-900 to-emerald-900 text-white p-6 sm:p-8 rounded-2xl shadow-md space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            Transparência Pública Municipal • Lei de Acesso à Informação
          </span>
        </div>
        <h1 className="text-2xl font-black">
          Endemias em Números — {municipality.name}
        </h1>
        <p className="text-xs text-emerald-100 max-w-2xl">
          Acompanhamento público dos esforços municipais no combate à Dengue, Zika e Chikungunya. Dados estatísticos agregados em total conformidade com a LGPD (Lei Geral de Proteção de Dados).
        </p>
      </div>

      {/* Public Aggregated Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 text-center shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase">Imóveis Visitados</span>
          <p className="text-2xl font-black text-slate-900 mt-1">2.418</p>
          <span className="text-[10px] text-emerald-700 font-bold">71% da meta anual</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 text-center shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase">Focos Eliminados</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">39</p>
          <span className="text-[10px] text-emerald-700 font-bold">Criadouros neutralizados</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 text-center shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase">Agentes nas Ruas</span>
          <p className="text-2xl font-black text-blue-700 mt-1">42 ACEs</p>
          <span className="text-[10px] text-blue-700 font-bold">Cobertura em todos os bairros</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 text-center shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase">Tempo de Atendimento</span>
          <p className="text-2xl font-black text-purple-700 mt-1">28h</p>
          <span className="text-[10px] text-purple-700 font-bold">Em denúncias da comunidade</span>
        </div>
      </div>

      {/* Bairros - Dados Agregados Públicos */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Situação por Região / Bairro no 1º Ciclo de 2026
        </h3>

        <div className="divide-y divide-slate-100 text-xs">
          {neighborhoods.map(n => (
            <div key={n.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">{n.name}</p>
                <p className="text-[11px] text-slate-500">{n.totalProperties} imóveis cadastrados</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Cobertura</span>
                  <span className="font-bold text-blue-700">{n.coveragePercentage}%</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Situação</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    n.riskLevel === 'CRITICO' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {n.riskLevel === 'CRITICO' ? 'Atenção Redobrada' : 'Controlado'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dicas aos Moradores */}
      <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-xs text-amber-900 space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
          <Heart className="w-5 h-5 text-rose-500" />
          <span>Como você pode ajudar a proteger sua família e vizinhos:</span>
        </div>
        <ul className="space-y-1.5 pl-4 list-disc text-amber-800">
          <li>Elimine a água acumulada sobre lajes, calhas entupidas e ralos externos.</li>
          <li>Mantenha caixas d'água e tonéis de chuva completamente vedados com telas milimétricas.</li>
          <li>Coloque areia grossa até a borda nos pratinhos dos vasos de plantas.</li>
          <li>Receba bem o Agente de Combate às Endemias (ACE), devidamente uniformizado e com crachá municipal.</li>
        </ul>
      </div>
    </div>
  );
};
