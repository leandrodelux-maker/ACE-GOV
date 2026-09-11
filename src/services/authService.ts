import { supabase } from './supabaseClient';
import { User, UserRole, Municipality } from '../types';

export interface AuthSessionData {
  user: User;
  profile: {
    id: string;
    fullName: string;
    email: string;
    registrationNumber?: string;
    jobTitle?: string;
    active: boolean;
  };
  municipality: Municipality;
  roles: {
    id: string;
    slug: UserRole;
    name: string;
  }[];
  permissions: string[];
  settings: Record<string, any>;
  defaultRoute: string;
}

const BOOTSTRAP_CACHE_PREFIX = 'endemias_gov_bootstrap_';

// Mapeamento oficial de rotas iniciais por perfil (RBAC SUS)
export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case 'ACE':
      return 'ace_pwa';
    case 'FIELD_SUPERVISOR':
      return 'routes';
    case 'EPIDEMIOLOGY_AGENT':
      return 'epidemiology';
    case 'HEALTH_SECRETARY':
      return 'executive';
    case 'SANITARY_AGENT':
      return 'strategic_points';
    case 'PRIMARY_CARE_ACS':
      return 'territory';
    case 'AUDITOR_VIEWER':
      return 'dashboard';
    case 'SUPER_ADMIN':
      return 'system_health';
    case 'MUNICIPAL_ADMIN':
      return 'dashboard';
    case 'ENDEMIAS_COORDINATOR':
    default:
      return 'dashboard';
  }
}

export function getDefaultRouteForUser(user: User): string {
  if (!user || !user.role) return 'dashboard';
  return getDefaultRouteForRole(user.role);
}

// Tratamento central de erros amigáveis ao usuário SUS
export function formatFriendlyAuthError(err: any): string {
  if (!err) return 'Ocorreu uma instabilidade ao conectar. Tente novamente.';
  const message = typeof err === 'string' ? err : err.message || '';

  if (
    message.includes('Invalid login credentials') ||
    message.includes('invalid_credentials') ||
    message.includes('invalid_grant')
  ) {
    return 'E-mail ou senha incorretos. Por favor, verifique suas credenciais.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Este e-mail ainda não foi validado. Verifique sua caixa de entrada ou o convite recebido.';
  }
  if (message.includes('account_inactive') || message.includes('inactive') || message.includes('desativada')) {
    return 'Esta conta está inativa. Solicite a liberação junto à Coordenação Municipal.';
  }
  if (message.includes('profile_not_found')) {
    return 'Seu acesso ainda não foi vinculado a um perfil municipal. Procure o administrador do sistema.';
  }
  if (message.includes('not_authenticated')) {
    return 'Sessão expirada. Faça login novamente.';
  }
  if (message.includes('rate limit') || message.includes('too many') || message.includes('over_request_rate_limit')) {
    return 'Muitas tentativas em curto período. Por segurança, aguarde alguns instantes.';
  }
  if (message.includes('network') || message.includes('Failed to fetch') || message.includes('fetch')) {
    return 'Não foi possível conectar ao servidor municipal. Verifique sua conexão com a internet.';
  }
  return 'Não foi possível realizar o acesso no momento. Caso persista, procure o suporte técnico do município.';
}

// Limpa TODO o cache local do Endemias GOV (importante em máquinas compartilhadas / LGPD)
export function clearLocalCaches(): void {
  const wipe = (store: Storage) => {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && (k.startsWith('endemias_gov_') || k.startsWith('endemias_'))) keys.push(k);
    }
    keys.forEach((k) => store.removeItem(k));
  };
  try { wipe(localStorage); } catch { /* ignore */ }
  try { wipe(sessionStorage); } catch { /* ignore */ }
}

function buildMunicipality(m: any, settings: Record<string, any>): Municipality {
  return {
    id: m?.id,
    name: m?.name || 'Município',
    state: m?.state || '',
    ibgeCode: m?.ibgeCode || '',
    coatOfArmsUrl: m?.logoUrl || undefined,
    healthSecretaryName: settings?.general?.health_secretary_name || '',
    healthSecretaryPhone: settings?.general?.health_secretary_phone || '',
    coordinatorName: settings?.general?.coordinator_name || '',
    coordinatorPhone: settings?.general?.coordinator_phone || '',
    address: settings?.general?.address || '',
    totalProperties: 0,
    totalAgents: 0,
    totalSupervisors: 0,
    settings: settings?.risk_engine || settings || {},
  } as Municipality;
}

