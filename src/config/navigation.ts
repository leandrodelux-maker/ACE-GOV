/**
 * MENU PRINCIPAL (Sidebar) — 7 grupos.
 *
 * Cada item aponta para uma rota de `routes.ts`; a visibilidade usa a mesma
 * checagem de acesso das rotas (`canAccessView`). Itens que representam um hub
 * com abas declaram `activeViews` para ficarem destacados em qualquer aba.
 */
import type React from 'react';
import {
  LayoutDashboard,
  Smartphone,
  CheckSquare,
  Navigation as NavigationIcon,
  Calendar,
  Clock,
  Users,
  Home,
  Map as MapIcon,
  MapPin,
  ScanSearch,
  Crosshair,
  Building2,
  Layers,
  Target,
  PieChart,
  RefreshCcw,
  Activity,
  Flame,
  TrendingUp,
  AlertCircle,
  Boxes,
  Wrench,
  ClipboardList,
  FileText,
  UserCheck,
  KeyRound,
  FileSearch,
  Settings,
  Server,
  HeartPulse,
  Briefcase,
  Bell,
  Gauge,
  LineChart,
} from 'lucide-react';
import type { UserRole } from '../types';
import { AccessChecker, ViewModule, canAccessView } from './routes';

export interface NavItem {
  view: ViewModule;
  label: string;
  icon: React.ElementType;
  /** Outras telas (abas do mesmo hub) que mantêm este item ativo */
  activeViews?: ViewModule[];
  highlight?: boolean;
  badge?: string;
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'inicio',
    title: 'Início',
    items: [
      { view: 'dashboard', label: 'Sala de Situação', icon: LayoutDashboard },
      { view: 'executive', label: 'Painel do Gestor', icon: Briefcase },
      { view: 'alerts', label: 'Central de Alertas', icon: Bell },
    ],
  },
  {
    id: 'campo',
    title: 'Campo ACE',
    items: [
      { view: 'ace_pwa', label: 'PWA do Agente', icon: Smartphone, highlight: true },
      { view: 'visits', label: 'Visitas', icon: CheckSquare },
      { view: 'routes', label: 'Minha Rota', icon: NavigationIcon },
      { view: 'field_pendencies', label: 'Pendências', icon: Clock },
      { view: 'planning', label: 'Planejamento', icon: Calendar },
      { view: 'supervisor_mobile', label: 'Supervisão', icon: Users },
    ],
  },
  {
    id: 'territorio',
    title: 'Território',
    items: [
      { view: 'properties', label: 'Imóveis', icon: Home },
      { view: 'map', label: 'Mapa', icon: MapIcon },
      {
        view: 'territory',
        label: 'Bairros e Setores',
        icon: MapPin,
        activeViews: ['territory_neighborhoods', 'territory_sectors', 'territory_blocks', 'territory_microareas'],
      },
      { view: 'geographic_reconnaissance', label: 'Reconhecimento Geográfico', icon: ScanSearch },
      { view: 'strategic_points', label: 'Pontos Estratégicos', icon: Crosshair },
      { view: 'special_properties', label: 'Imóveis Especiais', icon: Building2 },
    ],
  },
  {
    id: 'vigilancia',
    title: 'Vigilância',
    items: [
      // Módulo CORE: mantido em destaque (CORE_ARCHITECTURE_RULES.md)
      { view: 'ovitraps', label: 'Ovitrampas & Laboratório', icon: Layers, highlight: true, badge: 'Core', activeViews: ['entomology_lab'] },
      { view: 'vector_control', label: 'Controle Vetorial', icon: Target, activeViews: ['chemical_operations'] },
      { view: 'liraa', label: 'LIRAa / LIA', icon: PieChart },
      { view: 'cycles', label: 'Ciclos', icon: RefreshCcw },
      { view: 'epidemiology', label: 'Epidemiologia', icon: Activity },
      { view: 'foci_recurrence', label: 'Focos e Reincidências', icon: Flame },
      { view: 'risk_engine', label: 'Motor de Risco', icon: Gauge },
      { view: 'historical_analysis', label: 'Análise Histórica', icon: LineChart },
    ],
  },
  {
    id: 'gestao',
    title: 'Gestão Operacional',
    items: [
      { view: 'teams', label: 'Equipes & Produtividade', icon: TrendingUp, activeViews: ['productivity'] },
      { view: 'complaints', label: 'Denúncias & Encaminhamentos', icon: AlertCircle, activeViews: ['referrals'] },
      { view: 'stock', label: 'Estoque & Insumos', icon: Boxes, activeViews: ['supplies'] },
      { view: 'equipments', label: 'Equipamentos', icon: Wrench },
      { view: 'work_orders', label: 'Ordens de Serviço', icon: ClipboardList },
    ],
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    items: [{ view: 'reports', label: 'Relatórios & Documentos', icon: FileText, activeViews: ['documents'] }],
  },
  {
    id: 'admin',
    title: 'Administração',
    items: [
      { view: 'admin_users', label: 'Usuários', icon: UserCheck },
      { view: 'admin_roles', label: 'Perfis e Permissões', icon: KeyRound },
      { view: 'admin_audit', label: 'Auditoria', icon: FileSearch },
      { view: 'system_settings', label: 'Configurações', icon: Settings, activeViews: ['multi_disease', 'labels', 'data_import', 'communication'] },
      { view: 'integrations', label: 'Integrações', icon: Server },
      {
        view: 'system_health',
        label: 'Saúde do Sistema',
        icon: HeartPulse,
        activeViews: ['data_quality', 'database_health', 'system_errors'],
      },
    ],
  },
];

/** Perfis cujo trabalho principal é de campo: o grupo "Campo ACE" vem primeiro. */
const FIELD_FIRST_ROLES: UserRole[] = ['ACE', 'FIELD_SUPERVISOR'];

export function isItemActive(item: NavItem, currentView: ViewModule | null): boolean {
  if (!currentView) return false;
  return item.view === currentView || (item.activeViews?.includes(currentView) ?? false);
}

/**
 * Menu visível para o perfil: remove itens sem acesso (fail-closed), remove
 * grupos vazios e, para perfis de campo, coloca "Campo ACE" no topo.
 */
export function getVisibleNavGroups(role: UserRole | null | undefined, access: AccessChecker | null | undefined): NavGroup[] {
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canAccessView(i.view, access)) })).filter(
    (g) => g.items.length > 0
  );
  if (role && FIELD_FIRST_ROLES.includes(role)) {
    const field = groups.find((g) => g.id === 'campo');
    if (field) return [field, ...groups.filter((g) => g !== field)];
  }
  return groups;
}
