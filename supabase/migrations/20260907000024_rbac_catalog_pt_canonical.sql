-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 24: CATÁLOGO RBAC CANÔNICO (PORTUGUÊS)
-- ==============================================================================
-- Redefine `permissions` e `role_permissions` para o conjunto canônico em
-- português. Este catálogo é ESPELHADO em src/services/rbac.ts (PERMISSIONS_CATALOG
-- / ROLES_REGISTRY) - o banco é a fonte de verdade, o TS é só rótulo/tipagem.
--
-- Rollout: SEGURA de aplicar isoladamente. Só mexe em catálogo RBAC; nenhuma
-- policy depende de slugs específicos até a migration 26.
-- ==============================================================================

BEGIN;

-- 1. LIMPAR VÍNCULOS E CATÁLOGO ANTIGO (slugs divergentes das migrations 06/07)
DELETE FROM public.role_permissions;
DELETE FROM public.permissions;

-- 2. CATÁLOGO CANÔNICO DE PERMISSÕES (47 permissões)
INSERT INTO public.permissions (module, action, slug, description) VALUES
  ('painel',              'view',    'painel.view',                 'Acessar a Sala de Situação e painéis de indicadores'),
  ('mapas',               'view',    'mapas.view',                  'Visualizar camadas espaciais e mapas de calor'),

  ('usuarios',            'view',    'usuarios.view',               'Listar usuários municipais'),
  ('usuarios',            'create',  'usuarios.create',             'Cadastrar novos servidores'),
  ('usuarios',            'update',  'usuarios.update',             'Editar dados de usuários'),
  ('usuarios',            'disable', 'usuarios.disable',            'Desativar acesso de usuários'),

  ('perfis',              'view',    'perfis.view',                 'Consultar matriz de perfis e permissões'),
  ('perfis',              'manage',  'perfis.manage',              'Configurar permissões dos papéis (RBAC)'),

  ('territorio',          'view',    'territorio.view',             'Consultar zonas, bairros, setores e quadras'),
  ('territorio',          'manage',  'territorio.manage',           'Cadastrar e editar território'),

  ('imoveis',             'view',    'imoveis.view',                'Consultar imóveis e histórico sanitário'),
  ('imoveis',             'create',  'imoveis.create',              'Cadastrar novos imóveis'),
  ('imoveis',             'update',  'imoveis.update',              'Atualizar dados de imóveis'),
  ('imoveis',             'archive', 'imoveis.archive',             'Arquivar imóvel (soft delete)'),

  ('visitas',             'view',    'visitas.view',                'Consultar vistorias domiciliares'),
  ('visitas',             'create',  'visitas.create',              'Registrar vistorias domiciliares'),
  ('visitas',             'update',  'visitas.update',              'Retificar vistorias'),
  ('visitas',             'delete',  'visitas.delete',              'Cancelar registros de vistoria'),

  ('equipes',             'view',    'equipes.view',                'Listar equipes e supervisores'),
  ('equipes',             'manage',  'equipes.manage',              'Criar e alocar equipes'),

  ('agentes',             'view',    'agentes.view',                'Listar agentes de endemias'),
  ('agentes',             'manage',  'agentes.manage',              'Vincular agentes a microáreas e equipes'),

  ('ciclos',              'view',    'ciclos.view',                 'Acompanhar metas do LIRAa/LIA'),
  ('ciclos',              'manage',  'ciclos.manage',               'Abrir, configurar e gerir ciclos'),
  ('ciclos',              'close',   'ciclos.close',                'Encerrar ciclo epidemiológico'),
  ('ciclos',              'approve', 'ciclos.approve',              'Aprovar consolidação de ciclo'),

  ('focos',               'view',    'focos.view',                  'Acompanhar focos e reincidências'),
  ('focos',               'manage',  'focos.manage',                'Criar operações de contenção de surtos'),

  ('ovitrampas',          'view',    'ovitrampas.view',             'Consultar armadilhas e índices IPO/IDO'),
  ('ovitrampas',          'create',  'ovitrampas.create',           'Cadastrar pontos sentinela'),
  ('ovitrampas',          'update',  'ovitrampas.update',           'Editar dados de armadilhas'),
  ('ovitrampas',          'install', 'ovitrampas.install',          'Registrar instalação de armadilhas'),
  ('ovitrampas',          'collect', 'ovitrampas.collect',          'Registrar coletas em campo'),
  ('ovitrampas',          'results', 'ovitrampas.results',          'Lançar contagem de ovos e laudos'),
  ('ovitrampas',          'analyze', 'ovitrampas.analyze',          'Acessar inteligência entomológica avançada'),
  ('ovitrampas',          'export',  'ovitrampas.export',           'Exportar boletins de ovitrampas'),
  ('ovitrampas',          'manage',  'ovitrampas.manage',           'Gestão completa da rede de ovitrampas'),

  ('pontos_estrategicos', 'view',    'pontos_estrategicos.view',    'Consultar PEs (ferro-velho, borracharia, cemitério)'),
  ('pontos_estrategicos', 'manage',  'pontos_estrategicos.manage',  'Cadastrar e registrar inspeções quinzenais de PE'),

  ('imoveis_especiais',   'view',    'imoveis_especiais.view',      'Consultar imóveis especiais (escola, hospital, terminal)'),
  ('imoveis_especiais',   'manage',  'imoveis_especiais.manage',    'Programar vistorias em imóveis especiais'),

  ('denuncias',           'view',    'denuncias.view',              'Consultar protocolo de denúncias'),
  ('denuncias',           'manage',  'denuncias.manage',            'Triagem, despacho e atendimento de denúncias'),

  ('epidemiologia',       'view',    'epidemiologia.view',          'Acessar notificações Sinan e boletins'),
  ('epidemiologia',       'manage',  'epidemiologia.manage',        'Definir raios de bloqueio focal e UBV'),

  ('planejamento',        'view',    'planejamento.view',           'Acompanhar roteiros e ordens de serviço'),
  ('planejamento',        'manage',  'planejamento.manage',         'Gerar e distribuir rotas para os ACEs'),

  ('relatorios',          'view',    'relatorios.view',             'Consultar boletins e indicadores oficiais'),
  ('relatorios',          'export',  'relatorios.export',           'Exportar dados em Excel, PDF e CSV'),

  ('motor_risco',         'view',    'motor_risco.view',            'Consultar escores preditivos de risco'),
  ('motor_risco',         'manage',  'motor_risco.manage',          'Ajustar pesos do algoritmo de risco'),

  ('ia_assistente',       'use',     'ia_assistente.use',           'Interagir com o assistente inteligente'),

  ('configuracoes',       'view',    'configuracoes.view',          'Acessar parâmetros gerais do sistema'),
  ('configuracoes',       'manage',  'configuracoes.manage',        'Administrar sistema, integrações e endemias'),

  ('auditoria',           'view',    'auditoria.view',              'Acessar logs de conformidade SUS/LGPD')
