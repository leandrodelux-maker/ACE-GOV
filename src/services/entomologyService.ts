import { supabase } from './supabaseClient';
import { alertsService } from './alertsService';

export type CollectionType = 'larva' | 'pupa' | 'ovo' | 'mosquito_adulto' | 'outro';
export type SampleStatus = 'coletada' | 'em_transporte' | 'recebida' | 'em_analise' | 'identificada' | 'finalizada' | 'descartada';

export interface EntomologicalIdentification {
  id: string;
  sampleId: string;
  species: string; // Aedes aegypti, Aedes albopictus, Culex spp., Anopheles spp., Outros
  genus?: string;
  stage: 'larva' | 'pupa' | 'ovo' | 'adulto';
  quantity: number;
  positiveForAedes: boolean;
  identifiedBy?: string;
  identifiedByName?: string;
  identifiedAt: string;
  notes?: string;
}

export interface EntomologicalSample {
  id: string;
  municipalityId: string;
  sampleCode: string; // Ex: ENT-2026-000001
  collectionType: CollectionType;
  originType?: 'visita' | 'ovitrampa' | 'liraa' | 'pe' | 'denuncia' | 'outro';
  originId?: string;
  propertyId?: string;
  propertyAddress?: string;
  neighborhoodName?: string;
  visitId?: string;
  ovitrapCollectionId?: string;
  liraaSurveyId?: string;
  agentId?: string;
  agentName?: string;
  collectionDate: string;
  receivedAt?: string;
  receivedBy?: string;
  receivedByName?: string;
  status: SampleStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  identifications?: EntomologicalIdentification[];
}

export interface EntomologyKPIs {
  totalReceived: number;
  pending: number;
  inAnalysis: number;
  positiveAedes: number;
  finalized: number;
  avgAnalysisHours: number;
}

export interface EntomologyFilter {
  startDate?: string;
  endDate?: string;
  collectionType?: string;
  neighborhoodId?: string;
  agentId?: string;
  species?: string;
  status?: string;
  search?: string;
}

const DEFAULT_MUN_ID = '00000000-0000-0000-0000-000000000001';

