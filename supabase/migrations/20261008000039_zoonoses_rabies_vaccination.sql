-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 39: ZOONOSES — VACINAÇÃO ANTIRRÁBICA ANIMAL E
-- VIGILÂNCIA DA RAIVA
-- ==============================================================================
-- Reaproveita território (bairros, imóveis), equipes, perfis e o estoque existente
-- (products / product_batches / stock_movements). Regras de negócio:
-- docs/MODULOS-LIRAA-ZOONOSES.md
--
-- Também corrige a trigger de estoque existente (handle_stock_deduction_on_movement):
-- ela atualizava products.current_stock, coluna inexistente, e por isso TODA
-- movimentação de estoque falhava (42703). Agora trava o lote (FOR UPDATE) antes
-- de conferir o saldo, e product_batches.current_quantity não pode ficar negativo.
--
-- Rollback: DROP das tabelas zoo_*/animal_*/vaccination_*/rabies_* e funções zoo_*;
-- a trigger de estoque pode voltar à versão da migration 30 (que falhava).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. Estoque: correção da trigger e saldo não negativo
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_stock_deduction_on_movement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF NEW.batch_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.movement_type IN ('saida', 'uso_operacao', 'distribuicao_ace', 'distribuicao_equipe', 'perda', 'vencimento') THEN
    SELECT current_quantity INTO v_balance FROM public.product_batches WHERE id = NEW.batch_id FOR UPDATE;
    IF v_balance < NEW.quantity THEN
      RAISE EXCEPTION 'saldo_insuficiente: saldo do lote (%) menor que a quantidade (%)', v_balance, NEW.quantity USING ERRCODE = '23514';
    END IF;
    UPDATE public.product_batches SET current_quantity = current_quantity - NEW.quantity, updated_at = now() WHERE id = NEW.batch_id;
  ELSIF NEW.movement_type IN ('entrada', 'devolucao', 'estorno_aplicacao') THEN
    UPDATE public.product_batches SET current_quantity = current_quantity + NEW.quantity, updated_at = now() WHERE id = NEW.batch_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_stock_deduction_on_movement() FROM public, anon, authenticated;

