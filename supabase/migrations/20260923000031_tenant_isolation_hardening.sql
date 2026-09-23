-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 31: ISOLAMENTO ENTRE MUNICÍPIOS E ESCALADA DE PRIVILÉGIO
-- ==============================================================================
-- Validada em homologação local (PostgreSQL 15 + linha de base Supabase: papéis
-- anon/authenticated/service_role, esquema auth, extensões em "extensions").
-- Cada item abaixo foi comprovado com um teste que FUNCIONAVA antes (falha real)
-- e passou a ser BLOQUEADO depois, sem quebrar os fluxos legítimos (22 testes de
-- regressão). Ver docs/ACE-GOV-AUDITORIA-E-EXECUCAO.md, seção 10.
--
-- Nenhum dado, tabela ou migração existente é apagado: apenas funções e políticas
-- são substituídas, e um gatilho de auditoria é criado.
--
--  S1  is_platform_admin() incluía MUNICIPAL_ADMIN: o admin de um município lia e
--      alterava dados de TODOS os municípios (imóveis, denúncias com nome/telefone).
--  S2  user_roles: quem tinha 'usuarios.update' (inclusive COORDENADOR) atribuía
--      qualquer papel a qualquer perfil de qualquer município, e a si mesmo
--      (ex.: coordenador -> MUNICIPAL_ADMIN -> plataforma inteira).
--  S3  submit_official_visit (SECURITY DEFINER) confiava em municipality_id,
--      property_id, agent_id e cycle_id vindos do navegador.
--  S4  roles/role_permissions são GLOBAIS e aceitavam escrita de quem tinha
--      'perfis.manage': um coordenador renomeava slugs e virava SUPER_ADMIN, ou
--      apagava o papel ACE de todos os municípios. set_role_permissions idem.
--  S6  system_settings: escrita sem filtro de município.
--  S7  system_error_logs: leitura/exclusão sem filtro de município.
--  S9  audit_logs: o autor (user_id) era aceito do navegador (autoria forjável).
--  S10 Cadastro público (sign-up aberto no projeto) criava um perfil-esqueleto no
--      município mais antigo; passa a não criar perfil sem convite.
-- ==============================================================================

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

-- S2 ---------------------------------------------------------------------------
-- Regra por linha de user_roles (vale para inserir, alterar e remover):
--  - perfil do mesmo município do usuário;
--  - nunca o próprio perfil (sem autopromoção);
--  - SUPER_ADMIN só pela plataforma; MUNICIPAL_ADMIN só por outro MUNICIPAL_ADMIN.
DROP POLICY IF EXISTS user_roles_write ON public.user_roles;
CREATE POLICY user_roles_write ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR (
      public.has_permission('usuarios.update')
      AND user_roles.user_id IS DISTINCT FROM public.auth_profile_id()
      AND EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = user_roles.user_id
                    AND p.municipality_id = public.current_user_municipality_id())
      AND NOT EXISTS (SELECT 1 FROM public.roles r
                      WHERE r.id = user_roles.role_id AND r.slug = 'SUPER_ADMIN')
      AND (NOT EXISTS (SELECT 1 FROM public.roles r
                       WHERE r.id = user_roles.role_id AND r.slug = 'MUNICIPAL_ADMIN')
           OR public.has_role(ARRAY['MUNICIPAL_ADMIN']))
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (
      public.has_permission('usuarios.update')
      AND user_roles.user_id IS DISTINCT FROM public.auth_profile_id()
      AND EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = user_roles.user_id
                    AND p.municipality_id = public.current_user_municipality_id())
      AND NOT EXISTS (SELECT 1 FROM public.roles r
                      WHERE r.id = user_roles.role_id AND r.slug = 'SUPER_ADMIN')
      AND (NOT EXISTS (SELECT 1 FROM public.roles r
                       WHERE r.id = user_roles.role_id AND r.slug = 'MUNICIPAL_ADMIN')
           OR public.has_role(ARRAY['MUNICIPAL_ADMIN']))
    )
  );

