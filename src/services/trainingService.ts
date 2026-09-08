import { supabase } from './supabaseClient';

export interface Training {
  id: string;
  municipality_id: string;
  title: string;
  category: 'dengue' | 'liraa' | 'controle_vetorial' | 'seguranca' | 'epi' | 'pwa' | 'vigilancia' | 'ovitrampas' | 'pe' | 'outros';
  description?: string;
  instructor?: string;
  workload_hours: number;
  start_date: string;
  end_date: string;
  status: 'planejado' | 'em_andamento' | 'concluido' | 'cancelado';
  max_participants?: number;
  location?: string;
  created_at: string;
  updated_at: string;
  participants_count?: number;
}

export interface TrainingParticipant {
  id: string;
  training_id: string;
  user_id: string;
  status: 'inscrito' | 'presente' | 'ausente' | 'aprovado' | 'reprovado';
  attendance_percent?: number;
  score?: number;
  certificate_code?: string;
  certificate_issued_at?: string;
  user?: {
    name: string;
    email: string;
    role: string;
  };
}

export interface AgentTrainingPassport {
  userId: string;
  userName: string;
  completedHours: number;
  coursesCount: number;
  certifications: Array<{
    trainingTitle: string;
    category: string;
    completedAt: string;
    workloadHours: number;
    certificateCode: string;
    score?: number;
  }>;
  pendingRecyclings: Array<{
    category: string;
    title: string;
    recommendedCycleMonths: number;
  }>;
}

export const trainingService = {
  /**
   * Lista capacitações do município
   */
  async getTrainings(municipalityId: string): Promise<Training[]> {
    const { data, error } = await supabase
      .from('trainings')
      .select('*, training_participants(count)')
      .eq('municipality_id', municipalityId)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar capacitações:', error);
      throw error;
    }

    return (data || []).map((t: any) => ({
      ...t,
      participants_count: t.training_participants?.[0]?.count || 0
    }));
  },

  /**
   * Cria uma nova capacitação
   */
  async createTraining(training: Omit<Training, 'id' | 'created_at' | 'updated_at' | 'participants_count'>): Promise<Training> {
    const { data, error } = await supabase
      .from('trainings')
      .insert(training)
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar capacitação:', error);
      throw error;
    }

    return data;
  },

  /**
   * Atualiza status da capacitação
   */
  async updateTrainingStatus(trainingId: string, status: Training['status']): Promise<void> {
    const { error } = await supabase
      .from('trainings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', trainingId);

    if (error) throw error;
  },

  /**
   * Obtém participantes de uma turma
   */
  async getParticipants(trainingId: string): Promise<TrainingParticipant[]> {
    const { data, error } = await supabase
      .from('training_participants')
      .select('*, users(name, email, role)')
      .eq('training_id', trainingId);

    if (error) {
      console.error('Erro ao buscar participantes:', error);
      throw error;
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      training_id: p.training_id,
      user_id: p.user_id,
      status: p.status,
      attendance_percent: p.attendance_percent,
      score: p.score,
      certificate_code: p.certificate_code,
      certificate_issued_at: p.certificate_issued_at,
      user: p.users ? {
        name: p.users.name,
        email: p.users.email,
        role: p.users.role
      } : undefined
    }));
  },

  /**
   * Inscreve um usuário na capacitação
   */
  async enrollParticipant(trainingId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('training_participants')
      .insert({
        training_id: trainingId,
        user_id: userId,
        status: 'inscrito'
      });

    if (error) throw error;
  },

  /**
   * Registra presença e emite certificado se aprovado
   */
  async evaluateParticipant(
    participantId: string,
    status: 'aprovado' | 'reprovado' | 'presente' | 'ausente',
    attendancePercent: number,
    score?: number
  ): Promise<{ certificateCode?: string }> {
    let certificateCode: string | undefined;
    let certificateIssuedAt: string | undefined;

    if (status === 'aprovado') {
      certificateCode = `CERT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      certificateIssuedAt = new Date().toISOString();
    }

    const { error } = await supabase
      .from('training_participants')
      .update({
        status,
        attendance_percent: attendancePercent,
        score,
        certificate_code: certificateCode,
        certificate_issued_at: certificateIssuedAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', participantId);

    if (error) throw error;

    return { certificateCode };
  },

  /**
   * Obtém histórico completo de capacitações de um Agente (Passaporte de Capacitação)
   */
  async getAgentTrainingPassport(userId: string): Promise<AgentTrainingPassport> {
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .maybeSingle();

    const { data: participations } = await supabase
      .from('training_participants')
      .select('status, score, certificate_code, certificate_issued_at, trainings(title, category, workload_hours, end_date)')
      .eq('user_id', userId)
      .eq('status', 'aprovado');

    const certifications = (participations || []).map((p: any) => ({
      trainingTitle: p.trainings?.title || 'Capacitação Técnica',
      category: p.trainings?.category || 'outros',
      completedAt: p.certificate_issued_at || p.trainings?.end_date || new Date().toISOString(),
      workloadHours: p.trainings?.workload_hours || 4,
      certificateCode: p.certificate_code || 'AUT-PENDENTE',
      score: p.score
    }));

    const totalHours = certifications.reduce((acc, c) => acc + c.workloadHours, 0);

    // Identificar capacitações recomendadas de reciclagem
    const mandatoryCategories = ['epi', 'seguranca', 'pwa', 'dengue'];
    const completedCategories = new Set(certifications.map(c => c.category));
    const pendingRecyclings: AgentTrainingPassport['pendingRecyclings'] = [];

    if (!completedCategories.has('epi')) {
      pendingRecyclings.push({
        category: 'epi',
        title: 'Uso Seguro e Manuseio de EPIs Operacionais',
        recommendedCycleMonths: 12
      });
    }
    if (!completedCategories.has('pwa')) {
      pendingRecyclings.push({
        category: 'pwa',
        title: 'Operação de Campo com PWA e Geolocalização',
        recommendedCycleMonths: 6
      });
    }

    return {
      userId,
      userName: user?.name || 'Agente de Combate a Endemias',
      completedHours: totalHours,
      coursesCount: certifications.length,
      certifications,
      pendingRecyclings
    };
  }
};