ALTER TABLE public.product_batches ADD CONSTRAINT product_batches_non_negative CHECK (current_quantity >= 0) NOT VALID;
DO $$ BEGIN
  ALTER TABLE public.product_batches VALIDATE CONSTRAINT product_batches_non_negative;
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'Há lotes com saldo negativo anterior a esta migração; a restrição vale para novas movimentações.';
END $$;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_quantity_positive CHECK (quantity > 0) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON public.stock_movements (batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_team ON public.stock_movements (team_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_product ON public.product_batches (product_id);

-- ------------------------------------------------------------------------------
-- 1. Contadores para códigos legíveis (animal, ocorrência de raiva)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zoo_counters (
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  kind varchar(20) NOT NULL,
  year int NOT NULL,
  value int NOT NULL DEFAULT 0,
  PRIMARY KEY (municipality_id, kind, year)
);

CREATE OR REPLACE FUNCTION public.zoo_next_code(p_municipality uuid, p_kind text, p_prefix text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year int := extract(year FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
  v_value int;
BEGIN
  INSERT INTO public.zoo_counters (municipality_id, kind, year, value) VALUES (p_municipality, p_kind, v_year, 1)
  ON CONFLICT (municipality_id, kind, year) DO UPDATE SET value = public.zoo_counters.value + 1
  RETURNING value INTO v_value;
  RETURN p_prefix || '-' || v_year || '-' || lpad(v_value::text, 5, '0');
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Tutores e animais
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.animal_tutors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  full_name varchar(150) NOT NULL CHECK (length(trim(full_name)) >= 2),
  phone varchar(30),
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  address text CHECK (address IS NULL OR length(address) <= 300),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_animal_tutors_municipality ON public.animal_tutors (municipality_id);
CREATE INDEX IF NOT EXISTS idx_animal_tutors_property ON public.animal_tutors (property_id);

CREATE TABLE IF NOT EXISTS public.animals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  code varchar(30) NOT NULL,
  name varchar(80),
  species varchar(10) NOT NULL CHECK (species IN ('canina', 'felina')),
  sex varchar(15) NOT NULL DEFAULT 'nao_informado' CHECK (sex IN ('macho', 'femea', 'nao_informado')),
  age_group varchar(30) NOT NULL DEFAULT 'nao_informada' CHECK (age_group IN ('menor_1_ano', '1_ano_ou_mais', 'nao_informada')),
  approx_age_months int CHECK (approx_age_months IS NULL OR approx_age_months BETWEEN 0 AND 360),
  characteristics text CHECK (characteristics IS NULL OR length(characteristics) <= 500),
  tutor_id uuid REFERENCES public.animal_tutors(id) ON DELETE SET NULL,
  without_known_tutor boolean NOT NULL DEFAULT false,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'obito', 'desaparecido', 'mudou_municipio')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (municipality_id, code),
  CHECK (NOT (without_known_tutor AND tutor_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_animals_municipality ON public.animals (municipality_id, species);
CREATE INDEX IF NOT EXISTS idx_animals_tutor ON public.animals (tutor_id);
CREATE INDEX IF NOT EXISTS idx_animals_property ON public.animals (property_id);
CREATE INDEX IF NOT EXISTS idx_animals_neighborhood ON public.animals (neighborhood_id);

CREATE OR REPLACE FUNCTION public.zoo_animals_before_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.code := public.zoo_next_code(NEW.municipality_id, 'animal', 'AN');
    NEW.created_by := COALESCE(NEW.created_by, public.auth_profile_id());
  ELSE
    NEW.code := OLD.code;
    NEW.municipality_id := OLD.municipality_id;
  END IF;
  IF NEW.tutor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.animal_tutors t WHERE t.id = NEW.tutor_id AND t.municipality_id = NEW.municipality_id) THEN
    RAISE EXCEPTION 'tutor_invalido' USING ERRCODE = '22023';
  END IF;
  IF NEW.property_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.properties p WHERE p.id = NEW.property_id AND p.municipality_id = NEW.municipality_id) THEN
    RAISE EXCEPTION 'imovel_invalido' USING ERRCODE = '22023';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_animals_before_write ON public.animals;
CREATE TRIGGER trg_animals_before_write BEFORE INSERT OR UPDATE ON public.animals
  FOR EACH ROW EXECUTE FUNCTION public.zoo_animals_before_write();

CREATE OR REPLACE FUNCTION public.zoo_tutors_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.municipality_id := OLD.municipality_id;
  ELSE
    NEW.created_by := COALESCE(NEW.created_by, public.auth_profile_id());
  END IF;
  IF NEW.property_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.properties p WHERE p.id = NEW.property_id AND p.municipality_id = NEW.municipality_id) THEN
    RAISE EXCEPTION 'imovel_invalido' USING ERRCODE = '22023';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_tutors_before_write ON public.animal_tutors;
CREATE TRIGGER trg_tutors_before_write BEFORE INSERT OR UPDATE ON public.animal_tutors
  FOR EACH ROW EXECUTE FUNCTION public.zoo_tutors_before_write();

-- ------------------------------------------------------------------------------
-- 3. Campanhas, localidades e postos
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vaccination_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  name varchar(150) NOT NULL,
  year int NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'planejamento' CHECK (status IN ('planejamento', 'em_andamento', 'encerrada', 'cancelada')),
  target_dog_coverage_pct numeric(5,2) CHECK (target_dog_coverage_pct IS NULL OR target_dog_coverage_pct BETWEEN 0 AND 100),
  target_cat_coverage_pct numeric(5,2) CHECK (target_cat_coverage_pct IS NULL OR target_cat_coverage_pct BETWEEN 0 AND 100),
  coverage_target_source text,
  est_dog_population int CHECK (est_dog_population IS NULL OR est_dog_population > 0),
  est_cat_population int CHECK (est_cat_population IS NULL OR est_cat_population > 0),
  population_source text,
  population_reference_date date,
  population_method text,
  planned_doses int CHECK (planned_doses IS NULL OR planned_doses >= 0),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (end_date >= start_date),
  CHECK ((est_dog_population IS NULL AND est_cat_population IS NULL) OR population_source IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_vacc_campaigns_municipality ON public.vaccination_campaigns (municipality_id, year);

CREATE TABLE IF NOT EXISTS public.vaccination_campaign_localities (
  campaign_id uuid NOT NULL REFERENCES public.vaccination_campaigns(id) ON DELETE CASCADE,
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  neighborhood_id uuid NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  est_dog_population int CHECK (est_dog_population IS NULL OR est_dog_population > 0),
  est_cat_population int CHECK (est_cat_population IS NULL OR est_cat_population > 0),
  PRIMARY KEY (campaign_id, neighborhood_id)
);

CREATE TABLE IF NOT EXISTS public.vaccination_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.vaccination_campaigns(id) ON DELETE CASCADE,
  name varchar(150) NOT NULL,
  modality varchar(20) NOT NULL DEFAULT 'posto_fixo' CHECK (modality IN ('posto_fixo', 'posto_volante', 'casa_a_casa')),
  neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  address text,
  latitude double precision,
  longitude double precision,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  scheduled_date date,
  start_time time,
  end_time time,
  planned_doses int CHECK (planned_doses IS NULL OR planned_doses >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vacc_posts_campaign ON public.vaccination_posts (campaign_id);

-- Integridade entre municípios das tabelas de planejamento
CREATE OR REPLACE FUNCTION public.zoo_same_municipality_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME IN ('vaccination_posts', 'vaccination_campaign_localities') THEN
    IF NOT EXISTS (SELECT 1 FROM public.vaccination_campaigns c WHERE c.id = NEW.campaign_id AND c.municipality_id = NEW.municipality_id) THEN
      RAISE EXCEPTION 'campanha_invalida' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NEW.neighborhood_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.neighborhoods n WHERE n.id = NEW.neighborhood_id AND n.municipality_id = NEW.municipality_id) THEN
    RAISE EXCEPTION 'localidade_invalida' USING ERRCODE = '22023';
  END IF;
  IF TG_TABLE_NAME = 'vaccination_posts' AND NEW.team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = NEW.team_id AND t.municipality_id = NEW.municipality_id) THEN
    RAISE EXCEPTION 'equipe_invalida' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_zoo_guard ON public.vaccination_posts;
CREATE TRIGGER trg_zoo_guard BEFORE INSERT OR UPDATE ON public.vaccination_posts FOR EACH ROW EXECUTE FUNCTION public.zoo_same_municipality_guard();
DROP TRIGGER IF EXISTS trg_zoo_guard ON public.vaccination_campaign_localities;
CREATE TRIGGER trg_zoo_guard BEFORE INSERT OR UPDATE ON public.vaccination_campaign_localities FOR EACH ROW EXECUTE FUNCTION public.zoo_same_municipality_guard();

-- Campanha encerrada/cancelada não muda (preservação histórica)
CREATE OR REPLACE FUNCTION public.zoo_campaign_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IN ('encerrada', 'cancelada') AND current_setting('endemias.zoo_reopen', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'campanha_bloqueada: campanha % não pode ser alterada', OLD.status USING ERRCODE = '42501';
  END IF;
  NEW.municipality_id := OLD.municipality_id;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_zoo_campaign_guard ON public.vaccination_campaigns;
CREATE TRIGGER trg_zoo_campaign_guard BEFORE UPDATE ON public.vaccination_campaigns FOR EACH ROW EXECUTE FUNCTION public.zoo_campaign_guard();

-- ------------------------------------------------------------------------------
-- 4. Registros de vacinação (individual / campanha rápida) e lançamentos agregados
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.animal_vaccinations (
  id uuid PRIMARY KEY,                                         -- gerado no aparelho (idempotência)
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.vaccination_campaigns(id) ON DELETE RESTRICT,
  post_id uuid REFERENCES public.vaccination_posts(id) ON DELETE SET NULL,
  record_mode varchar(20) NOT NULL CHECK (record_mode IN ('individual', 'campanha_rapida')),
  context varchar(20) NOT NULL CHECK (context IN ('campanha', 'rotina')),
  animal_id uuid REFERENCES public.animals(id) ON DELETE RESTRICT,
  tutor_id uuid REFERENCES public.animal_tutors(id) ON DELETE SET NULL,
  species varchar(10) NOT NULL CHECK (species IN ('canina', 'felina')),
  sex varchar(15) NOT NULL DEFAULT 'nao_informado' CHECK (sex IN ('macho', 'femea', 'nao_informado')),
  age_group varchar(30) NOT NULL DEFAULT 'nao_informada' CHECK (age_group IN ('menor_1_ano', '1_ano_ou_mais', 'nao_informada')),
  neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  vaccinated_at timestamptz NOT NULL,
  vaccinated_on date NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  vaccinator_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  verification_code varchar(20) NOT NULL UNIQUE,
  status varchar(10) NOT NULL DEFAULT 'valida' CHECK (status IN ('valida', 'anulada')),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_created_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CHECK (record_mode = 'campanha_rapida' OR animal_id IS NOT NULL),
  CHECK ((context = 'campanha') = (campaign_id IS NOT NULL))
);
-- Um animal conta uma única vez por campanha; na rotina, uma vez por dia
CREATE UNIQUE INDEX IF NOT EXISTS uq_vacc_animal_campaign ON public.animal_vaccinations (campaign_id, animal_id)
  WHERE status = 'valida' AND animal_id IS NOT NULL AND campaign_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_vacc_animal_routine_day ON public.animal_vaccinations (animal_id, vaccinated_on)
  WHERE status = 'valida' AND animal_id IS NOT NULL AND campaign_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_vacc_municipality_date ON public.animal_vaccinations (municipality_id, vaccinated_on);
CREATE INDEX IF NOT EXISTS idx_vacc_campaign ON public.animal_vaccinations (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_vacc_animal ON public.animal_vaccinations (animal_id);
CREATE INDEX IF NOT EXISTS idx_vacc_post_day ON public.animal_vaccinations (post_id, vaccinated_on);

CREATE TABLE IF NOT EXISTS public.vaccination_aggregate_entries (
  id uuid PRIMARY KEY,
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.vaccination_campaigns(id) ON DELETE RESTRICT,
  post_id uuid NOT NULL REFERENCES public.vaccination_posts(id) ON DELETE RESTRICT,
  entry_date date NOT NULL,
  species varchar(10) NOT NULL CHECK (species IN ('canina', 'felina')),
  sex varchar(15) NOT NULL DEFAULT 'nao_informado' CHECK (sex IN ('macho', 'femea', 'nao_informado')),
  age_group varchar(30) NOT NULL DEFAULT 'nao_informada' CHECK (age_group IN ('menor_1_ano', '1_ano_ou_mais', 'nao_informada')),
  quantity int NOT NULL CHECK (quantity > 0 AND quantity <= 5000),
  source_document varchar(80) NOT NULL CHECK (length(trim(source_document)) >= 1),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  notes text,
  status varchar(10) NOT NULL DEFAULT 'valida' CHECK (status IN ('valida', 'anulada')),
  void_reason text,
  entered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vacc_aggregate_line ON public.vaccination_aggregate_entries
  (campaign_id, post_id, entry_date, species, sex, age_group, source_document) WHERE status = 'valida';
CREATE INDEX IF NOT EXISTS idx_vacc_aggregate_post_day ON public.vaccination_aggregate_entries (post_id, entry_date);

-- ------------------------------------------------------------------------------
-- 5. Busca ativa
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zoo_search_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.vaccination_campaigns(id) ON DELETE CASCADE,
  animal_id uuid NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  assigned_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status varchar(25) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'vacinado', 'nao_vacinado', 'ausente', 'recusa', 'animal_nao_encontrado')),
  attempts int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, animal_id)
);
CREATE INDEX IF NOT EXISTS idx_zoo_tasks_assigned ON public.zoo_search_tasks (assigned_profile_id, status);

CREATE TABLE IF NOT EXISTS public.zoo_search_attempts (
  id uuid PRIMARY KEY,
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.zoo_search_tasks(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL,
  result varchar(25) NOT NULL CHECK (result IN ('vacinado', 'nao_vacinado', 'ausente', 'recusa', 'animal_nao_encontrado')),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  agent_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zoo_attempts_task ON public.zoo_search_attempts (task_id);

-- ------------------------------------------------------------------------------
-- 6. Vigilância da raiva animal
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rabies_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  event_code varchar(30) NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  event_type varchar(30) NOT NULL CHECK (event_type IN ('agressao_animal', 'animal_suspeito', 'morte_suspeita', 'morcego', 'outro')),
  species varchar(20) NOT NULL CHECK (species IN ('canina', 'felina', 'quiroptero', 'herbivoro', 'silvestre', 'outra')),
  animal_id uuid REFERENCES public.animals(id) ON DELETE SET NULL,
  animal_description text,
  neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  location_description text,
  clinical_signs text,
  epidemiological_info text,
  human_exposure boolean NOT NULL DEFAULT false,
  exposed_people_count int CHECK (exposed_people_count IS NULL OR exposed_people_count >= 0),
  referrals text,
  investigation_status varchar(30) NOT NULL DEFAULT 'notificado' CHECK (investigation_status IN
    ('notificado', 'em_investigacao', 'aguardando_laboratorio', 'encerrado_descartado', 'encerrado_confirmado', 'encerrado_inconclusivo')),
  sample_collected boolean NOT NULL DEFAULT false,
  sample_collected_at date,
  sample_type text,
  lab_institution text,
  lab_result varchar(20) CHECK (lab_result IS NULL OR lab_result IN ('pendente', 'positivo', 'negativo', 'inconclusivo', 'improprio')),
  lab_result_at date,
  focus_control_actions text,
  official_notification_number varchar(40),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  UNIQUE (municipality_id, event_code)
);
CREATE INDEX IF NOT EXISTS idx_rabies_events_municipality ON public.rabies_events (municipality_id, investigation_status);

CREATE TABLE IF NOT EXISTS public.rabies_event_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.rabies_events(id) ON DELETE CASCADE,
  update_type varchar(30) NOT NULL DEFAULT 'acompanhamento',
  from_status varchar(30),
  to_status varchar(30),
  note text NOT NULL CHECK (length(trim(note)) >= 3 AND length(note) <= 4000),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rabies_updates_event ON public.rabies_event_updates (event_id);

CREATE OR REPLACE FUNCTION public.rabies_events_before_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.event_code := public.zoo_next_code(NEW.municipality_id, 'raiva', 'RAI');
    NEW.created_by := COALESCE(NEW.created_by, public.auth_profile_id());
    IF NEW.investigation_status LIKE 'encerrado%' OR NEW.lab_result IN ('positivo', 'negativo', 'inconclusivo', 'improprio') THEN
      IF auth.uid() IS NOT NULL AND NOT public.has_permission('raiva.decidir') THEN
        RAISE EXCEPTION 'forbidden: classificação e encerramento exigem raiva.decidir' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSE
    NEW.event_code := OLD.event_code;
    NEW.municipality_id := OLD.municipality_id;
    IF OLD.investigation_status LIKE 'encerrado%' AND auth.uid() IS NOT NULL AND NOT public.has_permission('raiva.decidir') THEN
      RAISE EXCEPTION 'forbidden: evento encerrado só pode ser alterado com raiva.decidir' USING ERRCODE = '42501';
    END IF;
    IF (NEW.investigation_status IS DISTINCT FROM OLD.investigation_status AND NEW.investigation_status LIKE 'encerrado%')
       OR NEW.lab_result IS DISTINCT FROM OLD.lab_result
       OR NEW.focus_control_actions IS DISTINCT FROM OLD.focus_control_actions THEN
      IF auth.uid() IS NOT NULL AND NOT public.has_permission('raiva.decidir') THEN
        RAISE EXCEPTION 'forbidden: classificação, resultado laboratorial e bloqueio de foco exigem raiva.decidir' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  IF NEW.investigation_status LIKE 'encerrado%' THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
    NEW.closed_by := COALESCE(NEW.closed_by, public.auth_profile_id());
  ELSE
    NEW.closed_at := NULL;
    NEW.closed_by := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_rabies_before_write ON public.rabies_events;
CREATE TRIGGER trg_rabies_before_write BEFORE INSERT OR UPDATE ON public.rabies_events
  FOR EACH ROW EXECUTE FUNCTION public.rabies_events_before_write();

CREATE OR REPLACE FUNCTION public.rabies_events_history()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.rabies_event_updates (municipality_id, event_id, update_type, to_status, note, actor_id)
    VALUES (NEW.municipality_id, NEW.id, 'registro', NEW.investigation_status, 'Ocorrência registrada', public.auth_profile_id());
  ELSIF NEW.investigation_status IS DISTINCT FROM OLD.investigation_status OR NEW.lab_result IS DISTINCT FROM OLD.lab_result THEN
    INSERT INTO public.rabies_event_updates (municipality_id, event_id, update_type, from_status, to_status, note, actor_id)
    VALUES (NEW.municipality_id, NEW.id, 'situacao', OLD.investigation_status, NEW.investigation_status,
            'Situação: ' || OLD.investigation_status || ' → ' || NEW.investigation_status
            || CASE WHEN NEW.lab_result IS DISTINCT FROM OLD.lab_result THEN '; resultado laboratorial: ' || COALESCE(NEW.lab_result, '—') ELSE '' END,
            public.auth_profile_id());
  END IF;
  INSERT INTO public.audit_logs (municipality_id, user_id, action, module, entity, entity_id, old_data, new_data)
  VALUES (NEW.municipality_id, public.auth_profile_id(), CASE WHEN TG_OP = 'INSERT' THEN 'CRIAR' ELSE 'ATUALIZAR' END, 'raiva',
          'rabies_events', NEW.id::text,
          CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('status', OLD.investigation_status, 'lab_result', OLD.lab_result) END,
          jsonb_build_object('status', NEW.investigation_status, 'lab_result', NEW.lab_result));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_rabies_history ON public.rabies_events;
CREATE TRIGGER trg_rabies_history AFTER INSERT OR UPDATE ON public.rabies_events
  FOR EACH ROW EXECUTE FUNCTION public.rabies_events_history();

-- ------------------------------------------------------------------------------
-- 7. Funções auxiliares
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zoo_require(p_permission text)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun uuid := public.current_user_municipality_id();
BEGIN
  IF public.auth_profile_id() IS NULL OR v_mun IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_permission IS NOT NULL AND NOT public.has_permission(p_permission) THEN
    RAISE EXCEPTION 'forbidden: permissão % necessária', p_permission USING ERRCODE = '42501';
  END IF;
  RETURN v_mun;
END;
$$;

CREATE OR REPLACE FUNCTION public.zoo_audit(p_municipality uuid, p_action text, p_entity text, p_entity_id text, p_old jsonb, p_new jsonb)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.audit_logs (municipality_id, user_id, action, module, entity, entity_id, old_data, new_data)
  VALUES (p_municipality, public.auth_profile_id(), p_action, 'antirrabica', p_entity, p_entity_id, p_old, p_new);
$$;

-- Saldo de uma equipe num lote: distribuído + estornos − devolvido − aplicado − perdido
CREATE OR REPLACE FUNCTION public.zoo_team_batch_balance(p_team uuid, p_batch uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sum(CASE
    WHEN movement_type IN ('distribuicao_equipe', 'estorno_equipe') THEN quantity
    WHEN movement_type IN ('devolucao', 'aplicacao_equipe', 'perda_equipe') THEN -quantity
    ELSE 0 END), 0)
  FROM public.stock_movements WHERE team_id = p_team AND batch_id = p_batch;
$$;

-- Lote de vacina antirrábica válido do município
CREATE OR REPLACE FUNCTION public.zoo_vaccine_batch(p_municipality uuid, p_batch uuid, p_on date)
RETURNS public.product_batches
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.product_batches;
BEGIN
  SELECT b.* INTO v_batch FROM public.product_batches b JOIN public.products p ON p.id = b.product_id
   WHERE b.id = p_batch AND p.municipality_id = p_municipality AND p.category = 'vacina_antirrabica' AND p.deleted_at IS NULL;
  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'lote_invalido: lote não é de vacina antirrábica do município' USING ERRCODE = '22023';
  END IF;
  IF p_on IS NOT NULL AND v_batch.expiration_date < p_on THEN
    RAISE EXCEPTION 'lote_vencido: validade % anterior à data de aplicação %', v_batch.expiration_date, p_on USING ERRCODE = '22023';
  END IF;
  RETURN v_batch;
END;
$$;

-- Baixa de estoque de doses aplicadas (equipe ou almoxarifado central), com trava
CREATE OR REPLACE FUNCTION public.zoo_consume_doses(p_municipality uuid, p_batch public.product_batches, p_team uuid, p_quantity int,
                                                   p_reference uuid, p_note text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF p_team IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('zoo_team_batch:' || p_team || ':' || p_batch.id));
    v_balance := public.zoo_team_batch_balance(p_team, p_batch.id);
    IF v_balance < p_quantity THEN
      RAISE EXCEPTION 'saldo_insuficiente_equipe: a equipe tem % dose(s) deste lote; registre a distribuição antes', v_balance USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.stock_movements (municipality_id, product_id, batch_id, movement_type, quantity, team_id, operation_id, notes, created_by)
    VALUES (p_municipality, p_batch.product_id, p_batch.id, 'aplicacao_equipe', p_quantity, p_team, p_reference, p_note, public.auth_profile_id());
  ELSE
    PERFORM 1 FROM public.product_batches WHERE id = p_batch.id FOR UPDATE;
    INSERT INTO public.stock_movements (municipality_id, product_id, batch_id, movement_type, quantity, operation_id, notes, created_by)
    VALUES (p_municipality, p_batch.product_id, p_batch.id, 'uso_operacao', p_quantity, p_reference, p_note, public.auth_profile_id());
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. RPC: registro de vacinação (idempotente; offline)
-- ------------------------------------------------------------------------------
-- payload: { id, record_mode, campaign_id | null (rotina), post_id, team_id,
--   animal_id | new_animal {id, name, species, sex, age_group, approx_age_months, characteristics,
--     without_known_tutor, tutor_id | new_tutor {id, full_name, phone, address}, property_id, neighborhood_id},
--   species, sex, age_group, neighborhood_id, property_id, vaccinated_at, batch_id, notes, client_created_at }
CREATE OR REPLACE FUNCTION public.zoo_register_vaccination(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun uuid := public.zoo_require('antirrabica.vacinar');
  v_id uuid := (p->>'id')::uuid;
  v_existing public.animal_vaccinations;
  v_mode text := p->>'record_mode';
  v_campaign public.vaccination_campaigns;
  v_post public.vaccination_posts;
  v_animal public.animals;
  v_new_animal jsonb := p->'new_animal';
  v_new_tutor jsonb;
  v_tutor_id uuid;
  v_at timestamptz := COALESCE(NULLIF(p->>'vaccinated_at', '')::timestamptz, now());
  v_on date := (v_at AT TIME ZONE 'America/Sao_Paulo')::date;
  v_batch public.product_batches;
  v_team uuid := NULLIF(p->>'team_id', '')::uuid;
  v_species text := p->>'species';
  v_sex text := COALESCE(NULLIF(p->>'sex', ''), 'nao_informado');
  v_age text := COALESCE(NULLIF(p->>'age_group', ''), 'nao_informada');
  v_code text;
  v_neighborhood uuid := NULLIF(p->>'neighborhood_id', '')::uuid;
  v_property uuid := NULLIF(p->>'property_id', '')::uuid;
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'id_obrigatorio' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_existing FROM public.animal_vaccinations WHERE id = v_id;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.municipality_id <> v_mun THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('id', v_id, 'duplicated', true, 'verification_code', v_existing.verification_code);
  END IF;
  IF v_mode NOT IN ('individual', 'campanha_rapida') THEN
    RAISE EXCEPTION 'modo_invalido' USING ERRCODE = '22023';
  END IF;
  IF v_at > now() + interval '10 minutes' THEN
    RAISE EXCEPTION 'data_invalida: data da vacinação no futuro' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(p->>'campaign_id', '') IS NOT NULL THEN
    SELECT * INTO v_campaign FROM public.vaccination_campaigns
     WHERE id = (p->>'campaign_id')::uuid AND municipality_id = v_mun AND deleted_at IS NULL;
    IF v_campaign.id IS NULL THEN
      RAISE EXCEPTION 'campanha_invalida' USING ERRCODE = '22023';
    END IF;
    IF v_campaign.status <> 'em_andamento' THEN
      RAISE EXCEPTION 'campanha_fora_de_execucao: campanha em "%"', v_campaign.status USING ERRCODE = '22023';
    END IF;
    IF v_on NOT BETWEEN v_campaign.start_date AND v_campaign.end_date THEN
      RAISE EXCEPTION 'data_fora_da_campanha: % fora de % a %', v_on, v_campaign.start_date, v_campaign.end_date USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NULLIF(p->>'post_id', '') IS NOT NULL THEN
    SELECT * INTO v_post FROM public.vaccination_posts WHERE id = (p->>'post_id')::uuid AND campaign_id = v_campaign.id;
    IF v_post.id IS NULL THEN
      RAISE EXCEPTION 'posto_invalido' USING ERRCODE = '22023';
    END IF;
    v_team := COALESCE(v_team, v_post.team_id);
    v_neighborhood := COALESCE(v_neighborhood, v_post.neighborhood_id);
    -- Sem dupla contagem: o posto/dia já foi lançado por boletim agregado
    IF EXISTS (SELECT 1 FROM public.vaccination_aggregate_entries a
               WHERE a.post_id = v_post.id AND a.entry_date = v_on AND a.status = 'valida') THEN
      RAISE EXCEPTION 'boletim_agregado_existente: o posto já tem lançamento agregado nesta data' USING ERRCODE = '23505';
    END IF;
  END IF;
  IF v_team IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = v_team AND t.municipality_id = v_mun) THEN
    RAISE EXCEPTION 'equipe_invalida' USING ERRCODE = '22023';
  END IF;

  -- Animal novo enviado junto (cadastro no próprio atendimento, também offline)
  IF v_new_animal IS NOT NULL AND jsonb_typeof(v_new_animal) = 'object' THEN
    IF NOT public.has_permission('antirrabica.cadastro') THEN
      RAISE EXCEPTION 'forbidden: permissão antirrabica.cadastro necessária' USING ERRCODE = '42501';
    END IF;
    v_new_tutor := v_new_animal->'new_tutor';
    v_tutor_id := NULLIF(v_new_animal->>'tutor_id', '')::uuid;
    IF v_new_tutor IS NOT NULL AND jsonb_typeof(v_new_tutor) = 'object' THEN
      INSERT INTO public.animal_tutors (id, municipality_id, full_name, phone, address, property_id, neighborhood_id)
      VALUES ((v_new_tutor->>'id')::uuid, v_mun, trim(v_new_tutor->>'full_name'), NULLIF(trim(v_new_tutor->>'phone'), ''),
              NULLIF(trim(v_new_tutor->>'address'), ''), NULLIF(v_new_animal->>'property_id', '')::uuid,
              NULLIF(v_new_animal->>'neighborhood_id', '')::uuid)
      ON CONFLICT (id) DO NOTHING;
      v_tutor_id := (v_new_tutor->>'id')::uuid;
    END IF;
    INSERT INTO public.animals (id, municipality_id, code, name, species, sex, age_group, approx_age_months, characteristics,
                                tutor_id, without_known_tutor, property_id, neighborhood_id)
    VALUES ((v_new_animal->>'id')::uuid, v_mun, 'pendente', NULLIF(trim(v_new_animal->>'name'), ''), v_new_animal->>'species',
            COALESCE(NULLIF(v_new_animal->>'sex', ''), 'nao_informado'), COALESCE(NULLIF(v_new_animal->>'age_group', ''), 'nao_informada'),
            NULLIF(v_new_animal->>'approx_age_months', '')::int, NULLIF(trim(v_new_animal->>'characteristics'), ''),
            v_tutor_id, COALESCE((v_new_animal->>'without_known_tutor')::boolean, false) AND v_tutor_id IS NULL,
            NULLIF(v_new_animal->>'property_id', '')::uuid, NULLIF(v_new_animal->>'neighborhood_id', '')::uuid)
    ON CONFLICT (id) DO NOTHING;
    p := jsonb_set(p, '{animal_id}', to_jsonb(v_new_animal->>'id'));
  END IF;

  IF NULLIF(p->>'animal_id', '') IS NOT NULL THEN
    SELECT * INTO v_animal FROM public.animals WHERE id = (p->>'animal_id')::uuid AND municipality_id = v_mun AND deleted_at IS NULL;
    IF v_animal.id IS NULL THEN
      RAISE EXCEPTION 'animal_invalido' USING ERRCODE = '22023';
    END IF;
    IF v_animal.status <> 'ativo' THEN
      RAISE EXCEPTION 'animal_inativo: situação "%"', v_animal.status USING ERRCODE = '22023';
    END IF;
    v_species := v_animal.species;
    v_sex := CASE WHEN v_animal.sex <> 'nao_informado' THEN v_animal.sex ELSE v_sex END;
    v_age := CASE WHEN v_animal.age_group <> 'nao_informada' THEN v_animal.age_group ELSE v_age END;
    v_property := COALESCE(v_property, v_animal.property_id);
    v_neighborhood := COALESCE(v_neighborhood, v_animal.neighborhood_id);
  ELSIF v_mode = 'individual' THEN
    RAISE EXCEPTION 'animal_obrigatorio no modo individual' USING ERRCODE = '22023';
  END IF;
  IF v_species NOT IN ('canina', 'felina') THEN
    RAISE EXCEPTION 'especie_invalida' USING ERRCODE = '22023';
  END IF;

  -- Duplicidade: um animal por campanha (ou por dia na rotina)
  IF v_animal.id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.animal_vaccinations v WHERE v.animal_id = v_animal.id AND v.status = 'valida'
      AND ((v_campaign.id IS NOT NULL AND v.campaign_id = v_campaign.id) OR (v_campaign.id IS NULL AND v.campaign_id IS NULL AND v.vaccinated_on = v_on))) THEN
    RAISE EXCEPTION 'animal_ja_vacinado: o animal % já tem dose válida registrada %', v_animal.code,
      CASE WHEN v_campaign.id IS NOT NULL THEN 'nesta campanha' ELSE 'nesta data' END USING ERRCODE = '23505';
  END IF;

  v_batch := public.zoo_vaccine_batch(v_mun, NULLIF(p->>'batch_id', '')::uuid, v_on);

  LOOP
    v_code := 'VAC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.animal_vaccinations WHERE verification_code = v_code);
  END LOOP;

  INSERT INTO public.animal_vaccinations (id, municipality_id, campaign_id, post_id, record_mode, context, animal_id, tutor_id,
    species, sex, age_group, neighborhood_id, property_id, vaccinated_at, vaccinated_on, product_id, batch_id,
    vaccinator_profile_id, team_id, notes, verification_code, client_created_at, created_by)
  VALUES (v_id, v_mun, v_campaign.id, v_post.id, v_mode, CASE WHEN v_campaign.id IS NULL THEN 'rotina' ELSE 'campanha' END,
    v_animal.id, v_animal.tutor_id, v_species, v_sex, v_age, v_neighborhood, v_property, v_at, v_on, v_batch.product_id, v_batch.id,
    public.auth_profile_id(), v_team, NULLIF(left(trim(COALESCE(p->>'notes', '')), 1000), ''), v_code,
    NULLIF(p->>'client_created_at', '')::timestamptz, public.auth_profile_id());

  PERFORM public.zoo_consume_doses(v_mun, v_batch, v_team, 1, v_id, 'Vacinação ' || v_code);

  RETURN jsonb_build_object('id', v_id, 'duplicated', false, 'verification_code', v_code, 'animal_code', v_animal.code);
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. RPC: lançamento agregado (transcrição de boletim físico)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zoo_register_aggregate(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun uuid := public.zoo_require('antirrabica.vacinar');
  v_id uuid := (p->>'id')::uuid;
  v_campaign public.vaccination_campaigns;
  v_post public.vaccination_posts;
  v_date date := (p->>'entry_date')::date;
  v_qty int := (p->>'quantity')::int;
  v_batch public.product_batches;
  v_team uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.vaccination_aggregate_entries WHERE id = v_id) THEN
    RETURN jsonb_build_object('id', v_id, 'duplicated', true);
  END IF;
  SELECT * INTO v_campaign FROM public.vaccination_campaigns WHERE id = (p->>'campaign_id')::uuid AND municipality_id = v_mun;
  IF v_campaign.id IS NULL OR v_campaign.status NOT IN ('em_andamento', 'encerrada') THEN
    RAISE EXCEPTION 'campanha_invalida para lançamento agregado' USING ERRCODE = '22023';
  END IF;
  IF v_campaign.status = 'encerrada' THEN
    RAISE EXCEPTION 'campanha_bloqueada: campanha encerrada' USING ERRCODE = '42501';
  END IF;
  IF v_date IS NULL OR v_date NOT BETWEEN v_campaign.start_date AND v_campaign.end_date THEN
    RAISE EXCEPTION 'data_fora_da_campanha' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_post FROM public.vaccination_posts WHERE id = (p->>'post_id')::uuid AND campaign_id = v_campaign.id;
  IF v_post.id IS NULL THEN
    RAISE EXCEPTION 'posto_invalido' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.animal_vaccinations v WHERE v.post_id = v_post.id AND v.vaccinated_on = v_date AND v.status = 'valida') THEN
    RAISE EXCEPTION 'registros_individuais_existentes: o posto já tem doses registradas individualmente nesta data; o boletim agregado contaria em dobro'
      USING ERRCODE = '23505';
  END IF;
  v_team := COALESCE(NULLIF(p->>'team_id', '')::uuid, v_post.team_id);
  v_batch := public.zoo_vaccine_batch(v_mun, (p->>'batch_id')::uuid, v_date);

  INSERT INTO public.vaccination_aggregate_entries (id, municipality_id, campaign_id, post_id, entry_date, species, sex, age_group,
    quantity, source_document, product_id, batch_id, team_id, notes, entered_by)
  VALUES (v_id, v_mun, v_campaign.id, v_post.id, v_date, p->>'species', COALESCE(NULLIF(p->>'sex', ''), 'nao_informado'),
    COALESCE(NULLIF(p->>'age_group', ''), 'nao_informada'), v_qty, trim(p->>'source_document'), v_batch.product_id, v_batch.id, v_team,
    NULLIF(trim(COALESCE(p->>'notes', '')), ''), public.auth_profile_id());

  PERFORM public.zoo_consume_doses(v_mun, v_batch, v_team, v_qty, v_id, 'Boletim ' || trim(p->>'source_document'));
  PERFORM public.zoo_audit(v_mun, 'LANCAMENTO_AGREGADO', 'vaccination_aggregate_entries', v_id::text, NULL, p);
  RETURN jsonb_build_object('id', v_id, 'duplicated', false);
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. RPC: anulação (estorna o estoque)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zoo_void_record(p_kind text, p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun uuid := public.zoo_require('antirrabica.anular');
  v_batch uuid; v_product uuid; v_team uuid; v_qty int; v_status text; v_mun_rec uuid;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 15 THEN
    RAISE EXCEPTION 'justificativa_obrigatoria (mínimo 15 caracteres)' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'individual' THEN
    SELECT batch_id, product_id, team_id, 1, status, municipality_id INTO v_batch, v_product, v_team, v_qty, v_status, v_mun_rec
      FROM public.animal_vaccinations WHERE id = p_id FOR UPDATE;
  ELSIF p_kind = 'agregado' THEN
    SELECT batch_id, product_id, team_id, quantity, status, municipality_id INTO v_batch, v_product, v_team, v_qty, v_status, v_mun_rec
      FROM public.vaccination_aggregate_entries WHERE id = p_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'tipo_invalido' USING ERRCODE = '22023';
  END IF;
  IF v_mun_rec IS DISTINCT FROM v_mun THEN
    RAISE EXCEPTION 'registro_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'valida' THEN
    RAISE EXCEPTION 'registro_ja_anulado' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'individual' THEN
    UPDATE public.animal_vaccinations SET status = 'anulada', void_reason = trim(p_reason), voided_at = now(), voided_by = public.auth_profile_id()
     WHERE id = p_id;
  ELSE
    UPDATE public.vaccination_aggregate_entries SET status = 'anulada', void_reason = trim(p_reason) WHERE id = p_id;
  END IF;

  -- Estorno: devolve as doses ao mesmo saldo de onde saíram
  INSERT INTO public.stock_movements (municipality_id, product_id, batch_id, movement_type, quantity, team_id, operation_id, notes, created_by)
  VALUES (v_mun, v_product, v_batch, CASE WHEN v_team IS NULL THEN 'estorno_aplicacao' ELSE 'estorno_equipe' END, v_qty, v_team, p_id,
          'Estorno por anulação: ' || trim(p_reason), public.auth_profile_id());
  PERFORM public.zoo_audit(v_mun, 'ANULAR', CASE p_kind WHEN 'individual' THEN 'animal_vaccinations' ELSE 'vaccination_aggregate_entries' END,
    p_id::text, jsonb_build_object('status', 'valida'), jsonb_build_object('status', 'anulada', 'motivo', trim(p_reason)));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. RPC: operações de estoque de vacinas (com trava e auditoria)
-- ------------------------------------------------------------------------------
-- op: entrada {product_id, batch_number, expiration_date, quantity, manufacturer?}
--     distribuicao {batch_id, team_id, quantity} | devolucao {batch_id, team_id, quantity}
--     perda {batch_id, team_id?, quantity, reason} | ajuste {batch_id, delta, reason}
CREATE OR REPLACE FUNCTION public.zoo_stock_operation(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op text := p->>'op';
  v_mun uuid := public.zoo_require(CASE WHEN p->>'op' = 'ajuste' THEN 'antirrabica.estoque_ajuste' ELSE 'antirrabica.estoque' END);
  v_batch public.product_batches;
  v_product public.products;
  v_qty numeric := NULLIF(p->>'quantity', '')::numeric;
  v_team uuid := NULLIF(p->>'team_id', '')::uuid;
  v_reason text := NULLIF(trim(COALESCE(p->>'reason', '')), '');
  v_balance numeric;
  v_delta numeric;
BEGIN
  IF v_team IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = v_team AND t.municipality_id = v_mun) THEN
    RAISE EXCEPTION 'equipe_invalida' USING ERRCODE = '22023';
  END IF;

  IF v_op = 'entrada' THEN
    SELECT * INTO v_product FROM public.products
     WHERE id = (p->>'product_id')::uuid AND municipality_id = v_mun AND category = 'vacina_antirrabica' AND deleted_at IS NULL;
    IF v_product.id IS NULL THEN
      RAISE EXCEPTION 'produto_invalido' USING ERRCODE = '22023';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 OR v_qty <> trunc(v_qty) THEN
      RAISE EXCEPTION 'quantidade_invalida (doses inteiras)' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(trim(p->>'batch_number'), '') IS NULL OR NULLIF(p->>'expiration_date', '') IS NULL THEN
      RAISE EXCEPTION 'lote_e_validade_obrigatorios' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_batch FROM public.product_batches WHERE product_id = v_product.id AND upper(batch_number) = upper(trim(p->>'batch_number'));
    IF v_batch.id IS NULL THEN
      INSERT INTO public.product_batches (product_id, batch_number, expiration_date, quantity_received, current_quantity)
      VALUES (v_product.id, trim(p->>'batch_number'), (p->>'expiration_date')::date, v_qty, 0)
      RETURNING * INTO v_batch;
    ELSE
      IF v_batch.expiration_date <> (p->>'expiration_date')::date THEN
        RAISE EXCEPTION 'validade_divergente: o lote % já existe com validade %', v_batch.batch_number, v_batch.expiration_date USING ERRCODE = '22023';
      END IF;
      UPDATE public.product_batches SET quantity_received = quantity_received + v_qty WHERE id = v_batch.id;
    END IF;
    INSERT INTO public.stock_movements (municipality_id, product_id, batch_id, movement_type, quantity, notes, created_by)
    VALUES (v_mun, v_product.id, v_batch.id, 'entrada', v_qty, v_reason, public.auth_profile_id());
  ELSE
    SELECT b.* INTO v_batch FROM public.product_batches b JOIN public.products pr ON pr.id = b.product_id
     WHERE b.id = (p->>'batch_id')::uuid AND pr.municipality_id = v_mun AND pr.category = 'vacina_antirrabica'
     FOR UPDATE OF b;
    IF v_batch.id IS NULL THEN
      RAISE EXCEPTION 'lote_invalido' USING ERRCODE = '22023';
    END IF;

    IF v_op IN ('distribuicao', 'devolucao', 'perda') AND (v_qty IS NULL OR v_qty <= 0 OR v_qty <> trunc(v_qty)) THEN
      RAISE EXCEPTION 'quantidade_invalida (doses inteiras)' USING ERRCODE = '22023';
    END IF;

    IF v_op = 'distribuicao' THEN
      IF v_team IS NULL THEN RAISE EXCEPTION 'equipe_obrigatoria' USING ERRCODE = '22023'; END IF;
      IF v_batch.expiration_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
        RAISE EXCEPTION 'lote_vencido: não distribua lote vencido' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.stock_movements (municipality_id, product_id, batch_id, movement_type, quantity, team_id, notes, created_by)
      VALUES (v_mun, v_batch.product_id, v_batch.id, 'distribuicao_equipe', v_qty, v_team, v_reason, public.auth_profile_id());
    ELSIF v_op IN ('devolucao', 'perda') AND v_team IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtext('zoo_team_batch:' || v_team || ':' || v_batch.id));
      v_balance := public.zoo_team_batch_balance(v_team, v_batch.id);
      IF v_balance < v_qty THEN
        RAISE EXCEPTION 'saldo_insuficiente_equipe: a equipe tem % dose(s) deste lote', v_balance USING ERRCODE = '23514';
      END IF;
      IF v_op = 'perda' AND v_reason IS NULL THEN RAISE EXCEPTION 'motivo_obrigatorio para perda' USING ERRCODE = '22023'; END IF;
      INSERT INTO public.stock_movements (municipality_id, product_id, batch_id, movement_type, quantity, team_id, notes, created_by)
      VALUES (v_mun, v_batch.product_id, v_batch.id, CASE v_op WHEN 'devolucao' THEN 'devolucao' ELSE 'perda_equipe' END, v_qty, v_team,
              v_reason, public.auth_profile_id());
    ELSIF v_op = 'perda' THEN
      IF v_reason IS NULL THEN RAISE EXCEPTION 'motivo_obrigatorio para perda' USING ERRCODE = '22023'; END IF;
      INSERT INTO public.stock_movements (municipality_id, product_id, batch_id, movement_type, quantity, notes, created_by)
      VALUES (v_mun, v_batch.product_id, v_batch.id, 'perda', v_qty, v_reason, public.auth_profile_id());
    ELSIF v_op = 'ajuste' THEN
      v_delta := NULLIF(p->>'delta', '')::numeric;
      IF v_delta IS NULL OR v_delta = 0 OR v_delta <> trunc(v_delta) THEN
        RAISE EXCEPTION 'ajuste_invalido (doses inteiras, diferente de zero)' USING ERRCODE = '22023';
      END IF;
      IF v_reason IS NULL OR length(v_reason) < 15 THEN
        RAISE EXCEPTION 'justificativa_obrigatoria para ajuste (mínimo 15 caracteres)' USING ERRCODE = '22023';
      END IF;
      IF v_batch.current_quantity + v_delta < 0 THEN
        RAISE EXCEPTION 'saldo_insuficiente: ajuste deixaria o lote negativo' USING ERRCODE = '23514';
      END IF;
      UPDATE public.product_batches SET current_quantity = current_quantity + v_delta, updated_at = now() WHERE id = v_batch.id;
      INSERT INTO public.stock_movements (municipality_id, product_id, batch_id, movement_type, quantity, notes, created_by)
      VALUES (v_mun, v_batch.product_id, v_batch.id, CASE WHEN v_delta > 0 THEN 'ajuste_entrada' ELSE 'ajuste_saida' END, abs(v_delta),
              v_reason, public.auth_profile_id());
    ELSE
      RAISE EXCEPTION 'operacao_invalida' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM public.zoo_audit(v_mun, upper('ESTOQUE_' || v_op), 'product_batches', v_batch.id::text, NULL, p);
  RETURN jsonb_build_object('ok', true, 'batch_id', v_batch.id,
    'central_balance', (SELECT current_quantity FROM public.product_batches WHERE id = v_batch.id),
    'team_balance', CASE WHEN v_team IS NOT NULL THEN public.zoo_team_batch_balance(v_team, v_batch.id) END);
