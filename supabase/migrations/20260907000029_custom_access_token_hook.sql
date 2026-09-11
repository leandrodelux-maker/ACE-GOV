-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 29 (OPCIONAL): CUSTOM ACCESS TOKEN HOOK
-- ==============================================================================
-- Injeta `municipality_id` e `role_slugs` no app_metadata do JWT, permitindo que
-- (futuramente) as policies leiam de auth.jwt() sem subconsulta por linha.
--
-- As policies da migration 26 NÃO dependem deste hook (usam as funções
-- SECURITY DEFINER). Este hook é uma otimização; habilite-o em:
--   Dashboard -> Authentication -> Hooks -> "Custom Access Token" -> selecionar
--   public.custom_access_token_hook
--
-- É seguro aplicar esta migration sem habilitar o hook.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb;
  v_user   uuid := (event->>'user_id')::uuid;
  v_mun    uuid;
  v_roles  text[];
BEGIN
  SELECT p.municipality_id INTO v_mun
  FROM public.profiles p
  WHERE p.auth_user_id = v_user AND p.active = true
  LIMIT 1;

  SELECT COALESCE(array_agg(DISTINCT r.slug), ARRAY[]::text[]) INTO v_roles
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  JOIN public.roles r ON r.id = ur.role_id
  WHERE p.auth_user_id = v_user AND p.active = true;

  v_claims := COALESCE(event->'claims', '{}'::jsonb);

  IF NOT (v_claims ? 'app_metadata') THEN
    v_claims := jsonb_set(v_claims, '{app_metadata}', '{}'::jsonb);
  END IF;

  IF v_mun IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{app_metadata,municipality_id}', to_jsonb(v_mun::text));
  END IF;
  v_claims := jsonb_set(v_claims, '{app_metadata,role_slugs}', to_jsonb(v_roles));

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

-- O hook roda como supabase_auth_admin; precisa ler as tabelas de RBAC.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT SELECT ON public.profiles, public.user_roles, public.roles TO supabase_auth_admin;

-- Policies dedicadas para o auth admin (as tabelas têm RLS habilitada)
DROP POLICY IF EXISTS auth_admin_read_profiles ON public.profiles;
CREATE POLICY auth_admin_read_profiles ON public.profiles
  FOR SELECT TO supabase_auth_admin USING (true);

DROP POLICY IF EXISTS auth_admin_read_user_roles ON public.user_roles;
CREATE POLICY auth_admin_read_user_roles ON public.user_roles
  FOR SELECT TO supabase_auth_admin USING (true);

DROP POLICY IF EXISTS auth_admin_read_roles ON public.roles;
CREATE POLICY auth_admin_read_roles ON public.roles
  FOR SELECT TO supabase_auth_admin USING (true);

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
