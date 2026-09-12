import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Home,
  CheckSquare,
  Smartphone,
  Navigation,
  Calendar,
  Layers,
  Crosshair,
  Flame,
  Activity,
  AlertCircle,
  Users,
  Wrench,
  Map as MapIcon,
  ShieldAlert,
  Crown,
  Monitor,
  Bell,
  FileText,
  Clock,
  Sparkles,
  Eye,
  FileSearch,
  Settings,
  HeartPulse,
  X,
  KeyRound,
  UserCheck,
  Shield,
  PieChart,
  Boxes,
  Upload,
  QrCode,
  ClipboardList,
  Server,
  GraduationCap,
  MessageSquare,
  Globe,
  Radio,
  Target,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Star,
  Search,
} from 'lucide-react';
import { UserRole } from '../types';

export type ViewModule =
  | 'dashboard'
  | 'daily_briefing'
  | 'command_center'
  | 'historical_analysis'
  | 'management_targets'
  | 'liraa'
  | 'entomology_lab'
  | 'supervisor_mobile'
  | 'work_orders'
  | 'documents'
  | 'labels'
  | 'integrations'
  | 'stock'
  | 'vector_control'
  | 'productivity'
  | 'data_import'
  | 'data_quality'
  | 'system_settings'
  | 'system_errors'
  | 'territory'
  | 'geographic_reconnaissance'
  | 'properties'
  | 'field_pendencies'
  | 'chemical_operations'
  | 'visits'
  | 'ace_pwa'
  | 'routes'
  | 'planning'
  | 'ovitraps'
  | 'strategic_points'
  | 'special_properties'
  | 'foci_recurrence'
  | 'epidemiology'
  | 'complaints'
  | 'teams'
  | 'trainings'
  | 'supplies'
  | 'equipments'
  | 'map'
  | 'risk_engine'
  | 'executive'
  | 'tv_mode'
  | 'alerts'
  | 'reports'
  | 'cycles'
  | 'ai_assistant'
  | 'transparency'
  | 'referrals'
  | 'audit'
  | 'communication'
  | 'multi_disease'
  | 'public_portal'
  | 'admin'
  | 'admin_users'
  | 'admin_roles'
  | 'admin_audit'
  | 'system_health'
  | 'database_health';

interface SidebarProps {
  currentView: ViewModule;
  onSelectView: (view: ViewModule) => void;
  userRole: UserRole;
  can: (permission: string) => boolean;
  isOpen: boolean;
  onClose: () => void;
  pendingSyncCount: number;
}

