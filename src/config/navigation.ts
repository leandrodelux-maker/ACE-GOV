/**
 * NAVEGAÇÃO DO MVP INSTITUCIONAL — 5 grupos operacionais.
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
  Layers,
  Target,
  PieChart,
  Activity,
  AlertCircle,
  FileText,
  UserCheck,
  FileSearch,
  Settings,
  Briefcase,
  Bell,
  Bug,
  Syringe,
  PawPrint,
  ShieldAlert,
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
    title: 'Campo',
    items: [
      { view: 'ace_pwa', label: 'Trabalho de campo', icon: Smartphone, highlight: true },
      { view: 'routes', label: 'Minha Rota', icon: NavigationIcon },
      { view: 'visits', label: 'Visitas', icon: CheckSquare },
      { view: 'field_pendencies', label: 'Pendências', icon: Clock },
      { view: 'planning', label: 'Planejamento', icon: Calendar },
      { view: 'supervisor_mobile', label: 'Supervisão', icon: Users },
      { view: 'liraa_field', label: 'Coleta LIRAa/LIA', icon: Bug },
      { view: 'zoo_vaccination', label: 'Vacinação antirrábica', icon: Syringe },
      { view: 'complaints', label: 'Demandas do cidadão', icon: AlertCircle, activeViews: ['referrals'] },
    ],
  },
  {
    id: 'territorio',
    title: 'Território',
    items: [
      { view: 'properties', label: 'Imóveis', icon: Home },
      {
        view: 'territory',
        label: 'Bairros e setores',
        icon: MapPin,
        activeViews: [
          'territory_neighborhoods',
          'territory_sectors',
          'territory_blocks',
          'territory_microareas',
          'strategic_points',
          'special_properties',
        ],
      },
      { view: 'map', label: 'Mapa do município', icon: MapIcon },
      { view: 'geographic_reconnaissance', label: 'Reconhecimento geográfico', icon: ScanSearch },
    ],
  },
  {
    id: 'vigilancia',
    title: 'Vigilância',
    items: [
      // Módulo CORE: mantido em destaque (CORE_ARCHITECTURE_RULES.md)
      { view: 'ovitraps', label: 'Ovitrampas e laboratório', icon: Layers, highlight: true, activeViews: ['entomology_lab'] },
      { view: 'vector_control', label: 'Controle Vetorial', icon: Target, activeViews: ['chemical_operations'] },
      { view: 'liraa', label: 'LIRAa / LIA', icon: PieChart, activeViews: ['liraa_surveys', 'liraa_field', 'liraa_lab', 'liraa_reports'] },
      { view: 'epidemiology', label: 'Epidemiologia', icon: Activity },
    ],
  },
  {
    id: 'zoonoses',
    title: 'Zoonoses',
    items: [
      {
        view: 'zoo_dashboard',
        label: 'Vacinação antirrábica',
        icon: PawPrint,
        activeViews: ['zoo_campaigns', 'zoo_vaccination', 'zoo_animals', 'zoo_stock', 'zoo_active_search', 'zoo_reports'],
      },
      { view: 'zoo_rabies', label: 'Vigilância da raiva', icon: ShieldAlert },
    ],
  },
  {
    id: 'relatorios',
    title: 'Resultados',
    items: [{ view: 'reports', label: 'Relatórios', icon: FileText, activeViews: ['documents'] }],
  },
];

/** Administração é utilitária e não compete com o trabalho diário. */
export const UTILITY_NAV_ITEMS: NavItem[] = [
  { view: 'admin_users', label: 'Usuários', icon: UserCheck },
  { view: 'system_settings', label: 'Configurações', icon: Settings, activeViews: ['multi_disease', 'labels', 'data_import'] },
  { view: 'admin_audit', label: 'Auditoria', icon: FileSearch },
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
