-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 23: FUNÇÕES CANÔNICAS DE IDENTIDADE E RBAC
-- ==============================================================================
-- Estas funções passam a ser a ÚNICA fonte de verdade para "quem é o usuário",
-- "de qual município" e "o que ele pode fazer", sempre a partir de auth.uid()
-- (Supabase Auth). Nenhuma delas confia em dados vindos do cliente.
--
-- Rollout: esta migration é SEGURA de aplicar isoladamente - ela apenas
-- (re)define funções. As policies permissivas atuais continuam funcionando até
-- a migration 26 (RLS estrita).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- auth_profile_id(): id do profile do usuário autenticado
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
    AND p.active = true
  LIMIT 1;
$$;

-- ------------------------------------------------------------------------------
-- current_user_municipality_id(): município do usuário autenticado
-- (substitui a versão da migration 09, que tinha fallback inseguro)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_municipality_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.municipality_id
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
    AND p.active = true
  LIMIT 1;
$$;

-- ------------------------------------------------------------------------------
-- current_user_role_slugs(): slugs dos papéis do usuário autenticado
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role_slugs()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(array_agg(DISTINCT r.slug), ARRAY[]::text[])
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  JOIN public.roles r ON r.id = ur.role_id
  WHERE p.auth_user_id = auth.uid()
    AND p.active = true;
$$;

-- ------------------------------------------------------------------------------
-- is_platform_admin(): SUPER_ADMIN ou MUNICIPAL_ADMIN (passe livre)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_user_role_slugs() && ARRAY['SUPER_ADMIN', 'MUNICIPAL_ADMIN'];
$$;

-- ------------------------------------------------------------------------------
-- has_role(slugs): true se o usuário tem QUALQUER um dos papéis informados
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(p_slugs text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_user_role_slugs() && p_slugs;
$$;

-- ------------------------------------------------------------------------------
-- has_permission(perm): true se algum papel do usuário concede a permissão,
-- ou se o usuário é platform admin.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(p_perm text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.user_roles ur ON ur.user_id = pr.id
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions pe ON pe.id = rp.permission_id
    WHERE pr.auth_user_id = auth.uid()
      AND pr.active = true
      AND pe.slug = p_perm
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- is_superadmin(): alias DEPRECIADO -> is_platform_admin()
-- Mantido apenas para não quebrar as policies antigas até a migration 26.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_platform_admin();
$$;

-- ------------------------------------------------------------------------------
-- Permissões de execução
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.auth_profile_id()            TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_municipality_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role_slugs()    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin()          TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(text[])             TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text)         TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin()              TO authenticated, anon;

COMMENT ON FUNCTION public.has_permission(text) IS
  'RBAC canônico do Endemias GOV. Fonte de verdade para autorização - o cliente é apenas conveniência de UI.';
