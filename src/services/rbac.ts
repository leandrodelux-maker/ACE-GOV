import { UserRole } from '../types';

export interface PermissionDefinition {
  slug: string;
  module: string;
  action: 'view' | 'create' | 'update' | 'delete' | 'manage' | 'disable' | 'export' | 'use';
  label: string;
  description: string;
}

export interface RoleDefinition {
  slug: UserRole;
  name: string;
  description: string;
  badgeColor: string;
  defaultPermissions: string[];
}

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // Dashboard & Sala de Situação
  { slug: 'dashboard.view', module: 'dashboard', action: 'view', label: 'Visualizar Dashboard', description: 'Acesso à sala de situação e indicadores' },
  { slug: 'maps.view', module: 'maps', action: 'view', label: 'Visualizar Mapas', description: 'Camadas espaciais de território e calor' },

  // Usuários
  { slug: 'users.view', module: 'users', action: 'view', label: 'Visualizar Usuários', description: 'Listar usuários cadastrados' },
  { slug: 'users.create', module: 'users', action: 'create', label: 'Criar Usuários', description: 'Cadastrar novos servidores' },
  { slug: 'users.update', module: 'users', action: 'update', label: 'Editar Usuários', description: 'Alterar dados de usuários' },
  { slug: 'users.disable', module: 'users', action: 'disable', label: 'Desativar Usuários', description: 'Desativar acesso sem exclusão física' },

  // Perfis e Permissões (RBAC)
  { slug: 'roles.view', module: 'roles', action: 'view', label: 'Visualizar Perfis', description: 'Consultar matriz de controle de acesso' },
  { slug: 'roles.manage', module: 'roles', action: 'manage', label: 'Gerenciar Perfis', description: 'Configurar permissões de papéis' },

  // Território Municipal
  { slug: 'territory.view', module: 'territory', action: 'view', label: 'Visualizar Território', description: 'Consultar zonas, bairros e setores' },
  { slug: 'territory.create', module: 'territory', action: 'create', label: 'Criar Território', description: 'Cadastrar novos bairros e setores' },
  { slug: 'territory.update', module: 'territory', action: 'update', label: 'Editar Território', description: 'Modificar dados territoriais' },
  { slug: 'territory.delete', module: 'territory', action: 'delete', label: 'Excluir Território', description: 'Remover subdivisões territoriais' },

  // Cadastro de Imóveis
  { slug: 'properties.view', module: 'properties', action: 'view', label: 'Visualizar Imóveis', description: 'Consultar imóveis e histórico sanitário' },
  { slug: 'properties.create', module: 'properties', action: 'create', label: 'Criar Imóvel', description: 'Cadastrar novos imóveis no território' },
  { slug: 'properties.update', module: 'properties', action: 'update', label: 'Editar Imóvel', description: 'Atualizar dados e responsável pelo imóvel' },
  { slug: 'properties.delete', module: 'properties', action: 'delete', label: 'Arquivar Imóvel', description: 'Arquivar/soft delete de imóvel' },

  // Visitas Domiciliares
  { slug: 'visits.view', module: 'visits', action: 'view', label: 'Visualizar Visitas', description: 'Consultar vistorias e depósitos' },
  { slug: 'visits.create', module: 'visits', action: 'create', label: 'Registrar Visitas', description: 'Executar vistorias domiciliares' },
  { slug: 'visits.update', module: 'visits', action: 'update', label: 'Editar Visitas', description: 'Retificar vistorias cadastradas' },
  { slug: 'visits.delete', module: 'visits', action: 'delete', label: 'Excluir Visitas', description: 'Cancelar registros de vistoria' },

  // Equipes
  { slug: 'teams.view', module: 'teams', action: 'view', label: 'Visualizar Equipes', description: 'Listar equipes e supervisores' },
  { slug: 'teams.manage', module: 'teams', action: 'manage', label: 'Gerenciar Equipes', description: 'Criar e alocar equipes' },

  // Agentes
  { slug: 'agents.view', module: 'agents', action: 'view', label: 'Visualizar Agentes', description: 'Listar agentes de endemias' },
  { slug: 'agents.manage', module: 'agents', action: 'manage', label: 'Gerenciar Agentes', description: 'Vincular agentes a microáreas e equipes' },

  // Ciclos de Campo
  { slug: 'cycles.view', module: 'cycles', action: 'view', label: 'Visualizar Ciclos', description: 'Acompanhar metas do LIRAa/LIA' },
  { slug: 'cycles.manage', module: 'cycles', action: 'manage', label: 'Gerenciar Ciclos', description: 'Abrir, configurar e encerrar ciclos' },

  // Focos e Surtos
  { slug: 'outbreaks.view', module: 'outbreaks', action: 'view', label: 'Visualizar Focos/Surtos', description: 'Acompanhar surtos e reincidências' },
  { slug: 'outbreaks.manage', module: 'outbreaks', action: 'manage', label: 'Gerenciar Surtos', description: 'Criar operações de contenção' },

  // Ovitrampas
  { slug: 'ovitraps.view', module: 'ovitraps', action: 'view', label: 'Visualizar Ovitrampas', description: 'Consultar armadilhas e índice IPO' },
  { slug: 'ovitraps.manage', module: 'ovitraps', action: 'manage', label: 'Gerenciar Ovitrampas', description: 'Instalar, coletar e registrar ovos' },

  // Pontos Estratégicos (PE)
  { slug: 'strategic_points.view', module: 'strategic_points', action: 'view', label: 'Visualizar PEs', description: 'Consultar ferros-velhos, cemitérios e borracharias' },
  { slug: 'strategic_points.manage', module: 'strategic_points', action: 'manage', label: 'Gerenciar PEs', description: 'Cadastrar e registrar vistorias quinzenais' },

  // Imóveis Especiais (IE)
  { slug: 'special_properties.view', module: 'special_properties', action: 'view', label: 'Visualizar IEs', description: 'Consultar escolas, hospitais e órgãos públicos' },
  { slug: 'special_properties.manage', module: 'special_properties', action: 'manage', label: 'Gerenciar IEs', description: 'Programar vistorias em imóveis especiais' },

  // Denúncias do Cidadão
  { slug: 'complaints.view', module: 'complaints', action: 'view', label: 'Visualizar Denúncias', description: 'Consultar protocolo de denúncias públicas' },
  { slug: 'complaints.manage', module: 'complaints', action: 'manage', label: 'Gerenciar Denúncias', description: 'Triagem, despacho e atendimento de denúncias' },

  // Epidemiologia e Bloqueios
  { slug: 'epidemiology.view', module: 'epidemiology', action: 'view', label: 'Visualizar Epidemiologia', description: 'Acessar notificações e boletins Sinan' },
  { slug: 'epidemiology.manage', module: 'epidemiology', action: 'manage', label: 'Gerenciar Bloqueios', description: 'Definir raios de bloqueio focal e nebulização' },

  // Planejamento e Rotas
  { slug: 'field_planning.view', module: 'field_planning', action: 'view', label: 'Visualizar Planejamento', description: 'Acompanhar itinerários e ordens de serviço' },
  { slug: 'field_planning.manage', module: 'field_planning', action: 'manage', label: 'Gerenciar Rotas', description: 'Gerar e distribuir rotas para os ACEs' },

  // Relatórios
  { slug: 'reports.view', module: 'reports', action: 'view', label: 'Visualizar Relatórios', description: 'Consultar boletins e indicadores oficiais' },
  { slug: 'reports.export', module: 'reports', action: 'export', label: 'Exportar Relatórios', description: 'Exportar dados em Excel, PDF e CSV' },

  // Motor de Risco & IA
  { slug: 'risk_engine.view', module: 'risk_engine', action: 'view', label: 'Visualizar Motor de Risco', description: 'Consultar escores preditivos de risco' },
  { slug: 'risk_engine.manage', module: 'risk_engine', action: 'manage', label: 'Gerenciar Pesos de Risco', description: 'Ajustar pesos do algoritmo de risco' },
  { slug: 'ai_assistant.use', module: 'ai_assistant', action: 'use', label: 'Usar Assistente IA', description: 'Consultar inteligência artificial SUS' },

  // Configurações & Auditoria
  { slug: 'settings.view', module: 'settings', action: 'view', label: 'Visualizar Configurações', description: 'Consultar dados municipais e parâmetros' },
  { slug: 'settings.manage', module: 'settings', action: 'manage', label: 'Gerenciar Configurações', description: 'Editar parâmetros municipais' },
  { slug: 'audit.view', module: 'audit', action: 'view', label: 'Visualizar Auditoria', description: 'Acessar logs de auditoria e conformidade LGPD' },
];

