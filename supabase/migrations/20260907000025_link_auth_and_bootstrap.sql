-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 25: VÍNCULO auth.users <-> profiles + RPCs DE SESSÃO
-- ==============================================================================
-- Rollout: SEGURA de aplicar isoladamente. Cria trigger de vínculo e RPCs
-- consumidas pelo frontend novo (Workstream C). Não altera policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TRIGGER: ao criar um usuário no Supabase Auth, vincular ao profile
--    existente (mesmo e-mail) ou criar um profile mínimo inativo.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_matched uuid;
BEGIN
  UPDATE public.profiles
     SET auth_user_id = NEW.id,
         updated_at = NOW()
   WHERE lower(email) = lower(NEW.email)
     AND auth_user_id IS NULL
  RETURNING id INTO v_matched;

  IF v_matched IS NULL THEN
    -- Sem profile correspondente: cria um esqueleto INATIVO para um
    -- administrador municipal completar (município/papel) antes de liberar acesso.
    INSERT INTO public.profiles (auth_user_id, municipality_id, full_name, email, active)
    SELECT NEW.id,
           (SELECT id FROM public.municipalities WHERE active = true ORDER BY created_at LIMIT 1),
           COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
           NEW.email,
           false
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE auth_user_id = NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ------------------------------------------------------------------------------
-- 2. RPC: get_auth_bootstrap()
--    Retorna, numa única chamada, tudo que a sessão precisa. Exige auth.uid().
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile   public.profiles%ROWTYPE;
  v_result    jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_profile.active IS NOT TRUE THEN
    RAISE EXCEPTION 'account_inactive' USING ERRCODE = '28000';
  END IF;

  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'authUserId', v_profile.auth_user_id,
      'fullName', v_profile.full_name,
      'email', v_profile.email,
      'cpf', v_profile.cpf,
      'phone', v_profile.phone,
      'avatarUrl', v_profile.avatar_url,
      'registrationNumber', v_profile.registration_number,
      'jobTitle', v_profile.job_title,
      'active', v_profile.active,
      'municipalityId', v_profile.municipality_id
    ),
    'municipality', (
      SELECT jsonb_build_object(
        'id', m.id, 'name', m.name, 'state', m.state,
        'ibgeCode', m.ibge_code, 'logoUrl', m.logo_url, 'active', m.active
      )
      FROM public.municipalities m
      WHERE m.id = v_profile.municipality_id
    ),
    'roles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'slug', r.slug, 'name', r.name) ORDER BY r.slug)
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_profile.id
    ), '[]'::jsonb),
    'permissions', COALESCE((
      SELECT jsonb_agg(DISTINCT pe.slug)
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions pe ON pe.id = rp.permission_id
      WHERE ur.user_id = v_profile.id
    ), '[]'::jsonb),
    'settings', COALESCE((
      SELECT jsonb_object_agg(s.setting_key, s.setting_value)
      FROM public.system_settings s
      WHERE s.municipality_id = v_profile.municipality_id
    ), '{}'::jsonb)
  ) INTO v_result;

  UPDATE public.profiles SET last_login = NOW() WHERE id = v_profile.id;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. RPC: log_impersonation(target_role) - trilha de auditoria da simulação
--    de perfil (só platform admin).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_impersonation(p_target_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_mun_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_profile_id := public.auth_profile_id();
  v_mun_id := public.current_user_municipality_id();

  INSERT INTO public.audit_logs (municipality_id, user_id, action, module, entity, new_data)
  VALUES (
    v_mun_id, v_profile_id, 'IMPERSONATION', 'seguranca', 'rbac_impersonation',
    jsonb_build_object('target_role', p_target_role, 'at', NOW())
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. RPC: set_role_permissions(role_slug, perms[]) - edição da matriz RBAC
--    persistida no banco (substitui o localStorage do RolesPermissionsView).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_role_permissions(p_role_slug text, p_perms text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_id uuid;
BEGIN
  IF NOT (public.is_platform_admin() OR public.has_permission('perfis.manage')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Papéis de plataforma não podem ter permissões reduzidas por aqui.
  IF p_role_slug IN ('SUPER_ADMIN', 'MUNICIPAL_ADMIN') THEN
    RAISE EXCEPTION 'protected_role' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE slug = p_role_slug;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'role_not_found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.role_permissions WHERE role_id = v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, pe.id
  FROM public.permissions pe
  WHERE pe.slug = ANY (p_perms)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.audit_logs (municipality_id, user_id, action, module, entity, entity_id, new_data)
  VALUES (
    public.current_user_municipality_id(), public.auth_profile_id(),
    'RBAC_UPDATE', 'permissoes', 'role_permissions', p_role_slug,
    jsonb_build_object('permissions', to_jsonb(p_perms))
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. GRANTS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_auth_bootstrap()             FROM public, anon;
REVOKE ALL ON FUNCTION public.log_impersonation(text)          FROM public, anon;
REVOKE ALL ON FUNCTION public.set_role_permissions(text, text[]) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.get_auth_bootstrap()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_impersonation(text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_role_permissions(text, text[]) TO authenticated;
