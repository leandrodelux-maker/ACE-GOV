-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 20260907000015
-- IMPORTAÇÃO EPIDEMIOLÓGICA, COMUNICAÇÃO OPERACIONAL, CAPACITAÇÃO,
-- DENÚNCIAS PÚBLICAS, MULTI-ENDEMIAS E GEORREFERENCIAMENTO
-- ==============================================================================

-- 1. TEMPLATES DE MENSAGENS OPERACIONAIS (WhatsApp / Push / SMS)
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    event VARCHAR(50) NOT NULL, -- nova_os, area_critica, pe_vencido, planejamento_disponivel, pendencia_urgente, alteracao_rota
    text TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. LOGS DE MENSAGENS OPERACIONAIS
CREATE TABLE IF NOT EXISTS message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    recipient VARCHAR(50) NOT NULL,
    recipient_role VARCHAR(50),
    event VARCHAR(50) NOT NULL,
    message_text TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente', -- pendente, enviado, entregue, falha, simulado
    provider_reference VARCHAR(100),
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CAPACITAÇÕES E EDUCAÇÃO PERMANENTE
CREATE TABLE IF NOT EXISTS trainings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- Dengue, LIRAa, Controle vetorial, Segurança, EPI, PWA, Vigilância, Ovitrampas, PE, Outros
    date DATE NOT NULL,
    duration_hours NUMERIC(5,1) NOT NULL DEFAULT 4,
    instructor VARCHAR(150),
    status VARCHAR(30) NOT NULL DEFAULT 'agendado', -- agendado, em_andamento, concluido, cancelado
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PARTICIPANTES DA CAPACITAÇÃO
CREATE TABLE IF NOT EXISTS training_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    attendance BOOLEAN NOT NULL DEFAULT false,
    score NUMERIC(4,1),
    certificate_issued BOOLEAN NOT NULL DEFAULT false,
    certificate_code VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. EXPANSÃO EM COMPLAINTS PARA PORTAL PÚBLICO
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(32);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS problem_type VARCHAR(60);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_participants ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS DE RLS
DROP POLICY IF EXISTS rls_message_templates ON message_templates;
CREATE POLICY rls_message_templates ON message_templates
    FOR ALL USING (is_superadmin() OR municipality_id = current_user_municipality_id());

DROP POLICY IF EXISTS rls_message_logs ON message_logs;
CREATE POLICY rls_message_logs ON message_logs
    FOR ALL USING (is_superadmin() OR municipality_id = current_user_municipality_id());

DROP POLICY IF EXISTS rls_trainings ON trainings;
CREATE POLICY rls_trainings ON trainings
    FOR ALL USING (is_superadmin() OR municipality_id = current_user_municipality_id());

DROP POLICY IF EXISTS rls_training_participants ON training_participants;
CREATE POLICY rls_training_participants ON training_participants
    FOR ALL USING (
        is_superadmin() OR EXISTS (
            SELECT 1 FROM trainings t 
            WHERE t.id = training_participants.training_id 
            AND (is_superadmin() OR t.municipality_id = current_user_municipality_id())
        )
    );

-- Política pública para inserção e consulta de denúncias sem exigir login
DROP POLICY IF EXISTS rls_public_insert_complaints ON complaints;
CREATE POLICY rls_public_insert_complaints ON complaints
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS rls_public_select_complaints ON complaints;
CREATE POLICY rls_public_select_complaints ON complaints
    FOR SELECT USING (
        is_superadmin() 
        OR municipality_id = current_user_municipality_id() 
        OR tracking_token IS NOT NULL
    );
