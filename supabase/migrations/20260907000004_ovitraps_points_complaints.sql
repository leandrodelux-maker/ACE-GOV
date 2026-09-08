-- ====================================================================
-- ENDEMIAS GOV - MIGRATION 04: OVITRAMPAS, PONTOS ESTRATÉGICOS, IE E DENÚNCIAS
-- ====================================================================

-- 8. OVITRAMPAS
CREATE TABLE IF NOT EXISTS ovitraps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id) ON DELETE RESTRICT,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ATIVA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ovitrap_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ovitrap_id UUID NOT NULL REFERENCES ovitraps(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    installation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_collection_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ovitrap_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES ovitrap_installations(id) ON DELETE CASCADE,
    collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'COLETADA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ovitrap_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES ovitrap_collections(id) ON DELETE CASCADE,
    eggs_count INT NOT NULL DEFAULT 0,
    positive BOOLEAN NOT NULL DEFAULT FALSE,
    laboratory_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. PONTOS ESTRATÉGICOS
CREATE TABLE IF NOT EXISTS strategic_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    name VARCHAR(150),
    category VARCHAR(60) NOT NULL, -- BORRACHARIA, FERRO_VELHO, CEMITERIO, etc.
    inspection_frequency_days INT NOT NULL DEFAULT 15,
    last_inspection DATE,
    next_inspection DATE NOT NULL,
    risk_level VARCHAR(30) NOT NULL DEFAULT 'ALTO',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategic_point_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategic_point_id UUID NOT NULL REFERENCES strategic_points(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    deposits_found INT NOT NULL DEFAULT 0,
    positive_deposits INT NOT NULL DEFAULT 0,
    treatment TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. IMÓVEIS ESPECIAIS
CREATE TABLE IF NOT EXISTS special_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    name VARCHAR(150),
    category VARCHAR(60) NOT NULL, -- ESCOLA, HOSPITAL, TERMINAL, etc.
    inspection_frequency_days INT NOT NULL DEFAULT 30,
    last_inspection DATE,
    next_inspection DATE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS special_property_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    special_property_id UUID NOT NULL REFERENCES special_properties(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    findings TEXT,
    actions TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. DENÚNCIAS
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    protocol VARCHAR(50) NOT NULL UNIQUE,
    complainant_name VARCHAR(150),
    complainant_phone VARCHAR(30),
    anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT NOT NULL,
    street VARCHAR(200) NOT NULL,
    number VARCHAR(30),
    neighborhood_id UUID REFERENCES neighborhoods(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    priority VARCHAR(30) NOT NULL DEFAULT 'MEDIA',
    status VARCHAR(40) NOT NULL DEFAULT 'RECEBIDA',
    assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    inspected_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complaint_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers para updated_at
CREATE TRIGGER trg_ovitraps_updated_at BEFORE UPDATE ON ovitraps FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_ovitrap_installations_updated_at BEFORE UPDATE ON ovitrap_installations FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_ovitrap_collections_updated_at BEFORE UPDATE ON ovitrap_collections FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_ovitrap_results_updated_at BEFORE UPDATE ON ovitrap_results FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_strategic_points_updated_at BEFORE UPDATE ON strategic_points FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_special_properties_updated_at BEFORE UPDATE ON special_properties FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_complaints_updated_at BEFORE UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

-- Índices principais
CREATE INDEX IF NOT EXISTS idx_ovitraps_mun ON ovitraps(municipality_id);
CREATE INDEX IF NOT EXISTS idx_ovitraps_neighborhood ON ovitraps(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_strategic_points_mun ON strategic_points(municipality_id);
CREATE INDEX IF NOT EXISTS idx_strategic_points_next ON strategic_points(next_inspection);
CREATE INDEX IF NOT EXISTS idx_special_properties_mun ON special_properties(municipality_id);
CREATE INDEX IF NOT EXISTS idx_complaints_mun ON complaints(municipality_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_protocol ON complaints(protocol);