END;
$$;

-- Saldos por lote: almoxarifado central e equipes
CREATE OR REPLACE FUNCTION public.zoo_stock_balances()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun uuid := public.zoo_require('antirrabica.view');
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'product_id', pr.id, 'product_name', pr.name, 'manufacturer', pr.manufacturer, 'minimum_stock', pr.minimum_stock,
      'batch_id', b.id, 'batch_number', b.batch_number, 'expiration_date', b.expiration_date,
      'quantity_received', b.quantity_received, 'central_balance', b.current_quantity,
      'teams', (SELECT COALESCE(jsonb_agg(jsonb_build_object('team_id', t.team_id, 'team_name', tm.name, 'balance', t.balance)), '[]'::jsonb)
                FROM (SELECT team_id, sum(CASE
                        WHEN movement_type IN ('distribuicao_equipe', 'estorno_equipe') THEN quantity
                        WHEN movement_type IN ('devolucao', 'aplicacao_equipe', 'perda_equipe') THEN -quantity ELSE 0 END) balance
                      FROM public.stock_movements WHERE batch_id = b.id AND team_id IS NOT NULL GROUP BY team_id) t
                JOIN public.teams tm ON tm.id = t.team_id WHERE t.balance <> 0),
      'applied', (SELECT COALESCE(sum(quantity), 0) FROM public.stock_movements
                  WHERE batch_id = b.id AND movement_type IN ('uso_operacao', 'aplicacao_equipe'))
              - (SELECT COALESCE(sum(quantity), 0) FROM public.stock_movements
                  WHERE batch_id = b.id AND movement_type IN ('estorno_aplicacao', 'estorno_equipe')),
      'losses', (SELECT COALESCE(sum(quantity), 0) FROM public.stock_movements WHERE batch_id = b.id AND movement_type IN ('perda', 'perda_equipe', 'vencimento'))
    ) ORDER BY pr.name, b.expiration_date), '[]'::jsonb)
    FROM public.products pr JOIN public.product_batches b ON b.product_id = pr.id
    WHERE pr.municipality_id = v_mun AND pr.category = 'vacina_antirrabica' AND pr.deleted_at IS NULL
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. RPC: consolidação da vacinação (contagens; coberturas calculadas no app)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zoo_vaccination_counts(p_campaign_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_species text DEFAULT NULL, p_neighborhood uuid DEFAULT NULL, p_team uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun uuid := public.zoo_require('antirrabica.view');
  v_campaign public.vaccination_campaigns;
BEGIN
  IF p_campaign_id IS NOT NULL THEN
    SELECT * INTO v_campaign FROM public.vaccination_campaigns WHERE id = p_campaign_id AND municipality_id = v_mun;
    IF v_campaign.id IS NULL THEN
      RAISE EXCEPTION 'campanha_invalida' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN (
    WITH ind AS (
      SELECT v.* FROM public.animal_vaccinations v
      WHERE v.municipality_id = v_mun AND v.status = 'valida'
        AND (p_campaign_id IS NULL OR v.campaign_id = p_campaign_id)
        AND (p_from IS NULL OR v.vaccinated_on >= p_from) AND (p_to IS NULL OR v.vaccinated_on <= p_to)
    ), agg AS (
      SELECT a.* FROM public.vaccination_aggregate_entries a
      WHERE a.municipality_id = v_mun AND a.status = 'valida'
        AND (p_campaign_id IS NULL OR a.campaign_id = p_campaign_id)
        AND (p_from IS NULL OR a.entry_date >= p_from) AND (p_to IS NULL OR a.entry_date <= p_to)
    ), unified_all AS (   -- uma linha por dose; animal_key distingue animais únicos
      SELECT species, sex, age_group, vaccinated_on AS day, neighborhood_id, team_id, post_id, 1 AS doses,
             record_mode AS source, COALESCE(animal_id::text, id::text) AS animal_key
      FROM ind
      UNION ALL
      SELECT a.species, a.sex, a.age_group, a.entry_date, p.neighborhood_id, a.team_id, a.post_id, a.quantity, 'agregado', NULL
      FROM agg a LEFT JOIN public.vaccination_posts p ON p.id = a.post_id
    ), unified AS (
      SELECT * FROM unified_all
      WHERE (p_species IS NULL OR species = p_species)
        AND (p_neighborhood IS NULL OR neighborhood_id = p_neighborhood)
        AND (p_team IS NULL OR team_id = p_team)
    )
    SELECT jsonb_build_object(
      'campaign', CASE WHEN v_campaign.id IS NULL THEN NULL ELSE to_jsonb(v_campaign) END,
      'doses_total', (SELECT COALESCE(sum(doses), 0) FROM unified),
      'doses_by_source', (SELECT COALESCE(jsonb_object_agg(source, n), '{}') FROM (SELECT source, sum(doses) n FROM unified GROUP BY source) x),
      'by_species', (SELECT COALESCE(jsonb_object_agg(species, jsonb_build_object(
                        'doses', doses, 'animals', animals)), '{}')
                     FROM (SELECT species, sum(doses) doses,
                                  count(DISTINCT animal_key) + COALESCE(sum(doses) FILTER (WHERE animal_key IS NULL), 0) animals
                           FROM unified GROUP BY species) x),
      'by_sex', (SELECT COALESCE(jsonb_agg(jsonb_build_object('species', species, 'sex', sex, 'doses', n)), '[]')
                 FROM (SELECT species, sex, sum(doses) n FROM unified GROUP BY species, sex) x),
      'by_age_group', (SELECT COALESCE(jsonb_agg(jsonb_build_object('species', species, 'age_group', age_group, 'doses', n)), '[]')
                       FROM (SELECT species, age_group, sum(doses) n FROM unified GROUP BY species, age_group) x),
      'by_day', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', day, 'species', species, 'doses', n) ORDER BY day), '[]')
                 FROM (SELECT day, species, sum(doses) n FROM unified GROUP BY day, species) x),
      'by_neighborhood', (SELECT COALESCE(jsonb_agg(jsonb_build_object('neighborhood_id', x.neighborhood_id, 'name', n.name,
                             'species', x.species, 'doses', x.d, 'animals', x.a,
                             'est_dog_population', l.est_dog_population, 'est_cat_population', l.est_cat_population)), '[]')
                          FROM (SELECT neighborhood_id, species, sum(doses) d,
                                       count(DISTINCT animal_key) + COALESCE(sum(doses) FILTER (WHERE animal_key IS NULL), 0) a
                                FROM unified GROUP BY neighborhood_id, species) x
                          LEFT JOIN public.neighborhoods n ON n.id = x.neighborhood_id
                          LEFT JOIN public.vaccination_campaign_localities l ON l.campaign_id = p_campaign_id AND l.neighborhood_id = x.neighborhood_id),
      'by_team', (SELECT COALESCE(jsonb_agg(jsonb_build_object('team_id', x.team_id, 'name', t.name, 'doses', x.n)), '[]')
                  FROM (SELECT team_id, sum(doses) n FROM unified GROUP BY team_id) x LEFT JOIN public.teams t ON t.id = x.team_id),
      'by_post', (SELECT COALESCE(jsonb_agg(jsonb_build_object('post_id', x.post_id, 'name', p.name, 'modality', p.modality, 'doses', x.n)), '[]')
                  FROM (SELECT post_id, sum(doses) n FROM unified GROUP BY post_id) x LEFT JOIN public.vaccination_posts p ON p.id = x.post_id),
      'localities', (SELECT COALESCE(jsonb_agg(jsonb_build_object('neighborhood_id', l.neighborhood_id, 'name', n.name,
                         'est_dog_population', l.est_dog_population, 'est_cat_population', l.est_cat_population)), '[]')
                     FROM public.vaccination_campaign_localities l JOIN public.neighborhoods n ON n.id = l.neighborhood_id
                     WHERE l.campaign_id = p_campaign_id)
    )
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 13. Busca ativa: geração de lista e registro de tentativa
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zoo_generate_search_tasks(p_campaign_id uuid, p_neighborhood_ids uuid[], p_profile_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun uuid := public.zoo_require('antirrabica.busca_ativa');
  v_count int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.vaccination_campaigns WHERE id = p_campaign_id AND municipality_id = v_mun AND status = 'em_andamento') THEN
    RAISE EXCEPTION 'campanha_invalida: busca ativa só em campanha em andamento' USING ERRCODE = '22023';
  END IF;
  IF p_profile_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id AND municipality_id = v_mun AND active) THEN
    RAISE EXCEPTION 'responsavel_invalido' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.zoo_search_tasks (municipality_id, campaign_id, animal_id, property_id, neighborhood_id, assigned_profile_id, created_by)
  SELECT v_mun, p_campaign_id, a.id, a.property_id, a.neighborhood_id, p_profile_id, public.auth_profile_id()
  FROM public.animals a
  WHERE a.municipality_id = v_mun AND a.deleted_at IS NULL AND a.status = 'ativo'
    AND (p_neighborhood_ids IS NULL OR cardinality(p_neighborhood_ids) = 0 OR a.neighborhood_id = ANY (p_neighborhood_ids))
    AND NOT EXISTS (SELECT 1 FROM public.animal_vaccinations v WHERE v.animal_id = a.id AND v.campaign_id = p_campaign_id AND v.status = 'valida')
  ON CONFLICT (campaign_id, animal_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.zoo_audit(v_mun, 'GERAR_BUSCA_ATIVA', 'zoo_search_tasks', p_campaign_id::text, NULL,
    jsonb_build_object('tarefas', v_count, 'responsavel', p_profile_id));
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.zoo_register_search_attempt(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mun uuid := public.zoo_require('antirrabica.busca_ativa');
  v_id uuid := (p->>'id')::uuid;
  v_task public.zoo_search_tasks;
  v_result text := p->>'result';
  v_at timestamptz := COALESCE(NULLIF(p->>'attempted_at', '')::timestamptz, now());
BEGIN
  IF EXISTS (SELECT 1 FROM public.zoo_search_attempts WHERE id = v_id) THEN
    RETURN jsonb_build_object('id', v_id, 'duplicated', true);
  END IF;
  SELECT * INTO v_task FROM public.zoo_search_tasks WHERE id = (p->>'task_id')::uuid AND municipality_id = v_mun FOR UPDATE;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'tarefa_invalida' USING ERRCODE = 'P0002';
  END IF;
  IF v_result NOT IN ('vacinado', 'nao_vacinado', 'ausente', 'recusa', 'animal_nao_encontrado') THEN
    RAISE EXCEPTION 'resultado_invalido' USING ERRCODE = '22023';
  END IF;
  -- "vacinado" só com registro de dose válido na campanha (evita cobertura declarada sem registro)
  IF v_result = 'vacinado' AND NOT EXISTS (SELECT 1 FROM public.animal_vaccinations v
       WHERE v.animal_id = v_task.animal_id AND v.campaign_id = v_task.campaign_id AND v.status = 'valida') THEN
    RAISE EXCEPTION 'dose_nao_registrada: registre a vacinação antes de concluir a tarefa como vacinado' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.zoo_search_attempts (id, municipality_id, task_id, attempted_at, result, notes, agent_profile_id, latitude, longitude)
  VALUES (v_id, v_mun, v_task.id, v_at, v_result, NULLIF(left(trim(COALESCE(p->>'notes', '')), 1000), ''), public.auth_profile_id(),
          NULLIF(p->>'latitude', '')::double precision, NULLIF(p->>'longitude', '')::double precision);
  UPDATE public.zoo_search_tasks SET status = v_result, attempts = attempts + 1, last_attempt_at = v_at, updated_at = now()
   WHERE id = v_task.id;
  RETURN jsonb_build_object('id', v_id, 'duplicated', false);
END;
$$;

-- ------------------------------------------------------------------------------
-- 14. Verificação pública da carteira (sem dados pessoais)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_verify_vaccination(p_code text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row record;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) < 8 OR length(trim(p_code)) > 20 THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  SELECT v.verification_code, v.vaccinated_on, v.species, v.status, a.code AS animal_code, pr.name AS product_name,
         pr.manufacturer, b.batch_number, m.name AS municipality_name, m.state
    INTO v_row
    FROM public.animal_vaccinations v
    JOIN public.municipalities m ON m.id = v.municipality_id
    JOIN public.products pr ON pr.id = v.product_id
    JOIN public.product_batches b ON b.id = v.batch_id
    LEFT JOIN public.animals a ON a.id = v.animal_id
   WHERE v.verification_code = upper(trim(p_code));
  IF v_row.verification_code IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('code', v_row.verification_code, 'valid', v_row.status = 'valida', 'vaccinated_on', v_row.vaccinated_on,
    'species', v_row.species, 'animal_code', v_row.animal_code, 'vaccine', v_row.product_name, 'manufacturer', v_row.manufacturer,
    'batch', v_row.batch_number, 'service', 'Vigilância em Saúde - ' || v_row.municipality_name || '/' || v_row.state);
END;
$$;

-- ------------------------------------------------------------------------------
-- 15. RLS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zoo_can(p_municipality uuid, p_permissions text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_platform_admin()
      OR (p_municipality = public.current_user_municipality_id()
          AND EXISTS (SELECT 1 FROM unnest(p_permissions) x WHERE public.has_permission(x)));
$$;

ALTER TABLE public.zoo_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animal_tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccination_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccination_campaign_localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccination_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animal_vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccination_aggregate_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoo_search_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoo_search_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rabies_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rabies_event_updates ENABLE ROW LEVEL SECURITY;

-- Dados pessoais de tutores: só com antirrabica.tutores_dados (LGPD)
CREATE POLICY animal_tutors_read ON public.animal_tutors FOR SELECT TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.tutores_dados']));
CREATE POLICY animal_tutors_insert ON public.animal_tutors FOR INSERT TO authenticated
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['antirrabica.cadastro']) AND public.has_permission('antirrabica.tutores_dados'));
CREATE POLICY animal_tutors_update ON public.animal_tutors FOR UPDATE TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.cadastro']) AND public.has_permission('antirrabica.tutores_dados'))
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['antirrabica.cadastro']));

