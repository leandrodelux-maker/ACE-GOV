import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPinned,
  Radio,
  Route,
  ShieldCheck,
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

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) errors.email = 'Informe o e-mail institucional.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Digite um e-mail válido.';
    if (!password) errors.password = 'Informe sua senha.';
    else if (password.length < 8) errors.password = 'A senha deve ter pelo menos 8 caracteres.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    if (!validate()) {
      window.setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await login(email, password);
      onNavigate(redirectTo && redirectTo !== '/login' ? redirectTo : session.defaultRoute);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível entrar. Verifique os dados e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#eef3f4] lg:grid lg:grid-cols-[minmax(480px,1.05fr)_minmax(520px,0.95fr)]">
      <section className="login-territory-panel hidden min-h-screen overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14 2xl:p-16" aria-label="Apresentação do sistema">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/10">
            <ShieldCheck className="h-6 w-6 text-emerald-300" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-bold tracking-tight">Endemias GOV</p>
            <p className="text-sm text-sky-100/70">Inteligência municipal em saúde</p>
          </div>
        </div>

        <div className="max-w-2xl py-12">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-sm font-semibold text-emerald-100">
            <span className="territory-signal h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
            Território em acompanhamento
          </div>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.12] tracking-[-0.035em] xl:text-5xl 2xl:text-[3.5rem]">
            Cada registro de campo fortalece o cuidado com a cidade.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-sky-50/72 xl:text-lg">
            Planejamento, vigilância e resposta municipal conectados para orientar equipes e proteger a população.
          </p>

          <div className="mt-10 grid max-w-xl grid-cols-3 overflow-hidden rounded-xl border border-white/12 bg-[#073346]/80">
            <div className="border-r border-white/10 p-4">
              <Route className="mb-3 h-5 w-5 text-emerald-300" aria-hidden="true" />
              <p className="text-sm font-semibold">Campo</p>
              <p className="mt-1 text-xs leading-5 text-sky-100/60">Rotas e visitas</p>
            </div>
            <div className="border-r border-white/10 p-4">
              <MapPinned className="mb-3 h-5 w-5 text-emerald-300" aria-hidden="true" />
              <p className="text-sm font-semibold">Território</p>
              <p className="mt-1 text-xs leading-5 text-sky-100/60">Risco localizado</p>
            </div>
            <div className="p-4">
              <Activity className="mb-3 h-5 w-5 text-emerald-300" aria-hidden="true" />
              <p className="text-sm font-semibold">Decisão</p>
              <p className="mt-1 text-xs leading-5 text-sky-100/60">Ação prioritária</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-6 text-xs text-sky-100/60">
          <p>Acesso exclusivo para equipes autorizadas.</p>
          <span className="inline-flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" /> Operação municipal segura</span>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#0b4f6c] lg:hidden" aria-hidden="true" />
        <div className="w-full max-w-[440px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b4f6c] text-white">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold tracking-tight text-[#102a33]">Endemias GOV</p>
              <p className="text-xs text-slate-500">Inteligência municipal em saúde</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d8e3e6] bg-white p-6 shadow-[0_24px_70px_-42px_rgba(6,56,75,0.45)] sm:p-9">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-[-0.025em] text-[#102a33] sm:text-[1.75rem]">Acesse sua área de trabalho</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Entre com as credenciais da administração municipal.</p>
              </div>
              <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 sm:inline-flex">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Seguro
              </span>
            </div>

          {errorMessage ? (
            <div className="mt-6 flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert" aria-live="polite">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div>
              <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-slate-800">E-mail institucional</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  spellCheck={false}
                  inputMode="email"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: undefined })); }}
                  placeholder="servidor@municipio.gov.br"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                  className={`min-h-12 w-full rounded-lg border bg-white py-3 pl-11 pr-4 text-base text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${fieldErrors.email ? 'border-rose-500 focus:ring-rose-200' : 'border-slate-300 focus:border-teal-700 focus:ring-teal-100'}`}
                />
              </div>
              {fieldErrors.email ? <p id="login-email-error" className="mt-1.5 text-sm text-rose-700">{fieldErrors.email}</p> : null}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="login-password" className="text-sm font-semibold text-slate-800">Senha</label>
                <button type="button" onClick={() => onNavigate('/esqueci-senha')} className="text-sm font-semibold text-teal-800 hover:underline focus-visible:rounded-sm">Esqueci minha senha</button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); }}
                  placeholder="Digite sua senha…"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                  className={`min-h-12 w-full rounded-lg border bg-white py-3 pl-11 pr-12 text-base text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${fieldErrors.password ? 'border-rose-500 focus:ring-rose-200' : 'border-slate-300 focus:border-teal-700 focus:ring-teal-100'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </div>
              {fieldErrors.password ? <p id="login-password-error" className="mt-1.5 text-sm text-rose-700">{fieldErrors.password}</p> : null}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 text-base font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-wait disabled:opacity-70"
            >
              <span>{isSubmitting ? 'Verificando acesso…' : 'Entrar'}</span>
              {!isSubmitting ? <ArrowRight className="h-5 w-5" aria-hidden="true" /> : null}
            </button>
          </form>

          <div className="mt-7 border-t border-slate-200 pt-5 text-sm text-slate-600">
            Primeiro acesso?{' '}
            <button type="button" onClick={() => onNavigate('/primeiro-acesso')} className="font-semibold text-teal-800 hover:underline focus-visible:rounded-sm">Consulte as orientações</button>
          </div>
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-slate-500">
            Plataforma oficial de vigilância e controle de endemias.
          </p>
        </div>
      </section>
    </main>
  );
};
