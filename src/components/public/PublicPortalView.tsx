import React, { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  CheckCircle,
  AlertTriangle,
  Flame,
  Bug,
  MapPin,
  ExternalLink,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  HeartPulse,
  Send
} from 'lucide-react';
import { publicPortalService, PublicPortalData } from '../../services/publicPortalService';

interface PublicPortalViewProps {
  onNavigateToComplaint?: () => void;
  onNavigateToTracking?: () => void;
}

export const PublicPortalView: React.FC<PublicPortalViewProps> = ({
  onNavigateToComplaint,
  onNavigateToTracking
}) => {
  const municipalityId = '00000000-0000-0000-0000-000000000001';
  const [data, setData] = useState<PublicPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchNeighborhood, setSearchNeighborhood] = useState('');

  useEffect(() => {
    loadPublicData();
  }, []);

  const loadPublicData = async () => {
    setLoading(true);
    try {
      const res = await publicPortalService.getPublicOverview(municipalityId);
      setData(res);
    } catch (err) {
      console.error('Erro ao carregar dados do portal público:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredNeighborhoods = (data?.neighborhoods || []).filter(n =>
    n.name.toLowerCase().includes(searchNeighborhood.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Barra de Topo Institucional */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">Endemias GOV</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Transparência Pública
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {data?.municipalityName || 'Painel de Vigilância Entomológica & Saúde'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onNavigateToTracking}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              Consultar Protocolo
            </button>
            <button
              onClick={onNavigateToComplaint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Registrar Denúncia</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner Educativo */}
      <div className="bg-linear-to-r from-emerald-900 via-slate-900 to-teal-950 text-white py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800">
            Vigilância e Controle de Vetores
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Transparência das Ações contra as Arboviroses
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Acompanhe o trabalho dos Agentes de Combate a Endemias (ACE), o índice de visitas, os focos eliminados por bairro e saiba como proteger a sua residência.
          </p>

          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onNavigateToComplaint}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black rounded-xl shadow-lg transition flex items-center gap-2"
            >
              <Flame className="w-4 h-4 text-slate-950" />
              <span>Notificar Foco de Mosquito (Denúncia Cidadã)</span>
            </button>
            <button
              onClick={onNavigateToTracking}
              className="px-5 py-2.5 bg-slate-800/80 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700 transition"
            >
              Acompanhar Denúncia com Protocolo
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Central */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8">
        {/* Indicadores Consolidados */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase">Imóveis Trabalhados</span>
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {data?.indicators.totalVisited.toLocaleString('pt-BR') || '---'}
            </div>
            <span className="text-[11px] text-slate-400">Visitas domiciliares de rotina</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase">Focos Eliminados</span>
              <Bug className="w-5 h-5 text-rose-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {data?.indicators.fociEliminated.toLocaleString('pt-BR') || '---'}
            </div>
            <span className="text-[11px] text-slate-400">Criadouros tratados e removidos</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase">Quadras Tratadas</span>
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {data?.indicators.blocksTreated || '---'}
            </div>
            <span className="text-[11px] text-slate-400">Quarteirões com cobertura técnica</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase">Cobertura Territorial</span>
              <Shield className="w-5 h-5 text-teal-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {data?.indicators.coveragePercent || 78}%
            </div>
            <span className="text-[11px] text-slate-400">Meta do Ciclo Bimestral Vigente</span>
          </div>
        </div>

        {/* Tabela de Situação por Bairro */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <span>Situação e Classificação de Risco por Bairro</span>
              </h2>
              <p className="text-xs text-slate-500">
                Estatísticas agregadas territoriais • Dados 100% anonimizados em conformidade com a LGPD
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar bairro..."
                value={searchNeighborhood}
                onChange={e => setSearchNeighborhood(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Bairro</th>
                  <th className="py-2.5 px-3">Zona</th>
                  <th className="py-2.5 px-3">Classificação de Risco</th>
                  <th className="py-2.5 px-3">Imóveis Inspecionados</th>
                  <th className="py-2.5 px-3">Focos Eliminados</th>
                  <th className="py-2.5 px-3">Cobertura (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredNeighborhoods.map(n => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-800">{n.name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{n.zone}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          n.risk_level === 'baixo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : n.risk_level === 'medio'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {n.risk_level?.toUpperCase() || 'MÉDIO'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-mono">{n.visited_properties}</td>
                    <td className="py-2.5 px-3 text-rose-600 font-mono font-bold">{n.foci_eliminated}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, n.coverage_percent)}%` }}
                          ></div>
                        </div>
                        <span className="font-mono text-slate-600">{n.coverage_percent}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Seções Educativas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(data?.educationalCampaigns || []).map((camp, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">{camp.title}</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{camp.description}</p>
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-bold text-slate-700 block">Recomendações Práticas:</span>
                {camp.actionTips.map((tip, tIdx) => (
                  <div key={tIdx} className="flex items-start gap-2 text-xs text-slate-600">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Rodapé Oficial */}
      <footer className="bg-slate-900 text-white py-6 border-t border-slate-800 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p>
            Prefeitura Municipal • Secretaria Municipal de Saúde • Setor de Vigilância em Saúde e Controle de Endemias
          </p>
          <p className="text-[11px] text-slate-500">
            Endemias GOV © 2026 • Plataforma de Gestão e Inteligência Epidemiológica Municipal • Em conformidade com a LGPD (Lei nº 13.709/2018)
          </p>
        </div>
      </footer>
    </div>
  );
};
