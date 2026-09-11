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

  return (
    <div
      onClick={onClick}
      title={title}
      className={`rounded-card border shadow-xs p-4 transition group ${
        highlighted ? 'border-brand-danger/30 bg-brand-danger-tint/40' : 'bg-white border-slate-200'
      } ${interactive ? `cursor-pointer ${TONE_HOVER_BORDER[tone]} hover:shadow-sm` : ''}`}
    >
      <div className="flex items-center justify-between text-slate-500 mb-1.5">
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${highlighted ? toneText : `group-hover:${toneText}`}`}>
          {label}
        </span>
        {Icon && (
          <Icon
            className={`w-4 h-4 ${toneText} ${pulse ? 'animate-pulse' : ''} ${interactive ? 'group-hover:scale-110 transition' : ''}`}
            aria-hidden="true"
          />
        )}
      </div>

      <p className={`text-xl font-extrabold ${tone === 'neutral' ? 'text-slate-900' : toneText}`}>{value}</p>

      {footer ? (
        <div className="mt-1.5">{footer}</div>
      ) : caption ? (
        <span className={`text-[10px] font-medium ${tone === 'neutral' ? 'text-slate-500' : toneText}`}>{caption}</span>
      ) : null}
    </div>
  );
};
