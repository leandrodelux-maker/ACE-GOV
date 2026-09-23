import { UserRole } from '../types';
import { supabase } from './supabaseClient';

/**
 * RBAC do Endemias GOV — ESPELHO do catálogo canônico do banco.
 *
 * Nota: a permissão 'ia_assistente.use' continua existindo no banco (migrations
 * 07 e 24, não alteradas), mas saiu deste espelho junto com o módulo Assistente IA,
 * que foi removido da aplicação.
 *
 * A FONTE DA VERDADE é o PostgreSQL (tabelas `permissions` / `role_permissions`,
 * migration 20260907000024). As permissões efetivas de uma sessão vêm SEMPRE do
 * servidor (RPC `get_auth_bootstrap` → `session.permissions`) e são reforçadas
 * por RLS. Este arquivo existe apenas para:
 *   - tipagem e rótulos de UI;
 *   - preview de permissões ao SIMULAR um perfil (impersonation de admin);
 *   - seed de referência para a matriz RBAC.
 */

export interface PermissionDefinition {
  slug: string;
  module: string;
  action: 'view' | 'create' | 'update' | 'archive' | 'delete' | 'manage' | 'disable' | 'export' | 'use' | 'approve' | 'close' | 'install' | 'collect' | 'results' | 'analyze';
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

// ----------------------------------------------------------------------------
// Catálogo canônico (PT) — espelha migration 24
// ----------------------------------------------------------------------------
export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  { slug: 'painel.view', module: 'painel', action: 'view', label: 'Visualizar Painel', description: 'Sala de situação e indicadores' },
  { slug: 'mapas.view', module: 'mapas', action: 'view', label: 'Visualizar Mapas', description: 'Camadas espaciais e mapas de calor' },

  { slug: 'usuarios.view', module: 'usuarios', action: 'view', label: 'Visualizar Usuários', description: 'Listar usuários municipais' },
  { slug: 'usuarios.create', module: 'usuarios', action: 'create', label: 'Criar Usuários', description: 'Cadastrar novos servidores' },
  { slug: 'usuarios.update', module: 'usuarios', action: 'update', label: 'Editar Usuários', description: 'Alterar dados de usuários' },
  { slug: 'usuarios.disable', module: 'usuarios', action: 'disable', label: 'Desativar Usuários', description: 'Desativar acesso sem exclusão física' },

  { slug: 'perfis.view', module: 'perfis', action: 'view', label: 'Visualizar Perfis', description: 'Consultar matriz de controle de acesso' },
  { slug: 'perfis.manage', module: 'perfis', action: 'manage', label: 'Gerenciar Perfis', description: 'Configurar permissões de papéis' },

  { slug: 'territorio.view', module: 'territorio', action: 'view', label: 'Visualizar Território', description: 'Consultar zonas, bairros e setores' },
  { slug: 'territorio.manage', module: 'territorio', action: 'manage', label: 'Gerenciar Território', description: 'Cadastrar e editar território' },

  { slug: 'imoveis.view', module: 'imoveis', action: 'view', label: 'Visualizar Imóveis', description: 'Consultar imóveis e histórico sanitário' },
  { slug: 'imoveis.create', module: 'imoveis', action: 'create', label: 'Criar Imóvel', description: 'Cadastrar novos imóveis' },
  { slug: 'imoveis.update', module: 'imoveis', action: 'update', label: 'Editar Imóvel', description: 'Atualizar dados e responsável' },
  { slug: 'imoveis.archive', module: 'imoveis', action: 'archive', label: 'Arquivar Imóvel', description: 'Arquivar/soft delete de imóvel' },

  { slug: 'visitas.view', module: 'visitas', action: 'view', label: 'Visualizar Visitas', description: 'Consultar vistorias e depósitos' },
  { slug: 'visitas.create', module: 'visitas', action: 'create', label: 'Registrar Visitas', description: 'Executar vistorias domiciliares' },
  { slug: 'visitas.update', module: 'visitas', action: 'update', label: 'Editar Visitas', description: 'Retificar vistorias cadastradas' },
  { slug: 'visitas.delete', module: 'visitas', action: 'delete', label: 'Excluir Visitas', description: 'Cancelar registros de vistoria' },

  { slug: 'equipes.view', module: 'equipes', action: 'view', label: 'Visualizar Equipes', description: 'Listar equipes e supervisores' },
  { slug: 'equipes.manage', module: 'equipes', action: 'manage', label: 'Gerenciar Equipes', description: 'Criar e alocar equipes' },

