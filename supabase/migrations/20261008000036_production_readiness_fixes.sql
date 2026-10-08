-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 36: AJUSTES PARA PRODUÇÃO
-- ==============================================================================
-- Achados da revisão de produção (advisors do Supabase + auditoria RLS no banco
-- real). Nenhum dado é alterado.
--
-- 1. Portal do Cidadão (public_portal_overview):
--    - contava visitas com result = 'TRABALHADO', mas submit_official_visit grava
--      'trabalhado' (minúsculo): cobertura e imóveis visitados sempre 0;
--    - "focos eliminados" contava todos os criadouros, inclusive os ativos;
--    - "quarteirões trabalhados" era estimado (visitados / 25); agora conta as
--      quadras distintas dos imóveis visitados.
-- 2. profiles: a autoedição não pode alterar município, situação, vínculo de
--    login, e-mail nem exclusão lógica (hoje isso só era barrado indiretamente pela
--    checagem de SELECT no RETURNING do PostgREST). auth.uid() via subselect.
-- 3. Índices: remove 13 duplicados e cria índice em municipality_id nas tabelas
--    filtradas por RLS que não tinham.
-- 4. Funções de trigger não precisam de EXECUTE para anon/authenticated.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Portal do Cidadão
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_portal_overview(p_municipality_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun record;
  v_neighborhoods jsonb;
  v_total_visited int;
  v_total_foci int;
  v_total_props int;
  v_blocks int;
BEGIN
  SELECT id, name, state INTO v_mun
  FROM public.municipalities
  WHERE id = p_municipality_id AND active = true;

  IF v_mun.id IS NULL THEN
    RAISE EXCEPTION 'municipality_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(DISTINCT v.property_id), count(DISTINCT p.block_id)
  INTO v_total_visited, v_blocks
  FROM public.visits v
  LEFT JOIN public.properties p ON p.id = v.property_id
  WHERE v.municipality_id = p_municipality_id
    AND v.deleted_at IS NULL
    AND lower(v.result) = 'trabalhado';

  SELECT count(*) INTO v_total_foci
  FROM public.breeding_sites bs
  WHERE bs.municipality_id = p_municipality_id
    AND (bs.eliminated_at IS NOT NULL OR lower(bs.status) = 'eliminado');

  SELECT count(*) INTO v_total_props
  FROM public.properties p
  WHERE p.municipality_id = p_municipality_id AND p.deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(n_data ORDER BY n_data->>'name'), '[]'::jsonb)
  INTO v_neighborhoods
  FROM (
    SELECT jsonb_build_object(
      'id', n.id,
      'name', n.name,
      'zone', COALESCE(z.name, 'Urbana'),
      'visited_properties', COALESCE(vs.cnt, 0),
      'foci_eliminated', COALESCE(bs.cnt, 0),
      'coverage_percent', LEAST(100, CASE WHEN COALESCE(pc.cnt, 0) > 0
        THEN round(100.0 * COALESCE(vs.cnt, 0) / pc.cnt)
        ELSE 0 END)
    ) AS n_data
    FROM public.neighborhoods n
    LEFT JOIN public.zones z ON z.id = n.zone_id
    LEFT JOIN (
      SELECT p.neighborhood_id, count(DISTINCT v.property_id) AS cnt
      FROM public.visits v
      JOIN public.properties p ON p.id = v.property_id
      WHERE v.municipality_id = p_municipality_id AND v.deleted_at IS NULL AND lower(v.result) = 'trabalhado'
      GROUP BY p.neighborhood_id
    ) vs ON vs.neighborhood_id = n.id
    LEFT JOIN (
      SELECT p.neighborhood_id, count(*) AS cnt
      FROM public.breeding_sites b
      JOIN public.properties p ON p.id = b.property_id
      WHERE b.municipality_id = p_municipality_id
        AND (b.eliminated_at IS NOT NULL OR lower(b.status) = 'eliminado')
      GROUP BY p.neighborhood_id
    ) bs ON bs.neighborhood_id = n.id
    LEFT JOIN (
      SELECT neighborhood_id, count(*) AS cnt
      FROM public.properties
      WHERE municipality_id = p_municipality_id AND deleted_at IS NULL
      GROUP BY neighborhood_id
    ) pc ON pc.neighborhood_id = n.id
    WHERE n.municipality_id = p_municipality_id
  ) s;

  RETURN jsonb_build_object(
    'municipalityName', v_mun.name || ' - ' || v_mun.state,
    'lastUpdated', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
    'indicators', jsonb_build_object(
      'totalVisited', v_total_visited,
      'fociEliminated', v_total_foci,
      'blocksTreated', v_blocks,
      'coveragePercent', LEAST(100, CASE WHEN v_total_props > 0
        THEN round(100.0 * v_total_visited / v_total_props) ELSE 0 END)
    ),
    'neighborhoods', v_neighborhoods
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_portal_overview(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.public_portal_overview(uuid) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. profiles: autoedição restrita a dados pessoais
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid()))
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