CREATE POLICY animals_read ON public.animals FOR SELECT TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.view', 'antirrabica.vacinar', 'antirrabica.busca_ativa', 'raiva.view']));
CREATE POLICY animals_insert ON public.animals FOR INSERT TO authenticated
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['antirrabica.cadastro']));
CREATE POLICY animals_update ON public.animals FOR UPDATE TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.cadastro']))
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['antirrabica.cadastro']));

CREATE POLICY vacc_campaigns_read ON public.vaccination_campaigns FOR SELECT TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.view', 'antirrabica.vacinar']));
CREATE POLICY vacc_campaigns_insert ON public.vaccination_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['antirrabica.campanhas']));
CREATE POLICY vacc_campaigns_update ON public.vaccination_campaigns FOR UPDATE TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.campanhas']))
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['antirrabica.campanhas']));

CREATE POLICY vacc_localities_read ON public.vaccination_campaign_localities FOR SELECT TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.view', 'antirrabica.vacinar']));
CREATE POLICY vacc_localities_write ON public.vaccination_campaign_localities FOR ALL TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.campanhas']))
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['antirrabica.campanhas']));

CREATE POLICY vacc_posts_read ON public.vaccination_posts FOR SELECT TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.view', 'antirrabica.vacinar']));
CREATE POLICY vacc_posts_insert ON public.vaccination_posts FOR INSERT TO authenticated
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['antirrabica.campanhas']));
CREATE POLICY vacc_posts_update ON public.vaccination_posts FOR UPDATE TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.campanhas']))
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['antirrabica.campanhas']));

