-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 34: VÍNCULO DOS ACE COMO AGENTES + ESCRITA EM agents
-- ==============================================================================
-- 1. visits, ovitrap_installations e ovitrap_collections referenciam agents(id):
--    um ACE sem cadastro em "agents" não consegue gravar visita. Esta migração cria
--    o cadastro de agente (idempotente) para todo perfil ATIVO com papel ACE que
--    ainda não tem um, no próprio município do perfil. Matrícula = registration_number.
-- 2. A tabela agents usava a política genérica de município (qualquer usuário do
--    município podia criar/alterar agentes). A escrita passa a exigir
--    'agentes.manage' (supervisor, coordenador, admin), como a interface já exige.
-- Aditiva: não apaga agentes nem altera vínculos existentes.
-- ==============================================================================

BEGIN;

INSERT INTO public.agents (municipality_id, profile_id, employee_number, active)
SELECT p.municipality_id, p.id, p.registration_number, true
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id
JOIN public.roles r ON r.id = ur.role_id AND r.slug = 'ACE'
WHERE p.active = true
  AND NOT EXISTS (SELECT 1 FROM public.agents a WHERE a.profile_id = p.id);

DROP POLICY IF EXISTS rls_tenant ON public.agents;
DROP POLICY IF EXISTS agents_select ON public.agents;
DROP POLICY IF EXISTS agents_write ON public.agents;

CREATE POLICY agents_select ON public.agents
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR municipality_id = public.current_user_municipality_id());

CREATE POLICY agents_write ON public.agents
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id() AND public.has_permission('agentes.manage'))
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (municipality_id = public.current_user_municipality_id() AND public.has_permission('agentes.manage'))
  );

COMMIT;

-- Conferência: perfis ACE ativos sem agente (esperado: 0)
--   SELECT count(*) FROM profiles p JOIN user_roles ur ON ur.user_id = p.id
--   JOIN roles r ON r.id = ur.role_id AND r.slug = 'ACE'
--   WHERE p.active AND NOT EXISTS (SELECT 1 FROM agents a WHERE a.profile_id = p.id);
