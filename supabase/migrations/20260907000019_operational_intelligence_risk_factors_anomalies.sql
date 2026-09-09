-- ==============================================================================
-- ENDEMIAS GOV - FASE DE INTELIGÊNCIA OPERACIONAL
-- TABELAS: risk_factor_settings, operational_anomalies E ADEQUAÇÕES EM alerts
-- ==============================================================================

-- 1. TABELA DE CONFIGURAÇÃO DETALHADA DOS FATORES DE RISCO
CREATE TABLE IF NOT EXISTS risk_factor_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    factor VARCHAR(50) NOT NULL,
    weight NUMERIC NOT NULL DEFAULT 10.0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    lookback_days INT NOT NULL DEFAULT 30,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    CONSTRAINT unique_municipality_risk_factor UNIQUE (municipality_id, factor)
);

CREATE INDEX IF NOT EXISTS idx_risk_factor_settings_muni ON risk_factor_settings(municipality_id);

-- 2. POPULAR FATORES PADRÃO PARA O MUNICÍPIO PRINCIPAL
INSERT INTO risk_factor_settings (municipality_id, factor, weight, enabled, lookback_days, configuration)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'recent_foci', 20.0, true, 30, '{"description": "Focos ativos recentes de Aedes aegypti"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'recurrence', 15.0, true, 90, '{"description": "Imóveis ou quadras reincidentes em focos"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'epidemiological_cases', 15.0, true, 30, '{"description": "Casos notificados de arboviroses no território"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'positive_ovitraps', 10.0, true, 15, '{"description": "Índice de positividade de ovitrampas sentinela"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'egg_density', 5.0, true, 15, '{"description": "Índice de densidade de ovos por armadilha"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'iip', 5.0, true, 60, '{"description": "Índice de Infestação Predial (LIRAa)"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'ib', 5.0, true, 60, '{"description": "Índice de Breteau (LIRAa)"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'low_coverage', 10.0, true, 60, '{"description": "Déficit em relação à meta de cobertura do ciclo"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'closed_properties', 5.0, true, 30, '{"description": "Percentual elevado de imóveis fechados"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'refusals', 5.0, true, 30, '{"description": "Impedimentos e recusas deliberadas de vistoria"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'pendencies', 5.0, true, 30, '{"description": "Pendências de visita não recuperadas no prazo"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'overdue_pe', 5.0, true, 15, '{"description": "Pontos Estratégicos com vistoria quinzenal vencida"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'overdue_ie', 5.0, true, 30, '{"description": "Imóveis Especiais sem vistoria periódica"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'complaints', 5.0, true, 30, '{"description": "Denúncias comunitárias ativas aguardando ACE"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'days_without_visit', 5.0, true, 60, '{"description": "Tempo decorrido sem qualquer inspeção territorial"}'::jsonb),
    ('00000000-0000-0000-0000-000000000001', 'active_blockades', 10.0, true, 14, '{"description": "Bloqueios químicos ou focais em andamento"}'::jsonb)
ON CONFLICT (municipality_id, factor) DO NOTHING;

-- 3. TABELA DE ANOMALIAS E QUALIDADE OPERACIONAL
CREATE TABLE IF NOT EXISTS operational_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    anomaly_type VARCHAR(60) NOT NULL, 
    -- 'duplicate_visit', 'visit_without_property', 'visit_without_agent', 'visit_outside_cycle',
    -- 'production_without_visit', 'positive_deposit_without_foci', 'foci_without_territory',
    -- 'ovitrap_without_collection', 'overdue_pe_without_schedule', 'impossible_cycle_coverage',
    -- 'impossible_duration_activity', 'duplicate_sync'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    severity VARCHAR(20) NOT NULL DEFAULT 'media', -- 'baixa', 'media', 'alta', 'critica'
    status VARCHAR(30) NOT NULL DEFAULT 'detectada', -- 'detectada', 'em_revisao', 'corrigida', 'justificada'
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    justification TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_anomalies_muni ON operational_anomalies(municipality_id, status);
CREATE INDEX IF NOT EXISTS idx_op_anomalies_severity ON operational_anomalies(severity);

-- 4. ATUALIZAR TABELA ALERTS COM CAMPOS DE AGRUPAMENTO E ESCALONAMENTO
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'group_key') THEN
        ALTER TABLE alerts ADD COLUMN group_key VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'occurrence_count') THEN
        ALTER TABLE alerts ADD COLUMN occurrence_count INT NOT NULL DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'escalation_level') THEN
        ALTER TABLE alerts ADD COLUMN escalation_level VARCHAR(30) NOT NULL DEFAULT 'supervisor'; -- 'supervisor', 'coordenador', 'gestor'
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'resolved_by') THEN
        ALTER TABLE alerts ADD COLUMN resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'resolved_at') THEN
        ALTER TABLE alerts ADD COLUMN resolved_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'metadata') THEN
        ALTER TABLE alerts ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 5. RLS POLICIES
ALTER TABLE risk_factor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_anomalies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'risk_factor_settings' AND policyname = 'risk_factor_settings_select_policy') THEN
        CREATE POLICY risk_factor_settings_select_policy ON risk_factor_settings FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'risk_factor_settings' AND policyname = 'risk_factor_settings_all_policy') THEN
        CREATE POLICY risk_factor_settings_all_policy ON risk_factor_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operational_anomalies' AND policyname = 'operational_anomalies_select_policy') THEN
        CREATE POLICY operational_anomalies_select_policy ON operational_anomalies FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operational_anomalies' AND policyname = 'operational_anomalies_all_policy') THEN
        CREATE POLICY operational_anomalies_all_policy ON operational_anomalies FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
