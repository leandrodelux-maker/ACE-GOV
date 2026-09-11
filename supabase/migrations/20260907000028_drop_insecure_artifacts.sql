-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 28: REMOÇÃO DE ARTEFATOS INSEGUROS
-- ==============================================================================
-- ROLLOUT: aplicar por ÚLTIMO, depois de:
--   - todos os usuários reais provisionados no Supabase Auth (Workstream B);
--   - frontend novo publicado (Workstream C);
--   - migrations 26/27 aplicadas e verificadas.
-- ==============================================================================

BEGIN;

-- 1. Remove a coluna de senha-fallback (autenticação agora é 100% Supabase Auth)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS password_hash;

-- 2. Remove a função depreciada is_superadmin() (migration 26 já migrou tudo
--    para is_platform_admin()).
DROP FUNCTION IF EXISTS public.is_superadmin();

-- 3. Desativa qualquer profile que NÃO esteja vinculado a uma conta real do
--    Supabase Auth. Perfis de demonstração (Admin@2026) ficam sem acesso.
--    Um administrador pode reativar manualmente após vincular auth_user_id.
UPDATE public.profiles
   SET active = false, updated_at = NOW()
 WHERE auth_user_id IS NULL
   AND active = true;

-- 4. Trilha de auditoria da conclusão do hardening
INSERT INTO public.audit_logs (municipality_id, action, module, entity, entity_id, new_data)
SELECT id, 'SECURITY_HARDENING', 'seguranca', 'auth_rbac', 'migration_28',
  jsonb_build_object(
    'message', 'Autenticação movida 100% para Supabase Auth; RBAC/RLS server-side ativos; password_hash removido.',
    'at', NOW()
  )
FROM public.municipalities
WHERE active = true;

COMMIT;
