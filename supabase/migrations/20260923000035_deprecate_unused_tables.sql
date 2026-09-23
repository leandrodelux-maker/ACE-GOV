-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 35: TABELAS SEM USO APÓS A SIMPLIFICAÇÃO DO PAINEL
-- ==============================================================================
-- Os módulos "Capacitações e Cursos" e "Metas e Indicadores" foram retirados da
-- interface. As tabelas são MANTIDAS com os dados (retenção e eventual
-- reativação); apenas ficam marcadas como descontinuadas e sem escrita pela API.
-- Reversível: basta conceder novamente INSERT/UPDATE/DELETE a authenticated.
-- ==============================================================================

BEGIN;

COMMENT ON TABLE public.trainings IS
  'DESCONTINUADA em 2026-09-23 (módulo Capacitações removido da interface). Dados mantidos; somente leitura pela API.';
COMMENT ON TABLE public.training_participants IS
  'DESCONTINUADA em 2026-09-23 (módulo Capacitações removido da interface). Dados mantidos; somente leitura pela API.';
COMMENT ON TABLE public.management_targets IS
  'DESCONTINUADA em 2026-09-23 (módulo Metas e Indicadores removido da interface). Dados mantidos; somente leitura pela API.';

REVOKE INSERT, UPDATE, DELETE ON public.trainings, public.training_participants, public.management_targets FROM authenticated, anon;

COMMIT;
