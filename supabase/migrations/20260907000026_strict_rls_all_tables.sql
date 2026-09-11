-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 26: ROW LEVEL SECURITY ESTRITA (TODAS AS TABELAS)
-- ==============================================================================
-- Remove TODAS as policies permissivas atuais (que continham
-- `OR auth.uid() IS NULL OR municipality_id = '<piloto>'` = acesso público total)
-- e aplica isolamento real por município + RBAC.
--
-- Estratégia:
--   1. Função introspectiva _rls_tenant_predicate() resolve, para qualquer
--      tabela, um predicado de "mesmo município" seguindo as FKs (até 6 níveis).
--   2. Loop dinâmico habilita RLS, DROPA todas as policies e aplica:
--        - tabela com caminho até municipality_id -> policy de tenant
--        - tabela de referência global -> leitura autenticada / escrita admin
--   3. Overrides explícitos para o núcleo sensível (profiles, RBAC, auditoria...).
--   4. REVOKE de todos os privilégios de tabela para `anon`
--      (o portal do cidadão passa a usar apenas RPCs SECURITY DEFINER - migration 27).
--
-- ROLLOUT: aplicar SOMENTE depois de:
--   - migrations 23/24/25 aplicadas;
--   - usuários provisionados no Supabase Auth e profiles.auth_user_id preenchido;
--   - frontend novo (Workstream C) publicado;
--   - migration 27 (RPCs públicas) aplicada.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CONSTRUTOR DE PREDICADO DE TENANT (ferramenta de build; removida ao final)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._rls_tenant_predicate(
  p_table text,
  p_alias text,
  p_depth int DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  fk record;
  sub text;
BEGIN
  IF p_depth > 6 THEN
    RETURN NULL;
  END IF;

  -- Caminho direto
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = 'municipality_id'
  ) THEN
    RETURN format('%I.municipality_id = public.current_user_municipality_id()', p_alias);
  END IF;

  -- Segue FKs de coluna única para tabelas-pai
  FOR fk IN
    SELECT kcu.column_name AS child_col,
           ccu.table_name  AS parent_tbl,
           ccu.column_name AS parent_col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.constraint_schema = tc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.constraint_schema = tc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = p_table
      AND ccu.table_name <> p_table
  LOOP
    sub := public._rls_tenant_predicate(fk.parent_tbl, '_p' || p_depth, p_depth + 1);
    IF sub IS NOT NULL THEN
      RETURN format(
        'EXISTS (SELECT 1 FROM public.%I _p%s WHERE _p%s.%I = %I.%I AND (%s))',
        fk.parent_tbl, p_depth, p_depth, fk.parent_col, p_alias, fk.child_col, sub
      );
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. LOOP PRINCIPAL
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  t        record;
  pol      record;
  pred     text;
  full_pred text;
  -- Núcleo tratado explicitamente na seção 3 (loop apenas dropa policies e sai)
  core_tables text[] := ARRAY[
    'profiles','roles','permissions','role_permissions','user_roles','user_sessions',
    'municipalities','audit_logs','system_settings','system_error_logs',
    'database_backups','notifications','sync_queue'
  ];
BEGIN
  FOR t IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE '\_%'
      AND c.relname <> 'schema_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tbl);

    -- Dropa TODAS as policies existentes (permissivas legadas incluídas)
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.tbl
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t.tbl);
    END LOOP;

    -- Revoga acesso anônimo em nível de privilégio (defesa em profundidade)
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.tbl);

    IF t.tbl = ANY (core_tables) THEN
      CONTINUE;  -- policies definidas na seção 3
    END IF;

    pred := public._rls_tenant_predicate(t.tbl, t.tbl, 0);

    IF pred IS NOT NULL THEN
      full_pred := format('(public.is_platform_admin() OR %s)', pred);
      EXECUTE format(
        'CREATE POLICY rls_tenant ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
        t.tbl, full_pred, full_pred
      );
    ELSE
      -- Tabela de referência global (deposit_categories, epidemiological_weeks...)
      EXECUTE format(
        'CREATE POLICY rls_ref_read ON public.%I FOR SELECT TO authenticated USING (true)',
        t.tbl
      );
      EXECUTE format(
        'CREATE POLICY rls_ref_admin ON public.%I FOR ALL TO authenticated '
        'USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin())',
        t.tbl
      );
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. OVERRIDES EXPLÍCITOS - NÚCLEO SENSÍVEL
-- ------------------------------------------------------------------------------

