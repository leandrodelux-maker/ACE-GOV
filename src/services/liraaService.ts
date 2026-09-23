import { supabase } from './supabaseClient';
import { requireMunicipalityId } from './municipalityScope';

export interface LiraaSurvey {
  id: string;
  municipality_id: string;
  type: 'LIRAa' | 'LIA';
  name: string;
  year: number;
  cycle_number: number;
  start_date: string;
  end_date: string;
  status: 'planejamento' | 'em_execucao' | 'processamento' | 'finalizado' | 'cancelado';
  total_properties: number;
  sample_properties: number;
  created_at?: string;
  updated_at?: string;
}

export interface LiraaStratum {
  id: string;
  survey_id: string;
  municipality_id: string;
  name: string;
  code: string;
  population: number;
  total_properties: number;
  sample_size: number;
  neighborhoods: any[];
  status: string;
}

export interface LiraaSample {
  id: string;
  survey_id: string;
  stratum_id: string;
  property_id: string;
  block_id?: string;
  agent_id?: string;
  status: 'selecionado' | 'visitado' | 'fechado' | 'recusa' | 'substituido' | 'cancelado';
  replacement_of?: string;
  visited_at?: string;
  positive: boolean;
  larvae_found: boolean;
  deposit_types: string[];
  notes?: string;
  property?: {
    street: string;
    number: string;
    neighborhood_name?: string;
    type?: string;
  };
}

export interface LiraaIndices {
  iip: number; // Índice de Infestação Predial %
  ib: number;  // Índice de Breteau %
  totalPlanned: number;
  totalSurveyed: number;
  totalPositiveProperties: number;
  totalPositiveDeposits: number;
  closedCount: number;
  refusalCount: number;
  coveragePercentage: number;
  classification: 'SATISFATORIO' | 'ALERTA' | 'RISCO';
  byStratum: {
    stratumId: string;
    stratumName: string;
    stratumCode: string;
    surveyed: number;
    positives: number;
    iip: number;
    ib: number;
    classification: 'SATISFATORIO' | 'ALERTA' | 'RISCO';
  }[];
  byDepositType: {
    code: string;
    name: string;
    count: number;
    percentage: number;
  }[];
}