CREATE POLICY vacc_records_read ON public.animal_vaccinations FOR SELECT TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.view', 'antirrabica.vacinar']));
CREATE POLICY vacc_aggregate_read ON public.vaccination_aggregate_entries FOR SELECT TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.view', 'antirrabica.vacinar']));

CREATE POLICY zoo_tasks_read ON public.zoo_search_tasks FOR SELECT TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.view', 'antirrabica.busca_ativa']));
CREATE POLICY zoo_tasks_assign ON public.zoo_search_tasks FOR UPDATE TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.busca_ativa']))
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['antirrabica.busca_ativa'])
              AND (assigned_profile_id IS NULL OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = assigned_profile_id AND p.municipality_id = zoo_search_tasks.municipality_id)));
CREATE POLICY zoo_attempts_read ON public.zoo_search_attempts FOR SELECT TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['antirrabica.view', 'antirrabica.busca_ativa']));

CREATE POLICY rabies_events_read ON public.rabies_events FOR SELECT TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['raiva.view']));
CREATE POLICY rabies_events_insert ON public.rabies_events FOR INSERT TO authenticated
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['raiva.registrar']));
CREATE POLICY rabies_events_update ON public.rabies_events FOR UPDATE TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['raiva.registrar', 'raiva.decidir']))
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['raiva.registrar', 'raiva.decidir']));
CREATE POLICY rabies_updates_read ON public.rabies_event_updates FOR SELECT TO authenticated
  USING (public.zoo_can(municipality_id, ARRAY['raiva.view']));
