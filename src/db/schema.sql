-- ====================================================================
-- ENDEMIAS GOV - SCHEMA POSTGRESQL PRODUÇÃO
-- Plataforma Municipal de Inteligência e Controle de Endemias
-- Modelagem Relacional Completa, Índices, Constraints, RLS e Soft Delete
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. ORGANIZAÇÃO MUNICIPAL
-- ==========================================

CREATE TABLE IF NOT EXISTS municipalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    state CHAR(2) NOT NULL,
    ibge_code CHAR(7) NOT NULL UNIQUE,
    coat_of_arms_url TEXT,
    health_secretary_name VARCHAR(150),
    health_secretary_phone VARCHAR(20),
    coordinator_name VARCHAR(150),
    coordinator_phone VARCHAR(20),
    address TEXT,
    settings JSONB DEFAULT '{"riskWeights": {"recentFoci": 25, "recurrence": 20, "ovitraps": 15, "pendingVisits": 15, "closedProperties": 10, "complaints": 5, "strategicPoints": 5, "epidemiologicalEvents": 5}, "recurrenceThresholdDays": 90, "recurrenceThresholdCount": 3}',
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS health_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    acronym VARCHAR(20),
    department_head VARCHAR(150),
    phone VARCHAR(20),
    email VARCHAR(120),
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ==========================================
-- 2. USUÁRIOS, SEGURANÇA E RBAC
-- ==========================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    module VARCHAR(60) NOT NULL,
    action VARCHAR(40) NOT NULL, -- view, create, edit, delete, approve, export, admin
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES health_departments(id),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    cpf CHAR(11) NOT NULL UNIQUE,
    registration_number VARCHAR(40), -- Matrícula
    phone VARCHAR(20),
    avatar_url TEXT,
    password_hash TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "criticalAlertsOnly": false}',
    assigned_zone VARCHAR(50),
    preferred_language VARCHAR(10) DEFAULT 'pt-BR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. TERRITÓRIO MUNICIPAL
-- ==========================================

CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(30) NOT NULL, -- URBANA, RURAL, DISTRITO, POVOADO
    description TEXT,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS neighborhoods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL,
    estimated_population INT DEFAULT 0,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    risk_score INT DEFAULT 0, -- 0 a 100
    risk_level VARCHAR(20) DEFAULT 'BAIXO',
    boundary_geojson JSONB,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id) ON DELETE RESTRICT,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(100) NOT NULL,
    supervisor_id UUID REFERENCES users(id),
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id) ON DELETE RESTRICT,
    number VARCHAR(30) NOT NULL,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE RESTRICT,
    sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL, -- Ex: IMV-000492
    address VARCHAR(200) NOT NULL,
    number VARCHAR(20) NOT NULL,
    complement VARCHAR(100),
    type VARCHAR(50) NOT NULL, -- RESIDENCIA, COMERCIO, TERRENO_BALDIO, etc.
    situation VARCHAR(40) DEFAULT 'NORMAL', -- NORMAL, FOCO, FECHADO, RECUSA, REINCIDENTE
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    resident_name VARCHAR(150),
    resident_phone VARCHAR(20),
    responsible_agent_id UUID REFERENCES users(id),
    notes TEXT,
    is_recurrent BOOLEAN DEFAULT FALSE,
    foci_history_count INT DEFAULT 0,
    last_visit_date TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ==========================================
-- 4. EQUIPES DE CAMPO
-- ==========================================

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    supervisor_id UUID NOT NULL REFERENCES users(id),
    assigned_zone VARCHAR(40) DEFAULT 'URBANA',
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (team_id, agent_id)
);

-- ==========================================
-- 5. OPERAÇÕES, CICLOS E VISITAS DOMICILIARES
-- ==========================================