function sessionFromBootstrap(bootstrap: any): AuthSessionData {
  const roles = (bootstrap.roles || []) as { id: string; slug: UserRole; name: string }[];
  const primaryRole: UserRole = roles[0]?.slug || 'AUDITOR_VIEWER';
  const p = bootstrap.profile || {};
  const settings = bootstrap.settings || {};

  const user: User = {
    id: p.id,
    name: p.fullName,
    email: p.email,
    cpf: p.cpf || '',
    registrationNumber: p.registrationNumber || '',
    role: primaryRole,
    municipalityId: p.municipalityId,
    phone: p.phone || '',
    active: p.active,
    avatarUrl: p.avatarUrl || undefined,
    createdAt: p.createdAt || new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  return {
    user,
    profile: {
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      registrationNumber: p.registrationNumber,
      jobTitle: p.jobTitle,
      active: p.active,
    },
    municipality: buildMunicipality(bootstrap.municipality, settings),
    roles,
    permissions: (bootstrap.permissions || []) as string[],
    settings,
    defaultRoute: getDefaultRouteForRole(primaryRole),
  };
}

async function fetchBootstrap(): Promise<AuthSessionData> {
  const { data, error } = await supabase.rpc('get_auth_bootstrap');
  if (error) throw new Error(formatFriendlyAuthError(error));
  if (!data) throw new Error('profile_not_found');
  const session = sessionFromBootstrap(data);
  try {
    localStorage.setItem(BOOTSTRAP_CACHE_PREFIX + session.user.id, JSON.stringify(session));
  } catch { /* ignore */ }
  return session;
}

export const authService = {
  /**
   * Autenticação EXCLUSIVAMENTE via Supabase Auth. Sem fallback por e-mail,
   * sem perfis de demonstração. Após autenticar, carrega a sessão do servidor
   * numa única RPC.
   */
  async login(emailInput: string, passwordInput: string): Promise<AuthSessionData> {
    const email = emailInput.trim().toLowerCase();

    if (!email || !email.includes('@')) {
      throw new Error('Informe um endereço de e-mail institucional válido.');
    }
    if (!passwordInput || passwordInput.length < 8) {
      throw new Error('A senha deve possuir ao menos 8 caracteres.');
    }

    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password: passwordInput,
    });
    if (authErr) {
      throw new Error(formatFriendlyAuthError(authErr));
    }

    try {
      return await fetchBootstrap();
    } catch (e) {
      // Autenticou mas não tem perfil/vínculo válido: encerra a sessão.
      await supabase.auth.signOut();
      clearLocalCaches();
      throw e instanceof Error ? e : new Error(formatFriendlyAuthError(e));
    }
  },

  /**
   * Recupera a sessão ativa (se houver token Supabase válido) e os dados de RBAC.
   * Usa cache local do bootstrap para funcionar offline; revalida em background.
   */
  async getSession(): Promise<AuthSessionData | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    // Tenta cache primeiro (suporte offline): procura o bootstrap deste usuário
    let cached: AuthSessionData | null = null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(BOOTSTRAP_CACHE_PREFIX)) {
          const parsed = JSON.parse(localStorage.getItem(k) || 'null') as AuthSessionData | null;
          if (parsed?.profile?.email?.toLowerCase() === session.user.email?.toLowerCase()) {
            cached = parsed;
            break;
          }
        }
      }
    } catch { /* ignore */ }

    if (navigator.onLine) {
      try {
        return await fetchBootstrap();
      } catch (e) {
        if (cached) return cached;
        throw e;
      }
    }
    return cached;
  },

  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch { /* silencioso */ }
    clearLocalCaches();
  },

  /** Solicitação de recuperação de senha institucional. */
  async requestPasswordReset(emailInput: string): Promise<{ success: boolean; message: string }> {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Informe um e-mail válido para recuperação.');
    }
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    return {
      success: true,
      message:
        'Se o e-mail informado estiver registrado no sistema municipal, você receberá em instantes as instruções para recuperação de acesso.',
    };
  },

  /** Redefinição de senha — exige a sessão de recuperação ativa (link do e-mail). */
  async resetPassword(newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('A nova senha deve possuir no mínimo 8 caracteres.');
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Link de redefinição inválido ou expirado. Solicite um novo e-mail de recuperação.');
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(formatFriendlyAuthError(error));
    return {
      success: true,
      message: 'Sua senha foi redefinida com sucesso! Você já pode realizar o login.',
    };
  },

  /** Alteração de senha pelo operador autenticado. */
  async changePassword(payload: { currentPassword?: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    if (!payload.newPassword || payload.newPassword.length < 8) {
      throw new Error('A nova senha deve possuir no mínimo 8 caracteres.');
    }
    const { error } = await supabase.auth.updateUser({ password: payload.newPassword });
    if (error) throw new Error(formatFriendlyAuthError(error));
    return { success: true, message: 'Sua senha foi alterada com sucesso!' };
  },

  /** Revalida a sessão a partir do servidor (ex.: após TOKEN_REFRESHED). */
  async refreshBootstrap(): Promise<AuthSessionData | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    try {
      return await fetchBootstrap();
    } catch {
      return null;
    }
  },
};