  { slug: 'agentes.view', module: 'agentes', action: 'view', label: 'Visualizar Agentes', description: 'Listar agentes de endemias' },
  { slug: 'agentes.manage', module: 'agentes', action: 'manage', label: 'Gerenciar Agentes', description: 'Vincular agentes a microáreas e equipes' },

  { slug: 'ciclos.view', module: 'ciclos', action: 'view', label: 'Visualizar Ciclos', description: 'Acompanhar metas do LIRAa/LIA' },
  { slug: 'ciclos.manage', module: 'ciclos', action: 'manage', label: 'Gerenciar Ciclos', description: 'Abrir, configurar e gerir ciclos' },
  { slug: 'ciclos.close', module: 'ciclos', action: 'close', label: 'Encerrar Ciclos', description: 'Consolidar e encerrar ciclo epidemiológico' },
  { slug: 'ciclos.approve', module: 'ciclos', action: 'approve', label: 'Aprovar Ciclos', description: 'Aprovar consolidação de ciclo' },

  { slug: 'focos.view', module: 'focos', action: 'view', label: 'Visualizar Focos/Surtos', description: 'Acompanhar surtos e reincidências' },
  { slug: 'focos.manage', module: 'focos', action: 'manage', label: 'Gerenciar Surtos', description: 'Criar operações de contenção' },

  { slug: 'ovitrampas.view', module: 'ovitrampas', action: 'view', label: 'Visualizar Ovitrampas', description: 'Consultar armadilhas e índices IPO/IDO' },
  { slug: 'ovitrampas.create', module: 'ovitrampas', action: 'create', label: 'Cadastrar Ovitrampas', description: 'Cadastrar novos pontos sentinela' },
  { slug: 'ovitrampas.update', module: 'ovitrampas', action: 'update', label: 'Editar Ovitrampas', description: 'Atualizar dados de armadilhas' },
  { slug: 'ovitrampas.install', module: 'ovitrampas', action: 'install', label: 'Instalar Ovitrampas', description: 'Registrar instalação de armadilhas' },
  { slug: 'ovitrampas.collect', module: 'ovitrampas', action: 'collect', label: 'Coletar Ovitrampas', description: 'Registrar coletas em campo' },
  { slug: 'ovitrampas.results', module: 'ovitrampas', action: 'results', label: 'Resultados Entomológicos', description: 'Informar contagem de ovos e laudos' },
  { slug: 'ovitrampas.analyze', module: 'ovitrampas', action: 'analyze', label: 'Analisar Ovitrampas', description: 'Indicadores avançados, tendências e coberturas' },
  { slug: 'ovitrampas.export', module: 'ovitrampas', action: 'export', label: 'Exportar Ovitrampas', description: 'Exportar relatórios e boletins' },
  { slug: 'ovitrampas.manage', module: 'ovitrampas', action: 'manage', label: 'Gerenciar Rede de Ovitrampas', description: 'Gestão completa da rede sentinela' },

  { slug: 'pontos_estrategicos.view', module: 'pontos_estrategicos', action: 'view', label: 'Visualizar PEs', description: 'Consultar ferros-velhos, cemitérios e borracharias' },
  { slug: 'pontos_estrategicos.manage', module: 'pontos_estrategicos', action: 'manage', label: 'Gerenciar PEs', description: 'Cadastrar e registrar vistorias quinzenais' },

  { slug: 'imoveis_especiais.view', module: 'imoveis_especiais', action: 'view', label: 'Visualizar IEs', description: 'Consultar escolas, hospitais e órgãos públicos' },
  { slug: 'imoveis_especiais.manage', module: 'imoveis_especiais', action: 'manage', label: 'Gerenciar IEs', description: 'Programar vistorias em imóveis especiais' },

  { slug: 'denuncias.view', module: 'denuncias', action: 'view', label: 'Visualizar Denúncias', description: 'Consultar protocolo de denúncias públicas' },
  { slug: 'denuncias.manage', module: 'denuncias', action: 'manage', label: 'Gerenciar Denúncias', description: 'Triagem, despacho e atendimento de denúncias' },

  { slug: 'epidemiologia.view', module: 'epidemiologia', action: 'view', label: 'Visualizar Epidemiologia', description: 'Acessar notificações e boletins Sinan' },
  { slug: 'epidemiologia.manage', module: 'epidemiologia', action: 'manage', label: 'Gerenciar Bloqueios', description: 'Definir raios de bloqueio focal e nebulização' },

