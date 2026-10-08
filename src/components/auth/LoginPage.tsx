import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
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
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:grid lg:grid-cols-[minmax(320px,0.85fr)_minmax(480px,1.15fr)] lg:p-0">
      <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14" aria-label="Apresentação do sistema">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-700">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-bold">Vigilância de Endemias</p>
            <p className="text-sm text-slate-400">Secretaria Municipal de Saúde</p>
          </div>
        </div>

        <div className="max-w-lg">
          <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">Informação de campo para decisões de saúde pública.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
            Registre visitas, acompanhe o território e organize as prioridades da equipe em um único ambiente municipal.
          </p>
        </div>

        <p className="text-sm text-slate-400">Acesso restrito a servidores e colaboradores autorizados.</p>
      </section>

      <section className="flex min-h-[calc(100vh-2rem)] items-center justify-center lg:min-h-screen">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-8 lg:hidden">
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-teal-800 text-white">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-teal-800">Secretaria Municipal de Saúde</p>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">Entrar no sistema</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Use as credenciais fornecidas pela administração municipal.</p>
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
                  placeholder="Digite sua senha"
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
      </section>
    </main>
  );
};
