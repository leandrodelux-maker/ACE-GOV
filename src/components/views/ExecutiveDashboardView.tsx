import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
  Clock,
  Flame,
  Layers,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { situationRoomService, SituationRoomData } from '../../services/situationRoomService';
import { historicalAnalysisService, ComparativeAnalysisResult } from '../../services/historicalAnalysisService';
import { supabaseService } from '../../services/supabaseService';
import { Municipality, FieldCycle } from '../../types';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';

export const ExecutiveDashboardView: React.FC = () => {
  const { municipality: sessionMunicipality } = useAuth();
  const municipalityId = useMunicipalityId();
  const [municipality, setMunicipality] = useState<Municipality | null>(null);
  const [cycle, setCycle] = useState<FieldCycle | null>(null);
  const [data, setData] = useState<SituationRoomData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fociTrend, setFociTrend] = useState<ComparativeAnalysisResult | null>(null);
  const [casesTrend, setCasesTrend] = useState<ComparativeAnalysisResult | null>(null);

  const loadExecutiveData = useCallback(async () => {
    setIsLoading(true);
    try {
      const muni = sessionMunicipality;
      const muniId = municipalityId;
      const activeCycle = await supabaseService.getActiveCycle(muniId);

      const [sitData, foci, casesCmp] = await Promise.all([
        situationRoomService.getSituationData({ municipalityId: muniId, periodFilter: 'cycle' }),
        historicalAnalysisService.getComparativeAnalysis('focos', 'ultimas_4semanas_vs_anteriores', undefined, muniId),
        historicalAnalysisService.getComparativeAnalysis('casos', 'ano_atual_vs_anterior', undefined, muniId),
      ]);
      setFociTrend(foci);
      setCasesTrend(casesCmp);

      setMunicipality(muni);
      setCycle(activeCycle);
      setData(sitData);
    } catch (err) {
      console.error('Erro ao carregar painel executivo:', err);
    } finally {
      setIsLoading(false);
    }
  }, [municipalityId, sessionMunicipality]);

  useEffect(() => {
    loadExecutiveData();
  }, [loadExecutiveData]);

  const kpis = data?.kpis;
  const criticalNeighborhoods = (data?.neighborhoods || []).filter(n => n.riskLevel === 'CRITICO' || n.riskLevel === 'ALTO');

  // Semáforo Epidemiológico Geral
  // Sem bairros registrados não há score: o semáforo fica "sem dados" (nunca um valor padrão)
  const avgRiskScore: number | null = (data?.neighborhoods || []).length > 0
    ? Math.round((data?.neighborhoods || []).reduce((acc, n) => acc + n.riskScore, 0) / (data?.neighborhoods || []).length)
    : null;

  const semaforoLevel = avgRiskScore === null
    ? { icon: '⚪', label: 'SEM DADOS SUFICIENTES', color: 'bg-slate-400', text: 'text-slate-600', bgText: 'bg-slate-50 border-slate-200' }
    : avgRiskScore >= 75
    ? { icon: '🔴', label: 'ESTADO DE EMERGÊNCIA SANITÁRIA (Nível 3)', color: 'bg-rose-500', text: 'text-rose-700', bgText: 'bg-rose-50 border-rose-200' }
    : avgRiskScore >= 50
    ? { icon: '🟠', label: 'ESTADO DE ALERTA EPIDEMIOLÓGICO (Nível 2)', color: 'bg-orange-500', text: 'text-orange-700', bgText: 'bg-orange-50 border-orange-200' }
    : avgRiskScore >= 25
    ? { icon: '🟡', label: 'ESTADO DE ATENÇÃO MODERADA (Nível 1)', color: 'bg-amber-500', text: 'text-amber-700', bgText: 'bg-amber-50 border-amber-200' }
    : { icon: '🟢', label: 'SITUAÇÃO SANITÁRIA CONTROLADA', color: 'bg-emerald-500', text: 'text-emerald-700', bgText: 'bg-emerald-50 border-emerald-200' };

  // Alertas Automatizados Reais
  const executiveAlerts: string[] = [];
  if (criticalNeighborhoods.length > 0) {
    executiveAlerts.push(`Bairro ${criticalNeighborhoods[0].name} atingiu risco ${criticalNeighborhoods[0].riskLevel} (${criticalNeighborhoods[0].riskScore}/100).`);
  }
  if ((kpis?.overduePE || 0) > 0) {
    executiveAlerts.push(`${kpis?.overduePE} ponto(s) estratégico(s) estão com vistoria quinzenal vencida.`);
  }
  if ((kpis?.recurrent || 0) > 0) {
    executiveAlerts.push(`Foi detectada reincidência de focos em ${kpis?.recurrent} imóvel(is) no município.`);
  }
  if (kpis && kpis.totalProperties > 0 && kpis.coveragePercent < 80) {
    executiveAlerts.push(`Cobertura do ciclo em ${kpis.coveragePercent}% dos imóveis cadastrados (referência PNCD: 80%).`);
  }

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="bg-gradient-to-r from-purple-900 to-slate-900 text-white p-6 rounded-2xl shadow-md space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
              Gabinete da Secretaria Municipal de Saúde — Painel do Gestor
            </span>
          </div>
          <button
            onClick={loadExecutiveData}
            disabled={isLoading}
            className="p-1.5 text-purple-200 hover:text-white rounded-lg hover:bg-white/10 transition"
            title="Atualizar dados executivos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <h1 className="text-xl font-black">
          Painel Executivo de Endemias & Arboviroses — {municipality?.name || 'Município'}
        </h1>
        <p className="text-xs text-purple-200">
          Visão consolidada para alta governança municipal: "O que precisa da minha atenção em 30 segundos para tomada de decisão?"
        </p>
      </div>

      {/* Semáforo Municipal */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl ${semaforoLevel.color} text-white flex items-center justify-center font-black text-2xl shadow-md`}>
            {semaforoLevel.icon}
          </div>
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${semaforoLevel.bgText}`}>
              Semáforo Epidemiológico Geral
            </span>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              {semaforoLevel.label}
            </h2>
            <p className="text-xs text-slate-500">
              Score médio dos bairros: <strong>{avgRiskScore === null ? '—' : `${avgRiskScore}/100`}</strong> • Ciclo: {cycle?.name || 'nenhum em andamento'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <span className="text-slate-400 block text-[10px]">Taxa de Cobertura</span>
            <span className="font-extrabold text-blue-700 text-base">
              {isLoading ? '...' : `${kpis?.coveragePercent || 0}%`}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200 mx-2" />
          <div className="text-right">
            <span className="text-slate-400 block text-[10px]">Focos Ativos</span>
            <span className="font-extrabold text-rose-600 text-base">
              {isLoading ? '...' : (kpis?.fociActive || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Comparativos temporais calculados (ver Análise Histórica) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Focos: últimas 4 semanas x 4 anteriores</span>
          {fociTrend?.available ? (
            <>
              <p className="font-extrabold text-base text-slate-900 mt-1">
                {fociTrend.currentTotal} vs {fociTrend.previousTotal} {fociTrend.indicator.unit}
              </p>
              <span className="text-[10px] text-slate-600 font-semibold">{fociTrend.statusExplanation}</span>
            </>
          ) : (
            <p className="text-slate-500 mt-1">{isLoading ? '...' : fociTrend?.unavailableReason || 'Dados insuficientes para o período.'}</p>
          )}
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Casos notificados: ano atual x anterior (até o mês atual)</span>
          {casesTrend?.available ? (
            <>
              <p className="font-extrabold text-base text-slate-900 mt-1">
                {casesTrend.currentTotal} vs {casesTrend.previousTotal} {casesTrend.indicator.unit}
              </p>
              <span className="text-[10px] text-slate-600 font-semibold">{casesTrend.statusExplanation}</span>
            </>
          ) : (
            <p className="text-slate-500 mt-1">{isLoading ? '...' : casesTrend?.unavailableReason || 'Dados insuficientes para o período.'}</p>
          )}
        </div>
      </div>

      {/* Alertas Oficiais da Secretaria */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Alertas Operacionais & Sanitários Automatizados</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {executiveAlerts.length === 0 ? (
            <p className="text-slate-500 text-xs p-4 bg-slate-50 rounded-xl col-span-2">
              Dados insuficientes para o período ou sem alertas críticos ativos.
            </p>
          ) : (
            executiveAlerts.map((alertText, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                <p className="font-semibold text-slate-800">{alertText}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Resumo Executivo em 3 Parágrafos para Reunião de Gabinete */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
          <FileText className="w-4 h-4 text-purple-600" />
          <span>Texto Síntese para Reunião de Gabinete / Prefeito</span>
        </div>

        <div className="text-xs text-slate-700 space-y-3 leading-relaxed">
          {!kpis ? (
            <p className="text-slate-500">{isLoading ? 'Carregando...' : 'Sem dados carregados para compor a síntese.'}</p>
          ) : (
            <>
              <p>
                <strong>1. Cenário geral:</strong>{' '}
                {cycle ? `Ciclo "${cycle.name}" em andamento` : 'Nenhum ciclo de campo em andamento'}, com {kpis.visited} imóvel(is)
                trabalhado(s) de {kpis.totalProperties} cadastrado(s) ({kpis.coveragePercent}%).{' '}
                {kpis.activeTeamsCount === null ? 'Não há equipes cadastradas.' : `${kpis.activeTeamsCount} equipe(s) cadastrada(s).`}{' '}
                {kpis.totalOvitraps > 0
                  ? `${kpis.positiveOvitraps} de ${kpis.totalOvitraps} ovitrampa(s) com ovos.`
                  : 'Sem ovitrampas cadastradas.'}
              </p>
              <p>
                <strong>2. Focos e bloqueios:</strong> {kpis.fociActive} foco(s) ativo(s), {kpis.activeBlocks} bloqueio(s) em andamento e{' '}
                {kpis.recurrent} imóvel(is) com reincidência registrada.
              </p>
              <p>
                <strong>3. Pendências:</strong> {kpis.overduePE} ponto(s) estratégico(s) com vistoria vencida, {kpis.openComplaints} denúncia(s)
                em aberto e {kpis.pending} pendência(s) de retorno.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
