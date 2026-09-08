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
  KeyRound,
  UserCheck,
  Shield,
  PieChart,
  Boxes,
  TrendingUp,
  Upload,
  ShieldCheck,
  AlertTriangle,
  FlaskConical,
  QrCode,
  ClipboardList,
  Server,
  GraduationCap,
  MessageSquare,
  Globe,
  Radio,
  Target,
  BarChart2,
} from 'lucide-react';
import { UserRole } from '../types';
import { can } from '../services/rbac';

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
    requiredPermission?: string;
    allowedRoles?: UserRole[];
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
      title: 'OPERACIONAL DE CAMPO',
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
        { id: 'vector_control', label: 'Controle Vetorial', icon: Crosshair, requiredPermission: 'visits.view' },
        { id: 'routes', label: 'Minha Rota Otimizada', icon: Navigation, requiredPermission: 'field_planning.view' },
        { id: 'visits', label: 'Visitas Domiciliares', icon: CheckSquare, requiredPermission: 'visits.view' },
        { id: 'planning', label: 'Planejamento de Campo', icon: Calendar, requiredPermission: 'field_planning.view' },
      ],
    },
    {
      title: 'VIGILÂNCIA & INTELIGÊNCIA',
      items: [
        { id: 'daily_briefing', label: 'Briefing Diário', icon: FileText, highlight: true, badge: 'Matinal', requiredPermission: 'reports.view' },
        { id: 'command_center', label: 'Centro de Comando', icon: Radio, highlight: true, badge: 'Cockpit', requiredPermission: 'dashboard.view' },
        { id: 'dashboard', label: 'Sala de Situação', icon: LayoutDashboard, requiredPermission: 'dashboard.view' },
        { id: 'historical_analysis', label: 'Análise Histórica', icon: BarChart2, requiredPermission: 'dashboard.view' },
        { id: 'entomology_lab', label: 'Laboratório Entomológico', icon: FlaskConical, requiredPermission: 'dashboard.view' },
        { id: 'liraa', label: 'LIRAa / LIA', icon: PieChart, requiredPermission: 'dashboard.view' },
        { id: 'executive', label: 'Painel do Secretário', icon: Crown, requiredPermission: 'reports.view' },
        { id: 'tv_mode', label: 'Central TV / Telão', icon: Monitor, requiredPermission: 'dashboard.view' },
        { id: 'map', label: 'Mapa Municipal', icon: Map, requiredPermission: 'maps.view' },
        { id: 'risk_engine', label: 'Motor de Risco (0-100)', icon: ShieldAlert, requiredPermission: 'risk_engine.view' },
        { id: 'ai_assistant', label: 'Assistente IA Endemias', icon: Sparkles, requiredPermission: 'ai_assistant.use' },
      ],
    },
    {
      title: 'TERRITÓRIO & CONTROLE',
      items: [
        { id: 'territory', label: 'Território Municipal', icon: MapPin, requiredPermission: 'territory.view' },
        { id: 'properties', label: 'Cadastro de Imóveis', icon: Home, requiredPermission: 'properties.view' },
        { id: 'foci_recurrence', label: 'Focos e Reincidências', icon: Flame, requiredPermission: 'outbreaks.view' },
        { id: 'ovitraps', label: 'Ovitrampas (Ovos)', icon: Layers, requiredPermission: 'ovitraps.view' },
        { id: 'strategic_points', label: 'Pontos Estratégicos (PE)', icon: Crosshair, requiredPermission: 'strategic_points.view' },
        { id: 'special_properties', label: 'Imóveis Especiais (IE)', icon: Building2, requiredPermission: 'special_properties.view' },
      ],
    },
    {
      title: 'EPIDEMIOLOGIA & CIDADÃO',
      items: [
        { id: 'epidemiology', label: 'Bloqueios Epidêmicos', icon: Activity, requiredPermission: 'epidemiology.view' },
        { id: 'complaints', label: 'Portal de Denúncias', icon: AlertCircle, requiredPermission: 'complaints.view' },
        { id: 'public_portal', label: 'Portal Cidadão (Público)', icon: Globe, requiredPermission: 'reports.view' },
        { id: 'referrals', label: 'Encaminhamentos', icon: Send, requiredPermission: 'complaints.view' },
        { id: 'transparency', label: 'Endemias em Números', icon: Eye, requiredPermission: 'reports.view' },
      ],
    },
    {
      title: 'GESTÃO OPERACIONAL & LOGÍSTICA',
      items: [
        { id: 'management_targets', label: 'Metas e Indicadores', icon: Target, requiredPermission: 'reports.view' },
        { id: 'work_orders', label: 'Ordens de Serviço (OS)', icon: ClipboardList, requiredPermission: 'visits.view' },
        { id: 'trainings', label: 'Capacitações & Cursos', icon: GraduationCap, requiredPermission: 'teams.view' },
        { id: 'documents', label: 'Central de Documentos', icon: FileText, requiredPermission: 'reports.view' },
        { id: 'productivity', label: 'Produtividade ACE', icon: TrendingUp, requiredPermission: 'teams.view' },
        { id: 'stock', label: 'Estoque e Insumos', icon: Boxes, requiredPermission: 'teams.view' },
        { id: 'teams', label: 'Equipes & Carga ACE', icon: Users, requiredPermission: 'teams.view' },
        { id: 'supplies', label: 'Insumos & Larvicidas', icon: Package, requiredPermission: 'teams.view' },
        { id: 'equipments', label: 'Equipamentos & UBV', icon: Wrench, requiredPermission: 'teams.view' },
        { id: 'cycles', label: 'Ciclos (LIRAa / LIA)', icon: Clock, requiredPermission: 'cycles.view' },
        { id: 'reports', label: 'Central de Relatórios', icon: FileText, requiredPermission: 'reports.view' },
        { id: 'alerts', label: 'Central de Alertas', icon: Bell, requiredPermission: 'dashboard.view' },
      ],
    },
    {
      title: 'ADMINISTRAÇÃO',
      items: [
        { id: 'admin_users', label: 'Usuários', icon: UserCheck, requiredPermission: 'users.view' },
        { id: 'admin_roles', label: 'Perfis e Permissões', icon: KeyRound, requiredPermission: 'roles.view' },
        { id: 'communication', label: 'Comunicação Operacional', icon: MessageSquare, requiredPermission: 'settings.manage' },
        { id: 'multi_disease', label: 'Módulos de Endemias', icon: Layers, requiredPermission: 'settings.manage' },
        { id: 'labels', label: 'Gerador de Etiquetas (QR)', icon: QrCode, requiredPermission: 'settings.view' },
        { id: 'integrations', label: 'Central de Integrações', icon: Server, requiredPermission: 'settings.manage' },
        { id: 'system_settings', label: 'Central de Configurações', icon: Settings, requiredPermission: 'settings.manage' },
        { id: 'data_import', label: 'Importação de Dados', icon: Upload, requiredPermission: 'settings.manage' },
        { id: 'data_quality', label: 'Qualidade dos Dados', icon: ShieldCheck, requiredPermission: 'settings.view' },
        { id: 'admin_audit', label: 'Auditoria', icon: FileSearch, requiredPermission: 'audit.view' },
        { id: 'system_health', label: 'Saúde do Sistema', icon: HeartPulse, requiredPermission: 'settings.view' },
        { id: 'system_errors', label: 'Logs de Erros', icon: AlertTriangle, allowedRoles: ['SUPER_ADMIN'] },
      ],
    },
  ];

  // Filtragem estrita de segurança visual via can(userRole, permission) e allowedRoles
  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.allowedRoles && !item.allowedRoles.includes(userRole)) return false;
        if (!item.requiredPermission) return true;
        return can(userRole, item.requiredPermission);
      }),
    }))
    .filter((section) => section.items.length > 0);

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
          {filteredSections.map(section => (
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
