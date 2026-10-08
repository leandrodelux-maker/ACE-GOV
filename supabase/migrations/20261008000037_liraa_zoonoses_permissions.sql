-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 37: PERMISSÕES E PAPÉIS DOS MÓDULOS LIRAa/LIA E ZOONOSES
-- ==============================================================================
-- Aditiva: só insere no catálogo RBAC (permissions, roles, role_permissions).
-- Espelhada em src/services/rbac.ts (PERMISSIONS_CATALOG / ROLES_REGISTRY).
--
-- Rollback:
--   DELETE FROM public.permissions WHERE module IN ('liraa','antirrabica','raiva');
--   DELETE FROM public.roles WHERE slug IN ('LAB_TECHNICIAN','ZOONOSES_VACCINATOR','STOCK_MANAGER');
-- ==============================================================================

BEGIN;

INSERT INTO public.permissions (module, action, slug, description) VALUES
  ('liraa',       'view',      'liraa.view',                'Consultar levantamentos LIRAa/LIA, indicadores e relatórios'),
  ('liraa',       'manage',    'liraa.planejar',            'Planejar levantamentos, configurar estratos e executar o sorteio amostral'),
  ('liraa',       'collect',   'liraa.coletar',             'Registrar inspeções de campo do LIRAa/LIA'),
  ('liraa',       'approve',   'liraa.supervisionar',       'Conferir e corrigir inspeções, redistribuir amostras'),
  ('liraa',       'analyze',   'liraa.laboratorio',         'Receber tubitos e registrar resultados laboratoriais'),
  ('liraa',       'close',     'liraa.encerrar',            'Encerrar ou cancelar levantamentos'),
  ('liraa',       'manage',    'liraa.reabrir',             'Reabrir levantamento encerrado (com justificativa auditada)'),
  ('liraa',       'export',    'liraa.export',              'Exportar relatórios LIRAa/LIA'),

  ('antirrabica', 'view',      'antirrabica.view',          'Consultar vacinação antirrábica, campanhas e indicadores'),
  ('antirrabica', 'manage',    'antirrabica.campanhas',     'Planejar campanhas, postos e metas de vacinação'),
  ('antirrabica', 'create',    'antirrabica.vacinar',       'Registrar doses de vacina antirrábica'),
  ('antirrabica', 'update',    'antirrabica.cadastro',      'Cadastrar e editar animais e tutores'),
  ('antirrabica', 'view',      'antirrabica.tutores_dados', 'Ver nome, telefone e endereço de tutores (LGPD)'),
  ('antirrabica', 'manage',    'antirrabica.estoque',       'Registrar entradas, distribuições, devoluções e perdas de vacinas'),
  ('antirrabica', 'manage',    'antirrabica.estoque_ajuste','Registrar ajustes de inventário de vacinas'),
  ('antirrabica', 'delete',    'antirrabica.anular',        'Anular registros de vacinação (com justificativa)'),
  ('antirrabica', 'manage',    'antirrabica.busca_ativa',   'Gerar e executar listas de busca ativa'),
  ('antirrabica', 'export',    'antirrabica.export',        'Exportar relatórios de vacinação antirrábica'),

  ('raiva',       'view',      'raiva.view',                'Consultar eventos de vigilância da raiva animal'),
  ('raiva',       'create',    'raiva.registrar',           'Registrar ocorrências e acompanhamento de raiva animal'),
  ('raiva',       'approve',   'raiva.decidir',             'Decisões técnicas: encerramento, classificação e bloqueio de foco')
ON CONFLICT (slug) DO NOTHING;

-- Papéis novos (catálogo global; escrita só pela plataforma)
INSERT INTO public.roles (name, slug, description, system_role) VALUES
  ('Laboratório Entomológico',       'LAB_TECHNICIAN',      'Recebimento e análise de amostras entomológicas', true),
  ('Vacinação Antirrábica / Zoonoses','ZOONOSES_VACCINATOR', 'Campanhas, registro de doses, cadastro animal e busca ativa', true),
  ('Gestor de Estoque',              'STOCK_MANAGER',       'Controle de lotes, distribuição e inventário de imunobiológicos', true)
ON CONFLICT (slug) DO NOTHING;

-- Vínculos papel x permissão
WITH grants(role_slug, perm_slug) AS (
  SELECT r, p FROM unnest(ARRAY['SUPER_ADMIN','MUNICIPAL_ADMIN','ENDEMIAS_COORDINATOR']) r
  CROSS JOIN (SELECT slug p FROM public.permissions WHERE module IN ('liraa','antirrabica','raiva')) x
  UNION ALL SELECT 'FIELD_SUPERVISOR', unnest(ARRAY[
    'liraa.view','liraa.coletar','liraa.supervisionar','liraa.export',
    'antirrabica.view','antirrabica.vacinar','antirrabica.cadastro','antirrabica.tutores_dados',
    'antirrabica.busca_ativa','antirrabica.estoque','antirrabica.export',
    'raiva.view','raiva.registrar'])
  UNION ALL SELECT 'ACE', unnest(ARRAY[
    'liraa.view','liraa.coletar',
    'antirrabica.view','antirrabica.vacinar','antirrabica.cadastro','antirrabica.tutores_dados','antirrabica.busca_ativa'])
  UNION ALL SELECT 'EPIDEMIOLOGY_AGENT', unnest(ARRAY[
    'liraa.view','liraa.export','antirrabica.view','antirrabica.export',
    'raiva.view','raiva.registrar','raiva.decidir'])
  UNION ALL SELECT 'HEALTH_SECRETARY', unnest(ARRAY['liraa.view','liraa.export','antirrabica.view','antirrabica.export','raiva.view'])
  UNION ALL SELECT 'AUDITOR_VIEWER', unnest(ARRAY['liraa.view','antirrabica.view','raiva.view'])
  UNION ALL SELECT 'SANITARY_AGENT', unnest(ARRAY['raiva.view','raiva.registrar'])
  UNION ALL SELECT 'LAB_TECHNICIAN', unnest(ARRAY['liraa.view','liraa.laboratorio','ovitrampas.view','ovitrampas.results'])
  UNION ALL SELECT 'ZOONOSES_VACCINATOR', unnest(ARRAY[
    'antirrabica.view','antirrabica.campanhas','antirrabica.vacinar','antirrabica.cadastro','antirrabica.tutores_dados',
    'antirrabica.estoque','antirrabica.anular','antirrabica.busca_ativa','antirrabica.export',
    'raiva.view','raiva.registrar','territorio.view','imoveis.view'])
  UNION ALL SELECT 'STOCK_MANAGER', unnest(ARRAY[
    'antirrabica.view','antirrabica.estoque','antirrabica.estoque_ajuste','antirrabica.export','equipes.view'])
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM grants g
JOIN public.roles r ON r.slug = g.role_slug
JOIN public.permissions p ON p.slug = g.perm_slug
ON CONFLICT DO NOTHING;

COMMIT;
