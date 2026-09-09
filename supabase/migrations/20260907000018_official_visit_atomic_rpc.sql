-- Migration 20260907000018_official_visit_atomic_rpc.sql
-- Função transacional atômica para registro da Ficha Oficial da Visita ACE

CREATE OR REPLACE FUNCTION submit_official_visit(payload JSONB)
RETURNS JSONB AS $$
DECLARE
  v_id UUID;
  v_municipality_id UUID;
  v_cycle_id UUID;
  v_property_id UUID;
  v_agent_id UUID;
  v_team_id UUID;
  v_visit_date DATE;
  v_started_at TIMESTAMPTZ;
  v_finished_at TIMESTAMPTZ;
  v_visit_type VARCHAR;
  v_result VARCHAR;
  v_latitude DOUBLE PRECISION;
  v_longitude DOUBLE PRECISION;
  v_gps_accuracy NUMERIC;
  v_residents_present BOOLEAN;
  v_notes TEXT;
  
  v_deposit RECORD;
  v_action RECORD;
  v_deposit_id UUID;
  v_pending_id UUID;
  v_next_return DATE;
  v_product_id UUID;
BEGIN
  -- 1. Extração dos campos do cabeçalho
  v_id := (payload->>'id')::UUID;
  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
  END IF;

  -- Checagem de duplicidade / idempotência (evita duplo clique ou duplo envio)
  IF EXISTS (SELECT 1 FROM visits WHERE id = v_id) THEN
    RETURN jsonb_build_object(
      'success', true,
      'duplicated', true,
      'visit_id', v_id,
      'message', 'Visita já havia sido registrada anteriormente.'
    );
  END IF;

  v_municipality_id := (payload->>'municipality_id')::UUID;
  IF v_municipality_id IS NULL THEN
    v_municipality_id := current_user_municipality_id();
  END IF;
  
  -- Se o usuário não tiver municipality_id ou for nulo, buscar do imóvel
  v_property_id := (payload->>'property_id')::UUID;
  IF v_municipality_id IS NULL AND v_property_id IS NOT NULL THEN
    SELECT municipality_id INTO v_municipality_id FROM properties WHERE id = v_property_id;
  END IF;

  v_cycle_id := (payload->>'cycle_id')::UUID;
  v_agent_id := (payload->>'agent_id')::UUID;
  v_team_id := (payload->>'team_id')::UUID;
  v_visit_date := COALESCE((payload->>'visit_date')::DATE, CURRENT_DATE);
  v_started_at := (payload->>'started_at')::TIMESTAMPTZ;
  v_finished_at := COALESCE((payload->>'finished_at')::TIMESTAMPTZ, now());
  v_visit_type := COALESCE(payload->>'visit_type', 'rotina');
  v_result := COALESCE(payload->>'result', 'trabalhado');
  v_latitude := (payload->>'latitude')::DOUBLE PRECISION;
  v_longitude := (payload->>'longitude')::DOUBLE PRECISION;
  v_gps_accuracy := (payload->>'gps_accuracy')::NUMERIC;
  v_residents_present := COALESCE((payload->>'residents_present')::BOOLEAN, true);
  v_notes := payload->>'notes';

  -- 2. Inserção na tabela visits
  INSERT INTO visits (
    id,
    municipality_id,
    cycle_id,
    property_id,
    agent_id,
    team_id,
    visit_date,
    started_at,
    finished_at,
    visit_type,
    result,
    latitude,
    longitude,
    gps_accuracy,
    residents_present,
    notes,
    status,
    offline_created,
    synced_at,
    created_at,
    updated_at
  ) VALUES (
    v_id,
    v_municipality_id,
    v_cycle_id,
    v_property_id,
    v_agent_id,
    v_team_id,
    v_visit_date,
    v_started_at,
    v_finished_at,
    v_visit_type,
    v_result,
    v_latitude,
    v_longitude,
    v_gps_accuracy,
    v_residents_present,
    v_notes,
    'concluida',
    COALESCE((payload->>'offline_created')::BOOLEAN, false),
    now(),
    now(),
    now()
  );

  -- 3. Registro dos Depósitos Inspecionados
  IF payload ? 'deposits' AND jsonb_array_length(payload->'deposits') > 0 THEN
    FOR v_deposit IN SELECT * FROM jsonb_to_recordset(payload->'deposits') AS x(
      deposit_type VARCHAR,
      quantity INTEGER,
      has_water BOOLEAN,
      inspected BOOLEAN,
      positive BOOLEAN,
      larvae_found BOOLEAN,
      eliminated BOOLEAN,
      treated BOOLEAN,
      treatment_product VARCHAR,
      batch_id UUID,
      product_quantity NUMERIC,
      sample_collected BOOLEAN,
      sample_code VARCHAR,
      notes TEXT
    ) LOOP
      v_deposit_id := gen_random_uuid();

      INSERT INTO visit_deposits (
        id,
        visit_id,
        deposit_type,
        quantity,
        positive,
        larvae_found,
        eliminated,
        treated,
        treatment_product,
        batch_id,
        product_quantity,
        has_water,
        inspected,
        sample_collected,
        sample_code,
        notes,
        created_at
      ) VALUES (
        v_deposit_id,
        v_id,
        v_deposit.deposit_type,
        COALESCE(v_deposit.quantity, 1),
        COALESCE(v_deposit.positive, false),
        COALESCE(v_deposit.larvae_found, false),
        COALESCE(v_deposit.eliminated, false),
        COALESCE(v_deposit.treated, false),
        v_deposit.treatment_product,
        v_deposit.batch_id,
        COALESCE(v_deposit.product_quantity, 0),
        COALESCE(v_deposit.has_water, true),
        COALESCE(v_deposit.inspected, true),
        COALESCE(v_deposit.sample_collected, false),
        v_deposit.sample_code,
        v_deposit.notes,
        now()
      );

      -- Se houver foco positivo com larvas, registrar criadouro ativo
      IF v_deposit.positive IS TRUE OR v_deposit.larvae_found IS TRUE THEN
        INSERT INTO breeding_sites (
          id,
          municipality_id,
          property_id,
          visit_id,
          deposit_type,
          larvae_count,
          latitude,
          longitude,
          identified_at,
          eliminated_at,
          status,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          v_municipality_id,
          v_property_id,
          v_id,
          v_deposit.deposit_type,
          COALESCE(v_deposit.quantity, 1),
          v_latitude,
          v_longitude,
          now(),
          CASE WHEN v_deposit.eliminated THEN now() ELSE NULL END,
          CASE WHEN v_deposit.eliminated THEN 'eliminado' ELSE 'ativo' END,
          now(),
          now()
        );
      END IF;

      -- Se houve tratamento com lote e quantidade, dar baixa no estoque
      IF v_deposit.treated IS TRUE AND v_deposit.batch_id IS NOT NULL AND v_deposit.product_quantity > 0 THEN
        SELECT product_id INTO v_product_id FROM product_batches WHERE id = v_deposit.batch_id;
        IF v_product_id IS NOT NULL THEN
          INSERT INTO stock_movements (
            id,
            municipality_id,
            product_id,
            batch_id,
            movement_type,
            quantity,
            agent_id,
            notes,
            created_at
          ) VALUES (
            gen_random_uuid(),
            v_municipality_id,
            v_product_id,
            v_deposit.batch_id,
            'uso_operacao',
            v_deposit.product_quantity,
            v_agent_id,
            'Consumo em visita domiciliar (' || v_deposit.deposit_type || ')',
            now()
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 4. Registro das Ações / Condutas
  IF payload ? 'actions' AND jsonb_array_length(payload->'actions') > 0 THEN
    FOR v_action IN SELECT * FROM jsonb_to_recordset(payload->'actions') AS y(
      action_type VARCHAR,
      quantity INTEGER,
      notes TEXT
    ) LOOP
      INSERT INTO visit_actions (
        id,
        visit_id,
        action_type,
        quantity,
        notes,
        created_at
      ) VALUES (
        gen_random_uuid(),
        v_id,
        v_action.action_type,
        COALESCE(v_action.quantity, 1),
        v_action.notes,
        now()
      );
    END LOOP;
  END IF;

  -- 5. Gestão Operacional de Pendências e Recuperações
  IF v_result = 'trabalhado' THEN
    -- Recupera pendência anterior aberta do mesmo imóvel
    UPDATE pending_visits
    SET status = 'recuperado',
        recovered_at = now(),
        recovered_by_visit_id = v_id,
        updated_at = now()
    WHERE property_id = v_property_id
      AND (status != 'recuperado' OR status IS NULL);

    -- Atualiza imóvel como visitado
    UPDATE properties
    SET last_visit_at = now(),
        last_cadastral_update = now(),
        status = 'visitado',
        latitude = COALESCE(latitude, v_latitude),
        longitude = COALESCE(longitude, v_longitude),
        updated_at = now()
    WHERE id = v_property_id;

  ELSIF v_result IN ('fechado', 'recusa', 'desocupado', 'nao_localizado') THEN
    v_next_return := (payload->'pendency_info'->>'next_return_date')::DATE;
    IF v_next_return IS NULL THEN
      v_next_return := CURRENT_DATE + INTERVAL '7 days';
    END IF;

    -- Verificar se já existia pendência ativa para o imóvel neste ciclo
    SELECT id INTO v_pending_id
    FROM pending_visits
    WHERE property_id = v_property_id
      AND (cycle_id = v_cycle_id OR v_cycle_id IS NULL)
      AND status != 'recuperado'
    LIMIT 1;

    IF v_pending_id IS NOT NULL THEN
      UPDATE pending_visits
      SET attempt_count = attempt_count + 1,
          last_attempt_date = v_visit_date,
          next_return_date = v_next_return,
          reason = v_result,
          priority = CASE WHEN attempt_count >= 2 THEN 'alta' ELSE priority END,
          responsible_agent_id = COALESCE(v_agent_id, responsible_agent_id),
          updated_at = now()
      WHERE id = v_pending_id;
    ELSE
      INSERT INTO pending_visits (
        id,
        cycle_id,
        property_id,
        assigned_agent_id,
        responsible_agent_id,
        reason,
        priority,
        deadline,
        attempt_count,
        first_attempt_date,
        last_attempt_date,
        next_return_date,
        status,
        notes,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_cycle_id,
        v_property_id,
        v_agent_id,
        v_agent_id,
        v_result,
        'media',
        v_next_return,
        1,
        v_visit_date,
        v_visit_date,
        v_next_return,
        'pendente',
        v_notes,
        now(),
        now()
      );
    END IF;

    -- Atualiza status do imóvel para refletir a pendência
    UPDATE properties
    SET status = v_result,
        last_visit_at = now(),
        last_cadastral_update = now(),
        latitude = COALESCE(latitude, v_latitude),
        longitude = COALESCE(longitude, v_longitude),
        updated_at = now()
    WHERE id = v_property_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'visit_id', v_id,
    'result', v_result,
    'message', 'Visita domiciliar oficial e depósitos registrados com sucesso!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
