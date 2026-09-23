import React from 'react';
import { ShieldAlert, ArrowLeft, LogOut, Home } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AccessDeniedPageProps {
  onNavigate: (route: string) => void;
}

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({ onNavigate }) => {
  const { user, logout } = useAuth();

  const handleLogoutAndLogin = async () => {
    await logout();
    onNavigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex items-center justify-center p-4 selection:bg-sky-500 selection:text-white relative overflow-hidden">
      <div className="w-full max-w-md z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30 mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-bold text-white tracking-tight">403 — Acesso Restrito</h1>
          <p className="text-xs text-slate-400 mt-1.5">
            Você não possui autorização ou perfil adequado para acessar este módulo.
          </p>

          {user && (
            <div className="my-5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-left text-xs space-y-1">
              <div className="text-slate-400">Usuário conectado:</div>
              <div className="font-semibold text-white">{user.name}</div>
              <div className="text-sky-400 text-[11px]">Perfil: {user.role}</div>
            </div>
          )}

          <div className="space-y-2 mt-6">
            <button
              onClick={() => onNavigate('/')}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-sky-600 hover:bg-sky-500 transition flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Voltar para Página Inicial</span>
            </button>

            <button
              onClick={handleLogoutAndLogin}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Trocar de Conta / Fazer Logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
