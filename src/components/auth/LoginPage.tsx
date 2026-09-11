import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  Building2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface LoginPageProps {
  onNavigate: (route: string) => void;
  redirectTo?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, redirectTo }) => {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Informe o seu e-mail institucional.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Formato de e-mail inválido.';
    }

    if (!password) {
      errors.password = 'Informe sua senha de acesso.';
    } else if (password.length < 8) {
      errors.password = 'A senha deve conter ao menos 8 caracteres.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return; // Prevenção de múltiplos envios

    setErrorMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await login(email, password);

      // Redirecionamento após autenticação
      if (redirectTo && redirectTo !== '/login') {
        onNavigate(redirectTo);
      } else {
        onNavigate(session.defaultRoute);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao autenticar. Verifique seus dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex items-center justify-center p-4 selection:bg-sky-500 selection:text-white relative overflow-hidden">
      {/* Elementos visuais de fundo em vidro e iluminação */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-slate-900/40 rounded-full blur-2xl pointer-events-none" />

      {/* Card Principal */}
      <div className="w-full max-w-md z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/50">
          {/* Cabeçalho Oficial do Logo e Sistema */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-sky-600 to-sky-700 shadow-lg shadow-sky-600/30 ring-1 ring-white/20 mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>

            {/* Logo SUS / MS */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl font-black tracking-tight text-white">
                Endemias <span className="text-sky-400 font-extrabold">GOV</span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-sky-950/90 text-sky-300 border border-sky-800">
                SUS / MS
              </span>
            </div>

            {/* Título e Subtítulo */}
            <h1 className="text-lg font-bold text-slate-100 tracking-tight">
              Acesso ao Endemias GOV
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Sistema Municipal de Vigilância e Controle de Endemias
            </p>
          </div>

          {/* Mensagem de Erro Amigável */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Formulário de Login */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Campo E-mail */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-mail institucional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                  }}
                  placeholder="nome.servidor@municipio.gov.br"
                  disabled={isSubmitting}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition ${
                    fieldErrors.email
                      ? 'border-rose-500 focus:ring-rose-500/30'
                      : 'border-slate-700/80 focus:border-sky-500 focus:ring-sky-500/20'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] text-rose-400 mt-1 pl-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Campo Senha */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha de acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                  }}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/60 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition ${
                    fieldErrors.password
                      ? 'border-rose-500 focus:ring-rose-500/30'
                      : 'border-slate-700/80 focus:border-sky-500 focus:ring-sky-500/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition"
                  tabIndex={-1}
                  title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-rose-400 mt-1 pl-1">{fieldErrors.password}</p>
              )}
            </div>

            {/* Recuperação de senha */}
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => onNavigate('/esqueci-senha')}
                className="text-xs text-sky-400 hover:text-sky-300 transition hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 via-sky-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 shadow-lg shadow-sky-600/25 active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Validando credenciais...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Links Inferiores */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Primeiro acesso municipal?</span>
            <button
              type="button"
              onClick={() => onNavigate('/primeiro-acesso')}
              className="text-sky-400 hover:text-sky-300 font-medium transition hover:underline"
            >
              Primeiro acesso
            </button>
          </div>
        </div>

        {/* Rodapé Institucional */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-slate-500">
            Plataforma homologada pelo Ministério da Saúde para vigilância de arboviroses
          </p>
        </div>
      </div>
    </div>
  );
};
