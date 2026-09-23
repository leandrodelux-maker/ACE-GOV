import { supabase } from './supabaseClient';
import { requireMunicipalityId } from './municipalityScope';
import { supabaseService } from './supabaseService';
import { riskEngineService, RiskCalculationResult } from './riskEngineService';
import { Neighborhood } from '../types';

export interface SituationKpis {
  totalProperties: number;
  visited: number;
  coveragePercent: number;
  pending: number;
  closed: number;
  refusals: number;
  fociActive: number;
  eliminated: number;
  recurrent: number;
  positiveOvitraps: number;
  totalOvitraps: number;
  activeBlocks: number;
  openComplaints: number;
  overduePE: number;
  /** null = sem equipes cadastradas */
  activeTeamsCount: number | null;
  /** null = equipes sem número de membros informado */
  activeAgentsCount: number | null;
}

/** Entradas reais do motor de risco para um bairro (sem os pesos). */
export type NeighborhoodRiskInputs = Omit<Parameters<typeof riskEngineService.calculateScore>[0], 'settings'>;

export interface NeighborhoodSituation {
  id: string;
  name: string;
  totalProperties: number;
  /** null = bairro sem imóveis cadastrados (cobertura não calculável) */
  coveragePercentage: number | null;
  fociCount: number;
  riskScore: number;
  riskLevel: 'BAIXO' | 'ATENCAO' | 'ALTO' | 'CRITICO';
  riskSummary: string;
  pendingCount: number;
  /** Imóveis distintos com visita "trabalhado" no período */
  visitedCount: number;
  riskInputs: NeighborhoodRiskInputs;
}

export interface OperationalPriority {
  id: string;
  type: 'BLOQUEIO' | 'PE_VENCIDO' | 'OVITRAMPA_ALTA' | 'REINCIDENTE' | 'DENUNCIA_CRITICA' | 'BAIXA_COBERTURA';
  title: string;
  description: string;
  targetModule: string;
  badgeColor: string;
  badgeLabel: string;
}

export interface DepositTypeStat {
  code: string;
  name: string;
  count: number;
  color: string;
}

export interface SituationRoomData {
  kpis: SituationKpis;
  neighborhoods: NeighborhoodSituation[];
  priorities: OperationalPriority[];
  depositDistribution: DepositTypeStat[];
  /** null = nenhum ciclo em andamento */
  activeCycleName: string | null;
  /** Neighborhood com maior densidade média de ovos em ovitrampas positivas (null = sem dados) */
  topEggDensityNeighborhood: { name: string; averageEggs: number } | null;
  /** Consultas que falharam (dados exibidos podem estar incompletos) */
  failedSources: string[];
  calculatedAt: string;
}

