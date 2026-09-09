-- ===================================================================
-- MIGRATION 20260907000022: CENTRAL DE DIAGNÓSTICO E INTEGRIDADE DO SISTEMA
-- Tabelas para histórico de auditorias e itens auditados
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.system_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  initiated_by TEXT NOT NULL DEFAULT 'SYSTEM',
  pages_checked INTEGER NOT NULL DEFAULT 0,
  issues_found INTEGER NOT NULL DEFAULT 0,
  issues_fixed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'CONCLUIDO',
  summary JSONB DEFAULT '{}'::jsonb,
  municipality_id UUID REFERENCES public.municipalities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_audit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.system_audits(id) ON DELETE CASCADE,
  route TEXT NOT NULL,
  module TEXT NOT NULL,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_audits_municipality ON public.system_audits(municipality_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_items_audit_id ON public.system_audit_items(audit_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_items_route ON public.system_audit_items(route);

-- Habilitar RLS
ALTER TABLE public.system_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_items ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir leitura de auditorias para usuários autenticados"
  ON public.system_audits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir inserção de auditorias para usuários autenticados"
  ON public.system_audits FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de auditorias para usuários autenticados"
  ON public.system_audits FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Permitir leitura de itens de auditoria para usuários autenticados"
  ON public.system_audit_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir inserção de itens de auditoria para usuários autenticados"
  ON public.system_audit_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Permissões para anon (caso o frontend execute diagnóstico pré-login ou em modo dev)
CREATE POLICY "Permitir leitura anônima de auditorias em desenvolvimento"
  ON public.system_audits FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Permitir gravação anônima de auditorias em desenvolvimento"
  ON public.system_audits FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Permitir leitura anônima de itens em desenvolvimento"
  ON public.system_audit_items FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Permitir gravação anônima de itens em desenvolvimento"
  ON public.system_audit_items FOR INSERT
  TO anon
  WITH CHECK (true);