export const ROLES_REGISTRY: Record<UserRole, RoleDefinition> = {
  SUPER_ADMIN: {
    slug: 'SUPER_ADMIN',
    name: 'Super Administrador',
    description: 'Acesso total ao sistema e todos os municípios',
    badgeColor: 'bg-red-700 text-white',
    defaultPermissions: PERMISSIONS_CATALOG.map((p) => p.slug),
  },
  MUNICIPAL_ADMIN: {
    slug: 'MUNICIPAL_ADMIN',
    name: 'Administrador Municipal',
    description: 'Administra todo o Endemias GOV do município',
    badgeColor: 'bg-indigo-700 text-white',
    defaultPermissions: PERMISSIONS_CATALOG.map((p) => p.slug),
  },
  ENDEMIAS_COORDINATOR: {
    slug: 'ENDEMIAS_COORDINATOR',
    name: 'Coordenador de Endemias',
    description: 'Acesso operacional completo ao município',
    badgeColor: 'bg-blue-600 text-white',
    defaultPermissions: PERMISSIONS_CATALOG.filter((p) => p.slug !== 'settings.manage').map(
      (p) => p.slug
    ),
  },
  FIELD_SUPERVISOR: {
    slug: 'FIELD_SUPERVISOR',
    name: 'Supervisor de Campo',
    description: 'Gerencia equipes, agentes, planejamento e operações',
    badgeColor: 'bg-cyan-700 text-white',
    defaultPermissions: [
      'dashboard.view',
      'maps.view',
      'territory.view',
      'territory.update',
      'properties.view',
      'properties.create',
      'properties.update',
      'visits.view',
      'visits.create',
      'visits.update',
      'teams.view',
      'teams.manage',
      'agents.view',
      'agents.manage',
      'cycles.view',
      'outbreaks.view',
      'ovitraps.view',
      'ovitraps.manage',
      'strategic_points.view',
      'strategic_points.manage',
      'special_properties.view',
      'special_properties.manage',
      'complaints.view',
      'complaints.manage',
      'field_planning.view',
      'field_planning.manage',
      'reports.view',
      'risk_engine.view',
      'ai_assistant.use',
    ],
  },
  ACE: {
    slug: 'ACE',
    name: 'Agente de Combate às Endemias (ACE)',
    description: 'Acesso principalmente às ferramentas de campo e seus próprios dados',
    badgeColor: 'bg-emerald-600 text-white',
    defaultPermissions: [
      'properties.view',
      'properties.create',
      'properties.update',
      'visits.view',
      'visits.create',
      'visits.update',
      'territory.view',
      'cycles.view',
      'field_planning.view',
      'ovitraps.view',
      'ovitraps.manage',
      'complaints.view',
      'ai_assistant.use',
    ],
  },
  EPIDEMIOLOGY_AGENT: {
    slug: 'EPIDEMIOLOGY_AGENT',
    name: 'Vigilância Epidemiológica',
    description: 'Acesso a epidemiologia, casos, mapas, focos e inteligência',
    badgeColor: 'bg-rose-600 text-white',
    defaultPermissions: [
      'dashboard.view',
      'maps.view',
      'epidemiology.view',
      'epidemiology.manage',
      'outbreaks.view',
      'outbreaks.manage',
      'visits.view',
      'properties.view',
      'territory.view',
      'cycles.view',
      'reports.view',
      'reports.export',
      'risk_engine.view',
      'ai_assistant.use',
    ],
  },
  HEALTH_SECRETARY: {
    slug: 'HEALTH_SECRETARY',
    name: 'Secretário / Gestor de Saúde',
    description: 'Acesso aos painéis gerenciais, indicadores, mapas e relatórios (leitura)',
    badgeColor: 'bg-purple-600 text-white',
    defaultPermissions: [
      'dashboard.view',
      'maps.view',
      'reports.view',
      'reports.export',
      'epidemiology.view',
      'cycles.view',
      'territory.view',
      'properties.view',
      'visits.view',
      'teams.view',
      'strategic_points.view',
      'special_properties.view',
      'risk_engine.view',
      'audit.view',
      'settings.view',
      'ai_assistant.use',
    ],
  },
  AUDITOR_VIEWER: {
    slug: 'AUDITOR_VIEWER',
    name: 'Consulta / Auditor SUS',
    description: 'Somente leitura conforme módulos autorizados',
    badgeColor: 'bg-slate-700 text-white',
    defaultPermissions: [
      'dashboard.view',
      'maps.view',
      'reports.view',
      'reports.export',
      'audit.view',
      'visits.view',
      'properties.view',
      'territory.view',
      'cycles.view',
      'strategic_points.view',
      'special_properties.view',
      'settings.view',
    ],
  },
  SANITARY_AGENT: {
    slug: 'SANITARY_AGENT',
    name: 'Vigilância Sanitária',
    description: 'Fiscalização de pontos estratégicos, autuações e PE/IE',
    badgeColor: 'bg-amber-600 text-white',
    defaultPermissions: [
      'strategic_points.view',
      'strategic_points.manage',
      'special_properties.view',
      'special_properties.manage',
      'complaints.view',
      'complaints.manage',
      'territory.view',
      'properties.view',
      'visits.view',
      'reports.view',
    ],
  },
  PRIMARY_CARE_ACS: {
    slug: 'PRIMARY_CARE_ACS',
    name: 'Atenção Primária / ACS',
    description: 'Integração territorial e busca ativa na comunidade',
    badgeColor: 'bg-teal-600 text-white',
    defaultPermissions: [
      'territory.view',
      'properties.view',
      'complaints.view',
      'visits.view',
      'ai_assistant.use',
    ],
  },
};