// Cache em memória com TTL de 30 segundos
interface CacheEntry {
  timestamp: number;
  data: SituationRoomData;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30000; // 30s

export const situationRoomService = {
  /**
   * Buscar todos os dados consolidados da Sala de Situação com cache
   */
  async getSituationData(options: {
    municipalityId: string;
    periodFilter: 'today' | '7days' | '30days' | 'cycle';
    neighborhoodId?: string;
    forceRefresh?: boolean;
  }): Promise<SituationRoomData> {
    const {
      periodFilter = 'cycle',
      neighborhoodId = 'ALL',
      forceRefresh = false,
    } = options;
    const municipalityId = requireMunicipalityId(options.municipalityId);

    const cacheKey = `${municipalityId}_${periodFilter}_${neighborhoodId}`;

    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // 1. Data inicial conforme período
    const now = new Date();
    let startDateStr: string | null = null;

    if (periodFilter === 'today') {
      startDateStr = now.toISOString().split('T')[0];
    } else if (periodFilter === '7days') {
      const d = new Date(now.getTime() - 7 * 86400000);
      startDateStr = d.toISOString().split('T')[0];
    } else if (periodFilter === '30days') {
      const d = new Date(now.getTime() - 30 * 86400000);
      startDateStr = d.toISOString().split('T')[0];
    }

    // 2. Buscar Ciclo Ativo e Configurações de Risco em paralelo
    const [cycle, riskSettings, allNeighborhoodsRes] = await Promise.all([
      supabaseService.getActiveCycle(municipalityId),
      riskEngineService.getSettings(municipalityId),
      supabase.from('neighborhoods').select('*').eq('municipality_id', municipalityId),
    ]);

    const activeCycleName = cycle?.name ?? null;
    const activeCycleId = cycle?.id;

    // 3. Consultar Imóveis
    let propertiesQuery = supabase
      .from('properties')
      .select('id, property_code, neighborhood_id, status, risk_score, last_visit_at, recurrence_count', { count: 'exact' })
      .eq('municipality_id', municipalityId)
      .is('deleted_at', null);

    if (neighborhoodId !== 'ALL') {
      propertiesQuery = propertiesQuery.eq('neighborhood_id', neighborhoodId);
    }

    // 4. Consultar Visitas do período
    let visitsQuery = supabase
      .from('visits')
      .select(`
        id, property_id, result, visit_date, agent_id,
        properties!inner(neighborhood_id),
        visit_deposits(deposit_type, quantity, positive, eliminated, treated)
      `)
      .eq('municipality_id', municipalityId)
      .is('deleted_at', null);

    if (neighborhoodId !== 'ALL') {
      visitsQuery = visitsQuery.eq('properties.neighborhood_id', neighborhoodId);
    }

    if (startDateStr) {
      visitsQuery = visitsQuery.gte('visit_date', startDateStr);
    } else if (activeCycleId) {
      visitsQuery = visitsQuery.eq('cycle_id', activeCycleId);
    }

    // 5. Consultas adicionais consolidadas
    const [
      propsRes,
      visitsRes,
      pendingRes,
      ovitrapsRes,
      peRes,
      complaintsRes,
      blocksRes,
      teamsRes,
    ] = await Promise.all([
      propertiesQuery,
      visitsQuery,
      // pending_visits não tem municipality_id: filtra pelo município do imóvel
      supabase
        .from('pending_visits')
        .select('*, properties!inner(municipality_id)')
        .eq('status', 'PENDENTE')
        .eq('properties.municipality_id', municipalityId),
      supabase.from('ovitraps').select('*').eq('municipality_id', municipalityId),
      supabase.from('strategic_points').select('*').eq('municipality_id', municipalityId),
      supabase.from('complaints').select('*').eq('municipality_id', municipalityId).neq('status', 'RESOLVIDA'),
      supabase.from('epidemiological_blocks').select('*').eq('municipality_id', municipalityId).eq('status', 'EM_ANDAMENTO'),
      supabase.from('teams').select('id, members_count').eq('municipality_id', municipalityId),
    ]);

    const sourceResults: [string, { error: unknown }][] = [
      ['imóveis', propsRes],
      ['visitas', visitsRes],
      ['pendências', pendingRes],
      ['ovitrampas', ovitrapsRes],
      ['pontos estratégicos', peRes],
      ['denúncias', complaintsRes],
      ['bloqueios', blocksRes],
      ['equipes', teamsRes],
      ['bairros', allNeighborhoodsRes],
    ];
    const failedSources = sourceResults.filter(([, r]) => !!r.error).map(([name]) => name);

    const properties = propsRes.data || [];
    const visits = visitsRes.data || [];
    const pendingVisits = pendingRes.data || [];
    const ovitraps = ovitrapsRes.data || [];
    const strategicPoints = peRes.data || [];
    const complaints = complaintsRes.data || [];
    const blocks = blocksRes.data || [];
    const teams = teamsRes.data || [];
    const neighborhoodsList = allNeighborhoodsRes.data || [];

    // 6. Calcular Indicadores da Sala de Situação
    const totalProperties = properties.length;
    const visitedSet = new Set<string>();
    let closedCount = 0;
    let refusalCount = 0;
    let eliminatedDepositsCount = 0;
    let activeFociVisits = 0;

    // Tipologia de Criadouros A1 a E
    const depositCounts: Record<string, number> = {
      A1: 0,
      A2: 0,
      B: 0,
      C: 0,
      D1: 0,
      D2: 0,
      E: 0,
    };

    // A RPC grava 'trabalhado' (minúsculo); telas antigas usam maiúsculas — normaliza.
    const resultOf = (v: any) => String(v.result ?? '').toUpperCase();
    visits.forEach((v: any) => {
      if (resultOf(v) === 'TRABALHADO') {
        visitedSet.add(v.property_id);
      } else if (resultOf(v) === 'FECHADO') {
        closedCount++;
      } else if (resultOf(v) === 'RECUSADO') {
        refusalCount++;
      }

      (v.visit_deposits || []).forEach((d: any) => {
        if (d.positive) activeFociVisits++;
        if (d.eliminated || d.treated) eliminatedDepositsCount++;
        const type = d.deposit_type;
        if (type && depositCounts[type] !== undefined) {
          depositCounts[type] += d.quantity || 1;
        }
      });
    });

    const visited = visitedSet.size;
    const coveragePercent = totalProperties > 0 ? Math.round((visited / totalProperties) * 100) : 0;
    const pending = pendingVisits.length;
    const fociActive = properties.filter((p: any) => p.status === 'FOCO').length + activeFociVisits;
    const recurrent = properties.filter((p: any) => (p.recurrence_count || 0) >= 2).length;

    // Ovitrampas
    const totalOvitraps = ovitraps.length;
    const positiveOvitraps = ovitraps.filter((o: any) => o.positive || (o.eggs_count || 0) > 0).length;

    // PE Vencidos (> 15 dias)
    const overduePE = strategicPoints.filter((sp: any) => {
      if (!sp.last_inspection_at) return true;
      const daysSince = Math.floor((now.getTime() - new Date(sp.last_inspection_at).getTime()) / 86400000);
      return daysSince > 15;
    }).length;

    // Equipes (sem valores substitutos: ausência de dado => null)
    const activeTeamsCount = teams.length > 0 ? teams.length : null;
    const teamsWithMembers = teams.filter((t: any) => typeof t.members_count === 'number');
    const activeAgentsCount =
      teamsWithMembers.length > 0 ? teamsWithMembers.reduce((acc: number, t: any) => acc + t.members_count, 0) : null;

    const kpis: SituationKpis = {
      totalProperties,
      visited,
      coveragePercent,
      pending,
      closed: closedCount,
      refusals: refusalCount,
      fociActive,
      eliminated: eliminatedDepositsCount,
      recurrent,
      positiveOvitraps,
      totalOvitraps,
      activeBlocks: blocks.length,
      openComplaints: complaints.length,
      overduePE,
      activeTeamsCount,
      activeAgentsCount,
    };

    // 7. Situação Territorial por Bairro com cálculo dinâmico do Motor de Risco
    const neighborhoodSituations: NeighborhoodSituation[] = neighborhoodsList.map((n: any) => {
      const neighProps = properties.filter((p: any) => p.neighborhood_id === n.id);
      const neighVisits = visits.filter((v: any) => v.properties?.neighborhood_id === n.id);
      const neighVisited = new Set(neighVisits.filter((v: any) => resultOf(v) === 'TRABALHADO').map((v: any) => v.property_id)).size;
      const neighTotal = neighProps.length;
      const neighCoverage = neighTotal > 0 ? Math.round((neighVisited / neighTotal) * 100) : null;
      const neighPositiveTraps = ovitraps.filter((o: any) => o.neighborhood_id === n.id && (o.positive || (o.eggs_count || 0) > 0));
      const neighEggDensity =
        neighPositiveTraps.length > 0
          ? neighPositiveTraps.reduce((acc: number, o: any) => acc + (o.eggs_count || 0), 0) / neighPositiveTraps.length
          : 0;
      const lastVisitTimes = neighProps
        .map((p: any) => (p.last_visit_at ? new Date(p.last_visit_at).getTime() : NaN))
        .filter((t: number) => !Number.isNaN(t));
      const daysSinceLastVisit =
        lastVisitTimes.length > 0 ? Math.floor((now.getTime() - Math.max(...lastVisitTimes)) / 86400000) : 0;
      const neighFoci = neighProps.filter((p: any) => p.status === 'FOCO').length;
      const neighRecurrent = neighProps.filter((p: any) => (p.recurrence_count || 0) >= 2).length;
      const neighPending = pendingVisits.filter((pv: any) => neighProps.some((p: any) => p.id === pv.property_id)).length;

      // Calcular Score com o motor de risco (apenas dados registrados)
      const riskInputs: NeighborhoodRiskInputs = {
        recentFociCount: neighFoci,
        recurrentCount: neighRecurrent,
        epidemiologicalCasesCount: blocks.filter((b: any) => b.target_neighborhood === n.name).length,
        positiveOvitrapsCount: neighPositiveTraps.length,
        eggDensityAverage: neighEggDensity,
        openComplaintsCount: complaints.filter((c: any) => c.street?.includes(n.name)).length,
        closedPropertiesCount: neighVisits.filter((v: any) => resultOf(v) === 'FECHADO').length,
        refusalsCount: neighVisits.filter((v: any) => resultOf(v) === 'RECUSADO').length,
        // Sem imóveis cadastrados não há déficit de cobertura a pontuar
        coveragePercentage: neighCoverage ?? 100,
        overduePeCount: strategicPoints.filter((sp: any) => {
          if (sp.neighborhood_id !== n.id) return false;
          if (!sp.last_inspection_at) return true;
          return Math.floor((now.getTime() - new Date(sp.last_inspection_at).getTime()) / 86400000) > 15;
        }).length,
        daysSinceLastVisit,
      };
      const riskCalc: RiskCalculationResult = riskEngineService.calculateScore({ settings: riskSettings, ...riskInputs });

      return {
        id: n.id,
        name: n.name,
        totalProperties: neighTotal,
        coveragePercentage: neighCoverage,
        fociCount: neighFoci,
        riskScore: riskCalc.score,
        riskLevel: riskCalc.level,
        riskSummary: riskCalc.summary,
        pendingCount: neighPending,
        visitedCount: neighVisited,
        riskInputs,
      };
    });

    // 8. Prioridades Operacionais de Hoje Dinâmicas
    const priorities: OperationalPriority[] = [];

    // Prioridade de Bloqueios Ativos
    blocks.forEach((b: any) => {
      priorities.push({
        id: `blk-${b.id}`,
        type: 'BLOQUEIO',
        title: `Bloqueio ${b.code || 'sem código'}${b.disease ? ` (${b.disease})` : ''}`,
        description: [
          b.target_neighborhood ? `Local: ${b.target_neighborhood}.` : 'Local não informado.',
          b.radius_meters ? `Raio de ${b.radius_meters} m.` : 'Raio não informado.',
        ].join(' '),
        targetModule: 'epidemiology',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
        badgeLabel: 'Bloqueio Viral',
      });
    });

    // Prioridade de PEs Vencidos
    if (overduePE > 0) {
      priorities.push({
        id: 'pe-overdue',
        type: 'PE_VENCIDO',
        title: `${overduePE} Ponto(s) Estratégico(s) com Vistoria Vencida`,
        description: 'Borracharias e ferros-velhos ultrapassaram o limite quinzenal (15 dias) preconizado pelo Ministério da Saúde.',
        targetModule: 'strategic_points',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        badgeLabel: 'Inspeção Quinzenal',
      });
    }

    // Prioridade de Ovitrampas em Alta
    const highTraps = ovitraps.filter((o: any) => (o.eggs_count || 0) >= 100);
    if (highTraps.length > 0) {
      priorities.push({
        id: 'ovi-high',
        type: 'OVITRAMPA_ALTA',
        title: `${highTraps.length} Ovitrampa(s) com Alta Densidade de Ovos`,
        description: `Armadilha sentinela registrou contagem elevada de ovos. Recomenda-se busca ativa peridomiciliar imediata.`,
        targetModule: 'ovitraps',
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
        badgeLabel: 'Alerta Entomológico',
      });
    }

    // Prioridade de Reincidência
    if (recurrent > 0) {
      priorities.push({
        id: 'rec-foci',
        type: 'REINCIDENTE',
        title: `${recurrent} Imóvel(is) com Foco Reincidente`,
        description: 'Imóveis com múltiplos focos positivos nos últimos 90 dias demandam notificação formal da Vigilância Sanitária.',
        targetModule: 'properties',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
        badgeLabel: 'Reincidência Grave',
      });
    }

    // Prioridade de Denúncias
    if (complaints.length > 0) {
      priorities.push({
        id: 'complaints-priority',
        type: 'DENUNCIA_CRITICA',
        title: `${complaints.length} Denúncia(s) Aguardando Vistoria`,
        description: 'Denúncias em aberto aguardando vistoria do ACE.',
        targetModule: 'complaints',
        badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
        badgeLabel: 'Voz do Cidadão',
      });
    }

    // 9. Formatação da Tipologia de Criadouros
    const depositLabels: Record<string, { name: string; color: string }> = {
      A1: { name: 'Caixas d\'água / Reservatórios Elevados', color: 'bg-blue-500' },
      A2: { name: 'Tonéis / Tambores / Cisternas ao Solo', color: 'bg-cyan-500' },
      B: { name: 'Vasos / Pratos / Pingadeiras / Garrafas', color: 'bg-emerald-500' },
      C: { name: 'Calhas / Ralos / Lajes / Piscinas', color: 'bg-amber-500' },
      D1: { name: 'Pneus e Materiais Rodantes', color: 'bg-rose-500' },
      D2: { name: 'Lixo / Sucatas / Entulho / Recicláveis', color: 'bg-orange-500' },
      E: { name: 'Criadouros Naturais (Ocos / Bromélias)', color: 'bg-purple-500' },
    };

    const depositDistribution: DepositTypeStat[] = Object.keys(depositLabels).map(code => ({
      code,
      name: depositLabels[code].name,
      count: depositCounts[code] || 0,
      color: depositLabels[code].color,
    }));

    // Bairro com maior densidade média de ovos (apenas com dados reais)
    const densityRanking = neighborhoodsList
      .map((n: any) => {
        const positives = ovitraps.filter((o: any) => o.neighborhood_id === n.id && (o.eggs_count || 0) > 0);
        return {
          name: n.name as string,
          averageEggs: positives.length > 0 ? positives.reduce((a: number, o: any) => a + (o.eggs_count || 0), 0) / positives.length : 0,
        };
      })
      .filter((r) => r.averageEggs > 0)
      .sort((a, b) => b.averageEggs - a.averageEggs);
    const topEggDensityNeighborhood = densityRanking[0]
      ? { name: densityRanking[0].name, averageEggs: Math.round(densityRanking[0].averageEggs) }
      : null;

    const resultData: SituationRoomData = {
      kpis,
      neighborhoods: neighborhoodSituations,
      priorities,
      depositDistribution,
      activeCycleName,
      topEggDensityNeighborhood,
      failedSources,
      calculatedAt: new Date().toISOString(),
    };

    // Guardar em cache
    cache.set(cacheKey, {
      timestamp: Date.now(),
      data: resultData,
    });

    return resultData;
  },

  /**
   * Limpar cache da Sala de Situação
   */
  clearCache(): void {
    cache.clear();
  },
};
