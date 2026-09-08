-- ====================================================================
-- ENDEMIAS GOV - MIGRATION 02: TERRITÓRIO E EQUIPES DE CAMPO
-- ====================================================================

-- 3. TERRITÓRIO
CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50),
    geometry JSONB,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS neighborhoods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50),
    geometry JSONB,
    population INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    geometry JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS microareas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    responsible_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
    microarea_id UUID REFERENCES microareas(id) ON DELETE SET NULL,
    code VARCHAR(50) NOT NULL,
    geometry JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id) ON DELETE RESTRICT,
    sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
    microarea_id UUID REFERENCES microareas(id) ON DELETE SET NULL,
    block_id UUID REFERENCES blocks(id) ON DELETE SET NULL,
    property_code VARCHAR(50) NOT NULL,
    property_type VARCHAR(60) NOT NULL DEFAULT 'RESIDENCIAL',
    street VARCHAR(200) NOT NULL,
    number VARCHAR(30) NOT NULL,
    complement VARCHAR(100),
    reference TEXT,
    postal_code VARCHAR(20),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    resident_name VARCHAR(150),
    resident_phone VARCHAR(30),
    residents_count INT DEFAULT 1,
    status VARCHAR(40) NOT NULL DEFAULT 'NORMAL',
    last_visit_at TIMESTAMPTZ,
    risk_score INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 4. EQUIPES
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50),
    supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    employee_number VARCHAR(50),
    admission_date DATE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers para updated_at
CREATE TRIGGER trg_zones_updated_at BEFORE UPDATE ON zones FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_neighborhoods_updated_at BEFORE UPDATE ON neighborhoods FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_sectors_updated_at BEFORE UPDATE ON sectors FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_microareas_updated_at BEFORE UPDATE ON microareas FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_blocks_updated_at BEFORE UPDATE ON blocks FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_zones_mun ON zones(municipality_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_mun ON neighborhoods(municipality_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_zone ON neighborhoods(zone_id);
CREATE INDEX IF NOT EXISTS idx_sectors_mun_neigh ON sectors(municipality_id, neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_microareas_sector ON microareas(sector_id);
CREATE INDEX IF NOT EXISTS idx_blocks_sector ON blocks(sector_id);
CREATE INDEX IF NOT EXISTS idx_properties_mun ON properties(municipality_id);
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood ON properties(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_properties_sector ON properties(sector_id);
CREATE INDEX IF NOT EXISTS idx_properties_block ON properties(block_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_coords ON properties(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_teams_mun ON teams(municipality_id);
CREATE INDEX IF NOT EXISTS idx_agents_mun_team ON agents(municipality_id, team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
