-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 27: RPCs DO PORTAL DO CIDADÃO (ACESSO ANÔNIMO)
-- ==============================================================================
-- Depois da migration 26, `anon` não tem mais acesso direto a nenhuma tabela.
-- O portal público passa a operar exclusivamente por estas funções
-- SECURITY DEFINER, que expõem apenas dados agregados/anonimizados.
--
-- ROLLOUT: aplicar JUNTO ou IMEDIATAMENTE ANTES da migration 26.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. get_public_municipality(id) -> dados públicos do município
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_municipality(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', m.id,
    'name', m.name,
    'state', m.state,
    'ibgeCode', m.ibge_code,
    'logoUrl', m.logo_url
  )
  FROM public.municipalities m
  WHERE m.id = p_id AND m.active = true;
$$;

-- ------------------------------------------------------------------------------
-- 2. public_portal_overview(municipality_id) -> indicadores agregados
--    100% anonimizado: nenhuma linha de visita/perfil/denunciante é exposta.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_portal_overview(p_municipality_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun record;
  v_neighborhoods jsonb;
  v_total_visited int;
  v_total_foci int;
  v_total_props int;
BEGIN
  SELECT id, name, state INTO v_mun
  FROM public.municipalities
  WHERE id = p_municipality_id AND active = true;

  IF v_mun.id IS NULL THEN
    RAISE EXCEPTION 'municipality_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    COALESCE(count(DISTINCT v.property_id), 0),
    COALESCE((SELECT count(*) FROM public.breeding_sites bs WHERE bs.municipality_id = p_municipality_id), 0),
    COALESCE((SELECT count(*) FROM public.properties p WHERE p.municipality_id = p_municipality_id AND p.deleted_at IS NULL), 0)
  INTO v_total_visited, v_total_foci, v_total_props
  FROM public.visits v
  WHERE v.municipality_id = p_municipality_id
    AND v.deleted_at IS NULL
    AND v.result = 'TRABALHADO';

  SELECT COALESCE(jsonb_agg(n_data ORDER BY n_data->>'name'), '[]'::jsonb)
  INTO v_neighborhoods
  FROM (
    SELECT jsonb_build_object(
      'id', n.id,
      'name', n.name,
      'zone', COALESCE(z.name, 'Urbana'),
      'visited_properties', COALESCE(vs.cnt, 0),
      'foci_eliminated', COALESCE(bs.cnt, 0),
      'coverage_percent', LEAST(100, CASE WHEN COALESCE(pc.cnt, 0) > 0
        THEN round(100.0 * COALESCE(vs.cnt, 0) / pc.cnt)
        ELSE 0 END)
    ) AS n_data
    FROM public.neighborhoods n
    LEFT JOIN public.zones z ON z.id = n.zone_id
    LEFT JOIN (
      SELECT p.neighborhood_id, count(DISTINCT v.property_id) AS cnt
      FROM public.visits v
      JOIN public.properties p ON p.id = v.property_id
      WHERE v.municipality_id = p_municipality_id AND v.deleted_at IS NULL AND v.result = 'TRABALHADO'
      GROUP BY p.neighborhood_id
    ) vs ON vs.neighborhood_id = n.id
    LEFT JOIN (
      SELECT p.neighborhood_id, count(*) AS cnt
      FROM public.breeding_sites b
      JOIN public.properties p ON p.id = b.property_id
      WHERE b.municipality_id = p_municipality_id
      GROUP BY p.neighborhood_id
    ) bs ON bs.neighborhood_id = n.id
    LEFT JOIN (
      SELECT neighborhood_id, count(*) AS cnt
      FROM public.properties
      WHERE municipality_id = p_municipality_id AND deleted_at IS NULL
      GROUP BY neighborhood_id
    ) pc ON pc.neighborhood_id = n.id
    WHERE n.municipality_id = p_municipality_id
  ) s;

  RETURN jsonb_build_object(
    'municipalityName', v_mun.name || ' - ' || v_mun.state,
    'lastUpdated', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
    'indicators', jsonb_build_object(
      'totalVisited', v_total_visited,
      'fociEliminated', v_total_foci,
      'blocksTreated', COALESCE(round(v_total_visited::numeric / 25), 0),
      'coveragePercent', LEAST(100, CASE WHEN v_total_props > 0
        THEN round(100.0 * v_total_visited / v_total_props) ELSE 0 END)
    ),
    'neighborhoods', v_neighborhoods
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. public_submit_complaint(payload) -> registra denúncia, protocolo e token
--    gerados no SERVIDOR.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_submit_complaint(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun_id      uuid := (p_payload->>'municipalityId')::uuid;
  v_problem     text := p_payload->>'problemType';
  v_description text := p_payload->>'description';
  v_anonymous   boolean := COALESCE((p_payload->>'isAnonymous')::boolean, false);
  v_protocol    text;
  v_token       text;
  v_attempts    int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.municipalities WHERE id = v_mun_id AND active = true) THEN
    RAISE EXCEPTION 'municipality_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_problem IS NULL OR v_problem NOT IN (
    'terreno_baldinho','piscina_abandonada','acumulo_lixo','caixa_dagua_aberta','foco_larvas','outro'
  ) THEN
    RAISE EXCEPTION 'invalid_problem_type' USING ERRCODE = '22023';
  END IF;

  IF v_description IS NULL OR length(trim(v_description)) < 10 OR length(v_description) > 4000 THEN
    RAISE EXCEPTION 'invalid_description' USING ERRCODE = '22023';
  END IF;

  -- Protocolo único
  LOOP
    v_attempts := v_attempts + 1;
    v_protocol := 'END-' || extract(year FROM now())::text || '-' ||
                  lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.complaints WHERE protocol = v_protocol);
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'protocol_generation_failed' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  v_token := upper(encode(gen_random_bytes(6), 'hex'));

  INSERT INTO public.complaints (
    municipality_id, protocol, tracking_token, problem_type, description,
    street, number, neighborhood_id, latitude, longitude,
    complainant_name, complainant_phone, anonymous, priority, status, photo_url
  ) VALUES (
    v_mun_id,
    v_protocol,
    v_token,
    v_problem,
    v_description,
    COALESCE(NULLIF(trim(p_payload->>'approximateAddress'), ''), 'Endereço aproximado não informado'),
    'S/N',
    (p_payload->>'neighborhoodId')::uuid,
    NULLIF(p_payload->>'latitude', '')::double precision,
    NULLIF(p_payload->>'longitude', '')::double precision,
    CASE WHEN v_anonymous THEN NULL ELSE NULLIF(trim(p_payload->>'reporterName'), '') END,
    CASE WHEN v_anonymous THEN NULL ELSE NULLIF(trim(p_payload->>'reporterPhone'), '') END,
    v_anonymous,
    'MEDIA',
    'RECEBIDA',
    NULLIF(trim(p_payload->>'photoUrl'), '')
  );

  RETURN jsonb_build_object('protocol', v_protocol, 'trackingToken', v_token);
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. public_track_complaint(protocol, token) -> status whitelistado (sem PII)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_track_complaint(p_protocol text, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row record;
BEGIN
  IF p_protocol IS NULL OR p_token IS NULL OR length(trim(p_token)) < 4 THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT protocol, status, problem_type, street, number, created_at, updated_at, inspected_at
  INTO v_row
  FROM public.complaints
  WHERE upper(protocol) = upper(trim(p_protocol))
    AND upper(tracking_token) = upper(trim(p_token))
    AND deleted_at IS NULL;

  IF v_row.protocol IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'protocol', v_row.protocol,
    'status', v_row.status,
    'problemType', v_row.problem_type,
    'street', v_row.street,
    'number', v_row.number,
    'createdAt', v_row.created_at,
    'updatedAt', v_row.updated_at,
    'inspectedAt', v_row.inspected_at
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. GRANTS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_public_municipality(uuid)     FROM public;
REVOKE ALL ON FUNCTION public.public_portal_overview(uuid)      FROM public;
REVOKE ALL ON FUNCTION public.public_submit_complaint(jsonb)    FROM public;
REVOKE ALL ON FUNCTION public.public_track_complaint(text, text) FROM public;

GRANT EXECUTE ON FUNCTION public.get_public_municipality(uuid)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_portal_overview(uuid)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_submit_complaint(jsonb)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_track_complaint(text, text) TO anon, authenticated;
