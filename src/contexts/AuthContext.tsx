import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Municipality } from '../types';
import { authService, AuthSessionData, getDefaultRouteForRole } from '../services/authService';
import { can as rbacCan, hasRole as rbacHasRole } from '../services/rbac';

interface AuthContextType {
  user: User | null;
  session: AuthSessionData | null;
  municipality: Municipality | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string, rememberMe?: boolean) => Promise<AuthSessionData>;
  logout: () => Promise<void>;
  switchRole: (newRole: UserRole) => void;
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

  // Inicialização e checagem de sessão ativa
  useEffect(() => {
    try {
      const activeSession = authService.getSession();
      if (activeSession) {
        setSession(activeSession);
      }
    } catch (e) {
      console.error('Falha ao restaurar sessão:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Monitoramento periódico de expiração da sessão (a cada 1 minuto)
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      if (session.expiresAt && Date.now() > session.expiresAt) {
        authService.logout();
        setSession(null);
        window.location.href = '/login?expired=1';
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [session]);

  const login = async (
    email: string,
    pass: string,
    rememberMe: boolean = true
  ): Promise<AuthSessionData> => {
    const sessionData = await authService.login(email, pass, rememberMe);
    setSession(sessionData);
    return sessionData;
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    setSession(null);
  };

  const switchRole = (newRole: UserRole) => {
    if (!session) return;

    const updatedUser: User = { ...session.user, role: newRole };
    const updatedSession: AuthSessionData = {
      ...session,
      user: updatedUser,
      defaultRoute: getDefaultRouteForRole(newRole),
    };

    setSession(updatedSession);
    const storage = session.rememberMe ? localStorage : sessionStorage;
    storage.setItem('endemias_gov_auth_session', JSON.stringify(updatedSession));
    localStorage.setItem('endemias_gov_current_user', JSON.stringify(updatedUser));
    localStorage.setItem('endemias_current_user', JSON.stringify(updatedUser));
  };

  const checkCan = (permission: string): boolean => {
    if (!session) return false;
    return rbacCan(session.user.role, permission, session.permissions);
  };

  const checkHasRole = (role: UserRole | UserRole[]): boolean => {
    if (!session) return false;
    return rbacHasRole(session.user.role, role);
  };

  const hasPermission = (permissionSlug: string): boolean => {
    return checkCan(permissionSlug);
  };

  const requestPasswordReset = async (email: string) => {
    return authService.requestPasswordReset(email);
  };

  const resetPassword = async (password: string) => {
    return authService.resetPassword(password);
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user || null,
        session,
        municipality: session?.municipality || null,
        isAuthenticated: !!session?.user,
        isLoading,
        login,
        logout,
        switchRole,
        hasPermission,
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