CREATE POLICY rabies_updates_insert ON public.rabies_event_updates FOR INSERT TO authenticated
  WITH CHECK (public.zoo_can(municipality_id, ARRAY['raiva.registrar', 'raiva.decidir'])
              AND actor_id = public.auth_profile_id() AND update_type = 'acompanhamento'
              AND EXISTS (SELECT 1 FROM public.rabies_events e WHERE e.id = event_id AND e.municipality_id = rabies_event_updates.municipality_id));

-- Privilégios: exclusão física bloqueada (histórico preservado); registros de dose,
-- agregados, estoque e tentativas só por RPC.
REVOKE ALL ON public.zoo_counters, public.animal_tutors, public.animals, public.vaccination_campaigns,
  public.vaccination_campaign_localities, public.vaccination_posts, public.animal_vaccinations,
  public.vaccination_aggregate_entries, public.zoo_search_tasks, public.zoo_search_attempts,
  public.rabies_events, public.rabies_event_updates FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.animal_tutors, public.animals, public.vaccination_campaigns, public.vaccination_posts,
  public.rabies_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaccination_campaign_localities TO authenticated;
GRANT SELECT ON public.animal_vaccinations, public.vaccination_aggregate_entries, public.zoo_search_attempts TO authenticated;
GRANT SELECT, UPDATE (assigned_profile_id, updated_at) ON public.zoo_search_tasks TO authenticated;
GRANT SELECT, INSERT ON public.rabies_event_updates TO authenticated;

