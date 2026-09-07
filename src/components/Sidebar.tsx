import React from 'react';
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
  Building2,
  Flame,
  Activity,
  AlertCircle,
  Users,
  Package,
  Wrench,
  Map,
  ShieldAlert,
  Crown,
  Monitor,
  Bell,
  FileText,
  Clock,
  Sparkles,
  Eye,
  Send,
  FileSearch,
  Settings,
  HeartPulse,
  X,
  Star,
} from 'lucide-react';
import { UserRole } from '../types';

export type ViewModule =
  | 'dashboard'
  | 'territory'
  | 'properties'
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
  | 'admin'
  | 'system_health';

interface SidebarProps {
  currentView: ViewModule;
  onSelectView: (view: ViewModule) => void;
  userRole: UserRole;
  isOpen: boolean;
  onClose: () => void;
  pendingSyncCount: number;
}

interface NavSection {
  title: string;
  items: {
    id: ViewModule;
    label: string;
    icon: React.ElementType;
    badge?: string;
    highlight?: boolean;
    allowedRoles?: UserRole[];
    isPrimary?: boolean;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  userRole,
  isOpen,
  onClose,
  pendingSyncCount,
}) => {
  const sections: NavSection[] = [
    {
      title: 'PANORAMA',
      items: [
        { id: 'dashboard', label: 'Sala de Situação', icon: LayoutDashboard, isPrimary: true },
        { id: 'executive', label: 'Painel do Secretário', icon: Crown },
        { id: 'tv_mode', label: 'Central TV / Telão', icon: Monitor },
      ],
    },
    {
      title: 'OPERAÇÃO DE CAMPO',
      items: [
        {
          id: 'ace_pwa',
          label: 'PWA do Agente (ACE)',
          icon: Smartphone,
          badge: pendingSyncCount > 0 ? `${pendingSyncCount} pend.` : 'Mobile',
          highlight: true,
          isPrimary: true,
        },
        { id: 'visits', label: 'Visitas Domiciliares', icon: CheckSquare },
        { id: 'routes', label: 'Minha Rota Otimizada', icon: Navigation },
        { id: 'planning', label: 'Planejamento de Campo', icon: Calendar },
        { id: 'teams', label: 'Equipes & Carga ACE', icon: Users },
      ],
    },
    {
      title: 'TERRITÓRIO & VIGILÂNCIA',
      items: [
        { id: 'properties', label: 'Cadastro de Imóveis', icon: Home, isPrimary: true },
        { id: 'map', label: 'Mapa Municipal', icon: Map },
        { id: 'territory', label: 'Território Municipal', icon: MapPin },
        { id: 'ovitraps', label: 'Ovitrampas (Ovos)', icon: Layers },
        { id: 'strategic_points', label: 'Pontos Estratégicos (PE)', icon: Crosshair },
        { id: 'foci_recurrence', label: 'Focos e Reincidências', icon: Flame },
        { id: 'special_properties', label: 'Imóveis Especiais (IE)', icon: Building2 },
      ],
    },
    {
      title: 'EPIDEMIOLOGIA & CIDADÃO',
      items: [
        { id: 'epidemiology', label: 'Bloqueios Epidêmicos', icon: Activity, isPrimary: true },
        { id: 'complaints', label: 'Portal de Denúncias', icon: AlertCircle },
        { id: 'referrals', label: 'Encaminhamentos', icon: Send },
        { id: 'alerts', label: 'Central de Alertas', icon: Bell },
        { id: 'transparency', label: 'Endemias em Números', icon: Eye },
      ],
    },
    {
      title: 'GESTÃO & SISTEMA',
      items: [
        { id: 'reports', label: 'Central de Relatórios', icon: FileText, isPrimary: true },
        { id: 'supplies', label: 'Insumos & Larvicidas', icon: Package },
        { id: 'equipments', label: 'Equipamentos & UBV', icon: Wrench },
        { id: 'cycles', label: 'Ciclos (LIRAa / LIA)', icon: Clock },
        { id: 'risk_engine', label: 'Motor de Risco (0-100)', icon: ShieldAlert },
        { id: 'ai_assistant', label: 'Assistente IA Endemias', icon: Sparkles },
        { id: 'audit', label: 'Auditoria do Sistema', icon: FileSearch },
        { id: 'admin', label: 'Administração & RBAC', icon: Settings },
        { id: 'system_health', label: 'Saúde do Sistema', icon: HeartPulse },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header in sidebar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 lg:hidden">
          <span className="font-bold text-white text-sm">Navegação — Endemias GOV</span>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 text-xs">
          {sections.map(section => (
            <div key={section.title}>
              <p className="px-3 mb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectView(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition text-left ${
                        isActive
                          ? 'bg-sky-600 text-white shadow-sm'
                          : item.highlight
                          ? 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/40'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                        {item.isPrimary && (
                          <Star className={`w-2.5 h-2.5 flex-shrink-0 fill-amber-400 text-amber-400 ${isActive ? 'fill-white text-white' : ''}`} />
                        )}
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          isActive
                            ? 'bg-sky-700 text-white'
                            : item.highlight
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-300">Endemias GOV v1.0</p>
            <p className="text-[10px]">Controle de Vetores & Arboviroses</p>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] bg-slate-800 text-emerald-400 font-mono font-bold">
            POSTGRES / PWA
          </span>
        </div>
      </aside>
    </>
  );
};
