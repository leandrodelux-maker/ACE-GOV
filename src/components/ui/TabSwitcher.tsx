import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface TabSwitcherItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string;
}

export interface TabSwitcherProps {
  tabs: TabSwitcherItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

/**
 * Barra de abas compartilhada pelos hubs do Sistema Visual Endemias — une duas ou
 * mais telas que antes disputavam item próprio no menu, mantendo cada uma com seu
 * conteúdo original intacto abaixo da barra.
 */
export const TabSwitcher: React.FC<TabSwitcherProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div
      role="tablist"
      className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 ${
              isActive
                ? 'bg-teal-800 text-white'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-300' : 'text-slate-400'}`} />}
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200/60'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
