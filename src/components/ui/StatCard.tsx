import React from 'react';
import { LucideIcon } from 'lucide-react';

export type StatTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_TEXT: Record<StatTone, string> = {
  success: 'text-brand-success',
  warning: 'text-brand-warning',
  danger: 'text-brand-danger',
  info: 'text-brand-info',
  neutral: 'text-slate-700',
};

const TONE_HOVER_BORDER: Record<StatTone, string> = {
  success: 'hover:border-brand-success/50',
  warning: 'hover:border-brand-warning/50',
  danger: 'hover:border-brand-danger/50',
  info: 'hover:border-brand-info/50',
  neutral: 'hover:border-slate-400',
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  /** Substitui a legenda simples por um nó customizado (ex.: barra de progresso) */
  footer?: React.ReactNode;
  /** Legenda simples abaixo do valor — ignorada se `footer` for informado */
  caption?: string;
  onClick?: () => void;
  /** Realce para o caso de alerta ativo (ex.: focos em aberto) */
  highlighted?: boolean;
  /** Ícone pulsante — só para o que exige atenção imediata */
  pulse?: boolean;
  title?: string;
}

/**
 * Cartão de indicador único do Sistema Visual Endemias. O `tone` é sempre
 * semântico (sucesso/atenção/crítico/informativo) — nunca escolhido por
 * preferência estética da tela.
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  footer,
  caption,
  onClick,
  highlighted,
  pulse,
  title,
}) => {
  const toneText = TONE_TEXT[tone];
  const interactive = typeof onClick === 'function';

  // Cores de fundo e ícone sutis por tom
  const toneIconBadge: Record<StatTone, string> = {
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-rose-50 text-rose-600',
    info: 'bg-sky-50 text-sky-600',
    neutral: 'bg-slate-100 text-slate-600',
  };

  return (
    <div
      onClick={onClick}
      title={title}
      className={`rounded-xl border p-4 transition-all group ${
        highlighted
          ? 'border-rose-200 bg-rose-50/30 shadow-2xs'
          : 'bg-white border-slate-200/80 shadow-2xs hover:border-slate-300 hover:shadow-xs'
      } ${interactive ? `cursor-pointer ${TONE_HOVER_BORDER[tone]}` : ''}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">
          {label}
        </span>
        {Icon && (
          <span className={`p-1.5 rounded-lg flex items-center justify-center shrink-0 transition ${toneIconBadge[tone]} ${interactive ? 'group-hover:scale-105' : ''}`}>
            <Icon
              className={`w-3.5 h-3.5 ${pulse ? 'animate-pulse' : ''}`}
              aria-hidden="true"
            />
          </span>
        )}
      </div>

      <p className={`text-2xl font-extrabold tracking-tight ${highlighted && tone === 'danger' ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}
      </p>

      {footer ? (
        <div className="mt-2">{footer}</div>
      ) : caption ? (
        <p className="text-[11px] font-medium text-slate-500 mt-1 truncate">
          {caption}
        </p>
      ) : null}
    </div>
  );
};
