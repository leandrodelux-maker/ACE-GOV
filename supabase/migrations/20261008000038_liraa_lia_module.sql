-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 38: MÓDULO LIRAa / LIA (VIGILÂNCIA ENTOMOLÓGICA)
-- ==============================================================================
-- Estende as tabelas existentes (liraa_surveys, liraa_strata, liraa_samples,
-- entomological_samples) e cria: regras metodológicas versionadas, sorteios
-- auditáveis, quarteirões sorteados, inspeções, depósitos por tipo, eventos de
-- laboratório e histórico de situação. Regras de negócio: docs/MODULOS-LIRAA-ZOONOSES.md
--
-- Metodologia (fontes em liraa_rule_sets):
--   - Manual LIRAa MS/SVS 2013: n = 450 / (1 + 450/N); B = N/A; Q = n / (B/passo);
--     IA = A/Q; IC sorteado em [0, IA); quarteirões = posições IC + k·IA.
--     Estratos de 8.100 a 12.000 imóveis (20% = 1 a cada 5) ou de 2.000 a 8.100 (50%).
--     Pontos estratégicos fora da amostra. Fechado/recusa: substituição pelo imóvel
--     imediatamente anterior ou posterior.
--   - Portaria GM/MS 3.129/2016 (RC CIT 1/2021): LIRAa > 2.000 imóveis; LIA < 2.000.
--   - LIA: faixas percentuais PENDENTES de validação (sorteio bloqueado até a
--     coordenação registrar a confirmação técnica).
--
-- Sorteio reproduzível: u = SHA-256(semente|escopo) → [0,1). Semente, parâmetros,
-- versão das regras e hash do universo ficam gravados em liraa_draws.
--
-- Rollback: DROP das tabelas/funções criadas aqui; colunas novas são opcionais
-- (ALTER TABLE ... DROP COLUMN). Status antigos: execucao→em_execucao,
-- conferencia→processamento, encerrado→finalizado.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Regras metodológicas versionadas (catálogo global)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.liraa_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(60) NOT NULL,
  version varchar(20) NOT NULL,
  kind varchar(30) NOT NULL CHECK (kind IN ('amostragem_liraa', 'amostragem_lia', 'classificacao_risco')),
  params jsonb NOT NULL,
  source text NOT NULL,
  validation_status varchar(30) NOT NULL CHECK (validation_status IN ('referencia_oficial', 'pendente_validacao')),
  validation_notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, version)
);

INSERT INTO public.liraa_rule_sets (code, version, kind, params, source, validation_status, validation_notes) VALUES
('LIRAA_MS_2013', '1', 'amostragem_liraa',
 '{"base_sample":450,"stratum_min":8100,"stratum_max":12000,"small_stratum_min":2000,"step_regular":5,"step_small":2,"municipality_min_exclusive":2000,"sample_rounding":"ceil","block_rounding":"round_half_up_min1"}',
 'Manual LIRAa MS/SVS 2013 (cap. 2 Amostragem; 4.5 Procedimentos de campo); Portaria GM/MS 3.129/2016, incorporada à RC CIT 1/2021.',
 'referencia_oficial',
 'Arredondamentos: n e Q para cima e posição do quarteirão pela metade para cima (mínimo 1), reproduzindo o Quadro 1 do manual (IC 0,70; IA 4,2 → quarteirões 1, 5, 9, 13, 18...). O texto do manual fala em "partes inteiras" e o exemplo usa B=26 e Q=85 de forma inconsistente; B é usado sem arredondamento. Confirmar com a SES-GO.'),
('LIA_REFERENCIA_ESTADUAL', '1', 'amostragem_lia',
 '{"municipality_max_exclusive":2000,"bands":[{"max":400,"step":1},{"max":1500,"step":3},{"max":1999,"step":5}]}',
 'Portaria GM/MS 3.129/2016 (LIA em municípios com menos de 2.000 imóveis, conforme Diretrizes Nacionais 2009). Faixas: materiais técnicos estaduais (SES-RS, SES-TO).',
 'pendente_validacao',
 'As faixas (até 400 imóveis: 100%; 401-1.500: 1 a cada 3; 1.501-1.999: 1 a cada 5) não foram localizadas em norma federal vigente. O sorteio do LIA exige confirmação técnica registrada pela coordenação (liraa_confirm_rules).'),
('CLASSIF_IIP_MS_2009', '1', 'classificacao_risco',
 '{"indicator":"IIP","decimals":1,"bands":[{"below":1,"level":"satisfatorio"},{"up_to":3.9,"level":"alerta"},{"level":"risco"}]}',
 'Diretrizes Nacionais para a Prevenção e Controle de Epidemias de Dengue, MS 2009: IIP < 1% satisfatório; 1 a 3,9% alerta; > 3,9% risco.',
 'referencia_oficial',
 'O IB não recebe classificação automática até validação técnica de faixas vigentes.')
ON CONFLICT (code, version) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. Levantamentos e estratos (tabelas existentes)
-- ------------------------------------------------------------------------------
ALTER TABLE public.liraa_surveys
  ADD COLUMN IF NOT EXISTS rule_set_id uuid REFERENCES public.liraa_rule_sets(id),
  ADD COLUMN IF NOT EXISTS total_blocks int,
  ADD COLUMN IF NOT EXISTS coordinator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rules_confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rules_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rules_confirmation_note text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS tube_seq int NOT NULL DEFAULT 0;

UPDATE public.liraa_surveys SET status = CASE status
  WHEN 'em_execucao' THEN 'execucao'
  WHEN 'processamento' THEN 'conferencia'
  WHEN 'finalizado' THEN 'encerrado'
  ELSE status END;

ALTER TABLE public.liraa_surveys
  ADD CONSTRAINT liraa_surveys_status_chk CHECK (status IN ('planejamento', 'execucao', 'conferencia', 'encerrado', 'cancelado')),
  ADD CONSTRAINT liraa_surveys_type_chk CHECK (type IN ('LIRAa', 'LIA')),
  ADD CONSTRAINT liraa_surveys_dates_chk CHECK (end_date >= start_date);

ALTER TABLE public.liraa_strata
  ADD COLUMN IF NOT EXISTS stratum_number int,
  ADD COLUMN IF NOT EXISTS neighborhood_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_blocks int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inspection_step int;

CREATE TABLE IF NOT EXISTS public.liraa_survey_members (
  survey_id uuid NOT NULL REFERENCES public.liraa_surveys(id) ON DELETE CASCADE,
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role varchar(20) NOT NULL CHECK (member_role IN ('supervisor', 'agente', 'laboratorio')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_id, profile_id, member_role)
);

-- ------------------------------------------------------------------------------
-- 3. Sorteios, quarteirões e imóveis selecionados
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.liraa_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.liraa_surveys(id) ON DELETE CASCADE,
  stratum_id uuid NOT NULL REFERENCES public.liraa_strata(id) ON DELETE CASCADE,
  rule_set_id uuid NOT NULL REFERENCES public.liraa_rule_sets(id),
  rule_code varchar(60) NOT NULL,
  rule_version varchar(20) NOT NULL,
  algorithm varchar(60) NOT NULL,
  seed text NOT NULL,
  parameters jsonb NOT NULL,
  universe_count int NOT NULL,
  universe_hash text NOT NULL,
  selected_blocks int NOT NULL DEFAULT 0,
  selected_properties int NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'vigente' CHECK (status IN ('vigente', 'substituido')),
  executed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_liraa_draws_vigente ON public.liraa_draws (stratum_id) WHERE status = 'vigente';
CREATE INDEX IF NOT EXISTS idx_liraa_draws_survey ON public.liraa_draws (survey_id);

CREATE TABLE IF NOT EXISTS public.liraa_selected_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL REFERENCES public.liraa_draws(id) ON DELETE CASCADE,
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.liraa_surveys(id) ON DELETE CASCADE,
  stratum_id uuid NOT NULL REFERENCES public.liraa_strata(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE RESTRICT,
  ordinal int NOT NULL,
  position double precision NOT NULL,
  properties_in_block int NOT NULL,
  UNIQUE (draw_id, block_id)
);
CREATE INDEX IF NOT EXISTS idx_liraa_selected_blocks_survey ON public.liraa_selected_blocks (survey_id);

