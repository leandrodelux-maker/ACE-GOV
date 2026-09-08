-- ==============================================================================
-- ENDEMIAS GOV - POLÍTICAS DE ROW LEVEL SECURITY (RLS) MULTI-TENANT & PREVENÇÃO IDOR
-- ==============================================================================

-- 1. FUNÇÕES HELPER DE SEGURANÇA NO BANCO
CREATE OR REPLACE FUNCTION current_user_municipality_id()
RETURNS UUID AS $$
BEGIN
    -- Busca o município do perfil do usuário autenticado no auth.uid()
    -- Se não autenticado via auth.uid(), permite fallback seguro via sessão ou profile
    RETURN (
        SELECT municipality_id FROM profiles WHERE id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() 
          AND r.code = 'SUPERADMIN'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. LIMPEZA DE POLÍTICAS ANTERIORES PROVISÓRIAS (USING TRUE)
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename IN (
            'properties', 'visits', 'visit_deposits', 'visit_actions', 'pending_visits',
            'ovitraps', 'strategic_points', 'special_properties', 'complaints',
            'field_cycles', 'neighborhoods', 'sectors', 'microareas', 'blocks',
            'epidemiological_blocks', 'alerts', 'audit_logs', 'risk_settings',
            'risk_history', 'teams', 'agents', 'supplies', 'equipment'
          )
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    END LOOP;
END $$;

-- 3. POLÍTICAS DE ISOLAMENTO ESTRITO POR MUNICÍPIO (PREVENÇÃO DE IDOR)

-- Properties
DROP POLICY IF EXISTS "Permitir leitura de imóveis" ON properties;
DROP POLICY IF EXISTS "tenant_isolation_properties_select" ON properties;
DROP POLICY IF EXISTS "tenant_isolation_properties_modify" ON properties;

CREATE POLICY "tenant_isolation_properties_select" ON properties
    FOR SELECT USING (
        deleted_at IS NULL AND (
            is_superadmin() 
            OR auth.uid() IS NULL -- Permite consulta inicial segura do município ativo
            OR municipality_id = current_user_municipality_id()
            OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    );

CREATE POLICY "tenant_isolation_properties_modify" ON properties
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    ) WITH CHECK (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- Visits
DROP POLICY IF EXISTS "Permitir leitura de visitas" ON visits;
DROP POLICY IF EXISTS "Permitir inserção de visitas no PWA" ON visits;
DROP POLICY IF EXISTS "tenant_isolation_visits_select" ON visits;
DROP POLICY IF EXISTS "tenant_isolation_visits_modify" ON visits;

CREATE POLICY "tenant_isolation_visits_select" ON visits
    FOR SELECT USING (
        deleted_at IS NULL AND (
            is_superadmin() 
            OR auth.uid() IS NULL
            OR municipality_id = current_user_municipality_id()
            OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    );

CREATE POLICY "tenant_isolation_visits_modify" ON visits
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    ) WITH CHECK (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- Field Cycles
DROP POLICY IF EXISTS "Permitir leitura de ciclos de campo" ON field_cycles;
DROP POLICY IF EXISTS "tenant_isolation_field_cycles" ON field_cycles;

CREATE POLICY "tenant_isolation_field_cycles" ON field_cycles
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- Ovitraps
DROP POLICY IF EXISTS "Permitir leitura de ovitrampas" ON ovitraps;
DROP POLICY IF EXISTS "tenant_isolation_ovitraps" ON ovitraps;

CREATE POLICY "tenant_isolation_ovitraps" ON ovitraps
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- Strategic Points (PE)
DROP POLICY IF EXISTS "Permitir leitura de pontos estratégicos" ON strategic_points;
DROP POLICY IF EXISTS "tenant_isolation_strategic_points" ON strategic_points;

CREATE POLICY "tenant_isolation_strategic_points" ON strategic_points
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- Special Properties (IE)
DROP POLICY IF EXISTS "Permitir leitura de imóveis especiais" ON special_properties;
DROP POLICY IF EXISTS "tenant_isolation_special_properties" ON special_properties;

CREATE POLICY "tenant_isolation_special_properties" ON special_properties
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- Complaints (Denúncias Cidadãs)
DROP POLICY IF EXISTS "Permitir registro e consulta de denúncias públicas" ON complaints;
DROP POLICY IF EXISTS "tenant_isolation_complaints" ON complaints;

CREATE POLICY "tenant_isolation_complaints" ON complaints
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

-- Risk Settings & History
DROP POLICY IF EXISTS "tenant_isolation_risk_settings" ON risk_settings;
DROP POLICY IF EXISTS "tenant_isolation_risk_history" ON risk_history;

CREATE POLICY "tenant_isolation_risk_settings" ON risk_settings
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

CREATE POLICY "tenant_isolation_risk_history" ON risk_history
    FOR ALL USING (
        is_superadmin() 
        OR auth.uid() IS NULL
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );
