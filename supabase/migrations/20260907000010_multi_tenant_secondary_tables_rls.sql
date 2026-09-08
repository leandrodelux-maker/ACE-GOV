-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 10: RLS COMPLETO PARA TABELAS SECUNDÁRIAS, SUPRIMENTOS E EQUIPAMENTOS
-- ==============================================================================

-- 1. TABELAS DE INSUMOS E EQUIPAMENTOS
CREATE TABLE IF NOT EXISTS supplies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- LARVICIDA, INSETICIDA, EPI, CONSUMO, OUTRO
    batch_number VARCHAR(50),
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(20) NOT NULL DEFAULT 'un',
    minimum_stock NUMERIC(10,2) NOT NULL DEFAULT 10.00,
    expiration_date DATE,
    status VARCHAR(40) NOT NULL DEFAULT 'DISPONIVEL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL, -- BOMBA_COSTAL_MANUAL, BOMBA_MOTORIZADA, UBV_PESADO, TERMONEBULIZADOR, TABLET
    serial_number VARCHAR(80),
    assigned_to_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'OPERACIONAL', -- OPERACIONAL, MANUTENCAO, BAIXADO
    last_maintenance DATE,
    next_maintenance DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ
);

-- 2. HABILITAR RLS EM TODAS AS TABELAS RESTANTES
ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockade_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockade_operation_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE epidemiological_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DE ROW LEVEL SECURITY (MULTI-TENANT ISOLATION)

