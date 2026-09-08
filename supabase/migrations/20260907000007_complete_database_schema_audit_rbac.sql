-- ====================================================================
-- ENDEMIAS GOV - MIGRATION 07: AUDITORIA, STATUS, RBAC COMPLETO E CONFIGURAÇÕES
-- ====================================================================

-- 1. ADICIONAR COLUNAS DE AUDITORIA E SOFT DELETE ONDE APLICÁVEL
ALTER TABLE properties 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE visits 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE field_cycles 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE strategic_points 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'ATIVO';

ALTER TABLE special_properties 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'ATIVO';

ALTER TABLE complaints 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE epidemiological_cases 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE field_plans 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE outbreaks 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE blockade_operations 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE ovitraps 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE alerts 
    ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'ATIVO';

-- Adicionar campo password_hash em profiles para suporte a autenticação municipal direta / fallback seguro
ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. ÍNDICES DE PERFORMANCE E CONSULTAS ESPACIAIS / TEMPORAIS
CREATE INDEX IF NOT EXISTS idx_properties_mun_status ON properties(municipality_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_deleted ON properties(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_visits_mun_date ON visits(municipality_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_agent_date ON visits(agent_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_deleted ON visits(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_breeding_sites_mun ON breeding_sites(municipality_id);
CREATE INDEX IF NOT EXISTS idx_breeding_sites_coords ON breeding_sites(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_complaints_mun_status ON complaints(municipality_id, status);
CREATE INDEX IF NOT EXISTS idx_epidemiological_cases_coords ON epidemiological_cases(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_ovitraps_coords ON ovitraps(latitude, longitude);

-- 3. CATÁLOGO COMPLETO DE PERMISSÕES DO SISTEMA (RBAC SUS)
INSERT INTO permissions (id, module, action, slug, description) VALUES
-- Visitas e Vistorias
('10000000-0000-0000-0000-000000000001', 'visitas', 'visualizar', 'visitas.view', 'Visualizar registros de vistorias domiciliares'),
('10000000-0000-0000-0000-000000000002', 'visitas', 'executar', 'visitas.create', 'Realizar vistoria e coletar dados em campo pelo PWA'),
('10000000-0000-0000-0000-000000000003', 'visitas', 'editar', 'visitas.update', 'Editar vistorias realizadas'),
('10000000-0000-0000-0000-000000000004', 'visitas', 'excluir', 'visitas.delete', 'Excluir vistoria (soft-delete auditado)'),

-- Território e Imóveis
('10000000-0000-0000-0000-000000000010', 'territorio', 'visualizar', 'territorio.view', 'Consultar zonas, bairros, setores, quarteirões e imóveis'),
('10000000-0000-0000-0000-000000000011', 'territorio', 'gerenciar', 'territorio.manage', 'Cadastrar e editar bairros, setores e polígonos'),
('10000000-0000-0000-0000-000000000012', 'imoveis', 'gerenciar', 'imoveis.manage', 'Cadastrar e atualizar imóveis e moradores'),

-- Ciclos de Campo (LIRAa / LIA)
('10000000-0000-0000-0000-000000000020', 'ciclos', 'visualizar', 'ciclos.view', 'Acompanhar metas e indicadores do ciclo de trabalho'),
('10000000-0000-0000-0000-000000000021', 'ciclos', 'gerenciar', 'ciclos.manage', 'Criar, abrir e encerrar ciclos de campo'),

-- Ovitrampas e Entomologia
('10000000-0000-0000-0000-000000000030', 'ovitrampas', 'visualizar', 'ovitrampas.view', 'Visualizar rede de armadilhas e índice IPO'),
('10000000-0000-0000-0000-000000000031', 'ovitrampas', 'gerenciar', 'ovitrampas.manage', 'Instalar, coletar e lançar contagem de ovos de ovitrampas'),

-- Pontos Estratégicos e Imóveis Especiais
('10000000-0000-0000-0000-000000000040', 'pontos_estrategicos', 'visualizar', 'pontos_estrategicos.view', 'Visualizar pontos estratégicos quinzenais'),
('10000000-0000-0000-0000-000000000041', 'pontos_estrategicos', 'gerenciar', 'pontos_estrategicos.manage', 'Gerenciar inspeções de PE e Imóveis Especiais'),

-- Denúncias do Cidadão (Ouvidoria / 156)
('10000000-0000-0000-0000-000000000050', 'denuncias', 'visualizar', 'denuncias.view', 'Consultar denúncias de focos e terrenos'),
('10000000-0000-0000-0000-000000000051', 'denuncias', 'gerenciar', 'denuncias.manage', 'Triagem, despacho e encerramento de denúncias'),

-- Vigilância Epidemiológica e Bloqueios
('10000000-0000-0000-0000-000000000060', 'epidemiologia', 'visualizar', 'epidemiologia.view', 'Acessar notificações Sinan e boletim de arboviroses'),
('10000000-0000-0000-0000-000000000061', 'epidemiologia', 'gerenciar', 'epidemiologia.manage', 'Definir raios de bloqueio focal e pulverização UBV'),

-- Equipes e Rotas Inteligentes
('10000000-0000-0000-0000-000000000070', 'equipes', 'gerenciar', 'equipes.manage', 'Alocar agentes, gerenciar equipes e supervisores'),
('10000000-0000-0000-0000-000000000071', 'planejamento', 'gerenciar', 'planejamento.manage', 'Planejar roteiros e ordens de serviço diárias'),

-- Alertas e Inteligência Artificial
('10000000-0000-0000-0000-000000000080', 'alertas', 'gerenciar', 'alertas.manage', 'Reconhecer e agir sobre alertas operacionais e críticos'),
('10000000-0000-0000-0000-000000000081', 'ia_assistente', 'usar', 'ia_assistente.use', 'Consultar IA especializada em protocolos do Ministério da Saúde'),

-- Relatórios Oficiais e Auditoria
('10000000-0000-0000-0000-000000000090', 'relatorios', 'gerar', 'relatorios.generate', 'Exportar boletins oficiais SisFist, LIRAa e relatórios executivos'),
('10000000-0000-0000-0000-000000000091', 'auditoria', 'visualizar', 'auditoria.view', 'Acessar logs de auditoria e trilha de conformidade LGPD'),

-- Gestão Administrativa e Usuários
('10000000-0000-0000-0000-000000000100', 'admin', 'usuarios', 'admin.users', 'Criar, desativar e gerenciar usuários e perfis municipais'),
('10000000-0000-0000-0000-000000000101', 'admin', 'configuracoes', 'admin.settings', 'Configurar parâmetros municipais, pesos de risco e integração')
ON CONFLICT (slug) DO NOTHING;

-- 4. VINCULAR PERMISSÕES AOS PAPÉIS (RBAC)
-- Super Administrador e Administrador Municipal recebem todas as permissões
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN ('SUPER_ADMIN', 'MUNICIPAL_ADMIN')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Coordenador de Endemias (todas exceto admin de infraestrutura global)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'ENDEMIAS_COORDINATOR'
  AND p.slug NOT IN ('admin.settings')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Supervisor de Campo
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'FIELD_SUPERVISOR'
  AND p.slug IN (
    'visitas.view', 'visitas.update', 'territorio.view', 'imoveis.manage',
    'ciclos.view', 'ovitrampas.view', 'ovitrampas.manage', 'pontos_estrategicos.view',
    'pontos_estrategicos.manage', 'denuncias.view', 'denuncias.manage',
    'equipes.manage', 'planejamento.manage', 'alertas.manage', 'relatorios.generate'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Agente de Combate às Endemias (ACE)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'ACE'
  AND p.slug IN (
    'visitas.view', 'visitas.create', 'territorio.view', 'imoveis.manage',
    'ciclos.view', 'denuncias.view', 'alertas.manage', 'ia_assistente.use'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Vigilância Epidemiológica
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'EPIDEMIOLOGY_AGENT'
  AND p.slug IN (
    'epidemiologia.view', 'epidemiologia.manage', 'visitas.view', 'territorio.view',
    'ciclos.view', 'alertas.manage', 'relatorios.generate'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Vigilância Sanitária
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'SANITARY_AGENT'
  AND p.slug IN (
    'pontos_estrategicos.view', 'pontos_estrategicos.manage', 'denuncias.view',
    'denuncias.manage', 'territorio.view', 'visitas.view', 'alertas.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Secretário de Saúde / Gabinete
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'HEALTH_SECRETARY'
  AND p.slug IN (
    'visitas.view', 'territorio.view', 'ciclos.view', 'epidemiologia.view',
    'alertas.manage', 'relatorios.generate', 'auditoria.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Auditor / Visualizador SUS
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'AUDITOR_VIEWER'
  AND p.slug IN (
    'visitas.view', 'territorio.view', 'ciclos.view', 'relatorios.generate', 'auditoria.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Atenção Primária / ACS
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'PRIMARY_CARE_ACS'
  AND p.slug IN (
    'territorio.view', 'denuncias.view', 'visitas.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. CONFIGURAÇÕES MUNICIPAIS (SYSTEM SETTINGS)
INSERT INTO system_settings (municipality_id, setting_key, setting_value) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'risk_engine',
    '{
        "weights": {
            "recentFoci": 30,
            "recurrence": 25,
            "ovitraps": 15,
            "pendingVisits": 10,
            "closedProperties": 5,
            "complaints": 5,
            "strategicPoints": 5,
            "epidemiologicalEvents": 5
        },
        "recurrenceThresholdDays": 60,
        "recurrenceThresholdCount": 2,
        "criticalRiskCutoff": 75
    }'::jsonb
),
(
    '00000000-0000-0000-0000-000000000001',
    'general',
    '{
        "system_name": "Endemias GOV",
        "ministry": "Ministério da Saúde - SUS",
        "pwa_offline_limit_days": 7,
        "default_cycle_type": "LIRAa",
        "allow_offline_sync": true
    }'::jsonb
)
ON CONFLICT (municipality_id, setting_key) 
DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW();

-- 6. ATUALIZAÇÃO DO PERFIL COORDENADOR COM SENHA SEGURA (Admin@2026)
-- Hash bcrypt padrão para 'Admin@2026' ou autenticação municipal
UPDATE profiles 
SET password_hash = '$2a$10$7zB3cIhy1P1c2aO0f8eGiePqvQdO2R9cZ7w1mG2t4p5Q6r7s8t9u.',
    updated_at = NOW()
WHERE email = 'coordenacao.endemias@santacruz.rs.gov.br';

-- 7. PERFIS DE TESTE ADICIONAIS PARA OUTROS PAPÉIS DO RBAC
-- Perfil Agente ACE
INSERT INTO profiles (id, municipality_id, full_name, email, job_title, registration_number, active, password_hash)
VALUES (
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000001',
    'Carlos Eduardo Santos',
    'carlos.ace@santacruz.rs.gov.br',
    'Agente de Combate às Endemias',
    'MAT-5510',
    true,
    '$2a$10$7zB3cIhy1P1c2aO0f8eGiePqvQdO2R9cZ7w1mG2t4p5Q6r7s8t9u.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
VALUES ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000015')
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Perfil Secretário de Saúde
INSERT INTO profiles (id, municipality_id, full_name, email, job_title, registration_number, active, password_hash)
VALUES (
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000001',
    'Dr. Fernando Albuquerque',
    'secretario.saude@santacruz.rs.gov.br',
    'Secretário Municipal de Saúde',
    'MAT-1001',
    true,
    '$2a$10$7zB3cIhy1P1c2aO0f8eGiePqvQdO2R9cZ7w1mG2t4p5Q6r7s8t9u.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
VALUES ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000012')
ON CONFLICT (user_id, role_id) DO NOTHING;
