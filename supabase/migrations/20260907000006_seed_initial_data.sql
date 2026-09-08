-- ====================================================================
-- ENDEMIAS GOV - MIGRATION 06: DADOS BÁSICOS INICIAIS (SEED REALISTA)
-- ====================================================================

-- 1. Município Piloto de Referência
INSERT INTO municipalities (id, name, ibge_code, state, active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Santa Cruz do Sul', '4316808', 'RS', true)
ON CONFLICT (ibge_code) DO UPDATE SET name = EXCLUDED.name;

-- 2. Secretaria Municipal de Saúde
INSERT INTO health_departments (id, municipality_id, name, cnes, phone, email, active)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Secretaria Municipal de Saúde e Vigilância Sanitária',
    '2245891',
    '(51) 3715-1234',
    'saude@santacruz.rs.gov.br',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 3. Papéis do Sistema (RBAC SUS)
INSERT INTO roles (id, name, slug, description, system_role) VALUES
('00000000-0000-0000-0000-000000000010', 'Super Administrador', 'SUPER_ADMIN', 'Acesso irrestrito a configurações globais', true),
('00000000-0000-0000-0000-000000000011', 'Administrador Municipal', 'MUNICIPAL_ADMIN', 'Gestor administrativo municipal e RBAC', true),
('00000000-0000-0000-0000-000000000012', 'Secretário Municipal de Saúde', 'HEALTH_SECRETARY', 'Visão executiva de gabinete e governança', true),
('00000000-0000-0000-0000-000000000013', 'Coordenador de Endemias', 'ENDEMIAS_COORDINATOR', 'Coordenação técnica de campo e ciclos', true),
('00000000-0000-0000-0000-000000000014', 'Supervisor de Campo', 'FIELD_SUPERVISOR', 'Supervisão direta das equipes e rotas', true),
('00000000-0000-0000-0000-000000000015', 'Agente de Combate às Endemias', 'ACE', 'Operador de campo PWA e vistorias domiciliares', true),
('00000000-0000-0000-0000-000000000016', 'Vigilância Epidemiológica', 'EPIDEMIOLOGY_AGENT', 'Investigação e bloqueio de transmissão', true),
('00000000-0000-0000-0000-000000000017', 'Vigilância Sanitária', 'SANITARY_AGENT', 'Fiscalização de PE, autuações e interdições', true),
('00000000-0000-0000-0000-000000000018', 'Atenção Primária / ACS', 'PRIMARY_CARE_ACS', 'Integração territorial e acolhimento', true),
('00000000-0000-0000-0000-000000000019', 'Auditor / Visualizador SUS', 'AUDITOR_VIEWER', 'Consulta e auditoria de indicadores oficiais', true)
ON CONFLICT (slug) DO NOTHING;

-- 4. Perfil Coordenador Padrão
INSERT INTO profiles (id, municipality_id, full_name, email, job_title, registration_number, active)
VALUES (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000001',
    'Dra. Vanessa Lima',
    'coordenacao.endemias@santacruz.rs.gov.br',
    'Coordenadora Geral de Endemias',
    'MAT-4482',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 5. Vincular Perfil ao Papel
INSERT INTO user_roles (user_id, role_id)
VALUES ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000013')
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 6. Zonas Municipais
INSERT INTO zones (id, municipality_id, name, code, active) VALUES
('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', 'Zona Urbana', 'ZU', true),
('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', 'Zona Rural', 'ZR', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Bairros Principais
INSERT INTO neighborhoods (id, municipality_id, zone_id, name, code, population) VALUES
('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000030', 'Vila Nova', 'VIL', 8400),
('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000030', 'Centro', 'CEN', 14200),
('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000030', 'Arroio Grande', 'ARG', 12500),
('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000030', 'Avenida', 'AVE', 6200)
ON CONFLICT (id) DO NOTHING;

-- 8. Ciclo de Trabalho 1º Ciclo 2026 (LIRAa / LIA)
INSERT INTO field_cycles (id, municipality_id, name, cycle_number, year, start_date, end_date, target_properties, status)
VALUES (
    '00000000-0000-0000-0000-000000000050',
    '00000000-0000-0000-0000-000000000001',
    '1º Ciclo 2026 (LIRAa / LIA)',
    1,
    2026,
    '2026-01-15',
    '2026-03-31',
    2800,
    'EM_ANDAMENTO'
)
ON CONFLICT (id) DO NOTHING;
