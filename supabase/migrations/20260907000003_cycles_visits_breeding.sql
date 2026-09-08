-- ====================================================================
-- ENDEMIAS GOV - MIGRATION 03: CICLOS, VISITAS DOMICILIARES E FOCOS
-- ====================================================================

-- 5. CICLOS DE TRABALHO
CREATE TABLE IF NOT EXISTS field_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    cycle_number INT NOT NULL,
    year INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    target_properties INT DEFAULT 0,
    status VARCHAR(40) NOT NULL DEFAULT 'EM_ANDAMENTO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cycle_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES field_cycles(id) ON DELETE CASCADE,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id) ON DELETE CASCADE,
    sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    planned_properties INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. VISITAS DOMICILIARES
CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES field_cycles(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    visit_type VARCHAR(50) NOT NULL DEFAULT 'ROTINA',
    result VARCHAR(50) NOT NULL DEFAULT 'TRABALHADO',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    gps_accuracy NUMERIC(6,2),
    residents_present BOOLEAN DEFAULT TRUE,
    notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'CONCLUIDA',
    offline_created BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS visit_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    deposit_type VARCHAR(50) NOT NULL, -- A1, A2, B, C, D1, D2, E
    quantity INT NOT NULL DEFAULT 1,
    positive BOOLEAN DEFAULT FALSE,
    larvae_found BOOLEAN DEFAULT FALSE,
    eliminated BOOLEAN DEFAULT FALSE,
    treated BOOLEAN DEFAULT FALSE,
    treatment_product VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visit_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    action_type VARCHAR(60) NOT NULL,
    quantity INT DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES field_cycles(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    reason VARCHAR(100) NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'MEDIA',
    deadline DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visit_refusals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    reason VARCHAR(150) NOT NULL,
    notes TEXT,
    return_required BOOLEAN DEFAULT TRUE,
    return_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS closed_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    return_date DATE,
    attempts INT DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. FOCOS E CRIADOUROS
CREATE TABLE IF NOT EXISTS breeding_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
    deposit_type VARCHAR(50) NOT NULL,
    species VARCHAR(100) DEFAULT 'Aedes aegypti',
    larvae_count INT DEFAULT 0,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    identified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    eliminated_at TIMESTAMPTZ,
    status VARCHAR(40) NOT NULL DEFAULT 'ATIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outbreaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id) ON DELETE CASCADE,
    sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    disease VARCHAR(60) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    radius_meters INT DEFAULT 150,
    started_at DATE NOT NULL DEFAULT CURRENT_DATE,
    ended_at DATE,
    status VARCHAR(40) NOT NULL DEFAULT 'EM_ANDAMENTO',
    risk_level VARCHAR(30) NOT NULL DEFAULT 'ALTO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurrence_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    breeding_site_id UUID REFERENCES breeding_sites(id) ON DELETE SET NULL,
    recurrence_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recurrence_count INT NOT NULL DEFAULT 3,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers para updated_at
CREATE TRIGGER trg_field_cycles_updated_at BEFORE UPDATE ON field_cycles FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_cycle_areas_updated_at BEFORE UPDATE ON cycle_areas FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_visits_updated_at BEFORE UPDATE ON visits FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_pending_visits_updated_at BEFORE UPDATE ON pending_visits FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_visit_refusals_updated_at BEFORE UPDATE ON visit_refusals FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_closed_properties_updated_at BEFORE UPDATE ON closed_properties FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_breeding_sites_updated_at BEFORE UPDATE ON breeding_sites FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_outbreaks_updated_at BEFORE UPDATE ON outbreaks FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_recurrence_records_updated_at BEFORE UPDATE ON recurrence_records FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

-- Índices principais
CREATE INDEX IF NOT EXISTS idx_cycles_mun ON field_cycles(municipality_id);
CREATE INDEX IF NOT EXISTS idx_visits_mun ON visits(municipality_id);
CREATE INDEX IF NOT EXISTS idx_visits_property ON visits(property_id);
CREATE INDEX IF NOT EXISTS idx_visits_cycle ON visits(cycle_id);
CREATE INDEX IF NOT EXISTS idx_visits_agent ON visits(agent_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visit_deposits_visit ON visit_deposits(visit_id);
CREATE INDEX IF NOT EXISTS idx_pending_visits_cycle ON pending_visits(cycle_id);
CREATE INDEX IF NOT EXISTS idx_breeding_sites_property ON breeding_sites(property_id);
CREATE INDEX IF NOT EXISTS idx_outbreaks_mun_disease ON outbreaks(municipality_id, disease);
CREATE INDEX IF NOT EXISTS idx_recurrence_property ON recurrence_records(property_id);
