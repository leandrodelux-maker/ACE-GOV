-- ==============================================================================
-- ENDEMIAS GOV - MOTOR DE RISCO (CONFIGURAÇÃO DE PESOS E HISTÓRICO DE RISCO)
-- ==============================================================================

-- 1. TABELA DE CONFIGURAÇÃO DE PESOS DO MOTOR DE RISCO
CREATE TABLE IF NOT EXISTS risk_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    weight_recent_foci NUMERIC NOT NULL DEFAULT 25.0,
    weight_recurrence NUMERIC NOT NULL DEFAULT 20.0,
    weight_epidemiological_cases NUMERIC NOT NULL DEFAULT 15.0,
    weight_ovitraps NUMERIC NOT NULL DEFAULT 10.0,
    weight_egg_density NUMERIC NOT NULL DEFAULT 5.0,
    weight_complaints NUMERIC NOT NULL DEFAULT 5.0,
    weight_closed_properties NUMERIC NOT NULL DEFAULT 5.0,
    weight_refusals NUMERIC NOT NULL DEFAULT 5.0,
    weight_low_coverage NUMERIC NOT NULL DEFAULT 5.0,
    weight_overdue_pe NUMERIC NOT NULL DEFAULT 5.0,
    weight_days_without_visit NUMERIC NOT NULL DEFAULT 5.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_municipality_risk_settings UNIQUE (municipality_id)
);

-- 2. TABELA DE HISTÓRICO DA EVOLUÇÃO TEMPORAL DE RISCO
CREATE TABLE IF NOT EXISTS risk_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    entity_type VARCHAR(30) NOT NULL, -- 'PROPERTY', 'BLOCK', 'SECTOR', 'NEIGHBORHOOD', 'MUNICIPALITY'
    entity_id UUID NOT NULL,
    entity_name VARCHAR(150),
    risk_score INT NOT NULL, -- 0 a 100
    risk_level VARCHAR(30) NOT NULL, -- 'BAIXO', 'ATENCAO', 'ALTO', 'CRITICO'
    factors JSONB NOT NULL DEFAULT '[]'::jsonb, -- Fatores detalhados que compuseram o score
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_history_entity ON risk_history(entity_type, entity_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_history_muni ON risk_history(municipality_id, calculated_at DESC);

-- 3. INSERIR CONFIGURAÇÃO PADRÃO PARA O MUNICÍPIO ATIVO
INSERT INTO risk_settings (
    municipality_id,
    weight_recent_foci,
    weight_recurrence,
    weight_epidemiological_cases,
    weight_ovitraps,
    weight_egg_density,
    weight_complaints,
    weight_closed_properties,
    weight_refusals,
    weight_low_coverage,
    weight_overdue_pe,
    weight_days_without_visit
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    25.0,
    20.0,
    15.0,
    10.0,
    5.0,
    5.0,
    5.0,
    5.0,
    5.0,
    5.0,
    5.0
)
ON CONFLICT (municipality_id) DO NOTHING;