-- municipalities: cada usuário vê só o seu; escrita só platform admin
CREATE POLICY mun_select ON public.municipalities
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR id = public.current_user_municipality_id());
CREATE POLICY mun_admin ON public.municipalities
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- profiles: leitura no mesmo município; auto-edição de dados próprios;
-- gestão completa com permissão usuarios.*
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR municipality_id = public.current_user_municipality_id());
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY profiles_admin_write ON public.profiles
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id()
        AND public.has_permission('usuarios.update'))
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id()
        AND (public.has_permission('usuarios.create') OR public.has_permission('usuarios.update')))
  );

-- roles / permissions: catálogo legível por qualquer autenticado; escrita = perfis.manage
CREATE POLICY roles_read ON public.roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY roles_write ON public.roles
  FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.has_permission('perfis.manage'))
  WITH CHECK (public.is_platform_admin() OR public.has_permission('perfis.manage'));

CREATE POLICY permissions_read ON public.permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_write ON public.permissions
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY role_permissions_read ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY role_permissions_write ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.has_permission('perfis.manage'))
  WITH CHECK (public.is_platform_admin() OR public.has_permission('perfis.manage'));

-- user_roles: leitura no mesmo município; escrita = usuarios.update
CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.municipality_id = public.current_user_municipality_id()
    )
  );
CREATE POLICY user_roles_write ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.has_permission('usuarios.update'))
  WITH CHECK (public.is_platform_admin() OR public.has_permission('usuarios.update'));

-- user_sessions: dono
CREATE POLICY user_sessions_owner ON public.user_sessions
  FOR ALL TO authenticated
  USING (public.is_platform_admin() OR user_id = public.auth_profile_id())
  WITH CHECK (public.is_platform_admin() OR user_id = public.auth_profile_id());

-- audit_logs: leitura = auditoria.view no município; inserção livre (autenticado,
-- próprio município); sem UPDATE/DELETE
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id()
        AND public.has_permission('auditoria.view'))
  );
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    municipality_id = public.current_user_municipality_id()
    OR public.is_platform_admin()
  );

-- system_settings: leitura no município; escrita = configuracoes.manage
CREATE POLICY system_settings_select ON public.system_settings
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR municipality_id = public.current_user_municipality_id());
CREATE POLICY system_settings_write ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.has_permission('configuracoes.manage'))
  WITH CHECK (public.is_platform_admin() OR public.has_permission('configuracoes.manage'));

-- system_error_logs: leitura/gestão = configuracoes.manage; inserção livre autenticado
CREATE POLICY system_error_logs_admin ON public.system_error_logs
  FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.has_permission('configuracoes.manage'))
  WITH CHECK (public.is_platform_admin() OR public.has_permission('configuracoes.manage'));
CREATE POLICY system_error_logs_insert ON public.system_error_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    municipality_id IS NULL
    OR municipality_id = public.current_user_municipality_id()
    OR public.is_platform_admin()
  );

-- database_backups: só platform admin
CREATE POLICY database_backups_admin ON public.database_backups
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- notifications: dono
CREATE POLICY notifications_owner ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_platform_admin() OR user_id = public.auth_profile_id())
  WITH CHECK (public.is_platform_admin() OR user_id = public.auth_profile_id());

-- sync_queue: dono
CREATE POLICY sync_queue_owner ON public.sync_queue
  FOR ALL TO authenticated
  USING (public.is_platform_admin() OR user_id = public.auth_profile_id())
  WITH CHECK (public.is_platform_admin() OR user_id = public.auth_profile_id());

-- ------------------------------------------------------------------------------
-- 4. LIMPEZA
-- ------------------------------------------------------------------------------
DROP FUNCTION public._rls_tenant_predicate(text, text, int);

-- Sanidade: nenhuma policy pode mais conter o furo de acesso anônimo
DO $$
DECLARE
  bad int;
BEGIN
  SELECT count(*) INTO bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual ILIKE '%auth.uid() IS NULL%'
      OR qual ILIKE '%00000000-0000-0000-0000-000000000001%'
      OR with_check ILIKE '%auth.uid() IS NULL%');
  IF bad > 0 THEN
    RAISE EXCEPTION 'Ainda existem % policies com brecha de acesso anônimo', bad;
  END IF;
END $$;

COMMIT;