  { slug: 'planejamento.view', module: 'planejamento', action: 'view', label: 'Visualizar Planejamento', description: 'Acompanhar itinerários e ordens de serviço' },
  { slug: 'planejamento.manage', module: 'planejamento', action: 'manage', label: 'Gerenciar Rotas', description: 'Gerar e distribuir rotas para os ACEs' },

  { slug: 'relatorios.view', module: 'relatorios', action: 'view', label: 'Visualizar Relatórios', description: 'Consultar boletins e indicadores oficiais' },
  { slug: 'relatorios.export', module: 'relatorios', action: 'export', label: 'Exportar Relatórios', description: 'Exportar dados em Excel, PDF e CSV' },

  { slug: 'motor_risco.view', module: 'motor_risco', action: 'view', label: 'Visualizar Motor de Risco', description: 'Consultar escores preditivos de risco' },
  { slug: 'motor_risco.manage', module: 'motor_risco', action: 'manage', label: 'Gerenciar Pesos de Risco', description: 'Ajustar pesos do algoritmo de risco' },

  { slug: 'configuracoes.view', module: 'configuracoes', action: 'view', label: 'Visualizar Configurações', description: 'Acesso a parâmetros gerais' },
  { slug: 'configuracoes.manage', module: 'configuracoes', action: 'manage', label: 'Administrar Sistema', description: 'Controle de sistema, integrações e endemias' },

  { slug: 'auditoria.view', module: 'auditoria', action: 'view', label: 'Visualizar Auditoria', description: 'Acessar logs de conformidade SUS/LGPD' },
];

const ALL_PERMISSION_SLUGS = PERMISSIONS_CATALOG.map((p) => p.slug);

