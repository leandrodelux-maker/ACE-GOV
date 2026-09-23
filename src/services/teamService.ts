import { supabase } from './supabaseClient';
import { db } from './storage';
import { OperationalLoadAgent } from '../types';
import { requireMunicipalityId } from './municipalityScope';

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


export const teamService = {
  async getTeams(municipalityId: string): Promise<TeamEntity[]> {
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
          profiles:supervisor_id(full_name)
        `)
        .eq('municipality_id', municipalityId)
        .order('name');

      if (error) {
        console.warn('Erro ao carregar equipes:', error.message);
        return [];
      }
      if (!data || data.length === 0) return [];

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
        supervisor_name: t.profiles?.full_name || 'Não designado',
        active: t.active,
        member_count: countMap[t.id] || 0,
        created_at: t.created_at,
      }));
    } catch {
      return [];
    }
  },

  async createTeam(team: { name: string; code?: string; supervisor_id?: string; municipality_id: string }): Promise<boolean> {
    try {
      const { error } = await supabase.from('teams').insert({
        name: team.name,
        code: team.code || `EQ-${Date.now().toString().slice(-4)}`,
        supervisor_id: team.supervisor_id || null,
        municipality_id: requireMunicipalityId(team.municipality_id),
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
      console.warn('Erro ao calcular carga operacional:', err);
    }

    // Sem dados registrados: lista vazia (nunca agentes fictícios)
    return [];
  },
};
