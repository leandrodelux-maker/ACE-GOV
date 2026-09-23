-- =============================================================================
-- Migração ADITIVA (só cria objetos novos). Validada em homologação local
-- (testes E1-E5: criação no próprio município, bloqueio entre municípios, sem DELETE).
--
-- Motivo: Encaminhamentos intersetoriais (Gestão Operacional › Denúncias &
-- Encaminhamentos) não têm tabela no banco e hoje ficam salvos só no navegador.
-- O frontend (src/services/referralService.ts) passa a usar esta tabela
-- automaticamente quando ela existir; enquanto não existir, mantém o modo local
-- com aviso na tela.
--
-- Depende das funções de RLS da migration 23 (current_user_municipality_id,
-- is_platform_admin, has_permission).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.intersectoral_referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id  UUID NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
  protocol         VARCHAR(40) NOT NULL UNIQUE,
  target_sector    VARCHAR(40) NOT NULL,
  property_address TEXT NOT NULL,
  neighborhood     TEXT,
  description      TEXT NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'ENVIADO' CHECK (status IN ('ENVIADO', 'RECEBIDO', 'EM_ANDAMENTO', 'RESOLVIDO')),
  issued_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_by_name   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intersectoral_referrals_mun_created
  ON public.intersectoral_referrals (municipality_id, created_at DESC);

ALTER TABLE public.intersectoral_referrals ENABLE ROW LEVEL SECURITY;

-- Leitura: mesmo município + denuncias.view
CREATE POLICY intersectoral_referrals_select ON public.intersectoral_referrals
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id() AND public.has_permission('denuncias.view'))
  );

-- Criação e atualização de status: mesmo município + denuncias.manage
CREATE POLICY intersectoral_referrals_insert ON public.intersectoral_referrals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id() AND public.has_permission('denuncias.manage'))
  );

CREATE POLICY intersectoral_referrals_update ON public.intersectoral_referrals
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id() AND public.has_permission('denuncias.manage'))
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id() AND public.has_permission('denuncias.manage'))
  );

-- Sem política de DELETE: registros não são apagados (retenção para auditoria).

REVOKE ALL ON public.intersectoral_referrals FROM anon;

DROP TRIGGER IF EXISTS trg_intersectoral_referrals_updated_at ON public.intersectoral_referrals;
CREATE TRIGGER trg_intersectoral_referrals_updated_at
  BEFORE UPDATE ON public.intersectoral_referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

COMMIT;
