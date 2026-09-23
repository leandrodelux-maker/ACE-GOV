import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, ChevronDown, ChevronRight, Star, Search } from 'lucide-react';
import { UserRole } from '../types';
import { AccessChecker, ViewModule } from '../config/routes';
import { NavItem, getVisibleNavGroups, isItemActive } from '../config/navigation';

interface SidebarProps {
  currentView: ViewModule | null;
  onSelectView: (view: ViewModule) => void;
  userRole: UserRole;
  access: AccessChecker;
  isOpen: boolean;
  onClose: () => void;
  pendingSyncCount: number;
}

function readStoredList(key: string, fallback: ViewModule[]): ViewModule[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* armazenamento indisponível */
  }
  return fallback;
}

function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível */
  }
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
  // Grupos visíveis para o perfil (checagem fail-closed em canAccessView)
  const groups = useMemo(() => getVisibleNavGroups(userRole, access), [userRole, access]);

  const itemsByView = useMemo(() => {
    const dict = new Map<ViewModule, NavItem>();
    groups.forEach((g) => g.items.forEach((i) => dict.set(i.view, i)));
    return dict;
  }, [groups]);

  const [favorites, setFavorites] = useState<ViewModule[]>(() =>
    readStoredList('endemias_favorite_views', ['dashboard', 'ace_pwa', 'properties', 'ovitraps'])
  );
  const [recents, setRecents] = useState<ViewModule[]>(() => readStoredList('endemias_recent_views', []));
  const [menuFilter, setMenuFilter] = useState('');

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('endemias_sidebar_open_sections_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      }
    } catch {
      /* armazenamento indisponível */
    }
    return { inicio: true, campo: true, territorio: true, vigilancia: true };
  });

  const toggleFavorite = (view: ViewModule, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(view) ? prev.filter((id) => id !== view) : [...prev, view];
      writeStored('endemias_favorite_views', updated);
      return updated;
    });
  };

  // Recentes + auto-expandir o grupo da rota atual
  useEffect(() => {
    if (!currentView) return;
    const menuItem = groups.flatMap((g) => g.items).find((i) => isItemActive(i, currentView));
    if (menuItem) {
      setRecents((prev) => {
        const updated = [menuItem.view, ...prev.filter((id) => id !== menuItem.view)].slice(0, 4);
        writeStored('endemias_recent_views', updated);
        return updated;
      });
    }
    const parent = groups.find((g) => g.items.some((i) => isItemActive(i, currentView)));
    if (parent && !openSections[parent.id]) {
      setOpenSections((prev) => {
        const next = { ...prev, [parent.id]: true };
        writeStored('endemias_sidebar_open_sections_v2', next);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, groups]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeStored('endemias_sidebar_open_sections_v2', next);
      return next;
    });
  };

  const filteredGroups = useMemo(() => {
    const term = menuFilter.toLowerCase().trim();
    if (!term) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.label.toLowerCase().includes(term) || g.title.toLowerCase().includes(term)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, menuFilter]);

  // Favoritos e recentes só exibem itens ainda existentes e permitidos
  const favoriteItems = favorites.map((v) => itemsByView.get(v)).filter((i): i is NavItem => Boolean(i));
  const recentItems = recents
    .map((v) => itemsByView.get(v))
    .filter((i): i is NavItem => Boolean(i) && !isItemActive(i as NavItem, currentView));

  const select = (view: ViewModule) => {
    onSelectView(view);
    onClose();
  };

  const badgeFor = (item: NavItem) =>
    item.view === 'ace_pwa' && pendingSyncCount > 0 ? `${pendingSyncCount} pend.` : item.badge;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        aria-label="Menu principal"
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-3.5 border-b border-slate-800 lg:hidden">
          <span className="font-bold text-white text-sm">Navegação — Endemias GOV</span>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg" aria-label="Fechar menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-3 pt-3 pb-2 border-b border-slate-800/80">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={menuFilter}
              onChange={(e) => setMenuFilter(e.target.value)}
              placeholder="Filtrar menu..."
              aria-label="Filtrar itens do menu"
              className="w-full pl-8 pr-7 py-1 text-[11px] bg-slate-800/70 border border-slate-700/70 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
            />
            {menuFilter && (
              <button
                onClick={() => setMenuFilter('')}
                className="absolute right-2 text-slate-400 hover:text-slate-200 text-xs"
                aria-label="Limpar filtro"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 text-xs select-none">
          {!menuFilter && favoriteItems.length > 0 && (
            <div className="bg-slate-800/30 rounded-xl p-2 border border-slate-800/60">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[10px] font-bold tracking-wider text-amber-400 uppercase flex items-center gap-1.5">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  Favoritos
                </span>
                <span className="text-[9px] text-slate-400">{favoriteItems.length}</span>
              </div>
              <ul className="space-y-0.5">
                {favoriteItems.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item, currentView);
                  return (
                    <li key={`fav-${item.view}`} className="group flex items-center">
                      <button
                        onClick={() => select(item.view)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-medium transition text-left truncate ${
                          active ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-white' : 'text-amber-400'}`} />
                        <span className="truncate text-[11.5px]">{item.label}</span>
                      </button>
                      <button
                        onClick={(e) => toggleFavorite(item.view, e)}
                        className="p-1 text-amber-400 opacity-60 group-hover:opacity-100 focus:opacity-100 transition"
                        title="Remover dos favoritos"
                        aria-label={`Remover ${item.label} dos favoritos`}
                      >
                        <Star className="w-3 h-3 fill-amber-400" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!menuFilter && recentItems.length > 0 && (
            <div className="px-1">
              <span className="text-[9.5px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1 mb-1">
                <Clock className="w-2.5 h-2.5 text-slate-400" />
                Recentes
              </span>
              <div className="flex flex-wrap gap-1">
                {recentItems.map((item) => (
                  <button
                    key={`rec-${item.view}`}
                    onClick={() => select(item.view)}
                    className="px-2 py-0.5 rounded-md text-[10.5px] bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition truncate max-w-[130px]"
                    title={item.label}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredGroups.map((group) => {
            const expanded = menuFilter ? true : !!openSections[group.id];
            const hasActive = group.items.some((i) => isItemActive(i, currentView));
            const listId = `nav-group-${group.id}`;

            return (
              <div key={group.id} className="border-b border-slate-800/60 pb-2.5">
                <button
                  onClick={() => toggleSection(group.id)}
                  aria-expanded={expanded}
                  aria-controls={listId}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition ${
                    hasActive ? 'bg-slate-800/40 text-sky-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-[10px] font-bold tracking-wider uppercase truncate">{group.title}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 font-mono">{group.items.length}</span>
                    {expanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {expanded && (
                  <ul id={listId} className="mt-1 space-y-0.5 pl-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isItemActive(item, currentView);
                      const isFav = favorites.includes(item.view);
                      const badge = badgeFor(item);

                      return (
                        <li key={item.view} className="group flex items-center gap-1">
                          <button
                            onClick={() => select(item.view)}
                            aria-current={active ? 'page' : undefined}
                            className={`flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg font-medium transition text-left ${
                              active
                                ? 'bg-sky-600 text-white shadow-xs font-semibold'
                                : item.highlight
                                ? 'bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-800/30'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Icon
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  active ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400'
                                }`}
                              />
                              <span className="truncate text-[11.5px]">{item.label}</span>
                            </span>
                            {badge && (
                              <span
                                className={`text-[9.5px] px-1.5 rounded font-semibold shrink-0 ${
                                  active ? 'bg-sky-700 text-white' : item.highlight ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {badge}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={(e) => toggleFavorite(item.view, e)}
                            className={`p-1 transition ${
                              isFav
                                ? 'text-amber-400 opacity-100'
                                : 'opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-500 hover:text-amber-400'
                            }`}
                            title={isFav ? 'Remover dos favoritos' : 'Fixar nos favoritos'}
                            aria-label={isFav ? `Remover ${item.label} dos favoritos` : `Fixar ${item.label} nos favoritos`}
                            aria-pressed={isFav}
                          >
                            <Star className={`w-3 h-3 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          {filteredGroups.length === 0 && (
            <p className="px-2 py-4 text-center text-[11px] text-slate-500">Nenhum item do menu corresponde ao filtro.</p>
          )}
        </nav>

        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between bg-slate-950/40">
          <p className="font-semibold text-slate-300">Endemias GOV</p>
          <span className="px-2 py-0.5 rounded text-[9px] bg-slate-800 text-emerald-400 font-mono font-bold border border-slate-700">
            PWA
          </span>
        </div>
      </aside>
    </>
  );
};