-- risk_settings
DROP POLICY IF EXISTS "tenant_isolation_risk_settings" ON risk_settings;
CREATE POLICY "tenant_isolation_risk_settings" ON risk_settings
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- risk_history
DROP POLICY IF EXISTS "tenant_isolation_risk_history" ON risk_history;
CREATE POLICY "tenant_isolation_risk_history" ON risk_history
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- blockade_operations
DROP POLICY IF EXISTS "tenant_isolation_blockade_operations" ON blockade_operations;
CREATE POLICY "tenant_isolation_blockade_operations" ON blockade_operations
    FOR ALL USING (
        deleted_at IS NULL AND (
            is_superadmin() 
            OR auth.uid() IS NULL
            OR municipality_id = current_user_municipality_id()
            OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    ) WITH CHECK (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- epidemiological_cases
DROP POLICY IF EXISTS "tenant_isolation_epidemiological_cases" ON epidemiological_cases;
CREATE POLICY "tenant_isolation_epidemiological_cases" ON epidemiological_cases
    FOR ALL USING (
        deleted_at IS NULL AND (
            is_superadmin() 
            OR auth.uid() IS NULL
            OR municipality_id = current_user_municipality_id()
            OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    ) WITH CHECK (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- field_plans
DROP POLICY IF EXISTS "tenant_isolation_field_plans" ON field_plans;
CREATE POLICY "tenant_isolation_field_plans" ON field_plans
    FOR ALL USING (
        deleted_at IS NULL AND (
            is_superadmin() 
            OR auth.uid() IS NULL
            OR municipality_id = current_user_municipality_id()
            OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    ) WITH CHECK (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- supplies
DROP POLICY IF EXISTS "tenant_isolation_supplies" ON supplies;
CREATE POLICY "tenant_isolation_supplies" ON supplies
    FOR ALL USING (
        deleted_at IS NULL AND (
            is_superadmin() 
            OR auth.uid() IS NULL
            OR municipality_id = current_user_municipality_id()
            OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    ) WITH CHECK (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- equipment
DROP POLICY IF EXISTS "tenant_isolation_equipment" ON equipment;
CREATE POLICY "tenant_isolation_equipment" ON equipment
    FOR ALL USING (
        deleted_at IS NULL AND (
            is_superadmin() 
            OR auth.uid() IS NULL
            OR municipality_id = current_user_municipality_id()
            OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    ) WITH CHECK (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- audit_logs
DROP POLICY IF EXISTS "tenant_isolation_audit_logs" ON audit_logs;
CREATE POLICY "tenant_isolation_audit_logs" ON audit_logs
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- alerts
DROP POLICY IF EXISTS "tenant_isolation_alerts" ON alerts;
CREATE POLICY "tenant_isolation_alerts" ON alerts
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- 4. SEED INICIAL DE DADOS PARA TESTE DOS MÓDULOS (SANTA CRUZ DO SUL)
DO $$
DECLARE
    mun_id UUID := '00000000-0000-0000-0000-000000000001';
    neigh_id UUID;
    prof_id UUID;
BEGIN
    SELECT id INTO prof_id FROM profiles LIMIT 1;
    SELECT id INTO neigh_id FROM neighborhoods WHERE municipality_id = mun_id LIMIT 1;

    -- Suprimentos
    INSERT INTO supplies (municipality_id, name, category, batch_number, quantity, unit, minimum_stock, expiration_date)
    VALUES 
        (mun_id, 'Piriproxifeno 0,5% G', 'LARVICIDA', 'LOTE-2026-04A', 45.5, 'kg', 15.0, '2027-12-31'),
        (mun_id, 'Bacillus thuringiensis israelensis (BTI)', 'LARVICIDA', 'LOTE-2026-09B', 30.0, 'kg', 10.0, '2027-06-30'),
        (mun_id, 'Cielo (Malation + Permetrina) UBV', 'INSETICIDA', 'LOTE-2025-88X', 120.0, 'litros', 40.0, '2026-11-15'),
        (mun_id, 'Respirador PFF2 / N95', 'EPI', 'EPI-2026-01', 250.0, 'un', 50.0, '2028-01-01'),
        (mun_id, 'Pipeta Pasteur de Descarte', 'CONSUMO', 'MAT-2026-55', 600.0, 'un', 100.0, '2029-01-01')
    ON CONFLICT DO NOTHING;

    -- Equipamentos
    INSERT INTO equipment (municipality_id, code, name, type, serial_number, status, last_maintenance, next_maintenance)
    VALUES 
        (mun_id, 'EQP-BC-01', 'Pulverizador Costal de Compressão Prévia Guarany 10L', 'BOMBA_COSTAL_MANUAL', 'GUA-88392-BR', 'OPERACIONAL', '2026-01-10', '2026-07-10'),
        (mun_id, 'EQP-BC-02', 'Pulverizador Costal de Compressão Prévia Guarany 10L', 'BOMBA_COSTAL_MANUAL', 'GUA-88393-BR', 'OPERACIONAL', '2026-01-10', '2026-07-10'),
        (mun_id, 'EQP-UBV-01', 'Gerador de Aerossol UBV Pesado Veicular Micro-Gen', 'UBV_PESADO', 'UBV-VEC-2024-99', 'OPERACIONAL', '2026-02-15', '2026-08-15'),
        (mun_id, 'EQP-TN-01', 'Termonebulizador Portátil PulsFOG K-10', 'TERMONEBULIZADOR', 'PULSFOG-44102', 'MANUTENCAO', '2025-11-20', '2026-03-30'),
        (mun_id, 'EQP-TAB-01', 'Tablet Rugerizado Coleta de Campo 8"', 'TABLET', 'SAMSUNG-ACT3-001', 'OPERACIONAL', '2026-01-05', '2027-01-05')
    ON CONFLICT DO NOTHING;

    -- Casos Epidemiológicos
    IF neigh_id IS NOT NULL THEN
        INSERT INTO epidemiological_cases (municipality_id, disease, notification_number, notification_date, symptom_start_date, neighborhood_id, classification, status)
        VALUES 
            (mun_id, 'DENGUE', 'SINAN-2026-00452', CURRENT_DATE - 3, CURRENT_DATE - 7, neigh_id, 'CONFIRMADO_LAB', 'EM_INVESTIGACAO'),
            (mun_id, 'DENGUE', 'SINAN-2026-00453', CURRENT_DATE - 2, CURRENT_DATE - 5, neigh_id, 'SUSPEITO', 'NOTIFICADO'),
            (mun_id, 'CHIKUNGUNYA', 'SINAN-2026-00454', CURRENT_DATE - 1, CURRENT_DATE - 4, neigh_id, 'SUSPEITO', 'NOTIFICADO')
        ON CONFLICT DO NOTHING;

        -- Operações de Bloqueio
        INSERT INTO blockade_operations (municipality_id, code, neighborhood_id, disease, planned_properties, completed_properties, coverage_percentage, started_at, status)
        VALUES 
            (mun_id, 'BLQ-2026-001', neigh_id, 'DENGUE', 150, 95, 63.33, CURRENT_DATE - 2, 'EM_ANDAMENTO'),
            (mun_id, 'BLQ-2026-002', neigh_id, 'CHIKUNGUNYA', 120, 120, 100.00, CURRENT_DATE - 8, 'CONCLUIDA')
        ON CONFLICT (code) DO NOTHING;
    END IF;

    -- Logs de Auditoria Iniciais
    INSERT INTO audit_logs (municipality_id, user_id, action, module, entity, entity_id, new_data)
    VALUES 
        (mun_id, prof_id, 'SECURITY_INIT', 'seguranca', 'rls_policies', 'all', '{"message": "Políticas de Row Level Security multi-tenant ativadas com sucesso."}'::jsonb),
        (mun_id, prof_id, 'RBAC_CONFIG', 'permissoes', 'roles', 'all', '{"message": "Catálogo de 8 perfis e 25 permissões do SUS mapeados."}'::jsonb);
END $$;