ALTER TABLE public.liraa_samples
  ADD COLUMN IF NOT EXISTS municipality_id uuid REFERENCES public.municipalities(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS draw_id uuid REFERENCES public.liraa_draws(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ordinal int,
  ADD COLUMN IF NOT EXISTS selection_type varchar(20) NOT NULL DEFAULT 'sorteado',
  ADD COLUMN IF NOT EXISTS substitution_reason text,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

UPDATE public.liraa_samples s SET municipality_id = sv.municipality_id
FROM public.liraa_surveys sv WHERE sv.id = s.survey_id AND s.municipality_id IS NULL;
UPDATE public.liraa_samples SET status = 'trabalhado' WHERE status = 'visitado';

ALTER TABLE public.liraa_samples
  ALTER COLUMN municipality_id SET NOT NULL,
  ADD CONSTRAINT liraa_samples_status_chk CHECK (status IN ('selecionado', 'trabalhado', 'fechado', 'recusa', 'inexistente', 'cancelado')),
  ADD CONSTRAINT liraa_samples_selection_chk CHECK (selection_type IN ('sorteado', 'substituto'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_liraa_samples_property ON public.liraa_samples (survey_id, property_id) WHERE status <> 'cancelado';
CREATE INDEX IF NOT EXISTS idx_liraa_samples_survey ON public.liraa_samples (survey_id, status);
CREATE INDEX IF NOT EXISTS idx_liraa_samples_agent ON public.liraa_samples (agent_id);
CREATE INDEX IF NOT EXISTS idx_liraa_samples_municipality ON public.liraa_samples (municipality_id);
CREATE INDEX IF NOT EXISTS idx_liraa_samples_replacement ON public.liraa_samples (replacement_of);

-- ------------------------------------------------------------------------------
-- 4. Inspeções de campo e depósitos por tipo
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.liraa_inspections (
  id uuid PRIMARY KEY,                                   -- gerado no aparelho (idempotência)
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.liraa_surveys(id) ON DELETE CASCADE,
  stratum_id uuid NOT NULL REFERENCES public.liraa_strata(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL UNIQUE REFERENCES public.liraa_samples(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  inspector_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  inspected_at timestamptz NOT NULL,
  situation varchar(20) NOT NULL CHECK (situation IN ('trabalhado', 'fechado', 'recusa', 'inexistente')),
  is_vacant_lot boolean NOT NULL DEFAULT false,
  latitude double precision,
  longitude double precision,
  gps_accuracy double precision,
  notes text CHECK (notes IS NULL OR length(notes) <= 2000),
  client_created_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_liraa_inspections_survey ON public.liraa_inspections (survey_id, situation);
CREATE INDEX IF NOT EXISTS idx_liraa_inspections_municipality ON public.liraa_inspections (municipality_id);
CREATE INDEX IF NOT EXISTS idx_liraa_inspections_agent ON public.liraa_inspections (agent_id);

CREATE TABLE IF NOT EXISTS public.liraa_inspection_deposits (
  inspection_id uuid NOT NULL REFERENCES public.liraa_inspections(id) ON DELETE CASCADE,
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  deposit_category varchar(10) NOT NULL REFERENCES public.deposit_categories(code),
  inspected_count int NOT NULL CHECK (inspected_count >= 0),
  positive_count int NOT NULL DEFAULT 0 CHECK (positive_count >= 0 AND positive_count <= inspected_count),
  PRIMARY KEY (inspection_id, deposit_category)
);

-- Tubitos: entomological_samples (laboratório já existente)
ALTER TABLE public.entomological_samples
  ADD COLUMN IF NOT EXISTS liraa_inspection_id uuid REFERENCES public.liraa_inspections(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS deposit_category varchar(10) REFERENCES public.deposit_categories(code),
  ADD COLUMN IF NOT EXISTS tube_label varchar(40),
  ADD COLUMN IF NOT EXISTS lab_result varchar(30),
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS analyzed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discard_reason text;

ALTER TABLE public.entomological_samples
  ADD CONSTRAINT entomological_samples_lab_result_chk CHECK (lab_result IS NULL OR lab_result IN
    ('aedes_aegypti', 'aedes_albopictus', 'aegypti_e_albopictus', 'outros_culicideos', 'negativo', 'inconclusivo'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_ento_samples_liraa_tube ON public.entomological_samples (liraa_survey_id, tube_label)
  WHERE liraa_inspection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ento_samples_liraa_inspection ON public.entomological_samples (liraa_inspection_id);
CREATE INDEX IF NOT EXISTS idx_ento_samples_liraa_survey ON public.entomological_samples (liraa_survey_id, status);

CREATE TABLE IF NOT EXISTS public.liraa_lab_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL REFERENCES public.entomological_samples(id) ON DELETE CASCADE,
  event varchar(30) NOT NULL,
  from_status varchar(50),
  to_status varchar(50),
  lab_result varchar(30),
  notes text,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_liraa_lab_events_sample ON public.liraa_lab_events (sample_id);

CREATE TABLE IF NOT EXISTS public.liraa_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.liraa_surveys(id) ON DELETE CASCADE,
  from_status varchar(30),
  to_status varchar(30) NOT NULL,
  justification text,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_liraa_status_history_survey ON public.liraa_status_history (survey_id);

-- ------------------------------------------------------------------------------
-- 5. Funções auxiliares
-- ------------------------------------------------------------------------------

-- Número pseudoaleatório reproduzível em [0,1): 52 bits do SHA-256(semente|escopo).
CREATE OR REPLACE FUNCTION public.liraa_seed_unit(p_seed text, p_scope text)
RETURNS double precision
LANGUAGE sql IMMUTABLE STRICT
SET search_path = public, pg_temp
AS $$
  SELECT (('x' || substr(encode(extensions.digest(convert_to(p_seed || '|' || p_scope, 'UTF8'), 'sha256'), 'hex'), 1, 13))::bit(52)::bigint)::double precision
         / 4503599627370496.0;
$$;

-- Parte numérica inicial de um código (ordenação natural de quarteirões e números).
CREATE OR REPLACE FUNCTION public.liraa_numeric_prefix(p_text text)
RETURNS bigint
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_text ~ '^\s*\d{1,15}' THEN substring(p_text FROM '^\s*(\d{1,15})')::bigint END;
$$;

CREATE OR REPLACE FUNCTION public.liraa_require_access(p_survey_id uuid, p_permission text)
RETURNS public.liraa_surveys
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_survey public.liraa_surveys;
BEGIN
  IF public.auth_profile_id() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO v_survey FROM public.liraa_surveys WHERE id = p_survey_id AND deleted_at IS NULL;
  IF v_survey.id IS NULL THEN
    RAISE EXCEPTION 'levantamento_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (public.is_platform_admin() OR v_survey.municipality_id = public.current_user_municipality_id()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_permission IS NOT NULL AND NOT public.has_permission(p_permission) THEN
    RAISE EXCEPTION 'forbidden: permissão % necessária', p_permission USING ERRCODE = '42501';
  END IF;
  RETURN v_survey;
END;
$$;

CREATE OR REPLACE FUNCTION public.liraa_audit(p_municipality uuid, p_action text, p_entity text, p_entity_id text, p_old jsonb, p_new jsonb)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.audit_logs (municipality_id, user_id, action, module, entity, entity_id, old_data, new_data)
  VALUES (p_municipality, public.auth_profile_id(), p_action, 'liraa', p_entity, p_entity_id, p_old, p_new);
$$;

-- ------------------------------------------------------------------------------
-- 6. Trava de levantamentos encerrados/cancelados
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.liraa_guard_survey()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('endemias.liraa_status_rpc', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('encerrado', 'cancelado') THEN
    RAISE EXCEPTION 'levantamento_bloqueado: levantamento % só pode ser alterado por reabertura formal', OLD.status USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'situacao_somente_por_rpc: use liraa_change_status' USING ERRCODE = '42501';
  END IF;
  IF OLD.status <> 'planejamento' AND (NEW.type IS DISTINCT FROM OLD.type OR NEW.rule_set_id IS DISTINCT FROM OLD.rule_set_id
      OR NEW.municipality_id IS DISTINCT FROM OLD.municipality_id) THEN
    RAISE EXCEPTION 'levantamento_bloqueado: modalidade e regras só mudam no planejamento' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_liraa_guard_survey ON public.liraa_surveys;
CREATE TRIGGER trg_liraa_guard_survey BEFORE UPDATE ON public.liraa_surveys
  FOR EACH ROW EXECUTE FUNCTION public.liraa_guard_survey();

-- Tabelas filhas: TG_ARGV[0] = situações em que a escrita é permitida.
CREATE OR REPLACE FUNCTION public.liraa_guard_child()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_survey_id uuid;
  v_status text;
  v_row jsonb := to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END);
BEGIN
  -- Manutenção da plataforma (SQL direto, ex.: exclusão de município): SET endemias.liraa_maintenance = 'on'
  IF current_setting('endemias.liraa_maintenance', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_TABLE_NAME = 'liraa_inspection_deposits' THEN
    SELECT i.survey_id INTO v_survey_id FROM public.liraa_inspections i WHERE i.id = (v_row->>'inspection_id')::uuid;
  ELSIF TG_TABLE_NAME = 'entomological_samples' THEN
    v_survey_id := (v_row->>'liraa_survey_id')::uuid;
    IF (v_row->>'liraa_inspection_id') IS NULL THEN
      RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;   -- amostras de outras origens
    END IF;
  ELSE
    v_survey_id := (v_row->>'survey_id')::uuid;
  END IF;

  SELECT status INTO v_status FROM public.liraa_surveys WHERE id = v_survey_id;
  IF v_status IS NOT NULL AND NOT (v_status = ANY (string_to_array(TG_ARGV[0], ','))) THEN
    RAISE EXCEPTION 'levantamento_bloqueado: % não pode ser alterado com o levantamento em "%"', TG_TABLE_NAME, v_status
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_liraa_guard ON public.liraa_strata;
CREATE TRIGGER trg_liraa_guard BEFORE INSERT OR UPDATE OR DELETE ON public.liraa_strata
  FOR EACH ROW EXECUTE FUNCTION public.liraa_guard_child('planejamento');
DROP TRIGGER IF EXISTS trg_liraa_guard ON public.liraa_draws;
CREATE TRIGGER trg_liraa_guard BEFORE INSERT OR UPDATE ON public.liraa_draws
  FOR EACH ROW EXECUTE FUNCTION public.liraa_guard_child('planejamento');
DROP TRIGGER IF EXISTS trg_liraa_guard ON public.liraa_selected_blocks;
CREATE TRIGGER trg_liraa_guard BEFORE INSERT OR UPDATE ON public.liraa_selected_blocks
  FOR EACH ROW EXECUTE FUNCTION public.liraa_guard_child('planejamento');
DROP TRIGGER IF EXISTS trg_liraa_guard ON public.liraa_samples;
CREATE TRIGGER trg_liraa_guard BEFORE INSERT OR UPDATE ON public.liraa_samples
  FOR EACH ROW EXECUTE FUNCTION public.liraa_guard_child('planejamento,execucao,conferencia');
DROP TRIGGER IF EXISTS trg_liraa_guard ON public.liraa_survey_members;
CREATE TRIGGER trg_liraa_guard BEFORE INSERT OR UPDATE OR DELETE ON public.liraa_survey_members
  FOR EACH ROW EXECUTE FUNCTION public.liraa_guard_child('planejamento,execucao,conferencia');
DROP TRIGGER IF EXISTS trg_liraa_guard ON public.liraa_inspections;
CREATE TRIGGER trg_liraa_guard BEFORE INSERT OR UPDATE OR DELETE ON public.liraa_inspections
  FOR EACH ROW EXECUTE FUNCTION public.liraa_guard_child('execucao,conferencia');
DROP TRIGGER IF EXISTS trg_liraa_guard ON public.liraa_inspection_deposits;
CREATE TRIGGER trg_liraa_guard BEFORE INSERT OR UPDATE OR DELETE ON public.liraa_inspection_deposits
  FOR EACH ROW EXECUTE FUNCTION public.liraa_guard_child('execucao,conferencia');
DROP TRIGGER IF EXISTS trg_liraa_guard ON public.entomological_samples;
CREATE TRIGGER trg_liraa_guard BEFORE INSERT OR UPDATE OR DELETE ON public.entomological_samples
  FOR EACH ROW EXECUTE FUNCTION public.liraa_guard_child('execucao,conferencia');

-- ------------------------------------------------------------------------------
-- 7. Universo amostral e cálculo do sorteio
-- ------------------------------------------------------------------------------
-- Imóveis elegíveis: ativos, do município, fora de pontos estratégicos ativos.
CREATE OR REPLACE FUNCTION public.liraa_eligible_properties(p_municipality uuid, p_neighborhoods uuid[])
RETURNS TABLE (property_id uuid, block_id uuid, block_code text, street text, number text, complement text, property_code text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.block_id, b.code, p.street, p.number, p.complement, p.property_code
  FROM public.properties p
  LEFT JOIN public.blocks b ON b.id = p.block_id
  WHERE p.municipality_id = p_municipality
    AND p.deleted_at IS NULL
    AND (p_neighborhoods IS NULL OR p.neighborhood_id = ANY (p_neighborhoods))
    AND NOT EXISTS (SELECT 1 FROM public.strategic_points sp WHERE sp.property_id = p.id AND sp.active);
$$;

-- Ordem oficial do sistema: quarteirão (numeração natural) e, dentro dele,
-- logradouro, número (natural), complemento e código do imóvel.
-- Retorna o universo já ordenado, com o índice (0-based) global e no quarteirão.
CREATE OR REPLACE FUNCTION public.liraa_ordered_universe(p_municipality uuid, p_neighborhoods uuid[], p_require_block boolean)
RETURNS TABLE (idx int, property_id uuid, block_id uuid, block_idx int, idx_in_block int)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH u AS (
    SELECT e.*,
      public.liraa_numeric_prefix(e.block_code) AS bnum,
      public.liraa_numeric_prefix(e.number) AS pnum
    FROM public.liraa_eligible_properties(p_municipality, p_neighborhoods) e
    WHERE NOT p_require_block OR e.block_id IS NOT NULL
  ), ordered AS (
    SELECT u.*,
      row_number() OVER (ORDER BY u.bnum NULLS LAST, u.block_code COLLATE "C" NULLS LAST, u.block_id,
                                  u.street COLLATE "C", u.pnum NULLS LAST, u.number COLLATE "C",
                                  u.complement COLLATE "C", u.property_code COLLATE "C", u.property_id) - 1 AS gidx
    FROM u
  )
  SELECT o.gidx::int, o.property_id, o.block_id,
         (dense_rank() OVER (ORDER BY o.bnum NULLS LAST, o.block_code COLLATE "C" NULLS LAST, o.block_id) - 1)::int,
         (row_number() OVER (PARTITION BY o.block_id ORDER BY o.gidx) - 1)::int
  FROM ordered o
  ORDER BY o.gidx;
$$;

-- Universo elegível por bairro (planejamento dos estratos, antes do sorteio)
CREATE OR REPLACE FUNCTION public.liraa_universe_by_neighborhood()
RETURNS TABLE (neighborhood_id uuid, neighborhood_name text, eligible_properties int, blocks int, without_block int, strategic_points int)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun uuid := public.current_user_municipality_id();
BEGIN
  IF v_mun IS NULL OR NOT (public.has_permission('liraa.view') OR public.has_permission('liraa.planejar')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT n.id, n.name::text,
    count(p.id) FILTER (WHERE sp.id IS NULL)::int,
    count(DISTINCT p.block_id) FILTER (WHERE sp.id IS NULL)::int,
    count(p.id) FILTER (WHERE sp.id IS NULL AND p.block_id IS NULL)::int,
    count(sp.id)::int
  FROM public.neighborhoods n
  LEFT JOIN public.properties p ON p.neighborhood_id = n.id AND p.deleted_at IS NULL
  LEFT JOIN public.strategic_points sp ON sp.property_id = p.id AND sp.active
  WHERE n.municipality_id = v_mun
  GROUP BY n.id, n.name
  ORDER BY n.name;
END;
$$;

-- Plano de um estrato LIRAa (fórmulas do manual). Erro quando fora das faixas.
CREATE OR REPLACE FUNCTION public.liraa_stratum_plan(p_n int, p_blocks int, p_params jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base numeric := (p_params->>'base_sample')::numeric;
  v_step int;
  v_n int;
  v_b double precision;
  v_q int;
  v_ia double precision;
BEGIN
  IF p_n IS NULL OR p_n <= 0 OR p_blocks IS NULL OR p_blocks <= 0 THEN
    RAISE EXCEPTION 'estrato_sem_universo: cadastre imóveis com quarteirão (RG) no estrato' USING ERRCODE = '22023';
  END IF;
  IF p_n > (p_params->>'stratum_max')::int THEN
    RAISE EXCEPTION 'estrato_acima_do_limite: % imóveis (máximo %); divida o estrato', p_n, p_params->>'stratum_max' USING ERRCODE = '22023';
  ELSIF p_n >= (p_params->>'stratum_min')::int THEN
    v_step := (p_params->>'step_regular')::int;
  ELSIF p_n >= (p_params->>'small_stratum_min')::int THEN
    v_step := (p_params->>'step_small')::int;
  ELSE
    RAISE EXCEPTION 'estrato_abaixo_do_minimo: % imóveis (mínimo %); a metodologia não define este caso — validar com a SES', p_n, p_params->>'small_stratum_min'
      USING ERRCODE = '22023';
  END IF;

  v_n := ceil(v_base / (1 + v_base / p_n));
  v_b := p_n::double precision / p_blocks;
  v_q := LEAST(p_blocks, ceil(v_n / (v_b / v_step))::int);
  v_q := GREATEST(v_q, 1);
  v_ia := p_blocks::double precision / v_q;
  RETURN jsonb_build_object('N', p_n, 'A', p_blocks, 'n', v_n, 'B', v_b, 'step', v_step, 'Q', v_q, 'IA', v_ia);
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. RPC: confirmação técnica de regras pendentes (LIA)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.liraa_confirm_rules(p_survey_id uuid, p_note text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_survey public.liraa_surveys := public.liraa_require_access(p_survey_id, 'liraa.planejar');
BEGIN
  IF v_survey.status <> 'planejamento' THEN
    RAISE EXCEPTION 'levantamento_bloqueado: confirmação só no planejamento' USING ERRCODE = '42501';
  END IF;
  IF p_note IS NULL OR length(trim(p_note)) < 20 THEN
    RAISE EXCEPTION 'justificativa_obrigatoria: descreva a referência técnica validada (mínimo 20 caracteres)' USING ERRCODE = '22023';
  END IF;
  UPDATE public.liraa_surveys
     SET rules_confirmed_by = public.auth_profile_id(), rules_confirmed_at = now(), rules_confirmation_note = trim(p_note)
   WHERE id = p_survey_id;
  PERFORM public.liraa_audit(v_survey.municipality_id, 'CONFIRMAR_REGRAS', 'liraa_surveys', p_survey_id::text, NULL,
    jsonb_build_object('nota', trim(p_note), 'regra', v_survey.rule_set_id));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. RPC: sorteio amostral
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.liraa_execute_draw(p_survey_id uuid, p_seed text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_survey public.liraa_surveys := public.liraa_require_access(p_survey_id, 'liraa.planejar');
  v_rule public.liraa_rule_sets;
  v_seed text := COALESCE(NULLIF(trim(p_seed), ''), replace(gen_random_uuid()::text, '-', ''));
  v_mun_total int;
  v_stratum record;
  v_universe_count int;
  v_blocks int;
  v_plan jsonb;
  v_unit double precision;
  v_ic double precision;
  v_ia double precision;
  v_step int;
  v_draw_id uuid;
  v_hash text;
  v_result jsonb := '[]'::jsonb;
  v_selected_blocks int;
  v_selected_props int;
  v_start int;
  v_band jsonb;
BEGIN
  IF v_survey.status <> 'planejamento' THEN
    RAISE EXCEPTION 'levantamento_bloqueado: o sorteio só pode ser feito no planejamento' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_rule FROM public.liraa_rule_sets
   WHERE id = v_survey.rule_set_id
      OR (v_survey.rule_set_id IS NULL AND active AND kind = CASE v_survey.type WHEN 'LIA' THEN 'amostragem_lia' ELSE 'amostragem_liraa' END)
   ORDER BY (id = v_survey.rule_set_id) DESC NULLS LAST, created_at DESC
   LIMIT 1;
  IF v_rule.id IS NULL THEN
    RAISE EXCEPTION 'regras_nao_encontradas' USING ERRCODE = 'P0002';
  END IF;
  IF v_rule.kind <> (CASE v_survey.type WHEN 'LIA' THEN 'amostragem_lia' ELSE 'amostragem_liraa' END) THEN
    RAISE EXCEPTION 'regras_incompativeis com a modalidade %', v_survey.type USING ERRCODE = '22023';
  END IF;
  IF v_rule.validation_status = 'pendente_validacao' AND v_survey.rules_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'regras_pendentes_validacao: registre a confirmação técnica das regras % antes do sorteio', v_rule.code
      USING ERRCODE = '42501';
  END IF;

  -- Modalidade x porte do município (Portaria GM/MS 3.129/2016)
  SELECT count(*) INTO v_mun_total FROM public.liraa_eligible_properties(v_survey.municipality_id, NULL);
  IF v_survey.type = 'LIRAa' AND v_mun_total <= (v_rule.params->>'municipality_min_exclusive')::int THEN
    RAISE EXCEPTION 'modalidade_incompativel: município com % imóveis elegíveis deve realizar LIA (LIRAa exige mais de %)',
      v_mun_total, v_rule.params->>'municipality_min_exclusive' USING ERRCODE = '22023';
  END IF;
  IF v_survey.type = 'LIA' AND v_mun_total >= (v_rule.params->>'municipality_max_exclusive')::int THEN
    RAISE EXCEPTION 'modalidade_incompativel: município com % imóveis elegíveis deve realizar LIRAa (LIA exige menos de %)',
      v_mun_total, v_rule.params->>'municipality_max_exclusive' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('endemias.liraa_status_rpc', 'off', true);

  -- LIA: estrato único criado automaticamente
  IF v_survey.type = 'LIA' AND NOT EXISTS (SELECT 1 FROM public.liraa_strata WHERE survey_id = p_survey_id) THEN
    INSERT INTO public.liraa_strata (survey_id, municipality_id, name, code, stratum_number, neighborhood_ids)
    VALUES (p_survey_id, v_survey.municipality_id, 'Estrato único (LIA)', 'LIA-1', 1, '{}');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.liraa_strata WHERE survey_id = p_survey_id) THEN
    RAISE EXCEPTION 'estratos_nao_configurados' USING ERRCODE = '22023';
  END IF;

  -- Sorteios anteriores (antes da execução) ficam no histórico como substituídos
  UPDATE public.liraa_samples SET status = 'cancelado', updated_at = now()
   WHERE survey_id = p_survey_id AND status <> 'cancelado';
  UPDATE public.liraa_draws SET status = 'substituido', superseded_at = now()
   WHERE survey_id = p_survey_id AND status = 'vigente';

  FOR v_stratum IN
    SELECT * FROM public.liraa_strata WHERE survey_id = p_survey_id ORDER BY stratum_number NULLS LAST, code
  LOOP
    CREATE TEMP TABLE IF NOT EXISTS _liraa_u (idx int, property_id uuid, block_id uuid, block_idx int, idx_in_block int) ON COMMIT DROP;
    TRUNCATE _liraa_u;

    IF v_survey.type = 'LIRAa' THEN
      IF cardinality(v_stratum.neighborhood_ids) = 0 THEN
        RAISE EXCEPTION 'estrato_sem_bairros: %', v_stratum.name USING ERRCODE = '22023';
      END IF;
      INSERT INTO _liraa_u SELECT * FROM public.liraa_ordered_universe(v_survey.municipality_id, v_stratum.neighborhood_ids, true);
    ELSE
      INSERT INTO _liraa_u SELECT * FROM public.liraa_ordered_universe(v_survey.municipality_id, NULL, false);
    END IF;

    SELECT count(*), count(DISTINCT block_id) INTO v_universe_count, v_blocks FROM _liraa_u;
    SELECT encode(extensions.digest(convert_to(COALESCE(string_agg(property_id::text, ',' ORDER BY idx), ''), 'UTF8'), 'sha256'), 'hex')
      INTO v_hash FROM _liraa_u;
    v_unit := public.liraa_seed_unit(v_seed, v_stratum.id::text);

    INSERT INTO public.liraa_draws (municipality_id, survey_id, stratum_id, rule_set_id, rule_code, rule_version, algorithm, seed,
                                    parameters, universe_count, universe_hash, executed_by)
    VALUES (v_survey.municipality_id, p_survey_id, v_stratum.id, v_rule.id, v_rule.code, v_rule.version,
            CASE v_survey.type WHEN 'LIA' THEN 'LIA_SISTEMATICO_IMOVEL_V1' ELSE 'LIRAA_CONGLOMERADO_QUARTEIRAO_V1' END,
            v_seed, '{}'::jsonb, v_universe_count, v_hash, public.auth_profile_id())
    RETURNING id INTO v_draw_id;

    IF v_survey.type = 'LIRAa' THEN
      v_plan := public.liraa_stratum_plan(v_universe_count, v_blocks, v_rule.params);
      v_ia := (v_plan->>'IA')::double precision;
      v_step := (v_plan->>'step')::int;
      v_ic := v_unit * v_ia;

      -- Quarteirões: posições IC + k·IA (k = 0..Q-1), arredondadas pela metade para cima (mínimo 1)
      INSERT INTO public.liraa_selected_blocks (draw_id, municipality_id, survey_id, stratum_id, block_id, ordinal, position, properties_in_block)
      SELECT v_draw_id, v_survey.municipality_id, p_survey_id, v_stratum.id, b.block_id, s.ordinal, s.pos, b.cnt
      FROM (
        SELECT DISTINCT ON (ordinal) ordinal, pos
        FROM (
          SELECT LEAST(v_blocks, GREATEST(1, floor(v_ic + k * v_ia + 0.5)::int)) AS ordinal, v_ic + k * v_ia AS pos
          FROM generate_series(0, (v_plan->>'Q')::int - 1) k
          WHERE v_ic + k * v_ia <= v_blocks
        ) x ORDER BY ordinal, pos
      ) s
      JOIN (SELECT block_idx, block_id, count(*) cnt FROM _liraa_u GROUP BY block_idx, block_id) b ON b.block_idx = s.ordinal - 1;

      -- Imóveis: 1º do quarteirão e, a partir dele, um a cada `passo`
      INSERT INTO public.liraa_samples (survey_id, stratum_id, municipality_id, property_id, block_id, draw_id, ordinal, selection_type, status)
      SELECT p_survey_id, v_stratum.id, v_survey.municipality_id, u.property_id, u.block_id, v_draw_id, u.idx, 'sorteado', 'selecionado'
      FROM _liraa_u u
      JOIN public.liraa_selected_blocks sb ON sb.draw_id = v_draw_id AND sb.block_id = u.block_id
      WHERE u.idx_in_block % v_step = 0;

      SELECT count(*) INTO v_selected_blocks FROM public.liraa_selected_blocks WHERE draw_id = v_draw_id;
    ELSE
      IF v_universe_count = 0 THEN
        RAISE EXCEPTION 'estrato_sem_universo: cadastre os imóveis do município' USING ERRCODE = '22023';
      END IF;
      SELECT b INTO v_band FROM jsonb_array_elements(v_rule.params->'bands') b
       WHERE v_universe_count <= (b->>'max')::int ORDER BY (b->>'max')::int LIMIT 1;
      IF v_band IS NULL THEN
        RAISE EXCEPTION 'faixa_lia_nao_definida para % imóveis', v_universe_count USING ERRCODE = '22023';
      END IF;
      v_step := (v_band->>'step')::int;
      v_start := LEAST(v_step - 1, floor(v_unit * v_step)::int);
      v_plan := jsonb_build_object('N', v_universe_count, 'step', v_step, 'start', v_start, 'band', v_band);

      INSERT INTO public.liraa_samples (survey_id, stratum_id, municipality_id, property_id, block_id, draw_id, ordinal, selection_type, status)
      SELECT p_survey_id, v_stratum.id, v_survey.municipality_id, u.property_id, u.block_id, v_draw_id, u.idx, 'sorteado', 'selecionado'
      FROM _liraa_u u
      WHERE u.idx >= v_start AND (u.idx - v_start) % v_step = 0;
      v_selected_blocks := 0;
    END IF;

    SELECT count(*) INTO v_selected_props FROM public.liraa_samples WHERE draw_id = v_draw_id;
    v_plan := v_plan || jsonb_build_object('unit', v_unit, 'IC', v_ic, 'excluded_without_block',
      CASE WHEN v_survey.type = 'LIRAa' THEN
        (SELECT count(*) FROM public.liraa_eligible_properties(v_survey.municipality_id, v_stratum.neighborhood_ids) e WHERE e.block_id IS NULL)
      ELSE 0 END);

    UPDATE public.liraa_draws SET parameters = v_plan, selected_blocks = v_selected_blocks, selected_properties = v_selected_props
     WHERE id = v_draw_id;
    UPDATE public.liraa_strata SET total_properties = v_universe_count, total_blocks = v_blocks, sample_size = v_selected_props,
           inspection_step = v_step, updated_at = now()
     WHERE id = v_stratum.id;

    v_result := v_result || jsonb_build_object('stratum_id', v_stratum.id, 'draw_id', v_draw_id, 'parameters', v_plan,
      'selected_blocks', v_selected_blocks, 'selected_properties', v_selected_props);
  END LOOP;

  UPDATE public.liraa_surveys
     SET rule_set_id = v_rule.id,
         total_properties = (SELECT COALESCE(sum(total_properties), 0) FROM public.liraa_strata WHERE survey_id = p_survey_id),
         total_blocks = (SELECT COALESCE(sum(total_blocks), 0) FROM public.liraa_strata WHERE survey_id = p_survey_id),
         sample_properties = (SELECT count(*) FROM public.liraa_samples WHERE survey_id = p_survey_id AND status <> 'cancelado')
   WHERE id = p_survey_id;

  PERFORM public.liraa_audit(v_survey.municipality_id, 'SORTEIO', 'liraa_surveys', p_survey_id::text, NULL,
    jsonb_build_object('semente', v_seed, 'regra', v_rule.code || ' v' || v_rule.version, 'estratos', v_result));
  RETURN jsonb_build_object('seed', v_seed, 'rule', v_rule.code, 'rule_version', v_rule.version, 'strata', v_result);
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. RPC: distribuição de imóveis aos agentes
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.liraa_assign_samples(p_survey_id uuid, p_sample_ids uuid[], p_agent_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_survey public.liraa_surveys := public.liraa_require_access(p_survey_id, NULL);
  v_count int;
BEGIN
  IF NOT (public.has_permission('liraa.planejar') OR public.has_permission('liraa.supervisionar')) THEN
    RAISE EXCEPTION 'forbidden: permissão liraa.planejar ou liraa.supervisionar necessária' USING ERRCODE = '42501';
  END IF;
  IF p_agent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.agents a WHERE a.id = p_agent_id AND a.municipality_id = v_survey.municipality_id AND a.active) THEN
    RAISE EXCEPTION 'agente_invalido' USING ERRCODE = '22023';
  END IF;
  UPDATE public.liraa_samples
     SET agent_id = p_agent_id, assigned_at = now(), updated_at = now()
   WHERE survey_id = p_survey_id AND id = ANY (p_sample_ids) AND status = 'selecionado';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.liraa_audit(v_survey.municipality_id, 'DISTRIBUIR', 'liraa_samples', p_survey_id::text, NULL,
    jsonb_build_object('agente', p_agent_id, 'quantidade', v_count));
  RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. RPC: situação do levantamento (com histórico e auditoria)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.liraa_change_status(p_survey_id uuid, p_to text, p_justification text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_survey public.liraa_surveys := public.liraa_require_access(p_survey_id, NULL);
  v_from text := v_survey.status;
  v_perm text;
  v_pending int;
BEGIN
  v_perm := CASE
    WHEN v_from = 'planejamento' AND p_to = 'execucao' THEN 'liraa.planejar'
    WHEN v_from = 'execucao' AND p_to = 'conferencia' THEN 'liraa.supervisionar'
    WHEN v_from = 'conferencia' AND p_to = 'execucao' THEN 'liraa.supervisionar'
    WHEN v_from = 'conferencia' AND p_to = 'encerrado' THEN 'liraa.encerrar'
    WHEN v_from = 'encerrado' AND p_to = 'conferencia' THEN 'liraa.reabrir'
    WHEN v_from IN ('planejamento', 'execucao', 'conferencia') AND p_to = 'cancelado' THEN 'liraa.encerrar'
    ELSE NULL END;
  IF v_perm IS NULL THEN
    RAISE EXCEPTION 'transicao_invalida: % → %', v_from, p_to USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_permission(v_perm) THEN
    RAISE EXCEPTION 'forbidden: permissão % necessária', v_perm USING ERRCODE = '42501';
  END IF;
  IF (p_to IN ('cancelado') OR (v_from = 'encerrado') OR (v_from = 'conferencia' AND p_to = 'execucao'))
     AND (p_justification IS NULL OR length(trim(p_justification)) < 15) THEN
    RAISE EXCEPTION 'justificativa_obrigatoria (mínimo 15 caracteres)' USING ERRCODE = '22023';
  END IF;

  IF p_to = 'execucao' AND v_from = 'planejamento' THEN
    IF EXISTS (SELECT 1 FROM public.liraa_strata st WHERE st.survey_id = p_survey_id
               AND NOT EXISTS (SELECT 1 FROM public.liraa_draws d WHERE d.stratum_id = st.id AND d.status = 'vigente'))
       OR NOT EXISTS (SELECT 1 FROM public.liraa_samples WHERE survey_id = p_survey_id AND status = 'selecionado') THEN
      RAISE EXCEPTION 'sorteio_pendente: todos os estratos precisam de sorteio vigente' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_to = 'encerrado' THEN
    SELECT count(*) INTO v_pending FROM public.entomological_samples
     WHERE liraa_survey_id = p_survey_id AND liraa_inspection_id IS NOT NULL AND status IN ('coletada', 'recebida');
    IF v_pending > 0 THEN
      RAISE EXCEPTION 'laboratorio_pendente: % tubito(s) sem resultado', v_pending USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM set_config('endemias.liraa_status_rpc', 'on', true);
  UPDATE public.liraa_surveys
     SET status = p_to, status_changed_at = now(), updated_at = now(),
         cancel_reason = CASE WHEN p_to = 'cancelado' THEN trim(p_justification) ELSE cancel_reason END
   WHERE id = p_survey_id;
  PERFORM set_config('endemias.liraa_status_rpc', 'off', true);

  INSERT INTO public.liraa_status_history (municipality_id, survey_id, from_status, to_status, justification, actor_id)
  VALUES (v_survey.municipality_id, p_survey_id, v_from, p_to, NULLIF(trim(COALESCE(p_justification, '')), ''), public.auth_profile_id());
  PERFORM public.liraa_audit(v_survey.municipality_id,
    CASE WHEN v_from = 'encerrado' THEN 'REABRIR' ELSE 'ALTERAR_SITUACAO' END,
    'liraa_surveys', p_survey_id::text, jsonb_build_object('status', v_from),
    jsonb_build_object('status', p_to, 'justificativa', p_justification));
  RETURN jsonb_build_object('from', v_from, 'to', p_to);
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. RPC: inspeção de campo (idempotente; offline)
-- ------------------------------------------------------------------------------
-- payload: { id, sample_id, situation, inspected_at, is_vacant_lot, latitude, longitude,
--   gps_accuracy, notes, client_created_at, closed_reason,
--   deposits: [{category, inspected, positive}],
--   tubes: [{label, category, stage}],
--   substitute_property_id (fechado/recusa) }
CREATE OR REPLACE FUNCTION public.liraa_submit_inspection(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := (p->>'id')::uuid;
  v_sample public.liraa_samples;
  v_survey public.liraa_surveys;
  v_situation text := p->>'situation';
  v_profile uuid := public.auth_profile_id();
  v_agent uuid;
  v_dep jsonb;
  v_tube jsonb;
  v_pos_by_cat jsonb := '{}'::jsonb;
  v_tubes_by_cat jsonb := '{}'::jsonb;
  v_cat text;
  v_sub_property uuid := NULLIF(p->>'substitute_property_id', '')::uuid;
  v_root uuid;
  v_sub_id uuid;
  v_inspected_at timestamptz := COALESCE((p->>'inspected_at')::timestamptz, now());
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'id_obrigatorio' USING ERRCODE = '22023';
  END IF;

  -- Reenvio do mesmo registro: resposta idempotente
  IF EXISTS (SELECT 1 FROM public.liraa_inspections WHERE id = v_id) THEN
    RETURN jsonb_build_object('id', v_id, 'duplicated', true);
  END IF;

  SELECT * INTO v_sample FROM public.liraa_samples WHERE id = (p->>'sample_id')::uuid FOR UPDATE;
  IF v_sample.id IS NULL THEN
    RAISE EXCEPTION 'amostra_nao_encontrada' USING ERRCODE = 'P0002';
  END IF;
  v_survey := public.liraa_require_access(v_sample.survey_id, NULL);
  IF NOT (public.has_permission('liraa.coletar') OR public.has_permission('liraa.supervisionar')) THEN
    RAISE EXCEPTION 'forbidden: permissão liraa.coletar necessária' USING ERRCODE = '42501';
  END IF;
  IF v_survey.status NOT IN ('execucao', 'conferencia') THEN
    RAISE EXCEPTION 'levantamento_bloqueado: levantamento em "%"', v_survey.status USING ERRCODE = '42501';
  END IF;
  IF v_survey.status = 'conferencia' AND NOT public.has_permission('liraa.supervisionar') THEN
    RAISE EXCEPTION 'forbidden: em conferência só a supervisão registra inspeções' USING ERRCODE = '42501';
  END IF;
  IF v_sample.status <> 'selecionado' THEN
    RAISE EXCEPTION 'amostra_ja_resolvida: imóvel já registrado como "%"', v_sample.status USING ERRCODE = '23505';
  END IF;

  SELECT a.id INTO v_agent FROM public.agents a
   WHERE a.profile_id = v_profile AND a.municipality_id = v_survey.municipality_id AND a.active LIMIT 1;
  IF v_sample.agent_id IS NOT NULL AND v_sample.agent_id IS DISTINCT FROM v_agent AND NOT public.has_permission('liraa.supervisionar') THEN
    RAISE EXCEPTION 'forbidden: imóvel distribuído para outro agente' USING ERRCODE = '42501';
  END IF;
  IF v_situation NOT IN ('trabalhado', 'fechado', 'recusa', 'inexistente') THEN
    RAISE EXCEPTION 'situacao_invalida' USING ERRCODE = '22023';
  END IF;
  IF v_inspected_at > now() + interval '10 minutes' OR v_inspected_at::date < v_survey.start_date - 1 THEN
    RAISE EXCEPTION 'data_invalida: fora do período do levantamento' USING ERRCODE = '22023';
  END IF;

  -- Coerência depósitos x tubitos (manual: um tubito por depósito positivo)
  IF v_situation = 'trabalhado' THEN
    FOR v_dep IN SELECT * FROM jsonb_array_elements(COALESCE(p->'deposits', '[]'::jsonb)) LOOP
      IF COALESCE((v_dep->>'positive')::int, 0) > 0 THEN
        v_pos_by_cat := jsonb_set(v_pos_by_cat, ARRAY[v_dep->>'category'],
          to_jsonb(COALESCE((v_pos_by_cat->>(v_dep->>'category'))::int, 0) + (v_dep->>'positive')::int));
      END IF;
    END LOOP;
    FOR v_tube IN SELECT * FROM jsonb_array_elements(COALESCE(p->'tubes', '[]'::jsonb)) LOOP
      v_tubes_by_cat := jsonb_set(v_tubes_by_cat, ARRAY[v_tube->>'category'],
        to_jsonb(COALESCE((v_tubes_by_cat->>(v_tube->>'category'))::int, 0) + 1));
    END LOOP;
    IF v_pos_by_cat <> v_tubes_by_cat THEN
      RAISE EXCEPTION 'tubitos_incoerentes: colete um tubito por depósito positivo (positivos %, tubitos %)', v_pos_by_cat, v_tubes_by_cat
        USING ERRCODE = '22023';
    END IF;
  ELSIF jsonb_array_length(COALESCE(p->'deposits', '[]'::jsonb)) > 0 OR jsonb_array_length(COALESCE(p->'tubes', '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'imovel_nao_trabalhado_sem_depositos' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.liraa_inspections (id, municipality_id, survey_id, stratum_id, sample_id, property_id, agent_id, inspector_profile_id,
    inspected_at, situation, is_vacant_lot, latitude, longitude, gps_accuracy, notes, client_created_at)
  VALUES (v_id, v_survey.municipality_id, v_survey.id, v_sample.stratum_id, v_sample.id, v_sample.property_id, COALESCE(v_agent, v_sample.agent_id), v_profile,
    v_inspected_at, v_situation, COALESCE((p->>'is_vacant_lot')::boolean, false),
    NULLIF(p->>'latitude', '')::double precision, NULLIF(p->>'longitude', '')::double precision, NULLIF(p->>'gps_accuracy', '')::double precision,
    NULLIF(left(trim(COALESCE(p->>'notes', '') || CASE WHEN p->>'closed_reason' IS NOT NULL THEN ' [motivo: ' || (p->>'closed_reason') || ']' ELSE '' END), 2000), ''),
    NULLIF(p->>'client_created_at', '')::timestamptz);

  IF v_situation = 'trabalhado' THEN
    INSERT INTO public.liraa_inspection_deposits (inspection_id, municipality_id, deposit_category, inspected_count, positive_count)
    SELECT v_id, v_survey.municipality_id, d->>'category', COALESCE((d->>'inspected')::int, 0), COALESCE((d->>'positive')::int, 0)
    FROM jsonb_array_elements(COALESCE(p->'deposits', '[]'::jsonb)) d
    WHERE COALESCE((d->>'inspected')::int, 0) > 0;

    INSERT INTO public.entomological_samples (municipality_id, sample_code, tube_label, collection_type, origin_type, origin_id,
      property_id, liraa_survey_id, liraa_inspection_id, deposit_category, agent_id, collection_date, status)
    SELECT v_survey.municipality_id, t->>'label', t->>'label', COALESCE(NULLIF(t->>'stage', ''), 'larva'), 'liraa', v_sample.id,
      v_sample.property_id, v_survey.id, v_id, t->>'category', COALESCE(v_agent, v_sample.agent_id), v_inspected_at::date, 'coletada'
    FROM jsonb_array_elements(COALESCE(p->'tubes', '[]'::jsonb)) t;
  END IF;

  UPDATE public.liraa_samples SET status = v_situation, visited_at = v_inspected_at, updated_at = now() WHERE id = v_sample.id;

  -- Substituição autorizada pelo manual: fechado/recusa → imóvel imediatamente anterior ou posterior
  IF v_sub_property IS NOT NULL THEN
    IF v_situation NOT IN ('fechado', 'recusa') THEN
      RAISE EXCEPTION 'substituicao_nao_autorizada: só para imóvel fechado ou recusa' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.liraa_eligible_properties(v_survey.municipality_id, NULL) e
      WHERE e.property_id = v_sub_property AND e.block_id IS NOT DISTINCT FROM v_sample.block_id) THEN
      RAISE EXCEPTION 'substituto_invalido: deve ser imóvel elegível do mesmo quarteirão' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.liraa_samples WHERE survey_id = v_survey.id AND property_id = v_sub_property AND status <> 'cancelado') THEN
      RAISE EXCEPTION 'substituto_ja_na_amostra' USING ERRCODE = '23505';
    END IF;
    v_root := COALESCE(v_sample.replacement_of, v_sample.id);
    INSERT INTO public.liraa_samples (survey_id, stratum_id, municipality_id, property_id, block_id, agent_id, draw_id, ordinal,
      selection_type, replacement_of, substitution_reason, status, assigned_at)
    VALUES (v_survey.id, v_sample.stratum_id, v_survey.municipality_id, v_sub_property, v_sample.block_id, v_sample.agent_id, v_sample.draw_id,
      v_sample.ordinal, 'substituto', v_root, v_situation, 'selecionado', now())
    RETURNING id INTO v_sub_id;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'duplicated', false, 'substitute_sample_id', v_sub_id);
END;
$$;

-- ------------------------------------------------------------------------------
-- 13. RPCs do laboratório
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.liraa_lab_receive(p_survey_id uuid, p_labels text[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_survey public.liraa_surveys := public.liraa_require_access(p_survey_id, 'liraa.laboratorio');
  v_received text[];
BEGIN
  WITH upd AS (
    UPDATE public.entomological_samples
       SET status = 'recebida', received_at = now(), received_by = public.auth_profile_id(), updated_at = now()
     WHERE liraa_survey_id = p_survey_id AND liraa_inspection_id IS NOT NULL AND status = 'coletada'
       AND upper(tube_label) = ANY (SELECT upper(trim(x)) FROM unnest(p_labels) x)
    RETURNING id, tube_label
  ), ev AS (
    INSERT INTO public.liraa_lab_events (municipality_id, sample_id, event, from_status, to_status, actor_id)
    SELECT v_survey.municipality_id, id, 'recebimento', 'coletada', 'recebida', public.auth_profile_id() FROM upd
  )
  SELECT array_agg(tube_label) INTO v_received FROM upd;
  RETURN jsonb_build_object('received', COALESCE(v_received, '{}'),
    'not_found', COALESCE((SELECT array_agg(x) FROM unnest(p_labels) x
                           WHERE upper(trim(x)) <> ALL (SELECT upper(r) FROM unnest(COALESCE(v_received, '{}')) r)), '{}'));
END;
$$;

CREATE OR REPLACE FUNCTION public.liraa_lab_result(p_sample_id uuid, p_result text, p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sample public.entomological_samples;
  v_survey public.liraa_surveys;
  v_to text;
BEGIN
  SELECT * INTO v_sample FROM public.entomological_samples WHERE id = p_sample_id FOR UPDATE;
  IF v_sample.id IS NULL OR v_sample.liraa_inspection_id IS NULL THEN
    RAISE EXCEPTION 'tubito_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;
  v_survey := public.liraa_require_access(v_sample.liraa_survey_id, 'liraa.laboratorio');

  IF p_result = 'descartada' THEN
    IF p_notes IS NULL OR length(trim(p_notes)) < 10 THEN
      RAISE EXCEPTION 'justificativa_obrigatoria para descarte (mínimo 10 caracteres)' USING ERRCODE = '22023';
    END IF;
    v_to := 'descartada';
  ELSIF p_result = 'inconclusivo' THEN
    v_to := 'inconclusiva';
  ELSIF p_result IN ('aedes_aegypti', 'aedes_albopictus', 'aegypti_e_albopictus', 'outros_culicideos', 'negativo') THEN
    v_to := 'analisada';
  ELSE
    RAISE EXCEPTION 'resultado_invalido' USING ERRCODE = '22023';
  END IF;
  IF v_sample.status IN ('analisada', 'inconclusiva', 'descartada') AND (p_notes IS NULL OR length(trim(p_notes)) < 10) THEN
    RAISE EXCEPTION 'justificativa_obrigatoria para retificar resultado (mínimo 10 caracteres)' USING ERRCODE = '22023';
  END IF;

  UPDATE public.entomological_samples
     SET status = v_to,
         lab_result = CASE WHEN v_to = 'descartada' THEN NULL ELSE p_result END,
         discard_reason = CASE WHEN v_to = 'descartada' THEN trim(p_notes) ELSE NULL END,
         received_at = COALESCE(received_at, now()), received_by = COALESCE(received_by, public.auth_profile_id()),
         analyzed_at = now(), analyzed_by = public.auth_profile_id(), updated_at = now()
   WHERE id = p_sample_id;

  INSERT INTO public.liraa_lab_events (municipality_id, sample_id, event, from_status, to_status, lab_result, notes, actor_id)
  VALUES (v_sample.municipality_id, p_sample_id,
          CASE WHEN v_sample.status IN ('analisada', 'inconclusiva', 'descartada') THEN 'retificacao' ELSE 'resultado' END,
          v_sample.status, v_to, CASE WHEN v_to = 'descartada' THEN NULL ELSE p_result END, NULLIF(trim(COALESCE(p_notes, '')), ''),
          public.auth_profile_id());
  RETURN jsonb_build_object('status', v_to, 'lab_result', p_result);
END;
$$;

-- ------------------------------------------------------------------------------
-- 14. Consolidação (contagens; índices calculados no aplicativo e nos testes)
-- ------------------------------------------------------------------------------
-- Positividade: tubito com resultado laboratorial Ae. aegypti (ou aegypti + albopictus).
-- Suspeita de campo (depósito com larva/pupa) é exibida à parte e não entra no IIP/IB.
CREATE OR REPLACE FUNCTION public.liraa_survey_counts(p_survey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_survey public.liraa_surveys := public.liraa_require_access(p_survey_id, NULL);
  v_out jsonb;
BEGIN
  IF NOT (public.has_permission('liraa.view') OR public.has_permission('liraa.coletar') OR public.has_permission('liraa.laboratorio')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH samples AS (
    SELECT s.*, p.neighborhood_id FROM public.liraa_samples s JOIN public.properties p ON p.id = s.property_id
    WHERE s.survey_id = p_survey_id AND s.status <> 'cancelado'
  ),
  resolved AS (   -- ponto amostral sorteado resolvido com imóvel trabalhado (ele ou substituto)
    SELECT DISTINCT COALESCE(replacement_of, id) AS root FROM samples WHERE status = 'trabalhado'
  ),
  insp AS (
    SELECT i.*, p.neighborhood_id FROM public.liraa_inspections i JOIN public.properties p ON p.id = i.property_id
    WHERE i.survey_id = p_survey_id
  ),
  tubes AS (
    SELECT t.*, i.stratum_id, i.neighborhood_id, i.agent_id AS insp_agent
    FROM public.entomological_samples t JOIN insp i ON i.id = t.liraa_inspection_id
  ),
  per_unit AS (
    SELECT 'stratum' AS level, st.id::text AS unit_id, st.name AS unit_name, st.stratum_number AS sort_key
    FROM public.liraa_strata st WHERE st.survey_id = p_survey_id
    UNION ALL
    SELECT 'neighborhood', n.id::text, n.name, NULL FROM public.neighborhoods n
    WHERE n.id IN (SELECT neighborhood_id FROM samples)
    UNION ALL
    SELECT 'municipality', p_survey_id::text, 'Município', NULL
  ),
  metrics AS (
    SELECT u.level, u.unit_id, u.unit_name, u.sort_key,
      (SELECT count(*) FROM samples s WHERE s.selection_type = 'sorteado' AND
         (u.level = 'municipality' OR (u.level = 'stratum' AND s.stratum_id::text = u.unit_id) OR (u.level = 'neighborhood' AND s.neighborhood_id::text = u.unit_id))) AS programmed,
      (SELECT count(*) FROM samples s WHERE s.selection_type = 'sorteado' AND s.status <> 'inexistente'
         AND NOT EXISTS (SELECT 1 FROM resolved r WHERE r.root = s.id) AND
         (u.level = 'municipality' OR (u.level = 'stratum' AND s.stratum_id::text = u.unit_id) OR (u.level = 'neighborhood' AND s.neighborhood_id::text = u.unit_id))) AS pending,
      (SELECT count(*) FROM samples s WHERE s.selection_type = 'substituto' AND
         (u.level = 'municipality' OR (u.level = 'stratum' AND s.stratum_id::text = u.unit_id) OR (u.level = 'neighborhood' AND s.neighborhood_id::text = u.unit_id))) AS substitutes,
      (SELECT jsonb_object_agg(situation, c) FROM (
         SELECT i.situation, count(*) c FROM insp i WHERE
           (u.level = 'municipality' OR (u.level = 'stratum' AND i.stratum_id::text = u.unit_id) OR (u.level = 'neighborhood' AND i.neighborhood_id::text = u.unit_id))
         GROUP BY i.situation) x) AS situations,
      (SELECT count(*) FROM insp i WHERE i.situation = 'trabalhado' AND i.is_vacant_lot AND
         (u.level = 'municipality' OR (u.level = 'stratum' AND i.stratum_id::text = u.unit_id) OR (u.level = 'neighborhood' AND i.neighborhood_id::text = u.unit_id))) AS vacant_lots,
      (SELECT count(*) FROM insp i WHERE i.situation = 'trabalhado'
         AND EXISTS (SELECT 1 FROM public.liraa_inspection_deposits d WHERE d.inspection_id = i.id AND d.positive_count > 0) AND
         (u.level = 'municipality' OR (u.level = 'stratum' AND i.stratum_id::text = u.unit_id) OR (u.level = 'neighborhood' AND i.neighborhood_id::text = u.unit_id))) AS field_positive_properties,
      (SELECT count(DISTINCT t.liraa_inspection_id) FROM tubes t WHERE t.lab_result IN ('aedes_aegypti', 'aegypti_e_albopictus') AND
         (u.level = 'municipality' OR (u.level = 'stratum' AND t.stratum_id::text = u.unit_id) OR (u.level = 'neighborhood' AND t.neighborhood_id::text = u.unit_id))) AS positive_properties_aegypti,
      (SELECT count(DISTINCT t.liraa_inspection_id) FROM tubes t WHERE t.lab_result IN ('aedes_albopictus', 'aegypti_e_albopictus') AND
         (u.level = 'municipality' OR (u.level = 'stratum' AND t.stratum_id::text = u.unit_id) OR (u.level = 'neighborhood' AND t.neighborhood_id::text = u.unit_id))) AS positive_properties_albopictus,
      (SELECT jsonb_object_agg(deposit_category, c) FROM (
         SELECT t.deposit_category, count(*) c FROM tubes t WHERE t.lab_result IN ('aedes_aegypti', 'aegypti_e_albopictus') AND
           (u.level = 'municipality' OR (u.level = 'stratum' AND t.stratum_id::text = u.unit_id) OR (u.level = 'neighborhood' AND t.neighborhood_id::text = u.unit_id))
         GROUP BY t.deposit_category) x) AS positive_recipients_aegypti,
      (SELECT count(*) FROM tubes t WHERE t.lab_result IN ('aedes_albopictus', 'aegypti_e_albopictus') AND
         (u.level = 'municipality' OR (u.level = 'stratum' AND t.stratum_id::text = u.unit_id) OR (u.level = 'neighborhood' AND t.neighborhood_id::text = u.unit_id))) AS positive_recipients_albopictus,
      (SELECT jsonb_object_agg(deposit_category, c) FROM (
         SELECT d.deposit_category, sum(d.inspected_count) c FROM public.liraa_inspection_deposits d JOIN insp i ON i.id = d.inspection_id WHERE
           (u.level = 'municipality' OR (u.level = 'stratum' AND i.stratum_id::text = u.unit_id) OR (u.level = 'neighborhood' AND i.neighborhood_id::text = u.unit_id))
         GROUP BY d.deposit_category) x) AS inspected_recipients,
      (SELECT jsonb_object_agg(status, c) FROM (
         SELECT t.status, count(*) c FROM tubes t WHERE
           (u.level = 'municipality' OR (u.level = 'stratum' AND t.stratum_id::text = u.unit_id) OR (u.level = 'neighborhood' AND t.neighborhood_id::text = u.unit_id))
         GROUP BY t.status) x) AS tubes_by_status
    FROM per_unit u
  )
  SELECT jsonb_build_object(
    'survey_id', p_survey_id,
    'status', v_survey.status,
    'units', COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.level, m.sort_key NULLS LAST, m.unit_name), '[]'::jsonb),
    'agents', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'agent_id', a.agent_id, 'name', pr.full_name, 'inspections', a.total, 'worked', a.worked,
                 'closed', a.closed, 'refused', a.refused, 'days', a.days, 'first_at', a.first_at, 'last_at', a.last_at)
               ORDER BY pr.full_name), '[]'::jsonb)
               FROM (SELECT i.agent_id, count(*) total, count(*) FILTER (WHERE situation = 'trabalhado') worked,
                            count(*) FILTER (WHERE situation = 'fechado') closed, count(*) FILTER (WHERE situation = 'recusa') refused,
                            count(DISTINCT (inspected_at AT TIME ZONE 'America/Sao_Paulo')::date) days, min(inspected_at) first_at, max(inspected_at) last_at
                     FROM insp i GROUP BY i.agent_id) a
               LEFT JOIN public.agents ag ON ag.id = a.agent_id
               LEFT JOIN public.profiles pr ON pr.id = ag.profile_id)
  ) INTO v_out
  FROM metrics m;
  RETURN v_out;
END;
$$;

-- ------------------------------------------------------------------------------
-- 15. RLS
-- ------------------------------------------------------------------------------
ALTER TABLE public.liraa_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liraa_survey_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liraa_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liraa_selected_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liraa_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liraa_inspection_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liraa_lab_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liraa_status_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.liraa_can_read(p_municipality uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_platform_admin()
      OR (p_municipality = public.current_user_municipality_id()
          AND (public.has_permission('liraa.view') OR public.has_permission('liraa.coletar') OR public.has_permission('liraa.laboratorio')));
$$;

CREATE POLICY liraa_rule_sets_read ON public.liraa_rule_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY liraa_rule_sets_admin ON public.liraa_rule_sets FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- Tabelas existentes: troca a política genérica por leitura com permissão do módulo
-- e escrita de planejamento com liraa.planejar (demais escritas só por RPC).
DROP POLICY IF EXISTS rls_tenant ON public.liraa_surveys;
CREATE POLICY liraa_surveys_read ON public.liraa_surveys FOR SELECT TO authenticated USING (public.liraa_can_read(municipality_id));
CREATE POLICY liraa_surveys_insert ON public.liraa_surveys FOR INSERT TO authenticated
  WITH CHECK ((public.is_platform_admin() OR municipality_id = public.current_user_municipality_id())
              AND public.has_permission('liraa.planejar') AND status = 'planejamento');
CREATE POLICY liraa_surveys_update ON public.liraa_surveys FOR UPDATE TO authenticated
  USING ((public.is_platform_admin() OR municipality_id = public.current_user_municipality_id()) AND public.has_permission('liraa.planejar'))
  WITH CHECK ((public.is_platform_admin() OR municipality_id = public.current_user_municipality_id()) AND public.has_permission('liraa.planejar'));

DROP POLICY IF EXISTS rls_tenant ON public.liraa_strata;
CREATE POLICY liraa_strata_read ON public.liraa_strata FOR SELECT TO authenticated USING (public.liraa_can_read(municipality_id));
CREATE POLICY liraa_strata_write ON public.liraa_strata FOR ALL TO authenticated
  USING ((public.is_platform_admin() OR municipality_id = public.current_user_municipality_id()) AND public.has_permission('liraa.planejar'))
  WITH CHECK ((public.is_platform_admin() OR municipality_id = public.current_user_municipality_id()) AND public.has_permission('liraa.planejar')
              AND EXISTS (SELECT 1 FROM public.liraa_surveys s WHERE s.id = survey_id AND s.municipality_id = liraa_strata.municipality_id));

DROP POLICY IF EXISTS rls_tenant ON public.liraa_samples;
CREATE POLICY liraa_samples_read ON public.liraa_samples FOR SELECT TO authenticated USING (public.liraa_can_read(municipality_id));

CREATE POLICY liraa_members_read ON public.liraa_survey_members FOR SELECT TO authenticated USING (public.liraa_can_read(municipality_id));
CREATE POLICY liraa_members_write ON public.liraa_survey_members FOR ALL TO authenticated
  USING ((public.is_platform_admin() OR municipality_id = public.current_user_municipality_id()) AND public.has_permission('liraa.planejar'))
  WITH CHECK ((public.is_platform_admin() OR municipality_id = public.current_user_municipality_id()) AND public.has_permission('liraa.planejar')
              AND EXISTS (SELECT 1 FROM public.liraa_surveys s WHERE s.id = survey_id AND s.municipality_id = liraa_survey_members.municipality_id)
              AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = profile_id AND pr.municipality_id = liraa_survey_members.municipality_id));

CREATE POLICY liraa_draws_read ON public.liraa_draws FOR SELECT TO authenticated USING (public.liraa_can_read(municipality_id));
CREATE POLICY liraa_blocks_read ON public.liraa_selected_blocks FOR SELECT TO authenticated USING (public.liraa_can_read(municipality_id));
CREATE POLICY liraa_inspections_read ON public.liraa_inspections FOR SELECT TO authenticated USING (public.liraa_can_read(municipality_id));
CREATE POLICY liraa_deposits_read ON public.liraa_inspection_deposits FOR SELECT TO authenticated USING (public.liraa_can_read(municipality_id));
CREATE POLICY liraa_lab_events_read ON public.liraa_lab_events FOR SELECT TO authenticated USING (public.liraa_can_read(municipality_id));
CREATE POLICY liraa_status_history_read ON public.liraa_status_history FOR SELECT TO authenticated USING (public.liraa_can_read(municipality_id));

-- Tubitos do LIRAa: escrita direta bloqueada (só pelas RPCs); demais amostras seguem a política existente.
CREATE POLICY ento_samples_liraa_no_direct_write ON public.entomological_samples AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (liraa_inspection_id IS NULL) WITH CHECK (liraa_inspection_id IS NULL);
CREATE POLICY ento_samples_liraa_no_direct_insert ON public.entomological_samples AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (liraa_inspection_id IS NULL);
CREATE POLICY ento_samples_liraa_no_direct_delete ON public.entomological_samples AS RESTRICTIVE FOR DELETE TO authenticated
  USING (liraa_inspection_id IS NULL);

-- Privilégios
REVOKE ALL ON public.liraa_rule_sets, public.liraa_survey_members, public.liraa_draws, public.liraa_selected_blocks,
  public.liraa_inspections, public.liraa_inspection_deposits, public.liraa_lab_events, public.liraa_status_history FROM anon;
GRANT SELECT ON public.liraa_rule_sets, public.liraa_draws, public.liraa_selected_blocks, public.liraa_inspections,
  public.liraa_inspection_deposits, public.liraa_lab_events, public.liraa_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liraa_survey_members TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.liraa_samples, public.liraa_draws, public.liraa_selected_blocks,
  public.liraa_inspections, public.liraa_inspection_deposits FROM authenticated;
REVOKE DELETE ON public.liraa_surveys FROM authenticated;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'liraa_confirm_rules(uuid,text)', 'liraa_execute_draw(uuid,text)', 'liraa_assign_samples(uuid,uuid[],uuid)',
    'liraa_change_status(uuid,text,text)', 'liraa_submit_inspection(jsonb)', 'liraa_lab_receive(uuid,text[])',
    'liraa_lab_result(uuid,text,text)', 'liraa_survey_counts(uuid)', 'liraa_universe_by_neighborhood()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'liraa_require_access(uuid,text)', 'liraa_audit(uuid,text,text,text,jsonb,jsonb)', 'liraa_eligible_properties(uuid,uuid[])',
    'liraa_ordered_universe(uuid,uuid[],boolean)', 'liraa_guard_survey()', 'liraa_guard_child()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['liraa_seed_unit(text,text)', 'liraa_numeric_prefix(text)', 'liraa_stratum_plan(int,int,jsonb)', 'liraa_can_read(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

COMMIT;
