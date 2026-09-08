-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 20260907000013
-- OPERAÇÕES CRÍTICAS, CONFIGURAÇÕES MUNICIPAIS, IMPORTAÇÃO, LOGS E INTEGRIDADE
-- ==============================================================================

-- 1. Expandir system_settings
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'GERAL';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Criar import_jobs
CREATE TABLE IF NOT EXISTS import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    entity_type VARCHAR(60) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    total_records INTEGER NOT NULL DEFAULT 0,
    valid_records INTEGER NOT NULL DEFAULT 0,
    invalid_records INTEGER NOT NULL DEFAULT 0,
    duplicate_records INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PROCESSANDO',
    error_summary JSONB,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Criar system_error_logs
CREATE TABLE IF NOT EXISTS system_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
    request_id VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_role VARCHAR(50),
    page VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    severity VARCHAR(30) NOT NULL DEFAULT 'ERROR',
    status VARCHAR(30) NOT NULL DEFAULT 'NOVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Criar database_backups
CREATE TABLE IF NOT EXISTS database_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    backup_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'CONCLUIDO',
    checksum VARCHAR(100),
    tables_included JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Ativar RLS
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_backups ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'import_jobs_tenant_policy' AND tablename = 'import_jobs') THEN
        CREATE POLICY import_jobs_tenant_policy ON import_jobs
            FOR ALL
            USING (
                is_superadmin() 
                OR auth.uid() IS NULL
                OR municipality_id = current_user_municipality_id()
                OR municipality_id = '00000000-0000-0000-0000-000000000001'
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'system_error_logs_tenant_policy' AND tablename = 'system_error_logs') THEN
        CREATE POLICY system_error_logs_tenant_policy ON system_error_logs
            FOR ALL
            USING (
                is_superadmin() 
                OR auth.uid() IS NULL
                OR municipality_id = current_user_municipality_id()
                OR municipality_id = '00000000-0000-0000-0000-000000000001'
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'database_backups_tenant_policy' AND tablename = 'database_backups') THEN
        CREATE POLICY database_backups_tenant_policy ON database_backups
            FOR ALL
            USING (
                is_superadmin() 
                OR auth.uid() IS NULL
                OR municipality_id = current_user_municipality_id()
                OR municipality_id = '00000000-0000-0000-0000-000000000001'
            );
    END IF;
END $$;

-- 7. Índices de performance
CREATE INDEX IF NOT EXISTS idx_import_jobs_mun ON import_jobs(municipality_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_error_logs_req ON system_error_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_system_error_logs_created ON system_error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_database_backups_mun ON database_backups(municipality_id, created_at DESC);
