/**
 * MAPA CENTRAL DE ROTAS DO ENDEMIAS GOV
 *
 * Fonte única da correspondência URL <-> tela interna. App (renderização e
 * guarda de acesso), Sidebar (menu), hubs com abas, busca global e testes
 * consomem este arquivo — nenhuma outra parte do código deve manter uma
 * tabela paralela de URLs.
 *
 * Regras:
 *  - Toda rota interna declara `permission` e/ou `roles`. A checagem é feita
 *    por `canAccessRoute`, que falha de forma FECHADA (erro => sem acesso).
 *  - `aliases` mantém URLs antigas funcionando; ao abrir um alias a aplicação
 *    troca a URL pela canônica (history.replaceState).
 *  - Módulos removidos têm redirecionamento em LEGACY_REDIRECTS para um
 *    destino válido.
 *
 * Arquivo puro (sem React) para poder ser importado pela suíte de testes.
 */
import type { UserRole } from '../types';
import { getDefaultRouteForRole } from '../services/authService';

export type ViewModule =
  // Início
  | 'dashboard'
  // Campo ACE
  | 'ace_pwa'
  | 'visits'
  | 'routes'
  | 'planning'
  | 'field_pendencies'
  | 'supervisor_mobile'
  // Território
  | 'properties'
  | 'map'
  | 'territory'
  | 'territory_neighborhoods'
  | 'territory_sectors'
  | 'territory_blocks'
  | 'territory_microareas'
  | 'geographic_reconnaissance'
  | 'strategic_points'
  | 'special_properties'
  // Vigilância
  | 'vector_control'
  | 'chemical_operations'
  | 'liraa'
  | 'cycles'
  | 'ovitraps'
  | 'entomology_lab'
  | 'epidemiology'
  | 'foci_recurrence'
  // Gestão Operacional
  | 'teams'
  | 'productivity'
  | 'complaints'
  | 'referrals'
  | 'stock'
  | 'supplies'
  | 'equipments'
  | 'work_orders'
  // Relatórios
  | 'reports'
  | 'documents'
  // Administração
  | 'admin_users'
  | 'admin_roles'
  | 'admin_audit'
  | 'system_settings'
  | 'multi_disease'
  | 'integrations'
  | 'system_health'
  | 'data_quality'
  | 'database_health'
  | 'system_errors'
  | 'labels'
  | 'data_import'
  | 'communication'
  // Telas mantidas fora do menu principal (acesso por URL / busca global)
  | 'command_center'
  | 'executive'
  | 'risk_engine'
  | 'historical_analysis'
  | 'alerts'
  | 'transparency';

export interface RouteDefinition {
  view: ViewModule;
  /** URL canônica */
  path: string;
  /** URLs antigas aceitas (redirecionadas para `path`) */
  aliases?: string[];
  title: string;
  /** Permissão exigida (aceita slug legado em inglês; ver rbac.normalizePermission) */
  permission?: string;
  /** Papéis exigidos (além da permissão, quando ambos definidos) */
  roles?: UserRole[];
  /** Exibir na busca global (Ctrl+K) */
  searchable?: boolean;
}

const SUPERVISION_ROLES: UserRole[] = ['FIELD_SUPERVISOR', 'ENDEMIAS_COORDINATOR', 'MUNICIPAL_ADMIN', 'SUPER_ADMIN'];
const PLATFORM_ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'MUNICIPAL_ADMIN'];

export const ROUTES: RouteDefinition[] = [
  // 1. Início
  { view: 'dashboard', path: '/dashboard', aliases: ['/sala-de-situacao'], title: 'Sala de Situação', permission: 'dashboard.view', searchable: true },

  // 2. Campo ACE
  { view: 'ace_pwa', path: '/ace-pwa', aliases: ['/ace_pwa', '/campo'], title: 'PWA do Agente (ACE)', permission: 'visits.create', searchable: true },
  { view: 'visits', path: '/visitas', aliases: ['/visits', '/operacional/visitas'], title: 'Visitas Domiciliares', permission: 'visits.view', searchable: true },
  { view: 'routes', path: '/rotas', aliases: ['/routes'], title: 'Minha Rota', permission: 'field_planning.view', searchable: true },
  { view: 'planning', path: '/planejamento', aliases: ['/planning'], title: 'Planejamento de Campo', permission: 'field_planning.view', searchable: true },
  { view: 'field_pendencies', path: '/operacional/pendencias', aliases: ['/field_pendencies', '/pendencias'], title: 'Pendências de Campo', permission: 'visits.view', searchable: true },
  { view: 'supervisor_mobile', path: '/supervisor', aliases: ['/supervisor_mobile'], title: 'Supervisão de Campo', roles: SUPERVISION_ROLES, searchable: true },

  // 3. Território
  { view: 'properties', path: '/imoveis', aliases: ['/properties'], title: 'Imóveis', permission: 'properties.view', searchable: true },
  { view: 'map', path: '/mapa', aliases: ['/map'], title: 'Mapa Municipal', permission: 'maps.view', searchable: true },
  { view: 'territory', path: '/territorio', aliases: ['/territory'], title: 'Bairros e Setores', permission: 'territory.view', searchable: true },
  { view: 'territory_neighborhoods', path: '/territorio/bairros', title: 'Bairros', permission: 'territory.view' },
  { view: 'territory_sectors', path: '/territorio/setores', title: 'Setores Censitários', permission: 'territory.view' },
  { view: 'territory_blocks', path: '/territorio/quadras', aliases: ['/blocks'], title: 'Quadras', permission: 'territory.view' },
  { view: 'territory_microareas', path: '/territorio/microareas', title: 'Microáreas', permission: 'territory.view' },
  { view: 'geographic_reconnaissance', path: '/territorio/rg', aliases: ['/geographic_reconnaissance'], title: 'Reconhecimento Geográfico', permission: 'territory.view', searchable: true },
  { view: 'strategic_points', path: '/pontos-estrategicos', aliases: ['/strategic_points'], title: 'Pontos Estratégicos', permission: 'strategic_points.view', searchable: true },
  { view: 'special_properties', path: '/imoveis-especiais', aliases: ['/special_properties'], title: 'Imóveis Especiais', permission: 'special_properties.view', searchable: true },

  // 4. Vigilância
  { view: 'vector_control', path: '/controle-vetorial', aliases: ['/vector_control'], title: 'Controle Vetorial', permission: 'visits.view', searchable: true },
  { view: 'chemical_operations', path: '/controle-vetorial/operacoes', aliases: ['/chemical_operations'], title: 'Operações Químicas & UBV', permission: 'visits.view', searchable: true },
  { view: 'liraa', path: '/liraa', title: 'LIRAa / LIA', permission: 'dashboard.view', searchable: true },
  { view: 'cycles', path: '/ciclos', aliases: ['/cycles'], title: 'Ciclos', permission: 'cycles.view', searchable: true },
  { view: 'ovitraps', path: '/ovitrampas', aliases: ['/ovitraps'], title: 'Ovitrampas', permission: 'ovitraps.view', searchable: true },
  { view: 'entomology_lab', path: '/laboratorio-entomologico', aliases: ['/entomology_lab'], title: 'Laboratório Entomológico', permission: 'ovitraps.view', searchable: true },
  { view: 'epidemiology', path: '/epidemiologia', aliases: ['/epidemiology'], title: 'Epidemiologia e Bloqueios', permission: 'epidemiology.view', searchable: true },
  { view: 'foci_recurrence', path: '/focos', aliases: ['/foci_recurrence'], title: 'Focos e Reincidências', permission: 'outbreaks.view', searchable: true },

  // 5. Gestão Operacional
  { view: 'teams', path: '/equipes', aliases: ['/teams'], title: 'Equipes', permission: 'teams.view', searchable: true },
  { view: 'productivity', path: '/produtividade', aliases: ['/productivity'], title: 'Produtividade ACE', permission: 'teams.view', searchable: true },
  { view: 'complaints', path: '/denuncias', aliases: ['/complaints'], title: 'Denúncias', permission: 'complaints.view', searchable: true },
  { view: 'referrals', path: '/encaminhamentos', aliases: ['/referrals'], title: 'Encaminhamentos', permission: 'complaints.view', searchable: true },
  { view: 'stock', path: '/estoque', aliases: ['/stock'], title: 'Estoque', permission: 'teams.view', searchable: true },
  { view: 'supplies', path: '/insumos', aliases: ['/supplies'], title: 'Insumos Químicos', permission: 'teams.view', searchable: true },
  { view: 'equipments', path: '/equipamentos', aliases: ['/equipments'], title: 'Equipamentos', permission: 'teams.view', searchable: true },
  { view: 'work_orders', path: '/ordens-servico', aliases: ['/work_orders'], title: 'Ordens de Serviço', permission: 'visits.view', searchable: true },

  // 6. Relatórios
  { view: 'reports', path: '/relatorios', aliases: ['/reports'], title: 'Relatórios', permission: 'reports.view', searchable: true },
  { view: 'documents', path: '/documentos', aliases: ['/documents'], title: 'Documentos', permission: 'reports.view', searchable: true },

  // 7. Administração
  { view: 'admin_users', path: '/admin/usuarios', aliases: ['/admin_users'], title: 'Usuários', permission: 'users.view', searchable: true },
  { view: 'admin_roles', path: '/admin/perfis-permissoes', aliases: ['/admin_roles'], title: 'Perfis e Permissões', permission: 'roles.view', searchable: true },
  { view: 'admin_audit', path: '/admin/auditoria', aliases: ['/admin_audit', '/audit'], title: 'Auditoria', permission: 'audit.view', searchable: true },
  { view: 'system_settings', path: '/admin/configuracoes', aliases: ['/system_settings', '/admin'], title: 'Configurações', permission: 'settings.manage', searchable: true },
  { view: 'multi_disease', path: '/admin/endemias', aliases: ['/multi_disease'], title: 'Módulos de Endemias', permission: 'settings.manage' },
  { view: 'integrations', path: '/admin/integracoes', aliases: ['/integrations'], title: 'Integrações', permission: 'settings.manage', searchable: true },
  { view: 'system_health', path: '/admin/sistema', aliases: ['/system_health'], title: 'Saúde do Sistema', permission: 'settings.view', searchable: true },
  { view: 'data_quality', path: '/admin/qualidade-dados', aliases: ['/data_quality'], title: 'Qualidade dos Dados', permission: 'settings.view' },
  { view: 'database_health', path: '/admin/database-health', aliases: ['/database_health'], title: 'Integridade do Sistema', permission: 'settings.view', roles: PLATFORM_ADMIN_ROLES },
  { view: 'system_errors', path: '/admin/sistema/erros', aliases: ['/system_errors'], title: 'Logs de Erros', permission: 'settings.view', roles: ['SUPER_ADMIN'] },
  { view: 'labels', path: '/admin/etiquetas', aliases: ['/labels'], title: 'Etiquetas QR', permission: 'settings.view', searchable: true },
  { view: 'data_import', path: '/admin/importacao', aliases: ['/data_import'], title: 'Importação de Dados', permission: 'settings.manage', searchable: true },
  { view: 'communication', path: '/admin/comunicacao', aliases: ['/communication'], title: 'Comunicação Operacional', permission: 'settings.manage', searchable: true },

  // Mantidas fora do menu principal
  { view: 'command_center', path: '/centro-comando', aliases: ['/command_center'], title: 'Centro de Comando', permission: 'dashboard.view', searchable: true },
  { view: 'executive', path: '/secretario', aliases: ['/executive'], title: 'Painel do Secretário', permission: 'reports.view', searchable: true },
  { view: 'risk_engine', path: '/risco', aliases: ['/risk_engine'], title: 'Motor de Risco', permission: 'risk_engine.view', searchable: true },
  { view: 'historical_analysis', path: '/inteligencia/historico', aliases: ['/historical_analysis'], title: 'Análise Histórica', permission: 'dashboard.view', searchable: true },
  { view: 'alerts', path: '/alertas', aliases: ['/alerts'], title: 'Central de Alertas', permission: 'dashboard.view', searchable: true },
  { view: 'transparency', path: '/transparencia', aliases: ['/transparency'], title: 'Endemias em Números', permission: 'reports.view', searchable: true },
];

