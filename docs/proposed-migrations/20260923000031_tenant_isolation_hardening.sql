-- =============================================================================
-- PROPOSTA — NÃO APLICADA. Revisar e testar em ambiente de homologação antes.
-- Mantida fora de supabase/migrations/ de propósito, para não ser aplicada por
-- `supabase db push`. Para adotar: revisar, testar, mover para supabase/migrations/.
--
-- Nenhum dado, tabela ou migração existente é apagado. Apenas funções e
-- políticas são substituídas por versões mais restritivas.
--
-- Justificativa (ver docs/ACE-GOV-AUDITORIA-E-EXECUCAO.md, achados S1–S3):
--  S1. is_platform_admin() retorna TRUE para MUNICIPAL_ADMIN. Como as políticas
--      usam "is_platform_admin() OR municipality_id = current_user_municipality_id()",
--      um administrador MUNICIPAL lê e grava dados de TODOS os municípios.
--  S2. user_roles_write só exige 'usuarios.update': quem tem essa permissão pode
--      atribuir qualquer papel (inclusive SUPER_ADMIN) a qualquer perfil, de
--      qualquer município.
--  S3. submit_official_visit é SECURITY DEFINER (ignora RLS) e confia no
--      municipality_id / agent_id / property_id enviados pelo navegador.
--
-- Pré-condição verificada: a migration 24 concede a MUNICIPAL_ADMIN todas as
-- permissões em role_permissions, então ele continua operando no PRÓPRIO
-- município pelos ramos "municipality_id = current_user_municipality_id() AND
-- has_permission(...)" das políticas.
--
-- Impacto a validar em homologação:
--  - Telas que um MUNICIPAL_ADMIN usava para ver outros municípios deixam de
--    mostrá-los (comportamento desejado).
--  - Escrita no catálogo global de permissões passa a ser só de SUPER_ADMIN.
-- =============================================================================

BEGIN;

-- S1 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- Plataforma (todos os municípios) = somente SUPER_ADMIN.
  SELECT public.current_user_role_slugs() && ARRAY['SUPER_ADMIN'];
$$;

-- role_permissions é GLOBAL (não tem municipality_id): alterar a matriz de um
-- papel afeta todos os municípios. Restringe a escrita ao SUPER_ADMIN.
DROP POLICY IF EXISTS role_permissions_write ON public.role_permissions;
CREATE POLICY role_permissions_write ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
-- ATENÇÃO: revisar também o corpo de public.set_role_permissions (migration 25),
-- que é SECURITY DEFINER e pode checar apenas 'perfis.manage'.

-- S2 ---------------------------------------------------------------------------
DROP POLICY IF EXISTS user_roles_write ON public.user_roles;
CREATE POLICY user_roles_write ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR (
      public.has_permission('usuarios.update')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_roles.user_id
          AND p.municipality_id = public.current_user_municipality_id()
      )
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (
      public.has_permission('usuarios.update')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_roles.user_id
          AND p.municipality_id = public.current_user_municipality_id()
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.roles r
        WHERE r.id = user_roles.role_id
          AND r.slug = 'SUPER_ADMIN'
      )
    )
  );

-- S3 ---------------------------------------------------------------------------
-- Preserva a função atual (transacional, idempotente) sob outro nome e expõe
-- um invólucro que valida o escopo municipal antes de chamá-la.
ALTER FUNCTION public.submit_official_visit(jsonb) RENAME TO submit_official_visit_core;
REVOKE EXECUTE ON FUNCTION public.submit_official_visit_core(jsonb) FROM anon, authenticated, public;

CREATE FUNCTION public.submit_official_visit(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun uuid := public.current_user_municipality_id();
  v_payload_mun uuid := NULLIF(payload->>'municipality_id', '')::uuid;
  v_property uuid := NULLIF(payload->>'property_id', '')::uuid;
  v_agent uuid := NULLIF(payload->>'agent_id', '')::uuid;
  v_cycle uuid := NULLIF(payload->>'cycle_id', '')::uuid;
BEGIN
  IF NOT public.has_permission('visitas.create') THEN
    RAISE EXCEPTION 'forbidden: sem permissão visitas.create' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_platform_admin() THEN
    IF v_mun IS NULL THEN
      RAISE EXCEPTION 'forbidden: perfil sem município' USING ERRCODE = '42501';
    END IF;
    IF v_payload_mun IS NOT NULL AND v_payload_mun <> v_mun THEN
      RAISE EXCEPTION 'forbidden: município divergente do perfil' USING ERRCODE = '42501';
    END IF;
    IF v_property IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.properties WHERE id = v_property AND municipality_id = v_mun
    ) THEN
      RAISE EXCEPTION 'forbidden: imóvel de outro município' USING ERRCODE = '42501';
    END IF;
    IF v_agent IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.agents WHERE id = v_agent AND municipality_id = v_mun
    ) THEN
      RAISE EXCEPTION 'forbidden: agente de outro município' USING ERRCODE = '42501';
    END IF;
    IF v_cycle IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.field_cycles WHERE id = v_cycle AND municipality_id = v_mun
    ) THEN
      RAISE EXCEPTION 'forbidden: ciclo de outro município' USING ERRCODE = '42501';
    END IF;
    payload := jsonb_set(payload, '{municipality_id}', to_jsonb(v_mun::text));
  END IF;

  RETURN public.submit_official_visit_core(payload);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_official_visit(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_official_visit(jsonb) TO authenticated;

COMMIT;

-- Verificação sugerida após aplicar em homologação (como MUNICIPAL_ADMIN do município A):
--   SELECT count(*) FROM properties WHERE municipality_id <> current_user_municipality_id();  -- esperado: 0
--   INSERT INTO user_roles (user_id, role_id) SELECT <perfil_do_municipio_B>, id FROM roles WHERE slug = 'ACE'; -- esperado: erro RLS
--   SELECT submit_official_visit('{"municipality_id":"<municipio_B>"}'::jsonb);         -- esperado: forbidden
