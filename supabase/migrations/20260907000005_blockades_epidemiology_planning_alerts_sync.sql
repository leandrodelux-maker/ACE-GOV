-- ====================================================================
-- ENDEMIAS GOV - MIGRATION 05: BLOQUEIOS, EPIDEMIOLOGIA, PLANEJAMENTO, ALERTAS, ARQUIVOS E SYNC PWA
-- ====================================================================

-- 12. BLOQUEIOS
CREATE TABLE IF NOT EXISTS blockade_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    outbreak_id UUID REFERENCES outbreaks(id) ON DELETE SET NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id) ON DELETE RESTRICT,
    sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
    disease VARCHAR(60) NOT NULL,
    planned_properties INT NOT NULL DEFAULT 100,
    completed_properties INT NOT NULL DEFAULT 0,
    coverage_percentage NUMERIC(5,2) DEFAULT 0.00,
    started_at DATE NOT NULL DEFAULT CURRENT_DATE,
    ended_at DATE,
    status VARCHAR(40) NOT NULL DEFAULT 'EM_ANDAMENTO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blockade_operation_agents (
    operation_id UUID NOT NULL REFERENCES blockade_operations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    PRIMARY KEY (operation_id, agent_id)
);

-- 13. EPIDEMIOLOGIA
CREATE TABLE IF NOT EXISTS epidemiological_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    disease VARCHAR(60) NOT NULL, -- DENGUE, ZIKA, CHIKUNGUNYA, etc.
    notification_number VARCHAR(50) NOT NULL,
    notification_date DATE NOT NULL,
    symptom_start_date DATE,
    neighborhood_id UUID REFERENCES neighborhoods(id) ON DELETE SET NULL,
    sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    classification VARCHAR(50) DEFAULT 'SUSPEITO',
    confirmation_method VARCHAR(50),
    status VARCHAR(40) NOT NULL DEFAULT 'NOTIFICADO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. PLANEJAMENTO
CREATE TABLE IF NOT EXISTS field_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES field_cycles(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    plan_date DATE NOT NULL,
    neighborhood_id UUID REFERENCES neighborhoods(id) ON DELETE SET NULL,
    sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
    planned_properties INT NOT NULL DEFAULT 25,
    priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(40) NOT NULL DEFAULT 'PLANEJADO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS field_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_plan_id UUID REFERENCES field_plans(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    route_date DATE NOT NULL,
    total_distance NUMERIC(8,2),
    estimated_duration VARCHAR(30),
    route_data JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(40) NOT NULL DEFAULT 'PENDENTE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. ALERTAS
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- EPIDEMIOLOGICO, ENTOMOLOGICO, OPERACIONAL, etc.
    severity VARCHAR(30) NOT NULL DEFAULT 'ATENCAO', -- INFORMATIVO, ATENCAO, CRITICO
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    entity_type VARCHAR(60),
    entity_id VARCHAR(100),
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'INFO',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. ARQUIVOS
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    entity_type VARCHAR(60) NOT NULL,
    entity_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. SINCRONIZAÇÃO PWA
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    device_id VARCHAR(100),
    entity_type VARCHAR(60) NOT NULL,
    operation VARCHAR(30) NOT NULL, -- INSERT, UPDATE, DELETE
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS agent_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    device_uuid VARCHAR(100) NOT NULL UNIQUE,
    device_name VARCHAR(150),
    last_sync TIMESTAMPTZ,
    app_version VARCHAR(30),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers para updated_at
CREATE TRIGGER trg_blockade_operations_updated_at BEFORE UPDATE ON blockade_operations FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_epidemiological_cases_updated_at BEFORE UPDATE ON epidemiological_cases FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_field_plans_updated_at BEFORE UPDATE ON field_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_field_routes_updated_at BEFORE UPDATE ON field_routes FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
CREATE TRIGGER trg_agent_devices_updated_at BEFORE UPDATE ON agent_devices FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

-- Índices principais
CREATE INDEX IF NOT EXISTS idx_blockades_mun ON blockade_operations(municipality_id);
CREATE INDEX IF NOT EXISTS idx_blockades_status ON blockade_operations(status);
CREATE INDEX IF NOT EXISTS idx_epi_cases_mun_disease ON epidemiological_cases(municipality_id, disease);
CREATE INDEX IF NOT EXISTS idx_epi_cases_date ON epidemiological_cases(notification_date);
CREATE INDEX IF NOT EXISTS idx_field_plans_agent_date ON field_plans(agent_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_alerts_mun_ack ON alerts(municipality_id, acknowledged);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user_status ON sync_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_devices_agent ON agent_devices(agent_id);

-- ====================================================================
-- HABILITAÇÃO DE ROW LEVEL SECURITY (RLS) & ISOLAMENTO MUNICIPAL
-- ====================================================================

ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE microareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_refusals ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE breeding_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbreaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurrence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ovitraps ENABLE ROW LEVEL SECURITY;
ALTER TABLE ovitrap_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ovitrap_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ovitrap_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_point_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_property_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockade_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockade_operation_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE epidemiological_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_devices ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso anônimo/autenticado seguras para leitura de dados municipais
CREATE POLICY "Permitir leitura pública/anônima com filtros" ON municipalities FOR SELECT USING (active = true);
CREATE POLICY "Permitir leitura de bairros" ON neighborhoods FOR SELECT USING (true);
CREATE POLICY "Permitir leitura de zonas" ON zones FOR SELECT USING (active = true);
CREATE POLICY "Permitir leitura de imóveis" ON properties FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Permitir leitura de ciclos de campo" ON field_cycles FOR SELECT USING (true);
CREATE POLICY "Permitir leitura de visitas" ON visits FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Permitir inserção de visitas no PWA" ON visits FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura e inserção de depósitos" ON visit_deposits FOR ALL USING (true);
CREATE POLICY "Permitir leitura de ovitrampas" ON ovitraps FOR SELECT USING (true);
CREATE POLICY "Permitir leitura de pontos estratégicos" ON strategic_points FOR SELECT USING (active = true);
CREATE POLICY "Permitir leitura de imóveis especiais" ON special_properties FOR SELECT USING (active = true);
CREATE POLICY "Permitir registro e consulta de denúncias públicas" ON complaints FOR ALL USING (true);
CREATE POLICY "Permitir leitura de bloqueios" ON blockade_operations FOR SELECT USING (true);
CREATE POLICY "Permitir leitura de alertas" ON alerts FOR ALL USING (true);
CREATE POLICY "Permitir gestão de sync queue no dispositivo" ON sync_queue FOR ALL USING (true);