ON CONFLICT (slug) DO UPDATE
  SET module = EXCLUDED.module, action = EXCLUDED.action, description = EXCLUDED.description;

-- 3. VÍNCULOS PAPEL -> PERMISSÃO (espelha ROLES_REGISTRY.defaultPermissions)

-- SUPER_ADMIN e MUNICIPAL_ADMIN: todas as permissões
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug IN ('SUPER_ADMIN', 'MUNICIPAL_ADMIN')
ON CONFLICT DO NOTHING;

-- ENDEMIAS_COORDINATOR: todas exceto configuracoes.manage
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'ENDEMIAS_COORDINATOR'
  AND p.slug <> 'configuracoes.manage'
ON CONFLICT DO NOTHING;

-- FIELD_SUPERVISOR
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r JOIN public.permissions p ON p.slug = ANY (ARRAY[
  'painel.view','mapas.view','territorio.view','territorio.manage',
  'imoveis.view','imoveis.create','imoveis.update',
  'visitas.view','visitas.create','visitas.update',
  'equipes.view','equipes.manage','agentes.view','agentes.manage',
  'ciclos.view','focos.view',
  'ovitrampas.view','ovitrampas.create','ovitrampas.update','ovitrampas.install',
  'ovitrampas.collect','ovitrampas.results','ovitrampas.analyze','ovitrampas.export','ovitrampas.manage',
  'pontos_estrategicos.view','pontos_estrategicos.manage',
  'imoveis_especiais.view','imoveis_especiais.manage',
  'denuncias.view','denuncias.manage',
  'planejamento.view','planejamento.manage',
  'relatorios.view','motor_risco.view','ia_assistente.use'
])
WHERE r.slug = 'FIELD_SUPERVISOR'
ON CONFLICT DO NOTHING;