/** Rotas acessíveis sem sessão (autenticação e Portal do Cidadão). */
export const PUBLIC_PATHS = [
  '/login',
  '/esqueci-senha',
  '/redefinir-senha',
  '/primeiro-acesso',
  '/acesso-negado',
  '/publico',
  '/publico/denuncia',
  '/publico/denuncia/acompanhar',
] as const;

/** Rotas da conta do usuário (exigem sessão, sem permissão específica). */
export const ACCOUNT_PATHS = ['/minha-conta', '/perfil'] as const;

/** Início: resolvido para a tela inicial do perfil. */
export const HOME_PATH = '/';

/**
 * URLs de módulos removidos ou de telas duplicadas -> destino válido equivalente.
 * `HOME_PATH` leva à tela inicial do perfil.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  // Central TV / Telão (removido)
  '/tv': HOME_PATH,
  '/tv_mode': HOME_PATH,
  // Briefing Diário (removido)
  '/briefing': HOME_PATH,
  '/daily_briefing': HOME_PATH,
  // Assistente IA (removido)
  '/assistente': HOME_PATH,
  '/ai_assistant': HOME_PATH,
  // Capacitações e Cursos (removido) -> Equipes
  '/capacitacoes': '/equipes',
  '/trainings': '/equipes',
  // Metas e Indicadores (página removida) -> Produtividade
  '/metas': '/produtividade',
  '/management_targets': '/produtividade',
  // Portal do Cidadão interno duplicava a rota pública
  '/public_portal': '/publico',
};

// ----------------------------------------------------------------------------
// Índices
// ----------------------------------------------------------------------------
const ROUTE_BY_VIEW = new Map<ViewModule, RouteDefinition>(ROUTES.map((r) => [r.view, r]));
const ROUTE_BY_PATH = new Map<string, RouteDefinition>();
for (const r of ROUTES) {
  ROUTE_BY_PATH.set(r.path, r);
  for (const a of r.aliases || []) ROUTE_BY_PATH.set(a, r);
}

export function isViewModule(value: string): value is ViewModule {
  return ROUTE_BY_VIEW.has(value as ViewModule);
}

export function getRoute(view: ViewModule): RouteDefinition {
  const route = ROUTE_BY_VIEW.get(view);
  if (!route) throw new Error(`Rota não registrada para a tela "${view}"`);
  return route;
}

export function pathForView(view: ViewModule): string {
  return getRoute(view).path;
}

/** Remove query/hash, barra final e decodifica. */
export function normalizePath(pathname: string): string {
  let p = (pathname || '').split('?')[0].split('#')[0].trim();
  try {
    p = decodeURI(p);
  } catch {
    /* mantém o valor original */
  }
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '');
  return p || HOME_PATH;
}