CREATE TABLE IF NOT EXISTS field_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL, -- 1º Ciclo 2026
    year INT NOT NULL,
    number INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    goal_percentage NUMERIC(5,2) DEFAULT 80.00,
    status VARCHAR(30) DEFAULT 'EM_ANDAMENTO',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    cycle_id UUID NOT NULL REFERENCES field_cycles(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    visit_time TIME NOT NULL DEFAULT CURRENT_TIME,
    situation VARCHAR(40) NOT NULL, -- TRABALHADO, FECHADO, RECUSA, DESOCUPADO, etc.
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    foci_found BOOLEAN DEFAULT FALSE,
    foci_eliminated BOOLEAN DEFAULT FALSE,
    conduct TEXT,
    pending_reason VARCHAR(100),
    photo_url TEXT,
    sync_status VARCHAR(20) DEFAULT 'SYNCED',
    created_by UUID REFERENCES users(id),
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS visit_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    category VARCHAR(10) NOT NULL, -- A1, A2, B, C, D1, D2, E
    deposit_name VARCHAR(100) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    has_water BOOLEAN DEFAULT FALSE,
    has_larvae BOOLEAN DEFAULT FALSE,
    is_foci BOOLEAN DEFAULT FALSE,
    action_taken VARCHAR(50) NOT NULL, -- ELIMINADO, VEDADO, TRATADO, ORIENTADO
    larvicide_used VARCHAR(80),
    larvicide_quantity_grams NUMERIC(6,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    visit_id UUID REFERENCES visits(id),
    reason VARCHAR(50) NOT NULL,
    due_date DATE,
    assigned_agent_id UUID REFERENCES users(id),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. ENDEMIAS, FOCOS E REINCIDÊNCIAS
-- ==========================================

CREATE TABLE IF NOT EXISTS breeding_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    visit_id UUID REFERENCES visits(id),
    deposit_category VARCHAR(10) NOT NULL,
    specie VARCHAR(80) DEFAULT 'Aedes aegypti',
    larvae_sample_code VARCHAR(50),
    eliminated BOOLEAN DEFAULT FALSE,
    chemical_treatment_applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurrence_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    foci_count_90_days INT NOT NULL DEFAULT 3,
    last_foci_date DATE NOT NULL,
    alert_triggered BOOLEAN DEFAULT TRUE,
    supervisor_notified BOOLEAN DEFAULT TRUE,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 7. OVITRAMPAS (VIGILÂNCIA ENTOMOLÓGICA)
-- ==========================================

CREATE TABLE IF NOT EXISTS ovitraps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL UNIQUE, -- OVI-001
    qr_code VARCHAR(100) NOT NULL UNIQUE,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
    address VARCHAR(200) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    installation_date DATE NOT NULL,
    responsible_agent_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(30) DEFAULT 'ATIVA', -- ATIVA, COLETA_PENDENTE, ANALISE, DESATIVADA
    consecutive_growth BOOLEAN DEFAULT FALSE,
    growth_alert BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ovitrap_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ovitrap_id UUID NOT NULL REFERENCES ovitraps(id) ON DELETE CASCADE,
    collection_date DATE NOT NULL,
    collected_by UUID NOT NULL REFERENCES users(id),
    egg_count INT DEFAULT 0,
    is_positive BOOLEAN DEFAULT FALSE,
    palheta_condition VARCHAR(40) DEFAULT 'INTEGRA',
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 8. PONTOS ESTRATÉGICOS (PE) E IMÓVEIS ESPECIAIS (IE)
-- ==========================================

CREATE TABLE IF NOT EXISTS strategic_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL, -- BORRACHARIA, FERRO_VELHO, CEMITERIO, etc.
    contact_name VARCHAR(120),
    contact_phone VARCHAR(20),
    address VARCHAR(200) NOT NULL,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    inspection_frequency_days INT DEFAULT 15,
    responsible_agent_id UUID NOT NULL REFERENCES users(id),
    risk_level VARCHAR(30) DEFAULT 'ALTO',
    next_inspection_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS strategic_point_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategic_point_id UUID NOT NULL REFERENCES strategic_points(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES users(id),
    inspection_date DATE NOT NULL,
    foci_found BOOLEAN DEFAULT FALSE,
    deposits_treated INT DEFAULT 0,
    larvicide_used VARCHAR(80),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS special_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL, -- ESCOLA, HOSPITAL, TERMINAL
    address VARCHAR(200) NOT NULL,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
    responsible_person VARCHAR(120),
    contact_phone VARCHAR(20),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ==========================================
-- 9. VIGILÂNCIA EPIDEMIOLÓGICA E BLOQUEIOS
-- ==========================================

CREATE TABLE IF NOT EXISTS epidemiological_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    disease VARCHAR(60) NOT NULL, -- DENGUE, CHIKUNGUNYA, ZIKA, etc.
    notification_date DATE NOT NULL,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
    sector_id UUID REFERENCES sectors(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    priority VARCHAR(30) DEFAULT 'ALTA',
    status VARCHAR(40) DEFAULT 'NOTIFICADO',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS epidemiological_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL UNIQUE, -- BLQ-2026-001
    event_id UUID REFERENCES epidemiological_events(id),
    disease VARCHAR(60) NOT NULL,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
    radius_meters INT DEFAULT 150,
    scheduled_date DATE NOT NULL,
    assigned_team_id UUID NOT NULL REFERENCES teams(id),
    priority VARCHAR(30) DEFAULT 'URGENTE',
    properties_forecast INT DEFAULT 100,
    properties_visited INT DEFAULT 0,
    properties_closed INT DEFAULT 0,
    properties_pending INT DEFAULT 0,
    foci_found INT DEFAULT 0,
    status VARCHAR(40) DEFAULT 'EM_ANDAMENTO',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ==========================================
-- 10. PORTAL DO CIDADÃO E DENÚNCIAS
-- ==========================================

CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    protocol VARCHAR(40) NOT NULL UNIQUE, -- END-2026-000235
    type VARCHAR(60) NOT NULL,
    description TEXT NOT NULL,
    address VARCHAR(200) NOT NULL,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    photo_url TEXT,
    citizen_name VARCHAR(120),
    citizen_phone VARCHAR(20),
    assigned_agent_id UUID REFERENCES users(id),
    status VARCHAR(40) DEFAULT 'RECEBIDA', -- RECEBIDA, TRIAGEM, ATRIBUIDA, VISTORIA_REALIZADA, RESOLVIDA
    resolution_notes TEXT,
    resolution_foci_found BOOLEAN,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ==========================================
-- 11. INSUMOS, ESTOQUE E EPIs
-- ==========================================

CREATE TABLE IF NOT EXISTS supplies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(60) NOT NULL, -- LARVICIDA, INSETICIDA_ADULTICIDA, EPI, UNIFORME
    unit VARCHAR(30) NOT NULL,
    current_stock NUMERIC(10,2) DEFAULT 0.00,
    minimum_stock NUMERIC(10,2) DEFAULT 0.00,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS supply_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supply_id UUID NOT NULL REFERENCES supplies(id) ON DELETE CASCADE,
    batch_number VARCHAR(60) NOT NULL,
    quantity NUMERIC(10,2) NOT NULL,
    expiration_date DATE NOT NULL,
    supplier VARCHAR(150),
    received_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supply_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supply_id UUID NOT NULL REFERENCES supplies(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES supply_batches(id),
    type VARCHAR(30) NOT NULL, -- ENTRADA, SAIDA_ACE, DESCARTE
    quantity NUMERIC(10,2) NOT NULL,
    recipient_user_id UUID REFERENCES users(id),
    responsible_user_id UUID NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 12. EQUIPAMENTOS E MANUTENÇÃO
-- ==========================================

CREATE TABLE IF NOT EXISTS equipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    patrimony_number VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL,
    serial_number VARCHAR(80),
    status VARCHAR(40) DEFAULT 'DISPONIVEL', -- DISPONIVEL, EM_USO, MANUTENCAO, INOPERANTE
    assigned_to_user UUID REFERENCES users(id),
    last_maintenance_date DATE,
    next_preventive_maintenance_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS equipment_maintenances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipments(id) ON DELETE CASCADE,
    maintenance_date DATE NOT NULL,
    type VARCHAR(40) NOT NULL, -- PREVENTIVA, CORRETIVA
    description TEXT NOT NULL,
    technician_name VARCHAR(120),
    cost NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 13. PLANEJAMENTO, TAREFAS E ROTAS
-- ==========================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    type VARCHAR(50) NOT NULL,
    priority VARCHAR(30) DEFAULT 'NORMAL',
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
    sector_id UUID REFERENCES sectors(id),
    assigned_agent_id UUID NOT NULL REFERENCES users(id),
    supervisor_id UUID NOT NULL REFERENCES users(id),
    notes TEXT,
    status VARCHAR(40) DEFAULT 'PENDENTE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    agent_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    optimized BOOLEAN DEFAULT FALSE,
    total_stops INT DEFAULT 0,
    status VARCHAR(40) DEFAULT 'PENDENTE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    sequence INT NOT NULL,
    property_id UUID NOT NULL REFERENCES properties(id),
    priority_order INT NOT NULL,
    reason VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'PENDENTE',
    visited_at TIMESTAMPTZ
);

-- ==========================================
-- 14. ALERTAS, NOTIFICAÇÕES E ENCAMINHAMENTOS
-- ==========================================

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    category VARCHAR(50) NOT NULL, -- EPIDEMIOLOGICO, ENTOMOLOGICO, OPERACIONAL, ADMINISTRATIVO
    level VARCHAR(30) NOT NULL, -- INFORMATIVO, ATENCAO, IMPORTANTE, CRITICO
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    neighborhood_id UUID REFERENCES neighborhoods(id),
    assigned_to UUID REFERENCES users(id),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolution_action TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intersectoral_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    protocol VARCHAR(50) NOT NULL UNIQUE,
    target_sector VARCHAR(60) NOT NULL,
    property_address TEXT NOT NULL,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    description TEXT NOT NULL,
    issued_by_agent_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(40) DEFAULT 'ENVIADO',
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 15. AUDITORIA COMPLETA (IMUTÁVEL)
-- ==========================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id),
    user_id UUID NOT NULL REFERENCES users(id),
    user_name VARCHAR(150) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    operation VARCHAR(50) NOT NULL, -- LOGIN, LOGOUT, CADASTRO, EDICAO, EXCLUSAO, APROVACAO, EXPORTACAO
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    ip_address VARCHAR(50),
    device TEXT,
    module VARCHAR(80) NOT NULL,
    record_identifier VARCHAR(100) NOT NULL,
    previous_value JSONB,
    new_value JSONB
);

-- ==========================================
-- ÍNDICES DE PERFORMANCE E INTEGRIDADE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_properties_mun_neighborhood ON properties(municipality_id, neighborhood_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_coords ON properties(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_visits_cycle_agent ON visits(cycle_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_ovitraps_mun ON ovitraps(municipality_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_strategic_points_due ON strategic_points(next_inspection_date);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_mun_time ON audit_logs(municipality_id, timestamp DESC);
