import React from 'react';
import { LucideIcon } from 'lucide-react';

export type BadgeTone = 'info' | 'success' | 'warning' | 'danger';

const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  info: 'bg-brand-info-tint text-brand-info',
  success: 'bg-brand-success-tint text-brand-success',
  warning: 'bg-brand-warning-tint text-brand-warning',
  danger: 'bg-brand-danger-tint text-brand-danger',
};

export interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: { label: string; tone?: BadgeTone };
  actions?: React.ReactNode;
  /** Ponto pulsante verde — reservado para telas de monitoramento em tempo real */
  live?: boolean;
}

/**
 * Cabeçalho de página único do Sistema Visual Endemias. Substitui os
 * tratamentos divergentes que cada tela inventava (tamanho de título, cor de
 * ícone, presença de badge) por uma única estrutura: ícone + título + badge
 * opcional à direita do título, subtítulo abaixo, ações à direita.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ icon: Icon, title, subtitle, badge, actions, live }) => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-card border border-slate-200 shadow-xs">
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        {live && <span className="w-2.5 h-2.5 rounded-full bg-brand-success animate-pulse" aria-hidden="true" />}
        {Icon && <Icon className="w-5 h-5 text-brand-primary" aria-hidden="true" />}
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {badge && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${BADGE_TONE_CLASSES[badge.tone || 'info']}`}>
            {badge.label}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>

    {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
  </div>
);