/**
 * Converte um destino de navegação (id de tela ou URL) em URL.
 * Ex.: 'visits' -> '/visitas'; '/liraa' -> '/liraa'.
 */
export function toPath(target: string): string {
  if (isViewModule(target)) return pathForView(target);
  return normalizePath(target);
}

export type RouteResolution =
  | { kind: 'home' }
  | { kind: 'public'; path: string }
  | { kind: 'account'; path: string }
  | { kind: 'view'; route: RouteDefinition; isCanonical: boolean }
  | { kind: 'redirect'; to: string }
  | { kind: 'not_found'; path: string };

export function resolvePath(pathname: string): RouteResolution {
  const path = normalizePath(pathname);
  if (path === HOME_PATH) return { kind: 'home' };
  if ((PUBLIC_PATHS as readonly string[]).includes(path)) return { kind: 'public', path };
  if ((ACCOUNT_PATHS as readonly string[]).includes(path)) return { kind: 'account', path };
  if (LEGACY_REDIRECTS[path]) return { kind: 'redirect', to: LEGACY_REDIRECTS[path] };

  const route = ROUTE_BY_PATH.get(path);
  if (route) return { kind: 'view', route, isCanonical: route.path === path };
  return { kind: 'not_found', path };
}

// ----------------------------------------------------------------------------
// Autorização (fail-closed)
// ----------------------------------------------------------------------------
export interface AccessChecker {
  can: (permission: string) => boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}

