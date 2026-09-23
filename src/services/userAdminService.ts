import { supabase } from './supabaseClient';
import { requireMunicipalityId } from './municipalityScope';
import { authService } from './authService';
import { UserRole } from '../types';

/**
 * Administração de usuários do município (tabelas `profiles` e `user_roles`).
 *
 * - Leitura: RLS limita ao município da sessão.
 * - Escrita: RLS exige `usuarios.create` / `usuarios.update`.
 * - Contas de login (Supabase Auth) NÃO podem ser criadas pelo navegador: o
 *   cadastro aqui cria o perfil; o acesso é criado pelo provisionamento
 *   (scripts/provision-auth-users.mjs) ou convite, que vincula a conta ao perfil.
 */

export interface ManagedUser {
  id: string;
  authUserId: string | null;
  name: string;
  email: string;
  registrationNumber: string;
  jobTitle: string;
  phone: string;
  active: boolean;
  lastLogin: string | null;
  roles: UserRole[];
  /** Cadastro de agente (tabela agents) ativo vinculado ao perfil; necessário para registrar visitas */
  agentId: string | null;
}

export interface ProfileInput {
  name: string;
  email: string;
  registrationNumber?: string;
  jobTitle?: string;
  phone?: string;
}

/** Papel que só um SUPER_ADMIN pode atribuir. */
export const RESTRICTED_ROLES: UserRole[] = ['SUPER_ADMIN'];

async function roleIdBySlug(slug: UserRole): Promise<string> {
  const { data, error } = await supabase.from('roles').select('id').eq('slug', slug).maybeSingle();
  if (error || !data?.id) throw new Error(`Perfil ${slug} não encontrado no catálogo de papéis.`);
  return data.id;
}

export const userAdminService = {
  async list(municipalityId: string): Promise<{ users: ManagedUser[]; error?: string }> {
    const munId = requireMunicipalityId(municipalityId);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, auth_user_id, full_name, email, registration_number, job_title, phone, active, last_login, user_roles(roles(slug)), agents(id, active)')
      .eq('municipality_id', munId)
      .order('full_name', { ascending: true });

    if (error) return { users: [], error: error.message };
    return {
      users: (data || []).map((p: any) => ({
        id: p.id,
        authUserId: p.auth_user_id ?? null,
        name: p.full_name,
        email: p.email,
        registrationNumber: p.registration_number || '',
        jobTitle: p.job_title || '',
        phone: p.phone || '',
        active: !!p.active,
        lastLogin: p.last_login ?? null,
        roles: (p.user_roles || []).map((ur: any) => ur.roles?.slug).filter(Boolean),
        agentId: (p.agents || []).find((a: any) => a.active)?.id ?? null,
      })),
    };
  },

  async createProfile(municipalityId: string, input: ProfileInput, role: UserRole): Promise<ManagedUser> {
    const munId = requireMunicipalityId(municipalityId);
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        municipality_id: munId,
        full_name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        registration_number: input.registrationNumber?.trim() || null,
        job_title: input.jobTitle?.trim() || null,
        phone: input.phone?.trim() || null,
        active: true,
      })
      .select('id, auth_user_id, full_name, email, registration_number, job_title, phone, active, last_login')
      .single();
    if (error || !data) throw new Error(error?.message || 'Não foi possível cadastrar o perfil.');

    await this.setRole(munId, data.id, role);
    return {
      id: data.id,
      authUserId: data.auth_user_id ?? null,
      name: data.full_name,
      email: data.email,
      registrationNumber: data.registration_number || '',
      jobTitle: data.job_title || '',
      phone: data.phone || '',
      active: true,
      lastLogin: null,
      roles: [role],
      agentId: null,
    };
  },

  async updateProfile(municipalityId: string, profileId: string, input: ProfileInput): Promise<void> {
    const munId = requireMunicipalityId(municipalityId);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        registration_number: input.registrationNumber?.trim() || null,
        job_title: input.jobTitle?.trim() || null,
        phone: input.phone?.trim() || null,
      })
      .eq('id', profileId)
      .eq('municipality_id', munId);
    if (error) throw new Error(error.message);
  },

  async setActive(municipalityId: string, profileId: string, active: boolean): Promise<void> {
    const munId = requireMunicipalityId(municipalityId);
    const { error } = await supabase.from('profiles').update({ active }).eq('id', profileId).eq('municipality_id', munId);
    if (error) throw new Error(error.message);
  },

  /** Substitui o papel do perfil (um papel por usuário, como no bootstrap da sessão). */
  async setRole(municipalityId: string, profileId: string, role: UserRole): Promise<void> {
    requireMunicipalityId(municipalityId);
    const roleId = await roleIdBySlug(role);
    const { error: delError } = await supabase.from('user_roles').delete().eq('user_id', profileId);
    if (delError) throw new Error(delError.message);
    const { error } = await supabase.from('user_roles').insert({ user_id: profileId, role_id: roleId });
    if (error) throw new Error(error.message);
  },

  /**
   * Cria (ou reativa) o cadastro de agente do perfil. visits, ovitrap_installations
   * e ovitrap_collections referenciam agents(id): sem isso o ACE não grava visitas.
   */
  async linkAgent(municipalityId: string, profileId: string, registrationNumber?: string): Promise<string> {
    const munId = requireMunicipalityId(municipalityId);
    const { data: existing, error: findError } = await supabase
      .from('agents')
      .select('id, active')
      .eq('profile_id', profileId)
      .eq('municipality_id', munId)
      .limit(1)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (existing) {
      if (!existing.active) {
        const { error } = await supabase.from('agents').update({ active: true }).eq('id', existing.id);
        if (error) throw new Error(error.message);
      }
      return existing.id;
    }
    const { data, error } = await supabase
      .from('agents')
      .insert({ municipality_id: munId, profile_id: profileId, employee_number: registrationNumber || null, active: true })
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message || 'Não foi possível criar o cadastro de agente.');
    return data.id;
  },

  /** Envia o e-mail oficial de redefinição de senha (Supabase Auth). */
  async sendPasswordReset(email: string) {
    return authService.requestPasswordReset(email);
  },
};
