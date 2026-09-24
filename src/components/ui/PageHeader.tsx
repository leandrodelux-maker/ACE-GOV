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
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="p-2 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
            <Icon className="w-5 h-5" />
          </span>
        )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {live && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" title="Atualização em tempo real" />}
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
            {badges.map((b, i) => (
              <span
                key={i}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${BADGE_TONE_CLASSES[b.tone || 'info']}`}
              >
                {b.label}
              </span>
            ))}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{subtitle}</p>}
        </div>
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">{actions}</div>}
    </div>
  );
};
