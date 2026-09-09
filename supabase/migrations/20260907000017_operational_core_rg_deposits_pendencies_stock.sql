-- Migration 20260907000017_operational_core_rg_deposits_pendencies_stock.sql
-- Adiciona campos e constraints necessários para o Reconhecimento Geográfico (RG),
-- Ficha Oficial ACE de Visitas e Depósitos, Gestão de Pendências, Ovitrampas e Operações Químicas

-- 1. PROPRIEDADES (RG - Base Territorial Operacional)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_cadastral_update TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS situation VARCHAR(30) DEFAULT 'ativo';

CREATE INDEX IF NOT EXISTS idx_properties_assigned_agent ON properties(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_situation ON properties(situation);

-- 2. DEPÓSITOS DA VISITA (Ficha Oficial ACE)
ALTER TABLE visit_deposits
ADD COLUMN IF NOT EXISTS has_water BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS inspected BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sample_collected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sample_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS product_quantity NUMERIC(10,3) DEFAULT 0;

-- 3. PENDÊNCIAS DE CAMPO (Gestão de Fechados, Recusas e Retornos)
ALTER TABLE pending_visits
ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS first_attempt_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS last_attempt_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS next_return_date DATE,
ADD COLUMN IF NOT EXISTS responsible_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recovery_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS recovered_by_visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_pending_visits_recovered ON pending_visits(recovered_at);
CREATE INDEX IF NOT EXISTS idx_pending_visits_responsible ON pending_visits(responsible_agent_id);

-- 4. OPERAÇÕES QUÍMICAS E UBV
ALTER TABLE vector_control_operations
ADD COLUMN IF NOT EXISTS equipment_type VARCHAR(50) DEFAULT 'ubv_costal',
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS operational_conditions TEXT,
ADD COLUMN IF NOT EXISTS route_distance_km NUMERIC(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS execution_time_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS worked_area_hectares NUMERIC(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS product_consumed_liters NUMERIC(10,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(50),
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS target_properties_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS visited_properties_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS worked_properties_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS closed_properties_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS refusal_properties_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS focus_found_count INTEGER DEFAULT 0;

-- 5. OVITRAMPAS OPERACIONAIS
ALTER TABLE ovitraps
ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS responsible_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS operational_status VARCHAR(30) DEFAULT 'ativa';

ALTER TABLE ovitrap_collections
ADD COLUMN IF NOT EXISTS paddle_replaced BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS next_collection_date DATE,
ADD COLUMN IF NOT EXISTS eggs_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS positive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS result_date DATE,
ADD COLUMN IF NOT EXISTS analysis_status VARCHAR(30) DEFAULT 'aguardando_coleta';

-- 6. TRIGGER / FUNÇÃO DE BAIXA AUTOMÁTICA DE ESTOQUE EM OPERAÇÃO E CONTROLE FEFO
CREATE OR REPLACE FUNCTION handle_stock_deduction_on_movement()
RETURNS TRIGGER AS $$
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

    -- Atualizar quantidade do produto pai se existir campo current_stock
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_movement_deduction ON stock_movements;
CREATE TRIGGER trg_stock_movement_deduction
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION handle_stock_deduction_on_movement();