// ----------------------------------------------------------------------------
// Registro de papéis (espelha migration 24 role_permissions)
// ----------------------------------------------------------------------------
export const ROLES_REGISTRY: Record<UserRole, RoleDefinition> = {
  SUPER_ADMIN: {
    slug: 'SUPER_ADMIN',
    name: 'Super Administrador',
    description: 'Acesso total ao sistema e todos os municípios',
    badgeColor: 'bg-red-700 text-white',
    defaultPermissions: [...ALL_PERMISSION_SLUGS],
  },
  MUNICIPAL_ADMIN: {
    slug: 'MUNICIPAL_ADMIN',
    name: 'Administrador Municipal',
    description: 'Administra todo o Endemias GOV do município',
    badgeColor: 'bg-indigo-700 text-white',
    defaultPermissions: [...ALL_PERMISSION_SLUGS],
  },
  ENDEMIAS_COORDINATOR: {
    slug: 'ENDEMIAS_COORDINATOR',
    name: 'Coordenador de Endemias',
    description: 'Acesso operacional completo ao município',
    badgeColor: 'bg-blue-600 text-white',
    defaultPermissions: ALL_PERMISSION_SLUGS.filter((s) => s !== 'configuracoes.manage'),
  },
  FIELD_SUPERVISOR: {
    slug: 'FIELD_SUPERVISOR',
    name: 'Supervisor de Campo',
    description: 'Gerencia equipes, agentes, planejamento e operações',
    badgeColor: 'bg-cyan-700 text-white',
    defaultPermissions: [
      'painel.view', 'mapas.view', 'territorio.view', 'territorio.manage',
      'imoveis.view', 'imoveis.create', 'imoveis.update',
      'visitas.view', 'visitas.create', 'visitas.update',
      'equipes.view', 'equipes.manage', 'agentes.view', 'agentes.manage',
      'ciclos.view', 'focos.view',
      'ovitrampas.view', 'ovitrampas.create', 'ovitrampas.update', 'ovitrampas.install',
      'ovitrampas.collect', 'ovitrampas.results', 'ovitrampas.analyze', 'ovitrampas.export', 'ovitrampas.manage',
      'pontos_estrategicos.view', 'pontos_estrategicos.manage',
      'imoveis_especiais.view', 'imoveis_especiais.manage',
      'denuncias.view', 'denuncias.manage',
      'planejamento.view', 'planejamento.manage',
      'relatorios.view', 'motor_risco.view',
    ],
  },
  ACE: {
    slug: 'ACE',
    name: 'Agente de Combate às Endemias (ACE)',
    description: 'Ferramentas de campo e dados próprios',
    badgeColor: 'bg-emerald-600 text-white',
    defaultPermissions: [
      'imoveis.view', 'imoveis.create', 'imoveis.update',
      'visitas.view', 'visitas.create', 'visitas.update',
      'territorio.view', 'ciclos.view', 'planejamento.view',
      'ovitrampas.view', 'ovitrampas.install', 'ovitrampas.collect', 'ovitrampas.update',
      'denuncias.view',
    ],
  },
  EPIDEMIOLOGY_AGENT: {
    slug: 'EPIDEMIOLOGY_AGENT',
    name: 'Vigilância Epidemiológica',
    description: 'Epidemiologia, casos, mapas, focos e inteligência',
    badgeColor: 'bg-rose-600 text-white',
    defaultPermissions: [
      'painel.view', 'mapas.view', 'epidemiologia.view', 'epidemiologia.manage',
      'focos.view', 'focos.manage',
      'ovitrampas.view', 'ovitrampas.results', 'ovitrampas.analyze', 'ovitrampas.export',
      'visitas.view', 'imoveis.view', 'territorio.view', 'ciclos.view',
      'relatorios.view', 'relatorios.export', 'motor_risco.view',
    ],
  },
  HEALTH_SECRETARY: {
    slug: 'HEALTH_SECRETARY',
    name: 'Secretário / Gestor de Saúde',
    description: 'Painéis gerenciais, indicadores, mapas e relatórios',
    badgeColor: 'bg-purple-600 text-white',
    defaultPermissions: [
      'painel.view', 'mapas.view', 'relatorios.view', 'relatorios.export',
      'epidemiologia.view', 'ciclos.view', 'territorio.view', 'imoveis.view', 'visitas.view',
      'equipes.view', 'ovitrampas.view', 'ovitrampas.analyze', 'ovitrampas.export',
      'pontos_estrategicos.view', 'imoveis_especiais.view', 'motor_risco.view',
      'auditoria.view', 'configuracoes.view',
    ],
  },
  AUDITOR_VIEWER: {
    slug: 'AUDITOR_VIEWER',
    name: 'Consulta / Auditor SUS',
    description: 'Somente leitura conforme módulos autorizados',
    badgeColor: 'bg-slate-700 text-white',
    defaultPermissions: [
      'painel.view', 'mapas.view', 'relatorios.view', 'relatorios.export', 'auditoria.view',
      'visitas.view', 'imoveis.view', 'territorio.view', 'ciclos.view',
      'pontos_estrategicos.view', 'imoveis_especiais.view', 'configuracoes.view',
    ],
  },
  SANITARY_AGENT: {
    slug: 'SANITARY_AGENT',
    name: 'Vigilância Sanitária',
    description: 'Fiscalização de PE/IE, autuações e denúncias',
    badgeColor: 'bg-amber-600 text-white',
    defaultPermissions: [
      'pontos_estrategicos.view', 'pontos_estrategicos.manage',
      'imoveis_especiais.view', 'imoveis_especiais.manage',
      'denuncias.view', 'denuncias.manage',
      'territorio.view', 'imoveis.view', 'visitas.view', 'relatorios.view',
    ],
  },
  PRIMARY_CARE_ACS: {
    slug: 'PRIMARY_CARE_ACS',
    name: 'Atenção Primária / ACS',
    description: 'Integração territorial e busca ativa na comunidade',
    badgeColor: 'bg-teal-600 text-white',
    defaultPermissions: [
      'territorio.view', 'imoveis.view', 'denuncias.view', 'visitas.view',
    ],
  },
};

