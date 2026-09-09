/**
 * CONFIGURAÇÃO CENTRAL DE MÓDULOS CORE DO ENDEMIAS GOV
 * 
 * DIRETRIZ ARQUITETURAL INEGOCIÁVEL:
 * Os módulos listados em CORE_MODULES são pilares estruturais do sistema.
 * Nenhuma refatoração futura de menu, rotas, RBAC, PWA, dashboard, Sala de Situação
 * ou banco de dados pode remover, desativar ou ocultar esses módulos sem substituição explícita.
 * 
 * O módulo 'ovitraps' (Vigilância Entomológica de Ovos) é formalmente um CORE MODULE.
 * Não depende de feature flags experimentais.
 */

export const CORE_MODULES = [
  'territory',
  'properties',
  'visits',
  'ovitraps',
] as const;

export type CoreModule = (typeof CORE_MODULES)[number];

export interface CoreModuleMetadata {
  id: CoreModule;
  title: string;
  description: string;
  canonicalRoute: string;
  alternateRoutes?: string[];
  requiredPermission: string;
  criticality: 'CORE_ESSENTIAL';
  isExperimental: false;
  databaseTables: string[];
}

export const CORE_MODULE_DEFINITIONS: Record<CoreModule, CoreModuleMetadata> = {
  territory: {
    id: 'territory',
    title: 'Território Municipal',
    description: 'Gestão de zonas, bairros, setores censitários, microáreas e quadras',
    canonicalRoute: '/territorio',
    alternateRoutes: ['/territorio/rg', '/territory'],
    requiredPermission: 'territory.view',
    criticality: 'CORE_ESSENTIAL',
    isExperimental: false,
    databaseTables: ['zones', 'neighborhoods', 'sectors', 'microareas', 'blocks'],
  },
  properties: {
    id: 'properties',
    title: 'Cadastro de Imóveis',
    description: 'Base cadastral imobiliária de domicílios, comércios e terrenos',
    canonicalRoute: '/imoveis',
    alternateRoutes: ['/properties'],
    requiredPermission: 'properties.view',
    criticality: 'CORE_ESSENTIAL',
    isExperimental: false,
    databaseTables: ['properties'],
  },
  visits: {
    id: 'visits',
    title: 'Visitas Domiciliares',
    description: 'Execução de vistorias sanitárias, depósitos inspecionados e tratamento químico/mecânico',
    canonicalRoute: '/visitas',
    alternateRoutes: ['/visits', '/operacional/visitas'],
    requiredPermission: 'visits.view',
    criticality: 'CORE_ESSENTIAL',
    isExperimental: false,
    databaseTables: ['visits', 'visit_deposits', 'visit_actions', 'breeding_sites'],
  },
  ovitraps: {
    id: 'ovitraps',
    title: 'Vigilância Entomológica de Ovitrampas',
    description: 'Rede sentinela de armadilhas para monitoramento da densidade de fêmeas e ovos de Aedes aegypti (IPO/IDO)',
    canonicalRoute: '/ovitrampas',
    alternateRoutes: ['/ovitraps'],
    requiredPermission: 'ovitraps.view',
    criticality: 'CORE_ESSENTIAL',
    isExperimental: false,
    databaseTables: ['ovitraps', 'ovitrap_installations', 'ovitrap_collections', 'ovitrap_results'],
  },
};

/**
 * Validador em tempo de execução para assegurar que um módulo não seja ocultado
 */
export function isCoreModule(moduleId: string): boolean {
  return CORE_MODULES.includes(moduleId as CoreModule);
}