-- Quem não administra usuários do município não altera campos de controle,
-- nem no próprio perfil. Conexões sem JWT (service_role, migrações) passam.
CREATE OR REPLACE FUNCTION public.profiles_guard_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR public.is_platform_admin()
     OR (OLD.municipality_id = public.current_user_municipality_id()
         AND public.has_permission('usuarios.update')
         AND NEW.auth_user_id IS DISTINCT FROM auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.municipality_id IS DISTINCT FROM OLD.municipality_id
     OR NEW.active IS DISTINCT FROM OLD.active
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'forbidden: campo de controle do perfil só pode ser alterado pela gestão de usuários'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.profiles_guard_protected_columns() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_guard_protected_columns ON public.profiles;
CREATE TRIGGER trg_profiles_guard_protected_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_protected_columns();

-- ------------------------------------------------------------------------------
-- 3. Índices
-- ------------------------------------------------------------------------------
-- 3.1 Duplicados (mantém a versão *_id, idêntica)
DROP INDEX IF EXISTS public.idx_breeding_sites_property;
DROP INDEX IF EXISTS public.idx_microareas_sector;
DROP INDEX IF EXISTS public.idx_ovitrap_col_inst;
DROP INDEX IF EXISTS public.idx_ovitrap_res_col;
DROP INDEX IF EXISTS public.idx_ovitraps_neighborhood;
DROP INDEX IF EXISTS public.idx_pending_visits_cycle;
DROP INDEX IF EXISTS public.idx_properties_block;
DROP INDEX IF EXISTS public.idx_properties_neighborhood;
DROP INDEX IF EXISTS public.idx_properties_sector;
DROP INDEX IF EXISTS public.idx_visit_deposits_visit;
DROP INDEX IF EXISTS public.idx_visits_agent;
DROP INDEX IF EXISTS public.idx_visits_cycle;
DROP INDEX IF EXISTS public.idx_visits_property;

-- 3.2 municipality_id: coluna usada em toda política RLS por município
CREATE INDEX IF NOT EXISTS idx_attachments_municipality_id               ON public.attachments (municipality_id);
CREATE INDEX IF NOT EXISTS idx_blocks_municipality_id                    ON public.blocks (municipality_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_municipality_id       ON public.document_signatures (municipality_id);
CREATE INDEX IF NOT EXISTS idx_entomological_samples_municipality_id     ON public.entomological_samples (municipality_id);
CREATE INDEX IF NOT EXISTS idx_equipment_municipality_id                 ON public.equipment (municipality_id);
CREATE INDEX IF NOT EXISTS idx_field_evidence_municipality_id            ON public.field_evidence (municipality_id);
CREATE INDEX IF NOT EXISTS idx_field_plans_municipality_id               ON public.field_plans (municipality_id);
CREATE INDEX IF NOT EXISTS idx_field_supervisions_municipality_id        ON public.field_supervisions (municipality_id);
CREATE INDEX IF NOT EXISTS idx_integration_jobs_municipality_id          ON public.integration_jobs (municipality_id);
CREATE INDEX IF NOT EXISTS idx_integrations_municipality_id              ON public.integrations (municipality_id);
CREATE INDEX IF NOT EXISTS idx_liraa_strata_municipality_id              ON public.liraa_strata (municipality_id);
CREATE INDEX IF NOT EXISTS idx_liraa_surveys_municipality_id             ON public.liraa_surveys (municipality_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_municipality_id              ON public.message_logs (municipality_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_municipality_id         ON public.message_templates (municipality_id);
CREATE INDEX IF NOT EXISTS idx_microareas_municipality_id                ON public.microareas (municipality_id);
CREATE INDEX IF NOT EXISTS idx_operational_plans_history_municipality_id ON public.operational_plans_history (municipality_id);
CREATE INDEX IF NOT EXISTS idx_products_municipality_id                  ON public.products (municipality_id);
CREATE INDEX IF NOT EXISTS idx_recurrence_records_municipality_id        ON public.recurrence_records (municipality_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_municipality_id           ON public.stock_movements (municipality_id);
CREATE INDEX IF NOT EXISTS idx_supplies_municipality_id                  ON public.supplies (municipality_id);
CREATE INDEX IF NOT EXISTS idx_system_error_logs_municipality_id         ON public.system_error_logs (municipality_id);
CREATE INDEX IF NOT EXISTS idx_vector_control_operations_municipality_id ON public.vector_control_operations (municipality_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_municipality_id               ON public.work_orders (municipality_id);

-- ------------------------------------------------------------------------------
-- 4. Funções de trigger: sem EXECUTE pela API
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at_column() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_stock_deduction_on_movement() FROM public, anon, authenticated;

COMMIT;