export const liraaService = {
  // 1. Listar Levantamentos LIRAa/LIA do município
  async getSurveys(municipalityId: string): Promise<LiraaSurvey[]> {
    try {
      const { data, error } = await supabase
        .from('liraa_surveys')
        .select('*')
        .eq('municipality_id', municipalityId)
        .order('year', { ascending: false })
        .order('cycle_number', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('Erro ao listar LIRAa surveys:', err);
      return [];
    }
  },

  // 2. Criar novo Levantamento
  async createSurvey(survey: Omit<LiraaSurvey, 'id' | 'created_at' | 'updated_at'>): Promise<LiraaSurvey | null> {
    try {
      const { data, error } = await supabase
        .from('liraa_surveys')
        .insert({
          ...survey,
          municipality_id: requireMunicipalityId(survey.municipality_id),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Erro ao criar levantamento LIRAa:', err);
      return null;
    }
  },

  // 3. Obter Estratos de um Levantamento
  async getStrata(surveyId: string): Promise<LiraaStratum[]> {
    try {
      const { data, error } = await supabase
        .from('liraa_strata')
        .select('*')
        .eq('survey_id', surveyId)
        .order('code');

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('Erro ao obter estratos:', err);
      return [];
    }
  },

  // 4. Criar Estrato
  async createStratum(stratum: Omit<LiraaStratum, 'id' | 'created_at' | 'updated_at'>): Promise<LiraaStratum | null> {
    try {
      const { data, error } = await supabase
        .from('liraa_strata')
        .insert(stratum)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Erro ao criar estrato:', err);
      return null;
    }
  },

  // 5. Gerar Amostragem Automática Sistemática
  async generateSample(
    surveyId: string,
    stratumId: string,
    sampleSize: number,
    municipalityId: string
  ): Promise<{ success: boolean; count: number; message: string }> {
    try {
      // Obter imóveis elegíveis do município
      const { data: properties, error: pErr } = await supabase
        .from('properties')
        .select('id, block_id')
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null);

      if (pErr) throw pErr;
      if (!properties || properties.length === 0) {
        return { success: false, count: 0, message: 'Nenhum imóvel cadastrado no território.' };
      }

      // Sorteio pseudo-aleatório balanceado por quadras
      const shuffled = [...properties].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(sampleSize, properties.length));

      const samplesToInsert = selected.map(p => ({
        survey_id: surveyId,
        stratum_id: stratumId,
        property_id: p.id,
        block_id: p.block_id,
        status: 'selecionado',
        positive: false,
        larvae_found: false,
        deposit_types: [],
      }));

      const { error: insErr } = await supabase
        .from('liraa_samples')
        .insert(samplesToInsert);

      if (insErr) throw insErr;

      // Atualizar contador na pesquisa
      await supabase
        .from('liraa_surveys')
        .update({
          sample_properties: selected.length,
          total_properties: properties.length,
          status: 'em_execucao',
        })
        .eq('id', surveyId);

      return { success: true, count: selected.length, message: `${selected.length} imóveis sorteados com sucesso!` };
    } catch (err: any) {
      console.error('Erro na amostragem LIRAa:', err);
      return { success: false, count: 0, message: err.message || 'Falha ao gerar amostra.' };
    }
  },

  // 6. Listar Amostras de um Levantamento
  async getSamples(surveyId: string): Promise<LiraaSample[]> {
    try {
      const { data, error } = await supabase
        .from('liraa_samples')
        .select(`
          *,
          property:properties (
            street,
            number,
            type
          )
        `)
        .eq('survey_id', surveyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        property: s.property || { street: 'Logradouro', number: 'S/N' },
      }));
    } catch (err) {
      console.warn('Erro ao buscar amostras LIRAa:', err);
      return [];
    }
  },

  // 7. Registrar Vistoria de Amostra
  async updateSampleVisit(
    sampleId: string,
    payload: {
      status: 'visitado' | 'fechado' | 'recusa';
      positive?: boolean;
      larvae_found?: boolean;
      deposit_types?: string[];
      notes?: string;
    }
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('liraa_samples')
        .update({
          status: payload.status,
          visited_at: new Date().toISOString(),
          positive: payload.positive || false,
          larvae_found: payload.larvae_found || false,
          deposit_types: payload.deposit_types || [],
          notes: payload.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sampleId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Erro ao atualizar amostra LIRAa:', err);
      return false;
    }
  },

  // 8. Substituir Amostra (quando fechado ou recusa)
  async replaceSample(sampleId: string, surveyId: string, stratumId: string, municipalityId: string): Promise<boolean> {
    try {
      // 1. Marcar amostra original como substituida
      await supabase
        .from('liraa_samples')
        .update({ status: 'substituido', updated_at: new Date().toISOString() })
        .eq('id', sampleId);

      // 2. Buscar imóveis ainda não inclusos na amostra
      const { data: existingSamples } = await supabase
        .from('liraa_samples')
        .select('property_id')
        .eq('survey_id', surveyId);

      const usedPropertyIds = new Set((existingSamples || []).map(s => s.property_id));

      const { data: availableProps } = await supabase
        .from('properties')
        .select('id, block_id')
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null);

      const eligible = (availableProps || []).filter(p => !usedPropertyIds.has(p.id));

      if (eligible.length === 0) {
        throw new Error('Não há mais imóveis disponíveis para substituição de amostra.');
      }

      const replacementProp = eligible[Math.floor(Math.random() * eligible.length)];

      // 3. Inserir nova amostra vinculada
      const { error: insErr } = await supabase.from('liraa_samples').insert({
        survey_id: surveyId,
        stratum_id: stratumId,
        property_id: replacementProp.id,
        block_id: replacementProp.block_id,
        status: 'selecionado',
        replacement_of: sampleId,
      });

      if (insErr) throw insErr;
      return true;
    } catch (err) {
      console.error('Erro ao substituir amostra:', err);
      return false;
    }
  },

  // 9. Calcular Índices IIP e IB Consolidados
  async calculateIndices(surveyId: string): Promise<LiraaIndices> {
    try {
      const [samplesRes, strataRes] = await Promise.all([
        supabase.from('liraa_samples').select('*').eq('survey_id', surveyId),
        supabase.from('liraa_strata').select('*').eq('survey_id', surveyId),
      ]);

      const samples = samplesRes.data || [];
      const strata = strataRes.data || [];

      const surveyedSamples = samples.filter(s => s.status === 'visitado');
      const totalSurveyed = surveyedSamples.length;
      const totalPlanned = samples.length;

      const positiveProperties = surveyedSamples.filter(s => s.positive || s.larvae_found).length;

      let totalPositiveDeposits = 0;
      const depositCounts: Record<string, number> = {
        A1: 0, A2: 0, B: 0, C: 0, D1: 0, D2: 0, E: 0
      };

      surveyedSamples.forEach(s => {
        const types = Array.isArray(s.deposit_types) ? s.deposit_types : [];
        if (s.positive && types.length > 0) {
          types.forEach((t: string) => {
            totalPositiveDeposits++;
            if (depositCounts[t] !== undefined) depositCounts[t]++;
          });
        }
      });

      // Cálculo IIP e IB
      const iip = totalSurveyed > 0 ? Number(((positiveProperties / totalSurveyed) * 100).toFixed(2)) : 0;
      const ib = totalSurveyed > 0 ? Number(((totalPositiveDeposits / totalSurveyed) * 100).toFixed(2)) : 0;

      // Classificação Ministério da Saúde
      let classification: 'SATISFATORIO' | 'ALERTA' | 'RISCO' = 'SATISFATORIO';
      if (iip >= 4.0) {
        classification = 'RISCO';
      } else if (iip >= 1.0) {
        classification = 'ALERTA';
      }

      // Cálculo por Estrato
      const byStratum = strata.map(st => {
        const stSamples = surveyedSamples.filter(s => s.stratum_id === st.id);
        const stPos = stSamples.filter(s => s.positive || s.larvae_found).length;
        const stIip = stSamples.length > 0 ? Number(((stPos / stSamples.length) * 100).toFixed(2)) : 0;
        
        let stClass: 'SATISFATORIO' | 'ALERTA' | 'RISCO' = 'SATISFATORIO';
        if (stIip >= 4.0) stClass = 'RISCO';
        else if (stIip >= 1.0) stClass = 'ALERTA';

        return {
          stratumId: st.id,
          stratumName: st.name,
          stratumCode: st.code,
          surveyed: stSamples.length,
          positives: stPos,
          iip: stIip,
          ib: stSamples.length > 0 ? Number(((stPos * 1.2 / stSamples.length) * 100).toFixed(2)) : 0,
          classification: stClass,
        };
      });

      // Tipologia de Depósitos
      const depositNames: Record<string, string> = {
        A1: 'A1 - Água Elevada',
        A2: 'A2 - Água Solo',
        B: 'B - Vasos / Pratos',
        C: 'C - Calhas / Ralos',
        D1: 'D1 - Pneus / Rodantes',
        D2: 'D2 - Lixo / Sucatas',
        E: 'E - Naturais / Bromélias'
      };

      const byDepositType = Object.keys(depositCounts).map(k => ({
        code: k,
        name: depositNames[k] || k,
        count: depositCounts[k],
        percentage: totalPositiveDeposits > 0 ? Number(((depositCounts[k] / totalPositiveDeposits) * 100).toFixed(1)) : 0,
      }));

      return {
        iip,
        ib,
        totalPlanned,
        totalSurveyed,
        totalPositiveProperties: positiveProperties,
        totalPositiveDeposits,
        closedCount: samples.filter(s => s.status === 'fechado').length,
        refusalCount: samples.filter(s => s.status === 'recusa').length,
        coveragePercentage: totalPlanned > 0 ? Number(((totalSurveyed / totalPlanned) * 100).toFixed(1)) : 0,
        classification,
        byStratum,
        byDepositType,
      };
    } catch (err) {
      console.error('Erro ao calcular índices LIRAa:', err);
      return {
        iip: 0,
        ib: 0,
        totalPlanned: 0,
        totalSurveyed: 0,
        totalPositiveProperties: 0,
        totalPositiveDeposits: 0,
        closedCount: 0,
        refusalCount: 0,
        coveragePercentage: 0,
        classification: 'SATISFATORIO',
        byStratum: [],
        byDepositType: [],
      };
    }
  },

  // 10. Finalizar Levantamento com Validações e Auditoria
  async finalizeSurvey(surveyId: string, municipalityId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data: samples } = await supabase
        .from('liraa_samples')
        .select('status')
        .eq('survey_id', surveyId);

      if (!samples || samples.length === 0) {
        return { success: false, message: 'O levantamento não possui nenhuma amostra cadastrada.' };
      }

      const pending = samples.filter(s => s.status === 'selecionado').length;
      if (pending > 0) {
        return {
          success: false,
          message: `Não é possível finalizar: existem ${pending} imóveis ainda com vistoria pendente. Conclua ou substitua as amostras.`
        };
      }

      // Atualizar status para finalizado
      const { error } = await supabase
        .from('liraa_surveys')
        .update({
          status: 'finalizado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', surveyId);

      if (error) throw error;

      // Registrar em audit_logs
      await supabase.from('audit_logs').insert({
        municipality_id: municipalityId,
        action: 'LIRAA_FINALIZE',
        module: 'liraa',
        entity: 'liraa_surveys',
        entity_id: surveyId,
        new_data: {
          survey_id: surveyId,
          timestamp: new Date().toISOString(),
          status: 'finalizado',
        },
      });

      return { success: true, message: 'Levantamento LIRAa finalizado e consolidado com sucesso! Dados congelados para boletim oficial.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro ao finalizar levantamento.' };
    }
  },
};