-- ACE
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r JOIN public.permissions p ON p.slug = ANY (ARRAY[
  'imoveis.view','imoveis.create','imoveis.update',
  'visitas.view','visitas.create','visitas.update',
  'territorio.view','ciclos.view','planejamento.view',
  'ovitrampas.view','ovitrampas.install','ovitrampas.collect','ovitrampas.update',
  'denuncias.view','ia_assistente.use'
])
WHERE r.slug = 'ACE'
ON CONFLICT DO NOTHING;

-- EPIDEMIOLOGY_AGENT
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r JOIN public.permissions p ON p.slug = ANY (ARRAY[
  'painel.view','mapas.view','epidemiologia.view','epidemiologia.manage',
  'focos.view','focos.manage',
  'ovitrampas.view','ovitrampas.results','ovitrampas.analyze','ovitrampas.export',
  'visitas.view','imoveis.view','territorio.view','ciclos.view',
  'relatorios.view','relatorios.export','motor_risco.view','ia_assistente.use'
])
WHERE r.slug = 'EPIDEMIOLOGY_AGENT'
ON CONFLICT DO NOTHING;

-- HEALTH_SECRETARY
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r JOIN public.permissions p ON p.slug = ANY (ARRAY[
  'painel.view','mapas.view','relatorios.view','relatorios.export',
  'epidemiologia.view','ciclos.view','territorio.view','imoveis.view','visitas.view',
  'equipes.view','ovitrampas.view','ovitrampas.analyze','ovitrampas.export',
  'pontos_estrategicos.view','imoveis_especiais.view','motor_risco.view',
  'auditoria.view','configuracoes.view','ia_assistente.use'
])
WHERE r.slug = 'HEALTH_SECRETARY'
ON CONFLICT DO NOTHING;

-- AUDITOR_VIEWER
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r JOIN public.permissions p ON p.slug = ANY (ARRAY[
  'painel.view','mapas.view','relatorios.view','relatorios.export','auditoria.view',
  'visitas.view','imoveis.view','territorio.view','ciclos.view',
  'pontos_estrategicos.view','imoveis_especiais.view','configuracoes.view'
])
WHERE r.slug = 'AUDITOR_VIEWER'
ON CONFLICT DO NOTHING;

-- SANITARY_AGENT
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r JOIN public.permissions p ON p.slug = ANY (ARRAY[
  'pontos_estrategicos.view','pontos_estrategicos.manage',
  'imoveis_especiais.view','imoveis_especiais.manage',
  'denuncias.view','denuncias.manage',
  'territorio.view','imoveis.view','visitas.view','relatorios.view'
])
WHERE r.slug = 'SANITARY_AGENT'
ON CONFLICT DO NOTHING;

-- PRIMARY_CARE_ACS
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r JOIN public.permissions p ON p.slug = ANY (ARRAY[
  'territorio.view','imoveis.view','denuncias.view','visitas.view','ia_assistente.use'
])
WHERE r.slug = 'PRIMARY_CARE_ACS'
ON CONFLICT DO NOTHING;

COMMIT;