const CUSTOM_PERMISSIONS_STORAGE_KEY = 'endemias_gov_custom_permissions';

export function getCustomPermissionsForRole(role: UserRole): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PERMISSIONS_STORAGE_KEY);
    if (!raw) return ROLES_REGISTRY[role]?.defaultPermissions || [];
    const parsed = JSON.parse(raw);
    return parsed[role] || ROLES_REGISTRY[role]?.defaultPermissions || [];
  } catch {
    return ROLES_REGISTRY[role]?.defaultPermissions || [];
  }
}

export function saveCustomPermissionsForRole(role: UserRole, permissions: string[]): void {
  try {
    const raw = localStorage.getItem(CUSTOM_PERMISSIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[role] = permissions;
    localStorage.setItem(CUSTOM_PERMISSIONS_STORAGE_KEY, JSON.stringify(parsed));
  } catch (err) {
    console.error('Falha ao salvar permissões de papel:', err);
  }
}

/**
 * Função central de verificação de permissão granular: can(permission)
 */
export function can(
  userRole?: UserRole,
  permission?: string,
  userExplicitPermissions?: string[]
): boolean {
  if (!userRole || !permission) return false;

  // Super Admin e Admin Municipal possuem passe livre total
  if (userRole === 'SUPER_ADMIN' || userRole === 'MUNICIPAL_ADMIN') {
    return true;
  }

  // Se o usuário tiver array explícito vindo do banco/profile
  if (userExplicitPermissions && userExplicitPermissions.includes(permission)) {
    return true;
  }

  // Consulta matriz configurada ou padrão do papel
  const rolePermissions = getCustomPermissionsForRole(userRole);
  return rolePermissions.includes(permission);
}

/**
 * Função central de verificação de papel: hasRole(role)
 */
export function hasRole(currentRole?: UserRole, requiredRoles?: UserRole | UserRole[]): boolean {
  if (!currentRole || !requiredRoles) return false;

  if (currentRole === 'SUPER_ADMIN') return true;

  if (Array.isArray(requiredRoles)) {
    return requiredRoles.includes(currentRole);
  }

  return currentRole === requiredRoles;
}
