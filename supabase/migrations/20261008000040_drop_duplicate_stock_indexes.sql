-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 40: ÍNDICES DUPLICADOS CRIADOS NA MIGRATION 39
-- ==============================================================================
-- A migration 39 criou idx_product_batches_product e idx_stock_movements_batch,
-- idênticos a idx_product_batches_product_id e idx_stock_movements_batch_id
-- (apontado pelo supabase db advisors). Mantém as versões *_id já existentes.
-- Rollback: recriar os dois índices (sem efeito funcional).
-- ==============================================================================

DROP INDEX IF EXISTS public.idx_product_batches_product;
DROP INDEX IF EXISTS public.idx_stock_movements_batch;