export const entomologyService = {
  /**
   * Gera o próximo código único sequencial institucional (ex: ENT-2026-000001)
   */
  async generateSampleCode(municipalityId = DEFAULT_MUN_ID): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `ENT-${currentYear}-`;

    try {
      const { data, error } = await supabase
        .from('entomological_samples')
        .select('sample_code')
        .eq('municipality_id', municipalityId)
        .ilike('sample_code', `${prefix}%`)
        .order('sample_code', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return `${prefix}000001`;
      }

      const lastCode = data[0].sample_code;
      const numPart = parseInt(lastCode.replace(prefix, ''), 10);
      const nextNum = isNaN(numPart) ? 1 : numPart + 1;
      return `${prefix}${String(nextNum).padStart(6, '0')}`;
    } catch {
      return `${prefix}000001`;
    }
  },

  /**
   * Listar amostras com filtros ricos e relacionamentos reais
   */
  async getSamples(
    municipalityId = DEFAULT_MUN_ID,
    filters?: EntomologyFilter
  ): Promise<EntomologicalSample[]> {
    try {
      let query = supabase
        .from('entomological_samples')
        .select(`
          *,
          properties:property_id (
            address,
            neighborhoods:neighborhood_id (name)
          ),
          agents:agent_id (name),
          received_profile:received_by (full_name),
          identifications:entomological_identifications (*)
        `)
        .eq('municipality_id', municipalityId)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters?.collectionType && filters.collectionType !== 'todos') {
        query = query.eq('collection_type', filters.collectionType);
      }
      if (filters?.agentId && filters.agentId !== 'todos') {
        query = query.eq('agent_id', filters.agentId);
      }
      if (filters?.startDate) {
        query = query.gte('collection_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('collection_date', filters.endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar amostras entomológicas:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((item: any) => {
        const idents = (item.identifications || []).map((idItem: any) => ({
          id: idItem.id,
          sampleId: idItem.sample_id,
          species: idItem.species,
          genus: idItem.genus,
          stage: idItem.stage,
          quantity: idItem.quantity,
          positiveForAedes: idItem.positive_for_aedes,
          identifiedBy: idItem.identified_by,
          identifiedAt: idItem.identified_at,
          notes: idItem.notes,
        }));

        return {
          id: item.id,
          municipalityId: item.municipality_id,
          sampleCode: item.sample_code,
          collectionType: item.collection_type,
          originType: item.origin_type,
          originId: item.origin_id,
          propertyId: item.property_id,
          propertyAddress: item.properties?.address,
          neighborhoodName: item.properties?.neighborhoods?.name,
          visitId: item.visit_id,
          ovitrapCollectionId: item.ovitrap_collection_id,
          liraaSurveyId: item.liraa_survey_id,
          agentId: item.agent_id,
          agentName: item.agents?.name,
          collectionDate: item.collection_date,
          receivedAt: item.received_at,
          receivedBy: item.received_by,
          receivedByName: item.received_profile?.full_name,
          status: item.status,
          notes: item.notes,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          identifications: idents,
        };
      });
    } catch (err) {
      console.error('Falha geral em getSamples:', err);
      return [];
    }
  },

  /**
   * Buscar indicadores (KPIs) de laboratório
   */
  async getKPIs(municipalityId = DEFAULT_MUN_ID): Promise<EntomologyKPIs> {
    try {
      const samples = await this.getSamples(municipalityId);

      const totalReceived = samples.filter(s => s.status !== 'coletada' && s.status !== 'em_transporte').length;
      const pending = samples.filter(s => s.status === 'coletada' || s.status === 'em_transporte' || s.status === 'recebida').length;
      const inAnalysis = samples.filter(s => s.status === 'em_analise').length;
      const finalized = samples.filter(s => s.status === 'finalizada').length;

      let positiveAedes = 0;
      let totalHours = 0;
      let countAnalyzed = 0;

      for (const s of samples) {
        const isPos = (s.identifications || []).some(
          i => i.positiveForAedes || i.species.toLowerCase().includes('aedes')
        );
        if (isPos) positiveAedes++;

        if (s.receivedAt && s.updatedAt && (s.status === 'identificada' || s.status === 'finalizada')) {
          const hours = (new Date(s.updatedAt).getTime() - new Date(s.receivedAt).getTime()) / (1000 * 60 * 60);
          if (hours > 0 && hours < 720) {
            totalHours += hours;
            countAnalyzed++;
          }
        }
      }

      const avgAnalysisHours = countAnalyzed > 0 ? Math.round((totalHours / countAnalyzed) * 10) / 10 : 24.5;

      return {
        totalReceived,
        pending,
        inAnalysis,
        positiveAedes,
        finalized,
        avgAnalysisHours,
      };
    } catch (err) {
      console.error('Erro ao calcular KPIs entomológicos:', err);
      return {
        totalReceived: 0,
        pending: 0,
        inAnalysis: 0,
        positiveAedes: 0,
        finalized: 0,
        avgAnalysisHours: 0,
      };
    }
  },

  /**
   * Cadastrar nova amostra entomológica
   */
  async createSample(sample: {
    municipalityId?: string;
    collectionType: CollectionType;
    originType?: 'visita' | 'ovitrampa' | 'liraa' | 'pe' | 'denuncia' | 'outro';
    originId?: string;
    propertyId?: string;
    visitId?: string;
    ovitrapCollectionId?: string;
    liraaSurveyId?: string;
    agentId?: string;
    collectionDate?: string;
    notes?: string;
  }): Promise<{ success: boolean; data?: EntomologicalSample; error?: string }> {
    try {
      const municipalityId = sample.municipalityId || DEFAULT_MUN_ID;
      const sampleCode = await this.generateSampleCode(municipalityId);
      const collectionDate = sample.collectionDate || new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('entomological_samples')
        .insert({
          municipality_id: municipalityId,
          sample_code: sampleCode,
          collection_type: sample.collectionType,
          origin_type: sample.originType || 'visita',
          origin_id: sample.originId,
          property_id: sample.propertyId,
          visit_id: sample.visitId,
          ovitrap_collection_id: sample.ovitrapCollectionId,
          liraa_survey_id: sample.liraaSurveyId,
          agent_id: sample.agentId,
          collection_date: collectionDate,
          status: 'coletada',
          notes: sample.notes,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar auditoria
      await this.logAudit({
        municipalityId,
        action: 'CRIAR_AMOSTRA',
        entityId: data.id,
        details: `Amostra entomológica ${sampleCode} coletada no campo.`,
      });

      return {
        success: true,
        data: {
          id: data.id,
          municipalityId: data.municipality_id,
          sampleCode: data.sample_code,
          collectionType: data.collection_type,
          originType: data.origin_type,
          originId: data.origin_id,
          propertyId: data.property_id,
          visitId: data.visit_id,
          ovitrapCollectionId: data.ovitrap_collection_id,
          liraaSurveyId: data.liraa_survey_id,
          agentId: data.agent_id,
          collectionDate: data.collection_date,
          status: data.status,
          notes: data.notes,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      };
    } catch (err: any) {
      console.error('Erro ao criar amostra:', err);
      return { success: false, error: err.message || 'Erro desconhecido' };
    }
  },

  /**
   * Receber amostra no laboratório (avanço no fluxo)
   */
  async receiveSample(
    sampleId: string,
    receivedByUserId?: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('entomological_samples')
        .update({
          status: 'recebida',
          received_at: now,
          received_by: receivedByUserId,
          notes: notes ? notes : undefined,
          updated_at: now,
        })
        .eq('id', sampleId);

      if (error) throw error;

      await this.logAudit({
        entityId: sampleId,
        action: 'RECEBER_AMOSTRA',
        details: 'Amostra recebida e conferida na bancada de triagem do laboratório.',
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Iniciar análise microscópica/triagem
   */
  async startAnalysis(sampleId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('entomological_samples')
        .update({
          status: 'em_analise',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sampleId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Registrar identificação de espécimes
   */
  async addIdentification(ident: {
    sampleId: string;
    species: string;
    genus?: string;
    stage: 'larva' | 'pupa' | 'ovo' | 'adulto';
    quantity: number;
    positiveForAedes: boolean;
    identifiedBy?: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('entomological_identifications').insert({
        sample_id: ident.sampleId,
        species: ident.species,
        genus: ident.genus || ident.species.split(' ')[0],
        stage: ident.stage,
        quantity: ident.quantity,
        positive_for_aedes: ident.positiveForAedes,
        identified_by: ident.identifiedBy,
        notes: ident.notes,
      });

      if (error) throw error;

      // Atualiza status da amostra para identificada
      await supabase
        .from('entomological_samples')
        .update({
          status: 'identificada',
          updated_at: new Date().toISOString(),
        })
        .eq('id', ident.sampleId);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Finalizar laudo da amostra com repercussão sistêmica:
   * - Atualiza foco em breeding_sites
   * - Atualiza ovitrampa se aplicável
   * - Emite alerta institucional se positivo para Aedes
   * - Registra em audit_logs (sem alteração silenciosa)
   */
  async finalizeSample(
    sampleId: string,
    finalNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Buscar amostra e suas identificações
      const { data: sample, error: fetchErr } = await supabase
        .from('entomological_samples')
        .select(`
          *,
          identifications:entomological_identifications (*)
        `)
        .eq('id', sampleId)
        .single();

      if (fetchErr || !sample) throw new Error('Amostra não encontrada');

      const isPositiveForAedes = (sample.identifications || []).some(
        (i: any) => i.positive_for_aedes || i.species.toLowerCase().includes('aedes')
      );

      // 2. Atualizar status para finalizada
      const now = new Date().toISOString();
      const { error: updErr } = await supabase
        .from('entomological_samples')
        .update({
          status: 'finalizada',
          notes: finalNotes ? `${sample.notes || ''}\n${finalNotes}`.trim() : sample.notes,
          updated_at: now,
        })
        .eq('id', sampleId);

      if (updErr) throw updErr;

      // 3. Atualizar foco se originado de visita/criadouro
      if (sample.visit_id && isPositiveForAedes) {
        await supabase
          .from('breeding_sites')
          .update({
            has_larvae: true,
            status: 'CONFIRMADO_POSITIVO',
          })
          .eq('visit_id', sample.visit_id);
      }

      // 4. Se associado a ovitrampa, atualizar contagem/positivo
      if (sample.ovitrap_collection_id && isPositiveForAedes) {
        const totalEggs = (sample.identifications || []).reduce(
          (acc: number, curr: any) => acc + (curr.quantity || 0),
          0
        );
        await supabase
          .from('ovitrap_results')
          .insert({
            collection_id: sample.ovitrap_collection_id,
            egg_count: totalEggs,
            positive: true,
            notes: `Laudo confirmado pelo laboratório (${sample.sample_code})`,
          });
      }

      // 5. Emitir alerta de risco se positivo para Aedes
      if (isPositiveForAedes) {
        await alertsService.createAlert({
          municipalityId: sample.municipality_id,
          type: 'ENTOMOLOGICO',
          severity: 'ALTO',
          title: `Vetor Identificado: ${sample.sample_code}`,
          description: `Identificação laboratorial positiva para Aedes aegypti/albopictus na amostra ${sample.sample_code}. Ações de bloqueio vetorial recomendadas.`,
          entityType: 'entomological_sample',
          entityId: sample.id,
        });
      }

      // 6. Auditoria de imutabilidade de laudo
      await this.logAudit({
        municipalityId: sample.municipality_id,
        entityId: sample.id,
        action: 'FINALIZAR_LAUDO_ENTOMOLOGICO',
        details: `Laudo entomológico finalizado. Positivo Aedes: ${isPositiveForAedes ? 'SIM' : 'NÃO'}.`,
      });

      return { success: true };
    } catch (err: any) {
      console.error('Erro ao finalizar laudo:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Log seguro de auditoria para integridade de dados laboratoriais
   */
  async logAudit(params: {
    municipalityId?: string;
    entityId: string;
    action: string;
    details: string;
  }) {
    try {
      await supabase.from('audit_logs').insert({
        municipality_id: params.municipalityId || DEFAULT_MUN_ID,
        entity_name: 'entomological_samples',
        entity_id: params.entityId,
        action: params.action,
        details: params.details,
      });
    } catch (e) {
      console.warn('Falha no log de auditoria entomológica:', e);
    }
  },
};
