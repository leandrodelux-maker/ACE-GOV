import React from 'react';
import { LucideIcon } from 'lucide-react';

export type BadgeTone = 'info' | 'success' | 'warning' | 'danger';

const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  info: 'bg-sky-50 text-sky-700 border border-sky-200',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200',
};

type PageHeaderBadge = { label: string; tone?: BadgeTone };

export interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  /** Um badge, ou vários (ex.: "CORE MODULE" + status) — renderizados em sequência */
  badge?: PageHeaderBadge | PageHeaderBadge[];
  actions?: React.ReactNode;
  /** Ponto pulsante verde — reservado para telas de monitoramento em tempo real */
  live?: boolean;
}

/**
 * Cabeçalho de página único do Sistema Visual Endemias. Substitui os
 * tratamentos divergentes que cada tela inventava (tamanho de título, cor de
 * ícone, presença de badge) por uma única estrutura: ícone + título + badge(s)
 * opcional(is) à direita do título, subtítulo abaixo, ações à direita.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ icon: Icon, title, subtitle, badge, actions, live }) => {
  const badges = badge ? (Array.isArray(badge) ? badge : [badge]) : [];

  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-brand-line bg-white p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
      <span className="absolute inset-y-0 left-0 w-1 bg-brand-primary" aria-hidden="true" />
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50 p-2.5 text-brand-primary" aria-hidden="true">
            <Icon className="w-5 h-5" />
          </span>
        )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {live && <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden="true" />}
            {live && <span className="sr-only">Dados atualizados automaticamente.</span>}
            <h1 className="text-xl font-bold tracking-[-0.025em] text-brand-ink sm:text-2xl">{title}</h1>
            {badges.map((b, i) => (
              <span
                key={i}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE_TONE_CLASSES[b.tone || 'info']}`}
              >
                {b.label}
              </span>
            ))}
          </div>
          {subtitle && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>}
        </div>
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">{actions}</div>}
    </div>
  );
};
