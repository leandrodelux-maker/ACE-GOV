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
    <div role="tablist" className="flex items-center gap-1.5 bg-white p-1.5 rounded-card border border-slate-200 shadow-xs overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              isActive
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {tab.label}
            {tab.badge && (
              <span
                className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
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
