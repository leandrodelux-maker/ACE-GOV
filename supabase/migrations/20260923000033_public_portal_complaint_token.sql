-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 33: CORREÇÃO DO REGISTRO DE DENÚNCIA DO PORTAL
-- ==============================================================================
-- public_submit_complaint (migration 27) usa gen_random_bytes(), da extensão
-- pgcrypto. No Supabase o pgcrypto fica no esquema "extensions", e a função roda
-- com search_path = public, pg_temp: a chamada falha com
--   42883 function gen_random_bytes(integer) does not exist
-- ou seja, NENHUMA denúncia do Portal do Cidadão é gravada. Comprovado em
-- homologação (teste P1). A correção gera o token com gen_random_uuid(), nativo do
-- PostgreSQL 13+, com a mesma entropia (48 bits) e o mesmo formato (12 hex).
-- Somente a função é substituída; nenhuma tabela ou dado é alterado.
-- ==============================================================================

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

  -- 12 hex de um UUID v4 (gerador criptográfico nativo, sem depender do pgcrypto)
  v_token := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

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

REVOKE ALL ON FUNCTION public.public_submit_complaint(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.public_submit_complaint(jsonb) TO anon, authenticated;
