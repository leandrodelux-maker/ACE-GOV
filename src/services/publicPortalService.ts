import { supabase } from './supabaseClient';

export interface PublicNeighborhoodStats {
  id: string;
  name: string;
  zone: string;
  risk_level: 'baixo' | 'medio' | 'alto' | 'critico';
  visited_properties: number;
  foci_eliminated: number;
  coverage_percent: number;
}

export interface PublicPortalData {
  municipalityName: string;
  lastUpdated: string;
  indicators: {
    totalVisited: number;
    fociEliminated: number;
    blocksTreated: number;
    coveragePercent: number;
  };
  neighborhoods: PublicNeighborhoodStats[];
  educationalCampaigns: Array<{
    title: string;
    description: string;
    actionTips: string[];
    priority: 'alta' | 'media' | 'informativa';
  }>;
}

export interface PublicComplaintPayload {
  municipalityId: string;
  problemType:
    | 'terreno_baldinho'
    | 'piscina_abandonada'
    | 'acumulo_lixo'
    | 'caixa_dagua_aberta'
    | 'foco_larvas'
    | 'outro';
  description: string;
  neighborhood: string;
  neighborhoodId?: string;
  approximateAddress: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  reporterName?: string;
  reporterPhone?: string;
  isAnonymous?: boolean;
}

export interface PublicComplaintTrackingResult {
  protocol: string;
  status: 'recebida' | 'em_analise' | 'vistoria_programada' | 'em_atendimento' | 'concluida' | 'cancelada';
  statusLabel: string;
  problemType: string;
  neighborhood: string;
  approximateAddress: string;
  createdAt: string;
  updatedAt: string;
  publicNotes?: string;
  timeline: Array<{ step: string; date: string; completed: boolean; current: boolean }>;
}

const EDUCATIONAL_CAMPAIGNS: PublicPortalData['educationalCampaigns'] = [
  {
    title: '10 Minutos Contra o Aedes',
    description:
      'Uma checagem semanal de 10 minutos no seu quintal elimina até 80% dos potenciais criadouros do mosquito transmissor da Dengue, Chikungunya e Zika.',
    actionTips: [
      'Vistorie pratos de plantas e coloque areia até a borda',
      'Tampe caixas d’água e tonéis de armazenamento',
      'Limpe calhas e ralos externos pelo menos uma vez por semana',
      'Descarte pneus velhos e garrafas com a boca virada para baixo',
    ],
    priority: 'alta',
  },
  {
    title: 'Sintomas e Quando Procurar a UBS',
    description:
      'Febre alta repentina, dor atrás dos olhos, dores articulares intensas e manchas vermelhas na pele são sinais de alerta. Beba muita água e evite automedicação.',
    actionTips: [
      'Nunca tome medicamentos à base de ácido acetilsalicílico (Aspirina/AAS)',
      'Procure a Unidade Básica de Saúde logo no início dos sintomas',
      'Mantenha repouso absoluto e hidratação oral vigorosa',
    ],
    priority: 'media',
  },
];

const STATUS_MAP: Record<
  string,
  { label: string; stage: number; key: PublicComplaintTrackingResult['status'] }
> = {
  RECEBIDA: { label: 'Recebida no Sistema', stage: 1, key: 'recebida' },
  EM_ANALISE: { label: 'Em Análise pela Vigilância', stage: 2, key: 'em_analise' },
  TRIAGEM: { label: 'Em Análise pela Vigilância', stage: 2, key: 'em_analise' },
  PROGRAMADA: { label: 'Vistoria de Campo Programada', stage: 3, key: 'vistoria_programada' },
  ATRIBUIDA: { label: 'Vistoria de Campo Programada', stage: 3, key: 'vistoria_programada' },
  EM_ATENDIMENTO: { label: 'Agente em Vistoria no Local', stage: 4, key: 'em_atendimento' },
  RESOLVIDA: { label: 'Atendimento Concluído', stage: 5, key: 'concluida' },
  CONCLUIDA: { label: 'Atendimento Concluído', stage: 5, key: 'concluida' },
  CANCELADA: { label: 'Denúncia Cancelada / Inconsistente', stage: 5, key: 'cancelada' },
};

const PROBLEM_LABELS: Record<string, string> = {
  terreno_baldinho: 'Terreno Baldio com Entulho',
  piscina_abandonada: 'Piscina sem Tratamento',
  acumulo_lixo: 'Acúmulo de Lixo / Sucata',
  caixa_dagua_aberta: 'Caixa d’Água Destampada',
  foco_larvas: 'Presença de Larvas / Mosquitos',
  outro: 'Outro Criadouro Potencial',
};