/**
 * Verifica acesso a uma rota interna. Qualquer erro na checagem nega o acesso.
 * Rotas sem `permission` nem `roles` são negadas (configuração incompleta).
 */
export function canAccessRoute(route: RouteDefinition | undefined, access: AccessChecker | null | undefined): boolean {
  if (!route || !access) return false;
  if (!route.permission && !route.roles?.length) return false;
  try {
    if (route.permission && access.can(route.permission) !== true) return false;
    if (route.roles?.length && access.hasRole(route.roles) !== true) return false;
    return true;
  } catch {
    return false;
  }
}

export function canAccessView(view: ViewModule, access: AccessChecker | null | undefined): boolean {
  return canAccessRoute(ROUTE_BY_VIEW.get(view), access);
}

/** Ordem de preferência para a tela inicial quando a rota padrão do perfil não está disponível. */
const HOME_FALLBACK_ORDER: ViewModule[] = [
  'dashboard',
  'ace_pwa',
  'visits',
  'territory',
  'properties',
  'strategic_points',
  'complaints',
  'epidemiology',
  'ovitraps',
  'reports',
];

/**
 * Tela inicial do perfil: rota padrão do papel (authService) quando acessível;
 * senão a primeira tela permitida. `null` quando o usuário não tem acesso a nenhuma.
 */
export function getHomeView(role: UserRole | null | undefined, access: AccessChecker | null | undefined): ViewModule | null {
  if (!role || !access) return null;
  const preferred = getDefaultRouteForRole(role);
  if (isViewModule(preferred) && canAccessView(preferred, access)) return preferred;
  const candidates = [...HOME_FALLBACK_ORDER, ...ROUTES.map((r) => r.view)];
  return candidates.find((v) => canAccessView(v, access)) ?? null;
}

// ----------------------------------------------------------------------------
// Hubs com abas: cada aba tem URL própria
// ----------------------------------------------------------------------------
export const HUB_TABS = {
  territory: {
    overview: 'territory',
    neighborhoods: 'territory_neighborhoods',
    sectors: 'territory_sectors',
    blocks: 'territory_blocks',
    microareas: 'territory_microareas',
    strategic_points: 'strategic_points',
    special_properties: 'special_properties',
  },
  vectorControl: { operacoes: 'vector_control', quimicas: 'chemical_operations' },
  ovitraps: { ovos: 'ovitraps', laboratorio: 'entomology_lab' },
  teams: { equipes: 'teams', produtividade: 'productivity' },
  complaints: { denuncias: 'complaints', encaminhamentos: 'referrals' },
  stock: { estoque: 'stock', quimicos: 'supplies' },
  reports: { relatorios: 'reports', documentos: 'documents' },
  systemHealth: { saude: 'system_health', qualidade: 'data_quality', integridade: 'database_health', erros: 'system_errors' },
} as const satisfies Record<string, Record<string, ViewModule>>;

export type HubId = keyof typeof HUB_TABS;
export type HubTab<H extends HubId> = keyof (typeof HUB_TABS)[H] & string;

export function viewForTab<H extends HubId>(hub: H, tab: HubTab<H>): ViewModule {
  return (HUB_TABS[hub] as Record<string, ViewModule>)[tab];
}

export function tabForView<H extends HubId>(hub: H, view: ViewModule): HubTab<H> | undefined {
  const entry = Object.entries(HUB_TABS[hub] as Record<string, ViewModule>).find(([, v]) => v === view);
  return entry?.[0] as HubTab<H> | undefined;
}

/** Abas de um hub que o usuário pode abrir (mesma regra das rotas). */
export function accessibleTabs<H extends HubId>(hub: H, access: AccessChecker | null | undefined): HubTab<H>[] {
  return (Object.keys(HUB_TABS[hub]) as HubTab<H>[]).filter((tab) => canAccessView(viewForTab(hub, tab), access));
}
