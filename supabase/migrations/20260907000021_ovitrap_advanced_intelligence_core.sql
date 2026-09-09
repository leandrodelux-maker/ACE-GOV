-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 21: OVITRAP CORE & ADVANCED INTELLIGENCE ECOSYSTEM
-- ==============================================================================

-- 1. EXTENSÃO DA TABELA OVITRAPS
ALTER TABLE ovitraps
ADD COLUMN IF NOT EXISTS name VARCHAR(150),
ADD COLUMN IF NOT EXISTS street VARCHAR(255),
ADD COLUMN IF NOT EXISTS number VARCHAR(50),
ADD COLUMN IF NOT EXISTS reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS responsible_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS installation_frequency_days INT DEFAULT 28,
ADD COLUMN IF NOT EXISTS collection_interval_days INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Atualizar assigned_agent_id a partir de responsible_agent_id se estiver nulo
UPDATE ovitraps SET assigned_agent_id = responsible_agent_id WHERE assigned_agent_id IS NULL AND responsible_agent_id IS NOT NULL;
UPDATE ovitraps SET reference = reference_point WHERE reference IS NULL AND reference_point IS NOT NULL;
UPDATE ovitraps SET street = address WHERE street IS NULL AND address IS NOT NULL;

-- 2. EXTENSÃO DA TABELA OVITRAP_INSTALLATIONS
ALTER TABLE ovitrap_installations
ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'concluida',
ADD COLUMN IF NOT EXISTS gps_accuracy NUMERIC;

-- 3. EXTENSÃO DA TABELA OVITRAP_COLLECTIONS
ALTER TABLE ovitrap_collections
ADD COLUMN IF NOT EXISTS ovitrap_id UUID REFERENCES ovitraps(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS collection_status VARCHAR(40) DEFAULT 'coletada',
ADD COLUMN IF NOT EXISTS gps_accuracy NUMERIC;

-- Preencher ovitrap_id em ovitrap_collections a partir de installation_id caso esteja nulo
UPDATE ovitrap_collections oc
SET ovitrap_id = oi.ovitrap_id
FROM ovitrap_installations oi
WHERE oc.installation_id = oi.id AND oc.ovitrap_id IS NULL;

-- 4. EXTENSÃO DA TABELA OVITRAP_RESULTS
ALTER TABLE ovitrap_results
ADD COLUMN IF NOT EXISTS ovitrap_id UUID REFERENCES ovitraps(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reading_date DATE,
ADD COLUMN IF NOT EXISTS read_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS result_status VARCHAR(30) DEFAULT 'positive';

-- Preencher ovitrap_id e reading_date
UPDATE ovitrap_results res
SET ovitrap_id = oc.ovitrap_id,
    reading_date = COALESCE(res.reading_date, res.laboratory_date)
FROM ovitrap_collections oc
WHERE res.collection_id = oc.id AND (res.ovitrap_id IS NULL OR res.reading_date IS NULL);

-- 5. TABELA DE CONFIGURAÇÕES MUNICIPAIS DE OVITRAMPAS
CREATE TABLE IF NOT EXISTS ovitrap_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL,
    collection_interval_days INT DEFAULT 5,
    installation_frequency_days INT DEFAULT 28,
    double_check_enabled BOOLEAN DEFAULT false,
    double_check_threshold INT DEFAULT 15,
    alert_eggs_threshold INT DEFAULT 100,
    persistent_positive_cycles INT DEFAULT 3,
    ipo_methodology VARCHAR(50) DEFAULT 'padrao_ms',
    ido_methodology VARCHAR(50) DEFAULT 'padrao_ms',
    trend_sensitivity VARCHAR(30) DEFAULT 'moderada',
    gps_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_ovitrap_settings_mun UNIQUE (municipality_id)
);

-- RLS para ovitrap_settings
ALTER TABLE ovitrap_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ovitrap_settings' AND policyname = 'settings_select_all') THEN
        CREATE POLICY settings_select_all ON ovitrap_settings FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ovitrap_settings' AND policyname = 'settings_all_auth') THEN
        CREATE POLICY settings_all_auth ON ovitrap_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 6. ÍNDICES DE ALTA VELOCIDADE ADICIONAIS
CREATE INDEX IF NOT EXISTS idx_ovitraps_active ON ovitraps(active, municipality_id);
CREATE INDEX IF NOT EXISTS idx_ovitraps_sec_active ON ovitraps(sector_id, active);
CREATE INDEX IF NOT EXISTS idx_ovitrap_col_date ON ovitrap_collections(collection_date);
CREATE INDEX IF NOT EXISTS idx_ovitrap_col_trap ON ovitrap_collections(ovitrap_id);
CREATE INDEX IF NOT EXISTS idx_ovitrap_res_date ON ovitrap_results(reading_date, positive);
CREATE INDEX IF NOT EXISTS idx_ovitrap_res_trap ON ovitrap_results(ovitrap_id);