// ----------------------------------------------------------------------------
// Compatibilidade: slugs legados (inglês) -> canônicos (português)
// Permite que call sites ainda não migrados continuem funcionando.
// ----------------------------------------------------------------------------
export const LEGACY_EN_TO_PT: Record<string, string> = {
  'dashboard.view': 'painel.view',
  'maps.view': 'mapas.view',
  'users.view': 'usuarios.view',
  'users.create': 'usuarios.create',
  'users.update': 'usuarios.update',
  'users.disable': 'usuarios.disable',
  'roles.view': 'perfis.view',
  'roles.manage': 'perfis.manage',
  'territory.view': 'territorio.view',
  'territory.create': 'territorio.manage',
  'territory.update': 'territorio.manage',
  'territory.delete': 'territorio.manage',
  'properties.view': 'imoveis.view',
  'properties.create': 'imoveis.create',
  'properties.update': 'imoveis.update',
  'properties.delete': 'imoveis.archive',
  'visits.view': 'visitas.view',
  'visits.create': 'visitas.create',
  'visits.update': 'visitas.update',
  'visits.delete': 'visitas.delete',
  'teams.view': 'equipes.view',
  'teams.manage': 'equipes.manage',
  'agents.view': 'agentes.view',
  'agents.manage': 'agentes.manage',
  'cycles.view': 'ciclos.view',
  'cycles.manage': 'ciclos.manage',
  'cycles.close': 'ciclos.close',
  'cycles.approve': 'ciclos.approve',
  'outbreaks.view': 'focos.view',
  'outbreaks.manage': 'focos.manage',
  'ovitraps.view': 'ovitrampas.view',
  'ovitraps.create': 'ovitrampas.create',
  'ovitraps.update': 'ovitrampas.update',
  'ovitraps.install': 'ovitrampas.install',
  'ovitraps.collect': 'ovitrampas.collect',
  'ovitraps.results': 'ovitrampas.results',
  'ovitraps.analyze': 'ovitrampas.analyze',
  'ovitraps.export': 'ovitrampas.export',
  'ovitraps.manage': 'ovitrampas.manage',
  'strategic_points.view': 'pontos_estrategicos.view',
  'strategic_points.manage': 'pontos_estrategicos.manage',
  'special_properties.view': 'imoveis_especiais.view',
  'special_properties.manage': 'imoveis_especiais.manage',
  'complaints.view': 'denuncias.view',
  'complaints.manage': 'denuncias.manage',
  'epidemiology.view': 'epidemiologia.view',
  'epidemiology.manage': 'epidemiologia.manage',
  'field_planning.view': 'planejamento.view',
  'field_planning.manage': 'planejamento.manage',
  'reports.view': 'relatorios.view',
  'reports.export': 'relatorios.export',
  'risk_engine.view': 'motor_risco.view',
  'risk_engine.manage': 'motor_risco.manage',
  'settings.view': 'configuracoes.view',
  'settings.manage': 'configuracoes.manage',
  'audit.view': 'auditoria.view',
};

export function normalizePermission(permission: string): string {
  return LEGACY_EN_TO_PT[permission] || permission;
}

const PLATFORM_ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'MUNICIPAL_ADMIN'];

/**
 * Verificação de permissão para conveniência de UI (a autorização real é RLS).
 *
 * @param userRole            papel efetivo (real ou simulado)
 * @param permission          slug (aceita legado em inglês)
 * @param explicitPermissions lista vinda do servidor (session.permissions).
 *                            Quando ausente, usa o default do papel (preview).
 */
export function can(
  userRole?: UserRole,
  permission?: string,
  explicitPermissions?: string[] | null
): boolean {
  if (!userRole || !permission) return false;

  if (PLATFORM_ADMIN_ROLES.includes(userRole)) return true;

  const slug = normalizePermission(permission);

  if (explicitPermissions && explicitPermissions.length > 0) {
    return explicitPermissions.map(normalizePermission).includes(slug);
  }

  // Sem lista do servidor: cai no catálogo de referência do papel.
  return (ROLES_REGISTRY[userRole]?.defaultPermissions || []).includes(slug);
}

export function hasRole(currentRole?: UserRole, requiredRoles?: UserRole | UserRole[]): boolean {
  if (!currentRole || !requiredRoles) return false;
  if (currentRole === 'SUPER_ADMIN') return true;
  if (Array.isArray(requiredRoles)) return requiredRoles.includes(currentRole);
  return currentRole === requiredRoles;
}

// ----------------------------------------------------------------------------
// Persistência da matriz RBAC no banco (substitui o antigo localStorage)
// ----------------------------------------------------------------------------

/** Lê as permissões efetivas de um papel a partir do banco. */
export async function fetchRolePermissions(roleSlug: UserRole): Promise<string[]> {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('permissions(slug), roles!inner(slug)')
    .eq('roles.slug', roleSlug);

  if (error || !data) {
    return ROLES_REGISTRY[roleSlug]?.defaultPermissions || [];
  }
  return data.map((r: any) => r.permissions?.slug).filter(Boolean);
}

/** Persiste a matriz de um papel via RPC (exige perfis.manage no servidor). */
export async function saveRolePermissions(roleSlug: UserRole, permissions: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_role_permissions', {
    p_role_slug: roleSlug,
    p_perms: permissions.map(normalizePermission),
  });
  if (error) throw new Error(error.message);
}