export const publicPortalService = {
  /** Dados agregados anonimizados do portal público (via RPC SECURITY DEFINER). */
  async getPublicOverview(municipalityId: string): Promise<PublicPortalData> {
    const { data, error } = await supabase.rpc('public_portal_overview', {
      p_municipality_id: municipalityId,
    });
    if (error) {
      console.error('Erro ao buscar resumo público:', error);
      throw new Error('Não foi possível carregar os indicadores públicos no momento.');
    }

    const d = data as any;
    return {
      municipalityName: d.municipalityName,
      lastUpdated: d.lastUpdated,
      indicators: {
        totalVisited: d.indicators?.totalVisited ?? 0,
        fociEliminated: d.indicators?.fociEliminated ?? 0,
        blocksTreated: d.indicators?.blocksTreated ?? 0,
        coveragePercent: d.indicators?.coveragePercent ?? 0,
      },
      neighborhoods: (d.neighborhoods || []).map((n: any) => ({
        id: n.id,
        name: n.name,
        zone: n.zone || 'Urbana',
        risk_level: (n.risk_level as PublicNeighborhoodStats['risk_level']) || 'medio',
        visited_properties: n.visited_properties ?? 0,
        foci_eliminated: n.foci_eliminated ?? 0,
        coverage_percent: n.coverage_percent ?? 0,
      })),
      educationalCampaigns: EDUCATIONAL_CAMPAIGNS,
    };
  },

  /** Registra denúncia pública; protocolo e token são gerados no servidor. */
  async submitPublicComplaint(
    payload: PublicComplaintPayload
  ): Promise<{ protocol: string; trackingToken: string }> {
    const { data, error } = await supabase.rpc('public_submit_complaint', {
      p_payload: {
        municipalityId: payload.municipalityId,
        problemType: payload.problemType,
        description: payload.description,
        neighborhoodId: payload.neighborhoodId ?? null,
        approximateAddress: payload.approximateAddress,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        photoUrl: payload.photoUrl ?? null,
        reporterName: payload.reporterName ?? null,
        reporterPhone: payload.reporterPhone ?? null,
        isAnonymous: !!payload.isAnonymous,
      },
    });

    if (error || !data) {
      console.error('Erro ao registrar denúncia pública:', error);
      throw new Error('Falha ao registrar denúncia. Verifique os dados e tente novamente.');
    }
    return { protocol: (data as any).protocol, trackingToken: (data as any).trackingToken };
  },

  /** Consulta status por Protocolo + Token (sem expor dados do denunciante). */
  async trackComplaint(protocol: string, token: string): Promise<PublicComplaintTrackingResult> {
    const { data, error } = await supabase.rpc('public_track_complaint', {
      p_protocol: protocol.trim(),
      p_token: token.trim(),
    });

    if (error || !data) {
      throw new Error(
        'Denúncia não encontrada com os dados informados. Verifique o protocolo e a chave de segurança.'
      );
    }

    const d = data as any;
    const info = STATUS_MAP[d.status] || STATUS_MAP.RECEBIDA;
    const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString('pt-BR') : 'Aguardando');

    const timeline = [
      { step: 'Denúncia Recebida', date: fmtDate(d.createdAt), completed: info.stage >= 1, current: info.stage === 1 },
      { step: 'Triagem & Análise Técnica', date: info.stage >= 2 ? fmtDate(d.updatedAt) : 'Aguardando', completed: info.stage >= 2, current: info.stage === 2 },
      { step: 'Programação de Vistoria ACE', date: d.inspectedAt ? fmtDate(d.inspectedAt) : 'Em fila de rota', completed: info.stage >= 3, current: info.stage === 3 },
      { step: 'Tratamento & Conclusão', date: info.stage >= 5 ? fmtDate(d.updatedAt) : 'Pendente', completed: info.stage >= 5, current: info.stage >= 5 },
    ];

    return {
      protocol: d.protocol,
      status: info.key,
      statusLabel: info.label,
      problemType: PROBLEM_LABELS[d.problemType] || d.problemType || 'Criadouro Potencial',
      neighborhood: d.street ? `Região de ${d.street}` : 'Município',
      approximateAddress: `${d.street || ''} ${d.number || ''}`.trim() || 'Endereço registrado',
      createdAt: new Date(d.createdAt).toLocaleString('pt-BR'),
      updatedAt: new Date(d.updatedAt).toLocaleString('pt-BR'),
      publicNotes:
        info.stage >= 5
          ? 'A equipe de agentes de endemias realizou a vistoria e adotou as medidas cabíveis de eliminação e tratamento de focos.'
          : 'Sua solicitação está em tramitação operacional junto ao setor de controle de vetores.',
      timeline,
    };
  },
};