-- S3 ---------------------------------------------------------------------------
-- Preserva a função atual (transacional, idempotente) sob outro nome e expõe um
-- invólucro que valida o escopo municipal antes de chamá-la.
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
  v_id uuid := NULLIF(payload->>'id', '')::uuid;
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
    -- A idempotência do núcleo não pode revelar visitas de outro município
    IF v_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.visits WHERE id = v_id AND municipality_id <> v_mun
    ) THEN
      RAISE EXCEPTION 'forbidden: identificador de visita inválido' USING ERRCODE = '42501';
    END IF;
    payload := jsonb_set(payload, '{municipality_id}', to_jsonb(v_mun::text));
  END IF;

  RETURN public.submit_official_visit_core(payload);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_official_visit(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_official_visit(jsonb) TO authenticated;

-- S4 ---------------------------------------------------------------------------
-- Catálogo de papéis e matriz de permissões são GLOBAIS (valem para todos os
-- municípios): escrita somente pela plataforma.
DROP POLICY IF EXISTS roles_write ON public.roles;
CREATE POLICY roles_write ON public.roles
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS role_permissions_write ON public.role_permissions;
CREATE POLICY role_permissions_write ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.set_role_permissions(p_role_slug text, p_perms text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_id uuid;
BEGIN
  -- A matriz é global: alterar um papel afeta todos os municípios.
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden: matriz de permissões é global (somente administrador da plataforma)' USING ERRCODE = '42501';
  END IF;

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
REVOKE ALL ON FUNCTION public.set_role_permissions(text, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_role_permissions(text, text[]) TO authenticated;

-- A simulação de perfil (pré-visualização na interface) continua disponível para
-- o administrador municipal; só grava trilha no próprio município.
CREATE OR REPLACE FUNCTION public.log_impersonation(p_target_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (public.is_platform_admin() OR public.has_role(ARRAY['MUNICIPAL_ADMIN'])) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_logs (municipality_id, user_id, action, module, entity, new_data)
  VALUES (
    public.current_user_municipality_id(), public.auth_profile_id(), 'IMPERSONATION', 'seguranca', 'rbac_impersonation',
    jsonb_build_object('target_role', p_target_role, 'at', NOW())
  );
END;
$$;
REVOKE ALL ON FUNCTION public.log_impersonation(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.log_impersonation(text) TO authenticated;

-- S6 ---------------------------------------------------------------------------
DROP POLICY IF EXISTS system_settings_write ON public.system_settings;
CREATE POLICY system_settings_write ON public.system_settings
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id() AND public.has_permission('configuracoes.manage'))
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id() AND public.has_permission('configuracoes.manage'))
  );

-- S7 ---------------------------------------------------------------------------
DROP POLICY IF EXISTS system_error_logs_admin ON public.system_error_logs;
CREATE POLICY system_error_logs_admin ON public.system_error_logs
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id() AND public.has_permission('configuracoes.manage'))
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id() AND public.has_permission('configuracoes.manage'))
  );

-- S9 ---------------------------------------------------------------------------
-- Autoria definida pelo servidor: com sessão (JWT), user_id = perfil autenticado.
-- Sem sessão (service_role, SQL editor) o valor informado é mantido.
CREATE OR REPLACE FUNCTION public.audit_logs_stamp_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := public.auth_profile_id();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_logs_stamp_author() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_logs_stamp_author ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_stamp_author
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_stamp_author();

-- S10 --------------------------------------------------------------------------
-- Vincula a conta do Auth ao perfil pré-cadastrado pela gestão (mesmo e-mail).
-- Sem perfil pré-cadastrado, NÃO cria perfil: o login mostra "acesso ainda não
-- vinculado" e a gestão cadastra o usuário em Administração > Usuários.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
     SET auth_user_id = NEW.id,
         updated_at = NOW()
   WHERE lower(email) = lower(NEW.email)
     AND auth_user_id IS NULL;
  RETURN NEW;
END;
$$;

COMMIT;

-- Verificação sugerida após aplicar (como MUNICIPAL_ADMIN do município A):
--   SELECT count(*) FROM properties WHERE municipality_id <> current_user_municipality_id();  -- esperado: 0
--   SELECT public.is_platform_admin();                                                       -- esperado: false
