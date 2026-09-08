-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 12: EXPANSÃO EPIDEMIOLÓGICA, SEMANAS EPIDEMIOLÓGICAS E PLANEJAMENTO
-- ==============================================================================

-- 1. ADICIONAR CAMPOS OFICIAIS DO SINAN EM EPIDEMIOLOGICAL_CASES
ALTER TABLE epidemiological_cases
    ADD COLUMN IF NOT EXISTS patient_age_group VARCHAR(30),
    ADD COLUMN IF NOT EXISTS sex VARCHAR(10),
    ADD COLUMN IF NOT EXISTS pregnant BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS case_origin VARCHAR(30) DEFAULT 'AUTOCTONE',
    ADD COLUMN IF NOT EXISTS probable_infection_location VARCHAR(150),
    ADD COLUMN IF NOT EXISTS notification_unit VARCHAR(150),
    ADD COLUMN IF NOT EXISTS clinical_classification VARCHAR(60),
    ADD COLUMN IF NOT EXISTS laboratory_result VARCHAR(50),
    ADD COLUMN IF NOT EXISTS confirmation_date DATE,
    ADD COLUMN IF NOT EXISTS discard_date DATE,
    ADD COLUMN IF NOT EXISTS hospitalization BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS death BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS death_date DATE,
    ADD COLUMN IF NOT EXISTS epidemiological_week INT,
    ADD COLUMN IF NOT EXISTS epidemiological_year INT;

-- 2. TABELA DE APOIO A SEMANAS EPIDEMIOLÓGICAS (CALENDÁRIO OFICIAL MS/OMS/CDC)
CREATE TABLE IF NOT EXISTS epidemiological_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    week_number INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_year_week UNIQUE (year, week_number)
);

-- 3. TABELA DE VERSIONAMENTO E AUDITORIA DE PLANEJAMENTO DE CAMPO
CREATE TABLE IF NOT EXISTS operational_plans_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    title VARCHAR(150) NOT NULL,
    target_date DATE NOT NULL,
    planned_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(30) NOT NULL DEFAULT 'APROVADO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE epidemiological_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_plans_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_epidemiological_weeks" ON epidemiological_weeks;
CREATE POLICY "tenant_isolation_epidemiological_weeks" ON epidemiological_weeks
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "tenant_isolation_operational_plans_history" ON operational_plans_history;
CREATE POLICY "tenant_isolation_operational_plans_history" ON operational_plans_history
    FOR ALL USING (
        is_superadmin() OR auth.uid() IS NULL OR municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
    ) WITH CHECK (
        is_superadmin() OR auth.uid() IS NULL OR municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- 5. POVOAR SEMANAS EPIDEMIOLÓGICAS DE 2026 (PADRÃO DOMINGO A SÁBADO)
DO $$
DECLARE
    cur_date DATE := '2026-01-04'::DATE; -- Primeiro domingo com maioria dos dias em 2026
    w_num INT := 1;
BEGIN
    WHILE w_num <= 52 LOOP
        INSERT INTO epidemiological_weeks (year, week_number, start_date, end_date)
        VALUES (2026, w_num, cur_date, cur_date + 6)
        ON CONFLICT (year, week_number) DO UPDATE 
        SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date;

        cur_date := cur_date + 7;
        w_num := w_num + 1;
    END LOOP;

    -- Povoar também 2025 para comparativo histórico
    cur_date := '2024-12-29'::DATE;
    w_num := 1;
    WHILE w_num <= 52 LOOP
        INSERT INTO epidemiological_weeks (year, week_number, start_date, end_date)
        VALUES (2025, w_num, cur_date, cur_date + 6)
        ON CONFLICT (year, week_number) DO NOTHING;

        cur_date := cur_date + 7;
        w_num := w_num + 1;
    END LOOP;
END $$;

-- 6. ATUALIZAR E EXPANDIR CASOS EPIDEMIOLÓGICOS DE DEMONSTRAÇÃO
DO $$
DECLARE
    mun_id UUID := '00000000-0000-0000-0000-000000000001';
    neigh_id UUID;
BEGIN
    SELECT id INTO neigh_id FROM neighborhoods WHERE municipality_id = mun_id LIMIT 1;

    -- Atualizar casos existentes
    UPDATE epidemiological_cases
    SET 
        patient_age_group = '20-34',
        sex = 'F',
        pregnant = false,
        case_origin = 'AUTOCTONE',
        notification_unit = 'UBS Central',
        clinical_classification = 'DENGUE_CLASSICA',
        laboratory_result = 'POSITIVO_NS1',
        confirmation_date = CURRENT_DATE - 2,
        hospitalization = false,
        death = false,
        epidemiological_week = 36,
        epidemiological_year = 2026
    WHERE municipality_id = mun_id AND notification_number = 'SINAN-2026-00452';

    -- Inserir novos casos com perfis variados para gráficos epidemiológicos
    IF neigh_id IS NOT NULL THEN
        INSERT INTO epidemiological_cases (
            municipality_id, disease, notification_number, notification_date, symptom_start_date,
            neighborhood_id, classification, clinical_classification, laboratory_result, status,
            patient_age_group, sex, pregnant, hospitalization, death, epidemiological_week, epidemiological_year
        ) VALUES
            (mun_id, 'DENGUE', 'SINAN-2026-00455', CURRENT_DATE - 8, CURRENT_DATE - 12, neigh_id, 'CONFIRMADO_LAB', 'DENGUE_COM_SINAIS_ALARME', 'POSITIVO_RT_PCR', 'CONCLUIDO', '50-64', 'M', false, true, false, 35, 2026),
            (mun_id, 'DENGUE', 'SINAN-2026-00456', CURRENT_DATE - 15, CURRENT_DATE - 18, neigh_id, 'CONFIRMADO_LAB', 'DENGUE_CLASSICA', 'POSITIVO_NS1', 'CONCLUIDO', '35-49', 'F', false, false, false, 34, 2026),
            (mun_id, 'ZIKA', 'SINAN-2026-00457', CURRENT_DATE - 5, CURRENT_DATE - 9, neigh_id, 'SUSPEITO', 'ZIKA_AGUDA', NULL, 'NOTIFICADO', '20-34', 'F', true, false, false, 36, 2026),
            (mun_id, 'CHIKUNGUNYA', 'SINAN-2026-00458', CURRENT_DATE - 22, CURRENT_DATE - 25, neigh_id, 'DESCARTADO', 'OUTRO_AGRAVO', 'NEGATIVO', 'CONCLUIDO', '65+', 'M', false, false, false, 33, 2026)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
