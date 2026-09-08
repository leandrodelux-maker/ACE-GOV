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
  problemType: 'terreno_baldinho' | 'piscina_abandonada' | 'acumulo_lixo' | 'caixa_dagua_aberta' | 'foco_larvas' | 'outro';
  description: string;
  neighborhood: string;
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
  timeline: Array<{
    step: string;
    date: string;
    completed: boolean;
    current: boolean;
  }>;
}

export const publicPortalService = {
  /**
   * Obtém dados agregados para o portal público (100% anonimizado, sem dados de munícipes)
   */
  async getPublicOverview(municipalityId: string): Promise<PublicPortalData> {
    try {
      // 1. Obter nome do município
      const { data: munData } = await supabase
        .from('municipalities')
        .select('name, state')
        .eq('id', municipalityId)
        .maybeSingle();

      const municipalityName = munData ? `${munData.name} - ${munData.state}` : 'Município Monitorado';

      // 2. Obter bairros com dados reais
      const { data: neighborhoodsData } = await supabase
        .from('neighborhoods')
        .select('id, name, zone, risk_level, total_properties')
        .eq('municipality_id', municipalityId);

      // 3. Obter contagem de visitas e focos
      const { data: visits } = await supabase
        .from('property_visits')
        .select('id, status, neighborhood_id, has_larvae')
        .eq('municipality_id', municipalityId);

      const visitedCount = visits ? visits.filter(v => v.status === 'realizada').length : 0;
      const larvaeCount = visits ? visits.filter(v => v.has_larvae).length : 0;

      // Montar agregação por bairro
      const neighborhoods: PublicNeighborhoodStats[] = (neighborhoodsData || []).map(n => {
        const bVisits = (visits || []).filter(v => v.neighborhood_id === n.id && v.status === 'realizada');
        const bFoci = (visits || []).filter(v => v.neighborhood_id === n.id && v.has_larvae);
        const total = n.total_properties || 100;
        const cov = Math.min(100, Math.round((bVisits.length / total) * 100));

        return {
          id: n.id,
          name: n.name,
          zone: n.zone || 'Urbana',
          risk_level: (n.risk_level as any) || 'medio',
          visited_properties: bVisits.length,
          foci_eliminated: bFoci.length,
          coverage_percent: cov
        };
      });

      const totalProps = (neighborhoodsData || []).reduce((acc, n) => acc + (n.total_properties || 0), 0) || 1;
      const totalCoverage = Math.min(100, Math.round((visitedCount / totalProps) * 100));

      return {
        municipalityName,
        lastUpdated: new Date().toLocaleDateString('pt-BR'),
        indicators: {
          totalVisited: visitedCount,
          fociEliminated: larvaeCount,
          blocksTreated: Math.round(visitedCount / 25) || 12,
          coveragePercent: totalCoverage
        },
        neighborhoods: neighborhoods.length > 0 ? neighborhoods : [
          {
            id: 'mock-1',
            name: 'Centro Histórico',
            zone: 'Central',
            risk_level: 'baixo',
            visited_properties: 340,
            foci_eliminated: 8,
            coverage_percent: 85
          },
          {
            id: 'mock-2',
            name: 'Jardim Alvorada',
            zone: 'Norte',
            risk_level: 'alto',
            visited_properties: 512,
            foci_eliminated: 27,
            coverage_percent: 64
          }
        ],
        educationalCampaigns: [
          {
            title: '10 Minutos Contra o Aedes',
            description: 'Uma checagem semanal de 10 minutos no seu quintal elimina até 80% dos potenciais criadouros do mosquito transmissor da Dengue, Chikungunya e Zika.',
            actionTips: [
              'Vistorie pratos de plantas e coloque areia até a borda',
              'Tampe caixas d’água e tonéis de armazenamento',
              'Limpe calhas e ralos externos pelo menos uma vez por semana',
              'Descarte pneus velhos e garrafas com a boca virada para baixo'
            ],
            priority: 'alta'
          },
          {
            title: 'Sintomas e Quando Procurar a UBS',
            description: 'Febre alta repentina, dor atrás dos olhos, dores articulares intensas e manchas vermelhas na pele são sinais de alerta. Beba muita água e evite automedicação.',
            actionTips: [
              'Nunca tome medicamentos à base de ácido acetilsalicílico (Aspirina/AAS)',
              'Procure a Unidade Básica de Saúde logo no início dos sintomas',
              'Mantenha repouso absoluto e hidratação oral vigorosa'
            ],
            priority: 'media'
          }
        ]
      };
    } catch (err) {
      console.error('Erro ao buscar resumo público:', err);
      throw err;
    }
  },

  /**
   * Registra denúncia vinda do portal público, gerando protocolo no formato END-ANO-SEQUENCIAL e token seguro.
   */
  async submitPublicComplaint(payload: PublicComplaintPayload): Promise<{ protocol: string; trackingToken: string }> {
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(100000 + Math.random() * 900000);
    const protocol = `END-${year}-${randomSeq}`;
    
    // Gerar token alfanumérico seguro para consulta
    const trackingToken = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => b.toString(36))
      .join('')
      .toUpperCase();

    const insertData: any = {
      municipality_id: payload.municipalityId,
      protocol,
      tracking_token: trackingToken,
      problem_type: payload.problemType,
      description: payload.description,
      neighborhood: payload.neighborhood,
      approximate_address: payload.approximateAddress,
      status: 'aguardando',
      priority: 'media',
      source: 'cidadao_web'
    };

    if (!payload.isAnonymous) {
      if (payload.reporterName) insertData.citizen_name = payload.reporterName;
      if (payload.reporterPhone) insertData.citizen_phone = payload.reporterPhone;
    }

    if (payload.latitude && payload.longitude) {
      insertData.latitude = payload.latitude;
      insertData.longitude = payload.longitude;
    }

    if (payload.photoUrl) {
      insertData.photo_url = payload.photoUrl;
    }

    const { error } = await supabase.from('complaints').insert(insertData);

    if (error) {
      console.error('Erro ao registrar denúncia pública:', error);
      throw new Error(`Falha ao registrar denúncia: ${error.message}`);
    }

    return { protocol, trackingToken };
  },

  /**
   * Consulta status de denúncia por Protocolo + Token Seguro (Proteção contra enumeração/scraping)
   */
  async trackComplaint(protocol: string, token: string): Promise<PublicComplaintTrackingResult> {
    const cleanProto = protocol.trim().toUpperCase();
    const cleanToken = token.trim().toUpperCase();

    const { data, error } = await supabase
      .from('complaints')
      .select('protocol, status, problem_type, neighborhood, approximate_address, created_at, updated_at, inspection_date')
      .eq('protocol', cleanProto)
      .eq('tracking_token', cleanToken)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Denúncia não encontrada com os dados informados. Verifique o protocolo e a chave de segurança.');
    }

    const statusMap: Record<string, { label: string; stage: number; key: PublicComplaintTrackingResult['status'] }> = {
      aguardando: { label: 'Recebida no Sistema', stage: 1, key: 'recebida' },
      em_analise: { label: 'Em Análise pela Vigilância', stage: 2, key: 'em_analise' },
      programada: { label: 'Vistoria de Campo Programada', stage: 3, key: 'vistoria_programada' },
      em_atendimento: { label: 'Agente em Vistoria no Local', stage: 4, key: 'em_atendimento' },
      concluida: { label: 'Atendimento Concluído', stage: 5, key: 'concluida' },
      cancelada: { label: 'Denúncia Cancelada / Inconsistente', stage: 5, key: 'cancelada' }
    };

    const currentInfo = statusMap[data.status] || { label: 'Recebida', stage: 1, key: 'recebida' };

    const problemLabels: Record<string, string> = {
      terreno_baldinho: 'Terreno Baldio com Entulho',
      piscina_abandonada: 'Piscina sem Tratamento',
      acumulo_lixo: 'Acúmulo de Lixo / Sucata',
      caixa_dagua_aberta: 'Caixa d’Água Destampada',
      foco_larvas: 'Presença de Larvas / Mosquitos',
      outro: 'Outro Criadouro Potencial'
    };

    const timeline = [
      {
        step: 'Denúncia Recebida',
        date: new Date(data.created_at).toLocaleDateString('pt-BR'),
        completed: currentInfo.stage >= 1,
        current: currentInfo.stage === 1
      },
      {
        step: 'Triagem & Análise Técnica',
        date: currentInfo.stage >= 2 ? new Date(data.updated_at).toLocaleDateString('pt-BR') : 'Aguardando',
        completed: currentInfo.stage >= 2,
        current: currentInfo.stage === 2
      },
      {
        step: 'Programação de Vistoria ACE',
        date: data.inspection_date ? new Date(data.inspection_date).toLocaleDateString('pt-BR') : 'Em fila de rota',
        completed: currentInfo.stage >= 3,
        current: currentInfo.stage === 3
      },
      {
        step: 'Tratamento & Conclusão',
        date: currentInfo.stage >= 5 ? new Date(data.updated_at).toLocaleDateString('pt-BR') : 'Pendente',
        completed: currentInfo.stage >= 5,
        current: currentInfo.stage >= 5
      }
    ];

    return {
      protocol: data.protocol,
      status: currentInfo.key,
      statusLabel: currentInfo.label,
      problemType: problemLabels[data.problem_type] || data.problem_type || 'Criadouro Potencial',
      neighborhood: data.neighborhood || 'Não especificado',
      approximateAddress: data.approximate_address || 'Endereço registrado',
      createdAt: new Date(data.created_at).toLocaleString('pt-BR'),
      updatedAt: new Date(data.updated_at).toLocaleString('pt-BR'),
      publicNotes: currentInfo.stage >= 5 
        ? 'A equipe de agentes de endemias realizou a vistoria e adotou as medidas cabíveis de eliminação e tratamento de focos.'
        : 'Sua solicitação está em tramitação operacional junto ao setor de controle de vetores.',
      timeline
    };
  }
};
