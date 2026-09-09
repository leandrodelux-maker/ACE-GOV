import React, { useState } from 'react';
import {
  User,
  Shield,
  KeyRound,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Clock,
  Lock,
  Eye,
  EyeOff,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';

interface MyAccountPageProps {
  onNavigate: (route: string) => void;
}

export const MyAccountPage: React.FC<MyAccountPageProps> = ({ onNavigate }) => {
  const { user, municipality, logout, can } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMsg('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('As senhas digitadas não conferem.');
      return;
    }

    setIsChangingPassword(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await authService.changePassword({
        currentPassword,
        newPassword,
      });

      if (res.success) {
        setSuccessMsg('Senha alterada com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setErrorMsg(res.message || 'Falha ao alterar senha.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('/login');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              MINHA CONTA
            </span>
            <span className="text-xs text-slate-400">• Sessão Autenticada</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <User className="w-7 h-7 text-emerald-400" />
            Perfil & Segurança do Operador
          </h1>
          <p className="text-sm text-slate-400">
            Gerencie suas credenciais de acesso, perfil de permissões e segurança municipal.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-sm font-medium flex items-center gap-2 transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Encerrar Sessão</span>
        </button>
      </div>

      {/* Alertas */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-300 text-xs font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs font-medium">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card de Dados Pessoais & Institucionais */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-700/60 pb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
                {user?.name ? user.name.substring(0, 2).toUpperCase() : 'OP'}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">{user?.name || 'Operador Municipal'}</h3>
                <span className="text-xs text-slate-400 block">{user?.email}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-1 uppercase">
                  {user?.role || 'ACE'}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  Município
                </span>
                <span className="text-white font-medium">{municipality?.name || 'Viamão - RS'}</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-slate-500" />
                  Código IBGE
                </span>
                <span className="text-slate-300 font-mono">{municipality?.ibgeCode || '4323002'}</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                  Perfil RBAC
                </span>
                <span className="text-cyan-400 font-semibold">{user?.role || 'OPERADOR'}</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Último Acesso
                </span>
                <span className="text-slate-300 font-mono">Hoje às 17:10</span>
              </div>
            </div>
          </div>
        </div>

        {/* Formulário de Alteração de Senha */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-700/60 pb-3">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              Alterar Senha de Acesso
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Para sua segurança e conformidade LGPD, utilize senhas com letras maiúsculas, números e caracteres especiais.
            </p>

            <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Senha Atual *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Nova Senha (min. 8 caracteres) *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nova senha forte"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Confirmar Nova Senha *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/60">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition shadow-md flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isChangingPassword ? 'Atualizando...' : 'Atualizar Senha'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Políticas e Proteção de Dados LGPD */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              Princípio da Necessidade & Segurança da Informação (LGPD)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              O acesso aos registros sanitários e epidemiológicos municipais é estritamente restrito e auditado. Todas as ações
              de consulta, cadastro e exportação geram registros indeléveis de auditoria com IP, data e horário para garantir a
              privacidade dos cidadãos e a rastreabilidade das operações de combate a endemias.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