-- Estoque de vacinas: movimentação direta bloqueada (só por zoo_stock_operation / registros de dose)
CREATE POLICY stock_movements_vaccine_rpc_only ON public.stock_movements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.category = 'vacina_antirrabica'));
CREATE POLICY product_batches_vaccine_rpc_only ON public.product_batches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.category = 'vacina_antirrabica'));
CREATE POLICY product_batches_vaccine_rpc_insert ON public.product_batches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.category = 'vacina_antirrabica'));

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'zoo_register_vaccination(jsonb)', 'zoo_register_aggregate(jsonb)', 'zoo_void_record(text,uuid,text)',
    'zoo_stock_operation(jsonb)', 'zoo_stock_balances()', 'zoo_vaccination_counts(uuid,date,date,text,uuid,uuid)',
    'zoo_generate_search_tasks(uuid,uuid[],uuid)', 'zoo_register_search_attempt(jsonb)', 'zoo_can(uuid,text[])'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'zoo_next_code(uuid,text,text)', 'zoo_animals_before_write()', 'zoo_tutors_before_write()', 'zoo_same_municipality_guard()',
    'zoo_campaign_guard()', 'rabies_events_before_write()', 'rabies_events_history()', 'zoo_require(text)',
    'zoo_audit(uuid,text,text,text,jsonb,jsonb)', 'zoo_team_batch_balance(uuid,uuid)', 'zoo_vaccine_batch(uuid,uuid,date)',
    'zoo_consume_doses(uuid,public.product_batches,uuid,int,uuid,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon, authenticated', f);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.public_verify_vaccination(text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_verify_vaccination(text) TO anon, authenticated;

COMMIT;
