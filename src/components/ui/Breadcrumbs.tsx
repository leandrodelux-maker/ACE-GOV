import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  icon?: React.ElementType;
  active?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onHomeClick?: () => void;
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  onHomeClick,
  className = '',
}) => {
  return (
    <nav
      aria-label="Caminho de navegação"
      className={`flex items-center gap-1.5 text-xs text-slate-500 py-1.5 px-3 bg-white/80 backdrop-blur-xs border border-slate-200/80 rounded-lg shadow-2xs overflow-x-auto ${className}`}
    >
      <button
        onClick={onHomeClick}
        className="flex items-center gap-1 text-slate-400 hover:text-slate-800 transition shrink-0 font-medium"
        title="Página Inicial"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Início</span>
      </button>

      {items.map((item, index) => {
        const isLast = index === items.length - 1 || item.active;
        const Icon = item.icon;

        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            {isLast ? (
              <span className="font-semibold text-slate-800 flex items-center gap-1 shrink-0 truncate max-w-[200px]">
                {Icon && <Icon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </span>
            ) : item.onClick ? (
              <button
                onClick={item.onClick}
                className="hover:text-indigo-600 transition flex items-center gap-1 shrink-0 font-medium"
              >
                {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                <span>{item.label}</span>
              </button>
            ) : (
              <span className="flex items-center gap-1 shrink-0 font-medium text-slate-600">
                {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                <span>{item.label}</span>
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