interface NavItem {
  id: ViewModule;
  label: string;
  icon: React.ElementType;
  badge?: string;
  highlight?: boolean;
  requiredPermission?: string;
  allowedRoles?: UserRole[];
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  userRole,
  can,
  isOpen,
  onClose,
  pendingSyncCount,
}) => {
  // 12 Seções Oficiais da Arquitetura Operacional
  const sections: NavSection[] = [
    {
      id: 'dashboards',
      title: '1. PAINÉIS & SALA DE SITUAÇÃO',
      items: [
        { id: 'dashboard', label: 'Sala de Situação', icon: LayoutDashboard, requiredPermission: 'dashboard.view' },
        { id: 'command_center', label: 'Centro de Comando', icon: Radio, highlight: true, badge: 'Cockpit', requiredPermission: 'dashboard.view' },
        { id: 'daily_briefing', label: 'Briefing Diário', icon: FileText, badge: 'Matinal', requiredPermission: 'reports.view' },
        { id: 'executive', label: 'Painel do Secretário', icon: Crown, requiredPermission: 'reports.view' },
        { id: 'tv_mode', label: 'Central TV / Telão', icon: Monitor, requiredPermission: 'dashboard.view' },
        { id: 'ai_assistant', label: 'Assistente IA Endemias', icon: Sparkles, requiredPermission: 'ai_assistant.use' },
      ],
    },
    {
      id: 'territory_hub',
      title: '2. CENTRAL DE TERRITÓRIO',
      items: [
        { id: 'territory', label: 'Central de Território', icon: MapPin, highlight: true, badge: 'Hub', requiredPermission: 'territory.view' },
        { id: 'properties', label: 'Cadastro de Imóveis', icon: Home, requiredPermission: 'properties.view' },
        { id: 'geographic_reconnaissance', label: 'Reconhecimento Geográfico (RG)', icon: MapIcon, requiredPermission: 'territory.view' },
        { id: 'map', label: 'Mapa Municipal', icon: MapIcon, requiredPermission: 'maps.view' },
        { id: 'foci_recurrence', label: 'Focos e Reincidências', icon: Flame, requiredPermission: 'outbreaks.view' },
      ],
    },
    {
      id: 'field_ops',
      title: '3. OPERAÇÕES DE CAMPO',
      items: [
        {
          id: 'ace_pwa',
          label: 'PWA do Agente (ACE)',
          icon: Smartphone,
          badge: pendingSyncCount > 0 ? `${pendingSyncCount} pend.` : 'Mobile',
          highlight: true,
          requiredPermission: 'visits.create',
        },
        {
          id: 'supervisor_mobile',
          label: 'Supervisor Mobile',
          icon: Users,
          badge: 'Campo',
          allowedRoles: ['FIELD_SUPERVISOR', 'ENDEMIAS_COORDINATOR', 'MUNICIPAL_ADMIN', 'SUPER_ADMIN'],
        },
        { id: 'visits', label: 'Visitas Domiciliares', icon: CheckSquare, requiredPermission: 'visits.view' },
        { id: 'field_pendencies', label: 'Pendências de Campo', icon: Clock, badge: 'Resgate', highlight: true, requiredPermission: 'visits.view' },
        { id: 'routes', label: 'Minha Rota Otimizada', icon: Navigation, requiredPermission: 'field_planning.view' },
        { id: 'planning', label: 'Planejamento de Campo', icon: Calendar, requiredPermission: 'field_planning.view' },
      ],
    },
    {
      id: 'vector_control_section',
      title: '4. CONTROLE VETORIAL',
      items: [
        { id: 'vector_control', label: 'Controle Vetorial', icon: Crosshair, requiredPermission: 'visits.view' },
        { id: 'chemical_operations', label: 'Operações Químicas & UBV', icon: Flame, requiredPermission: 'visits.view' },
      ],
    },
    {
      id: 'entomology',
      title: '5. VIGILÂNCIA ENTOMOLÓGICA',
      items: [
        { id: 'ovitraps', label: 'Ovitrampas & Laboratório', icon: Layers, highlight: true, badge: 'Hub', requiredPermission: 'ovitraps.view' },
        { id: 'liraa', label: 'LIRAa / LIA', icon: PieChart, requiredPermission: 'dashboard.view' },
        { id: 'cycles', label: 'Ciclos (LIRAa / LIA)', icon: Clock, requiredPermission: 'cycles.view' },
      ],
    },
    {
      id: 'epidemiology_section',
      title: '6. VIGILÂNCIA EPIDEMIOLÓGICA',
      items: [
        { id: 'epidemiology', label: 'Bloqueios Epidêmicos', icon: Activity, requiredPermission: 'epidemiology.view' },
        { id: 'risk_engine', label: 'Motor de Risco (0-100)', icon: ShieldAlert, requiredPermission: 'risk_engine.view' },
        { id: 'historical_analysis', label: 'Análise Histórica', icon: BarChart2, requiredPermission: 'dashboard.view' },
      ],
    },
    {
      id: 'teams_productivity',
      title: '7. EQUIPES & PRODUTIVIDADE',
      items: [
        { id: 'teams', label: 'Equipes & Produtividade', icon: Users, highlight: true, badge: 'Hub', requiredPermission: 'teams.view' },
        { id: 'trainings', label: 'Capacitações & Cursos', icon: GraduationCap, requiredPermission: 'teams.view' },
        { id: 'management_targets', label: 'Metas e Indicadores', icon: Target, requiredPermission: 'reports.view' },
      ],
    },
    {
      id: 'logistics_supplies',
      title: '8. INSUMOS & EQUIPAMENTOS',
      items: [
        { id: 'stock', label: 'Estoque & Insumos', icon: Boxes, highlight: true, badge: 'Hub', requiredPermission: 'teams.view' },
        { id: 'equipments', label: 'Equipamentos & UBV', icon: Wrench, requiredPermission: 'teams.view' },
      ],
    },
    {
      id: 'citizen_ombudsman',
      title: '9. OUVIDORIA & CIDADÃO',
      items: [
        { id: 'complaints', label: 'Denúncias & Encaminhamentos', icon: AlertCircle, highlight: true, badge: 'Hub', requiredPermission: 'complaints.view' },
        { id: 'public_portal', label: 'Portal Cidadão (Público)', icon: Globe, requiredPermission: 'reports.view' },
        { id: 'transparency', label: 'Endemias em Números', icon: Eye, requiredPermission: 'reports.view' },
      ],
    },
    {
      id: 'reports_documents',
      title: '10. RELATÓRIOS & DOCUMENTOS',
      items: [
        { id: 'reports', label: 'Relatórios & Documentos', icon: FileText, highlight: true, badge: 'Hub', requiredPermission: 'reports.view' },
        { id: 'work_orders', label: 'Ordens de Serviço (OS)', icon: ClipboardList, requiredPermission: 'visits.view' },
        { id: 'alerts', label: 'Central de Alertas', icon: Bell, requiredPermission: 'dashboard.view' },
      ],
    },
    {
      id: 'settings_integrations',
      title: '11. CONFIGURAÇÕES & INTEGRAÇÕES',
      items: [
        { id: 'system_settings', label: 'Central de Configurações', icon: Settings, highlight: true, badge: 'Hub', requiredPermission: 'settings.manage' },
        { id: 'integrations', label: 'Central de Integrações', icon: Server, requiredPermission: 'settings.manage' },
        { id: 'labels', label: 'Gerador de Etiquetas (QR)', icon: QrCode, requiredPermission: 'settings.view' },
        { id: 'data_import', label: 'Importação de Dados', icon: Upload, requiredPermission: 'settings.manage' },
        { id: 'communication', label: 'Comunicação Operacional', icon: MessageSquare, requiredPermission: 'settings.manage' },
      ],
    },
    {
      id: 'admin_audit_section',
      title: '12. ADMINISTRAÇÃO & AUDITORIA',
      items: [
        { id: 'admin_users', label: 'Usuários', icon: UserCheck, requiredPermission: 'users.view' },
        { id: 'admin_roles', label: 'Perfis e Permissões', icon: KeyRound, requiredPermission: 'roles.view' },
        { id: 'admin_audit', label: 'Auditoria', icon: FileSearch, requiredPermission: 'audit.view' },
        { id: 'system_health', label: 'Saúde do Sistema', icon: HeartPulse, highlight: true, badge: 'Hub', requiredPermission: 'settings.view' },
      ],
    },
  ];

  // Estado de favoritos fixáveis blindado
  const [favorites, setFavorites] = useState<ViewModule[]>(() => {
    try {
      const saved = localStorage.getItem('endemias_favorite_views');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return ['dashboard', 'territory', 'properties', 'ace_pwa'];
  });

  // Estado de itens recentes blindado
  const [recents, setRecents] = useState<ViewModule[]>(() => {
    try {
      const saved = localStorage.getItem('endemias_recent_views');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Mini filtro de pesquisa no menu
  const [menuFilter, setMenuFilter] = useState('');

  // Estado de seções colapsadas (accordion)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('endemias_sidebar_open_sections');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      }
    } catch {}
    // Padrão: abrir seções operacionais chave
    return {
      dashboards: true,
      territory_hub: true,
      field_ops: true,
    };
  });

  // Salvar favoritos no localStorage
  const toggleFavorite = (viewId: ViewModule, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const list = Array.isArray(prev) ? prev : [];
      const updated = list.includes(viewId) ? list.filter(id => id !== viewId) : [...list, viewId];
      try {
        localStorage.setItem('endemias_favorite_views', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Atualizar recentes quando a visualização mudar
  useEffect(() => {
    if (!currentView) return;
    setRecents(prev => {
      const list = Array.isArray(prev) ? prev : [];
      const filtered = list.filter(id => id !== currentView);
      const updated = [currentView, ...filtered].slice(0, 4);
      try {
        localStorage.setItem('endemias_recent_views', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Auto-expandir a seção correspondente à rota atual se estiver colapsada
    const parentSection = sections.find(s => s.items.some(i => i.id === currentView));
    if (parentSection && (!openSections || !openSections[parentSection.id])) {
      setOpenSections(prev => {
        const next = { ...(prev || {}), [parentSection.id]: true };
        try {
          localStorage.setItem('endemias_sidebar_open_sections', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [currentView]);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => {
      const next = { ...(prev || {}), [sectionId]: !(prev && prev[sectionId]) };
      try {
        localStorage.setItem('endemias_sidebar_open_sections', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Filtragem de segurança visual RBAC 100% segura contra undefined
  const filterItem = (item?: NavItem | null) => {
    if (!item) return false;
    if (item.allowedRoles && (!userRole || !item.allowedRoles.includes(userRole))) return false;
    if (!item.requiredPermission) return true;
    try {
      return typeof can === 'function' ? can(item.requiredPermission) : true;
    } catch {
      return true;
    }
  };

  // Dicionário rápido de todos os itens disponíveis
  const allItemsDict = useMemo(() => {
    const dict: Partial<Record<ViewModule, NavItem>> = {};
    sections.forEach(s => s.items.forEach(i => { dict[i.id] = i; }));
    return dict;
  }, []);

  // Seções filtradas por RBAC e texto de busca
  const filteredSections = useMemo(() => {
    const term = menuFilter.toLowerCase().trim();
    return sections
      .map(section => {
        const allowedItems = section.items.filter(item => filterItem(item));
        const matchedItems = term
          ? allowedItems.filter(item => item.label.toLowerCase().includes(term) || section.title.toLowerCase().includes(term))
          : allowedItems;
        return {
          ...section,
          items: matchedItems,
        };
      })
      .filter(section => section.items.length > 0);
  }, [sections, menuFilter, userRole]);

  // Lista de itens favoritos filtrados por permissão
  const favoriteItems = useMemo(() => {
    const list = Array.isArray(favorites) ? favorites : [];
    return list
      .map(id => allItemsDict[id])
      .filter((item): item is NavItem => Boolean(item && filterItem(item)));
  }, [favorites, allItemsDict, userRole]);

  // Lista de recentes filtrados por permissão
  const recentItems = useMemo(() => {
    const list = Array.isArray(recents) ? recents : [];
    return list
      .map(id => allItemsDict[id])
      .filter((item): item is NavItem => Boolean(item && filterItem(item) && item.id !== currentView));
  }, [recents, allItemsDict, userRole, currentView]);

  return (
    <>
      {/* Backdrop para mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Container da Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabeçalho Mobile */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-800 lg:hidden">
          <span className="font-bold text-white text-sm">Navegação — Endemias GOV</span>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mini Filtro de Menu */}
        <div className="px-3 pt-3 pb-2 border-b border-slate-800/80">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={menuFilter}
              onChange={e => setMenuFilter(e.target.value)}
              placeholder="Filtrar menu rápido..."
              className="w-full pl-8 pr-7 py-1 text-[11px] bg-slate-800/70 border border-slate-700/70 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
            />
            {menuFilter && (
              <button
                onClick={() => setMenuFilter('')}
                className="absolute right-2 text-slate-400 hover:text-slate-200 text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Lista de Navegação com Scroll */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 text-xs select-none">
          {/* SEÇÃO FAVORITOS (Se houver e sem busca ativa) */}
          {!menuFilter && favoriteItems.length > 0 && (
            <div className="bg-slate-800/30 rounded-xl p-2 border border-slate-800/60">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[10px] font-bold tracking-wider text-amber-400 uppercase flex items-center gap-1.5">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  FAVORITOS FIXADOS
                </span>
                <span className="text-[9px] text-slate-400">{favoriteItems.length}</span>
              </div>
              <div className="space-y-0.5">
                {favoriteItems.map(item => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={`fav-${item.id}`}
                      onClick={() => {
                        onSelectView(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium transition text-left group ${
                        isActive
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-amber-400'}`} />
                        <span className="truncate text-[11.5px]">{item.label}</span>
                      </div>
                      <span
                        onClick={(e) => toggleFavorite(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-amber-400 transition"
                        title="Desafixar dos favoritos"
                      >
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SEÇÃO RECENTES (Se houver e sem busca ativa) */}
          {!menuFilter && recentItems.length > 0 && (
            <div className="px-1">
              <span className="text-[9.5px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1 mb-1">
                <Clock className="w-2.5 h-2.5 text-slate-400" />
                RECENTES
              </span>
              <div className="flex flex-wrap gap-1">
                {recentItems.map(item => (
                  <button
                    key={`rec-${item.id}`}
                    onClick={() => {
                      onSelectView(item.id);
                      onClose();
                    }}
                    className="px-2 py-0.5 rounded-md text-[10.5px] bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition truncate max-w-[130px]"
                    title={item.label}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 12 SEÇÕES TEMÁTICAS COM ACCORDION */}
          {filteredSections.map(section => {
            const isOpen = menuFilter ? true : !!openSections[section.id];
            const hasActiveItem = section.items.some(i => i.id === currentView);

            return (
              <div key={section.id} className="border-b border-slate-800/60 pb-2.5">
                {/* Header do Accordion */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition ${
                    hasActiveItem ? 'bg-slate-800/40 text-sky-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-[10px] font-bold tracking-wider uppercase truncate">
                    {section.title}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 font-mono">
                      {section.items.length}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Itens do Accordion */}
                {isOpen && (
                  <div className="mt-1 space-y-0.5 pl-1">
                    {section.items.map(item => {
                      const Icon = item.icon;
                      const isActive = currentView === item.id;
                      const isFav = favorites.includes(item.id);

                      return (
                        <div
                          key={item.id}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium transition text-left cursor-pointer ${
                            isActive
                              ? 'bg-sky-600 text-white shadow-xs font-semibold'
                              : item.highlight
                              ? 'bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-800/30'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                          onClick={() => {
                            onSelectView(item.id);
                            onClose();
                          }}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isActive ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400'
                              }`}
                            />
                            <span className="truncate text-[11.5px]">{item.label}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.badge && (
                              <span
                                className={`text-[9.5px] px-1.5 py-0.2 rounded font-semibold ${
                                  isActive
                                    ? 'bg-sky-700 text-white'
                                    : item.highlight
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                            <button
                              onClick={(e) => toggleFavorite(item.id, e)}
                              className={`p-0.5 transition ${
                                isFav
                                  ? 'text-amber-400 opacity-100'
                                  : 'opacity-0 group-hover:opacity-100 text-slate-500 hover:text-amber-400'
                              }`}
                              title={isFav ? 'Remover dos favoritos' : 'Fixar nos favoritos'}
                            >
                              <Star className={`w-3 h-3 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Rodapé com Status */}
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between bg-slate-950/40">
          <div>
            <p className="font-semibold text-slate-300">Endemias GOV v2.0</p>
            <p className="text-[10px] text-slate-400">12 Módulos Integrados SUS</p>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] bg-slate-800 text-emerald-400 font-mono font-bold border border-slate-700">
            POSTGRES / PWA
          </span>
        </div>
      </aside>
    </>
  );
};
