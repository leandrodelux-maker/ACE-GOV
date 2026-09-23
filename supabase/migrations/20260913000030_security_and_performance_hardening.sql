-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 30: HARDENING DE SEGURANÇA E PERFORMANCE
-- ==============================================================================
-- 1. Corrige search_path mutável em funções de trigger e RPC (mitiga CVE / search_path injection)
-- 2. Restringe execução de funções de controle interno ao papel 'authenticated',
--    removendo privilégios indevidos concedidos ao papel 'anon'
-- 3. Cria índices de cobertura para as Foreign Keys operacionais críticas
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CORREÇÃO DE SEARCH_PATH EM FUNÇÕES DE SISTEMA
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_stock_deduction_on_movement()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.movement_type IN ('saida', 'uso_operacao', 'distribuicao_ace', 'distribuicao_equipe', 'perda', 'vencimento') THEN
    -- Verificar saldo no lote
    IF NEW.batch_id IS NOT NULL THEN
      IF (SELECT current_quantity FROM product_batches WHERE id = NEW.batch_id) < NEW.quantity THEN
        RAISE EXCEPTION 'Saldo insuficiente no lote selecionado para realizar esta saída.';
      END IF;
      
      UPDATE product_batches
      SET current_quantity = current_quantity - NEW.quantity,
          updated_at = now()
      WHERE id = NEW.batch_id;
    END IF;

    -- Atualizar quantidade do produto pai
    UPDATE products
    SET current_stock = GREATEST(0, current_stock - NEW.quantity),
        updated_at = now()
    WHERE id = NEW.product_id;

  ELSIF NEW.movement_type IN ('entrada', 'devolucao') THEN
    IF NEW.batch_id IS NOT NULL THEN
      UPDATE product_batches
      SET current_quantity = current_quantity + NEW.quantity,
          updated_at = now()
      WHERE id = NEW.batch_id;
    END IF;

    UPDATE products
    SET current_stock = current_stock + NEW.quantity,
        updated_at = now()
    WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. RESTRIÇÃO DE EXECUTE PARA PAPEL ANÔNIMO EM FUNÇÕES DE GESTÃO INTERNA
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.auth_profile_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.auth_profile_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_user_municipality_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_user_municipality_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_user_role_slugs() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_user_role_slugs() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(text[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(text[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_official_visit(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_official_visit(jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_role_permissions(text, text[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_role_permissions(text, text[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.log_impersonation(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_impersonation(text) TO authenticated;

-- Assegurar search_path na função submit_official_visit
ALTER FUNCTION public.submit_official_visit(jsonb) SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 3. ÍNDICES DE COBERTURA PARA FOREIGN KEYS (ALTA PERFORMANCE E JOINS)
-- ------------------------------------------------------------------------------

-- Imóveis e Território
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood_id ON public.properties(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_properties_sector_id ON public.properties(sector_id);
CREATE INDEX IF NOT EXISTS idx_properties_microarea_id ON public.properties(microarea_id);
CREATE INDEX IF NOT EXISTS idx_properties_block_id ON public.properties(block_id);
CREATE INDEX IF NOT EXISTS idx_sectors_neighborhood_id ON public.sectors(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_blocks_microarea_id ON public.blocks(microarea_id);
CREATE INDEX IF NOT EXISTS idx_microareas_sector_id ON public.microareas(sector_id);
CREATE INDEX IF NOT EXISTS idx_agents_profile_id ON public.agents(profile_id);
CREATE INDEX IF NOT EXISTS idx_agents_team_id ON public.agents(team_id);

-- Visitas e Vistorias
CREATE INDEX IF NOT EXISTS idx_visits_property_id ON public.visits(property_id);
CREATE INDEX IF NOT EXISTS idx_visits_agent_id ON public.visits(agent_id);
CREATE INDEX IF NOT EXISTS idx_visits_cycle_id ON public.visits(cycle_id);
CREATE INDEX IF NOT EXISTS idx_visits_team_id ON public.visits(team_id);
CREATE INDEX IF NOT EXISTS idx_visit_deposits_visit_id ON public.visit_deposits(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_actions_visit_id ON public.visit_actions(visit_id);

-- Pendências de Campo
CREATE INDEX IF NOT EXISTS idx_pending_visits_property_id ON public.pending_visits(property_id);
CREATE INDEX IF NOT EXISTS idx_pending_visits_cycle_id ON public.pending_visits(cycle_id);
CREATE INDEX IF NOT EXISTS idx_pending_visits_assigned_agent_id ON public.pending_visits(assigned_agent_id);

-- Criadouros e Focos
CREATE INDEX IF NOT EXISTS idx_breeding_sites_visit_id ON public.breeding_sites(visit_id);
CREATE INDEX IF NOT EXISTS idx_breeding_sites_property_id ON public.breeding_sites(property_id);

-- Ovitrampas (Core Module)
CREATE INDEX IF NOT EXISTS idx_ovitraps_property_id ON public.ovitraps(property_id);
CREATE INDEX IF NOT EXISTS idx_ovitraps_neighborhood_id ON public.ovitraps(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_ovitraps_assigned_agent_id ON public.ovitraps(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_ovitrap_installations_ovitrap_id ON public.ovitrap_installations(ovitrap_id);
CREATE INDEX IF NOT EXISTS idx_ovitrap_installations_agent_id ON public.ovitrap_installations(agent_id);
CREATE INDEX IF NOT EXISTS idx_ovitrap_collections_installation_id ON public.ovitrap_collections(installation_id);
CREATE INDEX IF NOT EXISTS idx_ovitrap_collections_agent_id ON public.ovitrap_collections(agent_id);
CREATE INDEX IF NOT EXISTS idx_ovitrap_results_collection_id ON public.ovitrap_results(collection_id);

-- Pontos Estratégicos e Imóveis Especiais
CREATE INDEX IF NOT EXISTS idx_strategic_points_property_id ON public.strategic_points(property_id);
CREATE INDEX IF NOT EXISTS idx_special_properties_property_id ON public.special_properties(property_id);

-- Denúncias e Bloqueios Epidemiológicos
CREATE INDEX IF NOT EXISTS idx_complaints_neighborhood_id ON public.complaints(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_agent_id ON public.complaints(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_blockade_operations_neighborhood_id ON public.blockade_operations(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_blockade_operations_sector_id ON public.blockade_operations(sector_id);
CREATE INDEX IF NOT EXISTS idx_epidemiological_cases_neighborhood_id ON public.epidemiological_cases(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_epidemiological_cases_sector_id ON public.epidemiological_cases(sector_id);

-- Estoque e Insumos FEFO
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch_id ON public.stock_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_product_id ON public.product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_chemical_applications_operation_id ON public.chemical_applications(operation_id);
CREATE INDEX IF NOT EXISTS idx_chemical_applications_property_id ON public.chemical_applications(property_id);

-- Ordens de Serviço e Equipamentos
CREATE INDEX IF NOT EXISTS idx_work_orders_property_id ON public.work_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_agent_id ON public.work_orders(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_equipment_movements_equipment_id ON public.equipment_movements(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment_id ON public.equipment_maintenance(equipment_id);
