import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Settings2, ShieldCheck, X } from 'lucide-react';
import { UserRole } from '../types';
import { AccessChecker, ViewModule, canAccessView } from '../config/routes';
import { NavItem, UTILITY_NAV_ITEMS, getVisibleNavGroups, isItemActive } from '../config/navigation';

interface SidebarProps {
  currentView: ViewModule | null;
  onSelectView: (view: ViewModule) => void;
  userRole: UserRole;
  access: AccessChecker;
  isOpen: boolean;
  onClose: () => void;
  pendingSyncCount: number;
}

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Administração da plataforma',
  MUNICIPAL_ADMIN: 'Administração municipal',
  ENDEMIAS_COORDINATOR: 'Coordenação de endemias',
  FIELD_SUPERVISOR: 'Supervisão de campo',
  ACE: 'Agente de campo',
  EPIDEMIOLOGY_AGENT: 'Vigilância epidemiológica',
  SANITARY_AGENT: 'Vigilância sanitária',
  HEALTH_SECRETARY: 'Gestão da saúde',
  PRIMARY_CARE_ACS: 'Atenção primária',
  AUDITOR_VIEWER: 'Consulta e auditoria',
  LAB_TECHNICIAN: 'Laboratório entomológico',
  ZOONOSES_VACCINATOR: 'Vacinação antirrábica',
  STOCK_MANAGER: 'Gestão de estoque',
};

const sectionStorageKey = 'endemias_sidebar_sections_v3';

function readSections(): Record<string, boolean> {
  try {
    const value = localStorage.getItem(sectionStorageKey);
    if (value) return JSON.parse(value);
  } catch {
    // A navegação continua funcional quando o armazenamento está indisponível.
  }
  return { inicio: true, campo: true, territorio: true, vigilancia: true, relatorios: true };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  userRole,
  access,
  isOpen,
  onClose,
  pendingSyncCount,
}) => {
  const groups = useMemo(() => getVisibleNavGroups(userRole, access), [userRole, access]);
  const utilities = useMemo(
    () => UTILITY_NAV_ITEMS.filter((item) => canAccessView(item.view, access)),
    [access]
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(readSections);

  useEffect(() => {
    const activeGroup = groups.find((group) => group.items.some((item) => isItemActive(item, currentView)));
    if (!activeGroup || openSections[activeGroup.id]) return;
    setOpenSections((current) => ({ ...current, [activeGroup.id]: true }));
  }, [currentView, groups, openSections]);

  const toggleSection = (id: string) => {
    setOpenSections((current) => {
      const next = { ...current, [id]: !current[id] };
      try {
        localStorage.setItem(sectionStorageKey, JSON.stringify(next));
      } catch {
        // Preferência não essencial.
      }
      return next;
    });
  };

  const select = (view: ViewModule) => {
    onSelectView(view);
    onClose();
  };

  const renderItem = (item: NavItem, utility = false) => {
    const Icon = item.icon;
    const active = isItemActive(item, currentView);
    const pending = item.view === 'ace_pwa' && pendingSyncCount > 0;

    return (
      <li key={item.view}>
        <button
          type="button"
          onClick={() => select(item.view)}
          aria-current={active ? 'page' : undefined}
          className={`group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
            active
              ? 'bg-white text-brand-ink shadow-[0_8px_24px_-18px_rgba(0,0,0,0.8)]'
              : utility
                ? 'text-sky-100/70 hover:bg-white/8 hover:text-white'
                : 'text-sky-50/85 hover:bg-white/8 hover:text-white'
          }`}
        >
          <Icon
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 ${active ? 'text-teal-700' : item.highlight ? 'text-teal-300' : 'text-slate-400 group-hover:text-white'}`}
          />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {pending ? (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? 'bg-amber-100 text-amber-800' : 'bg-amber-400 text-slate-950'}`}>
              {pendingSyncCount}
            </span>
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/55 lg:hidden"
          onClick={onClose}
          aria-label="Fechar menu"
        />
      ) : null}

      <aside
        aria-label="Navegação principal"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-brand-deep text-white shadow-2xl transition-transform duration-200 lg:static lg:z-20 lg:translate-x-0 lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-4 lg:hidden">
          <div>
            <p className="text-sm font-semibold">Menu</p>
            <p className="text-xs text-slate-400">{ROLE_LABELS[userRole]}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="hidden border-b border-white/10 px-4 py-[0.875rem] lg:block">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-emerald-300">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Área de trabalho</p>
              <p className="mt-0.5 truncate text-xs text-sky-100/55">{ROLE_LABELS[userRole]}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Módulos do sistema">
          <div className="space-y-2">
            {groups.map((group) => {
              const expanded = openSections[group.id] !== false;
              const hasActive = group.items.some((item) => isItemActive(item, currentView));
              const listId = `nav-${group.id}`;

              return (
                <section key={group.id} aria-labelledby={`${listId}-title`}>
                  <button
                    type="button"
                    onClick={() => toggleSection(group.id)}
                    aria-expanded={expanded}
                    aria-controls={listId}
                    className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                      hasActive ? 'text-teal-300' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <span id={`${listId}-title`}>{group.title}</span>
                    {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                  </button>
                  {expanded ? <ul id={listId} className="mt-1 space-y-1">{group.items.map((item) => renderItem(item))}</ul> : null}
                </section>
              );
            })}
          </div>
        </nav>

        {utilities.length > 0 ? (
          <div className="border-t border-white/10 p-3">
            <div className="mb-1 flex items-center gap-2 px-3 py-1 text-xs font-semibold text-slate-400">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Administração
            </div>
            <ul className="space-y-1">{utilities.map((item) => renderItem(item, true))}</ul>
          </div>
        ) : null}
      </aside>
    </>
  );
};
