import { supabase } from './supabaseClient';
import { db } from './storage';
import { OperationalLoadAgent } from '../types';

export interface TeamEntity {
  id: string;
  name: string;
  code?: string;
  supervisor_id?: string;
  supervisor_name?: string;
  active: boolean;
  member_count?: number;
  created_at?: string;
}

export interface AgentEntity {
  id: string;
  name: string;
  email?: string;
  team_id?: string;
  team_name?: string;
  employee_number?: string;
  active: boolean;
  ruralArea?: boolean;
}

const DEFAULT_MUN_ID = '00000000-0000-0000-0000-000000000001';

export const teamService = {
  async getTeams(municipalityId: string = DEFAULT_MUN_ID): Promise<TeamEntity[]> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          code,
          supervisor_id,
          active,
          created_at,
          profiles:supervisor_id(name)
        `)
        .eq('municipality_id', municipalityId)
        .order('name');

      if (error || !data || data.length === 0) {
        // Fallback para mock local
        return [
          { id: 't-1', name: 'Equipe Alpha - Centro', code: 'EQ-01', supervisor_name: 'Dr. Roberto Cruz', active: true, member_count: 4 },
          { id: 't-2', name: 'Equipe Beta - Zona Norte', code: 'EQ-02', supervisor_name: 'Ana Carolina Silva', active: true, member_count: 3 },
          { id: 't-3', name: 'Equipe Gamma - Zona Sul', code: 'EQ-03', supervisor_name: 'Mariana Souza', active: true, member_count: 5 },
          { id: 't-4', name: 'Equipe Delta - Rural & Periferia', code: 'EQ-04', supervisor_name: 'Carlos Mendes', active: true, member_count: 3 },
          { id: 't-5', name: 'Equipe Epsilon - Pontos Estratégicos', code: 'EQ-05', supervisor_name: 'Juliana Costa', active: true, member_count: 2 },
          { id: 't-6', name: 'Equipe Zeta - Bloqueio Químico', code: 'EQ-06', supervisor_name: 'Paulo Henrique', active: true, member_count: 4 },
        ];
      }

      // Buscar membros para contar por equipe
      const { data: members } = await supabase
        .from('agents')
        .select('team_id')
        .eq('municipality_id', municipalityId)
        .eq('active', true);

      const countMap: Record<string, number> = {};
      (members || []).forEach((m: any) => {
        if (m.team_id) countMap[m.team_id] = (countMap[m.team_id] || 0) + 1;
      });

      return data.map((t: any) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        supervisor_id: t.supervisor_id,
        supervisor_name: t.profiles?.name || 'Não designado',
        active: t.active,
        member_count: countMap[t.id] || 0,
        created_at: t.created_at,
      }));
    } catch {
      return [
        { id: 't-1', name: 'Equipe Alpha - Centro', code: 'EQ-01', supervisor_name: 'Dr. Roberto Cruz', active: true, member_count: 4 },
        { id: 't-2', name: 'Equipe Beta - Zona Norte', code: 'EQ-02', supervisor_name: 'Ana Carolina Silva', active: true, member_count: 3 },
        { id: 't-3', name: 'Equipe Gamma - Zona Sul', code: 'EQ-03', supervisor_name: 'Mariana Souza', active: true, member_count: 5 },
        { id: 't-4', name: 'Equipe Delta - Rural & Periferia', code: 'EQ-04', supervisor_name: 'Carlos Mendes', active: true, member_count: 3 },
      ];
    }
  },

  async createTeam(team: { name: string; code?: string; supervisor_id?: string; municipality_id?: string }): Promise<boolean> {
    try {
      const { error } = await supabase.from('teams').insert({
        name: team.name,
        code: team.code || `EQ-${Date.now().toString().slice(-4)}`,
        supervisor_id: team.supervisor_id || null,
        municipality_id: team.municipality_id || DEFAULT_MUN_ID,
        active: true,
      });
      return !error;
    } catch {
      return false;
    }
  },

  async getOperationalLoad(): Promise<OperationalLoadAgent[]> {
    try {
      // Tentar calcular via storage / dados combinados
      const localLoads = db.calculateAgentsOperationalLoad();
      if (localLoads && localLoads.length > 0) {
        return localLoads;
      }
    } catch (err) {
      console.warn('Erro ao calcular carga local, fallback em execução:', err);
    }

    return [
      {
        agentId: 'ACE-001',
        agentName: 'Carlos Oliveira',
        teamName: 'Equipe Alpha - Centro',
        totalVisits: 142,
        coveragePercentage: 88,
        pendingReturns: 6,
        fociFound: 4,
        blocksAssigned: 3,
        complaintsAssigned: 2,
        strategicPointsAssigned: 1,
        ruralArea: false,
        operationalLoadIndex: 68,
        loadCategory: 'MODERADA',
      },
      {
        agentId: 'ACE-002',
        agentName: 'Mariana Santos',
        teamName: 'Equipe Beta - Zona Norte',
        totalVisits: 178,
        coveragePercentage: 94,
        pendingReturns: 12,
        fociFound: 9,
        blocksAssigned: 5,
        complaintsAssigned: 4,
        strategicPointsAssigned: 2,
        ruralArea: false,
        operationalLoadIndex: 86,
        loadCategory: 'SOBRECARREGADA',
      },
      {
        agentId: 'ACE-003',
        agentName: 'João da Silva',
        teamName: 'Equipe Delta - Rural & Periferia',
        totalVisits: 98,
        coveragePercentage: 82,
        pendingReturns: 3,
        fociFound: 1,
        blocksAssigned: 2,
        complaintsAssigned: 1,
        strategicPointsAssigned: 0,
        ruralArea: true,
        operationalLoadIndex: 54,
        loadCategory: 'EQUILIBRADA',
      },
    ];
  },
};
