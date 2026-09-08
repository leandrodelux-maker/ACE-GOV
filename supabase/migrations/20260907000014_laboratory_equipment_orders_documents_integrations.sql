-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 20260907000014
-- LABORATÓRIO ENTOMOLÓGICO, EQUIPAMENTOS, ORDENS DE SERVIÇO,
-- SUPERVISÃO, EVIDÊNCIAS DE CAMPO, ASSINATURA ELETRÔNICA E INTEGRAÇÕES
-- ==============================================================================

-- 1. LABORATÓRIO ENTOMOLÓGICO: Amostras
CREATE TABLE IF NOT EXISTS entomological_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    sample_code VARCHAR(50) NOT NULL,
    collection_type VARCHAR(50) NOT NULL, -- larva, pupa, ovo, mosquito_adulto, outro
    origin_type VARCHAR(50), -- visita, ovitrampa, liraa, pe, denuncia, outro
    origin_id UUID,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
    ovitrap_collection_id UUID REFERENCES ovitrap_collections(id) ON DELETE SET NULL,
    liraa_survey_id UUID REFERENCES liraa_surveys(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    collection_date DATE NOT NULL,
    received_at TIMESTAMPTZ,
    received_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'coletada', -- coletada, em_transporte, recebida, em_analise, identificada, finalizada, descartada
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. LABORATÓRIO ENTOMOLÓGICO: Identificações
CREATE TABLE IF NOT EXISTS entomological_identifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL REFERENCES entomological_samples(id) ON DELETE CASCADE,
    species VARCHAR(100) NOT NULL, -- Aedes aegypti, Aedes albopictus, Culex spp., Anopheles spp., etc.
    genus VARCHAR(50),
    stage VARCHAR(50), -- larva, pupa, ovo, adulto
    quantity INTEGER NOT NULL DEFAULT 1,
    positive_for_aedes BOOLEAN DEFAULT false,
    identified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    identified_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EXPANSÃO DE EQUIPAMENTOS
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS model VARCHAR(100);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS assigned_to_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. MOVIMENTAÇÕES DE EQUIPAMENTOS
CREATE TABLE IF NOT EXISTS equipment_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL, -- entrega, devolucao, transferencia, manutencao, baixa
    from_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    registered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MANUTENÇÃO DE EQUIPAMENTOS
CREATE TABLE IF NOT EXISTS equipment_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(50) NOT NULL, -- preventiva, corretiva, calibracao
    description TEXT NOT NULL,
    provider VARCHAR(150),
    cost NUMERIC(10,2),
    sent_at DATE NOT NULL,
    returned_at DATE,
    next_maintenance DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'em_manutencao', -- em_manutencao, concluida, cancelada
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ORDENS DE SERVIÇO (OS)
CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    number VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL, -- vistoria, bloqueio, denuncia, ponto_estrategico, imovel_especial, reincidencia, controle_vetorial, levantamento, outro
    title VARCHAR(200) NOT NULL,
    description TEXT,
    priority VARCHAR(30) NOT NULL DEFAULT 'normal', -- baixa, normal, alta, urgente, critica
    status VARCHAR(30) NOT NULL DEFAULT 'aberta', -- aberta, atribuida, em_execucao, concluida, cancelada
    requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    neighborhood_id UUID REFERENCES neighborhoods(id) ON DELETE SET NULL,
    sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    planned_date DATE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completion_result VARCHAR(50),
    completion_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SUPERVISÃO DE CAMPO
CREATE TABLE IF NOT EXISTS field_supervisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    supervisor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL,
    result VARCHAR(100) NOT NULL, -- conforme, orientacao, inconsistencia, retorno
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. EVIDÊNCIAS DE CAMPO SEGURAS
CREATE TABLE IF NOT EXISTS field_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- visita, foco, denuncia, pe, ie, bloqueio, os, equipamento
    entity_id UUID NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. ASSINATURAS ELETRÔNICAS INTERNAS
CREATE TABLE IF NOT EXISTS document_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR(100) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_name VARCHAR(150) NOT NULL,
    user_role VARCHAR(100),
    signature_type VARCHAR(50) NOT NULL DEFAULT 'eletronica_avancada',
    document_hash VARCHAR(64) NOT NULL,
    verification_code VARCHAR(50) NOT NULL UNIQUE,
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. INTEGRAÇÕES GOVERNAMENTAIS
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- esus_aps, sinan, gal, sivep, cnes, ibge, estadual
    integration_type VARCHAR(50) NOT NULL, -- api_rest, csv_import, xlsx_import, etl_sync
    status VARCHAR(30) NOT NULL DEFAULT 'inativo', -- ativo, inativo, em_erro
    configuration JSONB DEFAULT '{}'::jsonb,
    last_sync TIMESTAMPTZ,
    last_success TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. JOBS DE INTEGRAÇÃO
CREATE TABLE IF NOT EXISTS integration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    records_read INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'em_andamento',
    log_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE entomological_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE entomological_identifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_supervisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_jobs ENABLE ROW LEVEL SECURITY;

-- 13. POLÍTICAS DE RLS
DROP POLICY IF EXISTS rls_entomological_samples ON entomological_samples;
CREATE POLICY rls_entomological_samples ON entomological_samples
    FOR ALL USING (is_superadmin() OR municipality_id = current_user_municipality_id());

DROP POLICY IF EXISTS rls_entomological_identifications ON entomological_identifications;
CREATE POLICY rls_entomological_identifications ON entomological_identifications
    FOR ALL USING (
        is_superadmin() OR EXISTS (
            SELECT 1 FROM entomological_samples s 
            WHERE s.id = entomological_identifications.sample_id 
            AND (is_superadmin() OR s.municipality_id = current_user_municipality_id())
        )
    );

DROP POLICY IF EXISTS rls_equipment_movements ON equipment_movements;
CREATE POLICY rls_equipment_movements ON equipment_movements
    FOR ALL USING (
        is_superadmin() OR EXISTS (
            SELECT 1 FROM equipment e 
            WHERE e.id = equipment_movements.equipment_id 
            AND (is_superadmin() OR e.municipality_id = current_user_municipality_id())
        )
    );

DROP POLICY IF EXISTS rls_equipment_maintenance ON equipment_maintenance;
CREATE POLICY rls_equipment_maintenance ON equipment_maintenance
    FOR ALL USING (
        is_superadmin() OR EXISTS (
            SELECT 1 FROM equipment e 
            WHERE e.id = equipment_maintenance.equipment_id 
            AND (is_superadmin() OR e.municipality_id = current_user_municipality_id())
        )
    );

DROP POLICY IF EXISTS rls_work_orders ON work_orders;
CREATE POLICY rls_work_orders ON work_orders
    FOR ALL USING (is_superadmin() OR municipality_id = current_user_municipality_id());

DROP POLICY IF EXISTS rls_field_supervisions ON field_supervisions;
CREATE POLICY rls_field_supervisions ON field_supervisions
    FOR ALL USING (is_superadmin() OR municipality_id = current_user_municipality_id());

DROP POLICY IF EXISTS rls_field_evidence ON field_evidence;
CREATE POLICY rls_field_evidence ON field_evidence
    FOR ALL USING (is_superadmin() OR municipality_id = current_user_municipality_id());

DROP POLICY IF EXISTS rls_document_signatures ON document_signatures;
CREATE POLICY rls_document_signatures ON document_signatures
    FOR ALL USING (is_superadmin() OR municipality_id = current_user_municipality_id());

DROP POLICY IF EXISTS rls_integrations ON integrations;
CREATE POLICY rls_integrations ON integrations
    FOR ALL USING (is_superadmin() OR municipality_id = current_user_municipality_id());

DROP POLICY IF EXISTS rls_integration_jobs ON integration_jobs;
CREATE POLICY rls_integration_jobs ON integration_jobs
    FOR ALL USING (is_superadmin() OR municipality_id = current_user_municipality_id());
