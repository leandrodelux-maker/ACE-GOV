-- ==============================================================================
-- ENDEMIAS GOV - ADEQUAÇÃO DEFINITIVA DA REDE DE OVITRAMPAS
-- ==============================================================================

-- 1. ADICIONAR CAMPOS COMPLEMENTARES NA TABELA OVITRAPS
ALTER TABLE ovitraps
ADD COLUMN IF NOT EXISTS address VARCHAR(255),
ADD COLUMN IF NOT EXISTS reference_point VARCHAR(255),
ADD COLUMN IF NOT EXISTS location_type VARCHAR(60) DEFAULT 'Residencial',
ADD COLUMN IF NOT EXISTS microarea_id UUID REFERENCES microareas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS block_id UUID REFERENCES blocks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS last_installation_date DATE,
ADD COLUMN IF NOT EXISTS last_collection_date DATE,
ADD COLUMN IF NOT EXISTS next_collection_date DATE,
ADD COLUMN IF NOT EXISTS last_eggs_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_result_status VARCHAR(30) DEFAULT 'NEGATIVA',
ADD COLUMN IF NOT EXISTS is_positive BOOLEAN DEFAULT FALSE;

-- 2. ADICIONAR CAMPOS COMPLEMENTARES NAS TABELAS DE FLUXO
ALTER TABLE ovitrap_installations
ADD COLUMN IF NOT EXISTS paddle_code VARCHAR(60),
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS installation_time TIME DEFAULT CURRENT_TIME;

ALTER TABLE ovitrap_collections
ADD COLUMN IF NOT EXISTS collection_time TIME DEFAULT CURRENT_TIME,
ADD COLUMN IF NOT EXISTS trap_condition VARCHAR(40) DEFAULT 'coleta_realizada',
ADD COLUMN IF NOT EXISTS paddle_condition VARCHAR(40) DEFAULT 'intacta',
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE ovitrap_results
ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS reading_status VARCHAR(30) DEFAULT 'positiva',
ADD COLUMN IF NOT EXISTS aedes_species VARCHAR(60) DEFAULT 'Aedes aegypti';

-- 3. ÍNDICES DE ALTA PERFORMANCE PARA O DASHBOARD E MAPA
CREATE INDEX IF NOT EXISTS idx_ovitraps_status ON ovitraps(status, is_positive);
CREATE INDEX IF NOT EXISTS idx_ovitraps_next_col ON ovitraps(next_collection_date);
CREATE INDEX IF NOT EXISTS idx_ovitraps_agent ON ovitraps(responsible_agent_id);
CREATE INDEX IF NOT EXISTS idx_ovitrap_col_inst ON ovitrap_collections(installation_id);
CREATE INDEX IF NOT EXISTS idx_ovitrap_res_col ON ovitrap_results(collection_id);

-- 4. RLS POLICIES
ALTER TABLE ovitrap_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ovitrap_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ovitrap_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ovitrap_installations' AND policyname = 'inst_select') THEN
        CREATE POLICY inst_select ON ovitrap_installations FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ovitrap_installations' AND policyname = 'inst_all') THEN
        CREATE POLICY inst_all ON ovitrap_installations FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ovitrap_collections' AND policyname = 'col_select') THEN
        CREATE POLICY col_select ON ovitrap_collections FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ovitrap_collections' AND policyname = 'col_all') THEN
        CREATE POLICY col_all ON ovitrap_collections FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ovitrap_results' AND policyname = 'res_select') THEN
        CREATE POLICY res_select ON ovitrap_results FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ovitrap_results' AND policyname = 'res_all') THEN
        CREATE POLICY res_all ON ovitrap_results FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
