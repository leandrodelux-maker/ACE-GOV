import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, Municipality } from '../types';
import { authService, AuthSessionData } from '../services/authService';
import { can as rbacCan, hasRole as rbacHasRole, ROLES_REGISTRY } from '../services/rbac';
import { supabase } from '../services/supabaseClient';
import { db } from '../services/storage';

const PLATFORM_ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'MUNICIPAL_ADMIN'];

interface AuthContextType {
  user: User | null;                 // usuário efetivo (papel = simulado, se houver)
  realUser: User | null;             // usuário real da sessão
  session: AuthSessionData | null;
  municipality: Municipality | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  realRole: UserRole | null;
  effectiveRole: UserRole | null;
  isImpersonating: boolean;
  login: (email: string, pass: string) => Promise<AuthSessionData>;
  logout: () => Promise<void>;
  impersonateRole: (newRole: UserRole) => void;
  stopImpersonation: () => void;
  hasPermission: (permissionSlug: string) => boolean;
  can: (permission: string) => boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (password: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSessionData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [impersonatedRole, setImpersonatedRole] = useState<UserRole | null>(null);

  // Restauração inicial da sessão
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await authService.getSession();
        if (active) setSession(s);
      } catch (e) {
        console.error('Falha ao restaurar sessão:', e);
        if (active) setSession(null);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Sincronização com o Supabase Auth (logout, refresh de token, etc.)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setImpersonatedRole(null);
        return;
      }
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const s = await authService.refreshBootstrap();
        if (s) setSession(s);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Espelha a identidade da sessão no armazenamento local (rótulos/logs) e
  // dispara a hidratação de dados do Supabase (respeitando RLS).
  useEffect(() => {
    if (session?.user) {
      db.setSessionUser(session.user);
      db.hydrateFromSupabase();
    } else {
      db.setSessionUser(null);
    }
  }, [session]);

  const login = async (email: string, pass: string): Promise<AuthSessionData> => {
    const sessionData = await authService.login(email, pass);
    setSession(sessionData);
    setImpersonatedRole(null);
    return sessionData;
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    setSession(null);
    setImpersonatedRole(null);
  };

  const realRole = session?.user.role ?? null;
  const isPlatformAdmin = !!realRole && PLATFORM_ADMIN_ROLES.includes(realRole);
  const effectiveRole = impersonatedRole ?? realRole;
  const isImpersonating = impersonatedRole !== null && impersonatedRole !== realRole;

  const impersonateRole = useCallback(
    (newRole: UserRole) => {
      if (!session || !isPlatformAdmin) return; // apenas SUPER_ADMIN / MUNICIPAL_ADMIN
      setImpersonatedRole(newRole === realRole ? null : newRole);
      // Trilha de auditoria (não bloqueia a UI)
      supabase.rpc('log_impersonation', { p_target_role: newRole }).then(({ error }) => {
        if (error) console.warn('Falha ao registrar auditoria de simulação:', error.message);
      });
    },
    [session, isPlatformAdmin, realRole]
  );

  const stopImpersonation = useCallback(() => setImpersonatedRole(null), []);

  const checkCan = useCallback(
    (permission: string): boolean => {
      if (!session || !effectiveRole) return false;
      // Simulando um perfil: preview pelas permissões PADRÃO do papel simulado.
      if (isImpersonating) {
        return rbacCan(effectiveRole, permission, ROLES_REGISTRY[effectiveRole]?.defaultPermissions || []);
      }
      // Normal: autoridade é a lista vinda do servidor (session.permissions).
      return rbacCan(session.user.role, permission, session.permissions);
    },
    [session, effectiveRole, isImpersonating]
  );

  const checkHasRole = useCallback(
    (role: UserRole | UserRole[]): boolean => {
      if (!effectiveRole) return false;
      return rbacHasRole(effectiveRole, role);
    },
    [effectiveRole]
  );

  const requestPasswordReset = (email: string) => authService.requestPasswordReset(email);
  const resetPassword = (password: string) => authService.resetPassword(password);

  const effectiveUser: User | null = session
    ? { ...session.user, role: effectiveRole ?? session.user.role }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        realUser: session?.user ?? null,
        session,
        municipality: session?.municipality ?? null,
        isAuthenticated: !!session?.user,
        isLoading,
        realRole,
        effectiveRole,
        isImpersonating,
        login,
        logout,
        impersonateRole,
        stopImpersonation,
        hasPermission: checkCan,
        can: checkCan,
        hasRole: checkHasRole,
        requestPasswordReset,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
