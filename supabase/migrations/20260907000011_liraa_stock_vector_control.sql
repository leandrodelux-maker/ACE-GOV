-- ==============================================================================
-- ENDEMIAS GOV - MIGRATION 11: LIRAA/LIA, ESTOQUE OPERACIONAL (FEFO) E CONTROLE VETORIAL
-- ==============================================================================

-- 1. CATEGORIAS DE DEPÓSITOS (MINISTÉRIO DA SAÚDE)
CREATE TABLE IF NOT EXISTS deposit_categories (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO deposit_categories (code, name, description, active) VALUES
('A1', 'Depósito elevado de água potável', 'Caixas d''água elevadas, reservatórios de alvenaria e tanques elevados.', true),
('A2', 'Depósito de água ao nível do solo', 'Caixas d''água baixas, tambores, tonéis, cisternas e poços.', true),
('B', 'Depósito móvel / doméstico', 'Vasos de plantas, pratos, pingadeiras, bebedouros de animais e fontes ornamentais.', true),
('C', 'Depósito fixo / passível de remoção', 'Calhas, lajes, ralos, sanitários desativados, piscinas não tratadas e tanques.', true),
('D1', 'Pneus e materiais rodantes', 'Pneus usados, câmaras de ar e materiais em borracharias e ferros-velhos.', true),
('D2', 'Lixo e resíduos sólidos domiciliares', 'Latas, garrafas pet, plásticos, sucatas, copos descartáveis e entulhos de construção.', true),
('E', 'Depósitos naturais', 'Ocos de árvores, bromélias, bambus, cascas de frutos e depressões em rochas.', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. LEVANTAMENTOS LIRAa / LIA
CREATE TABLE IF NOT EXISTS liraa_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'LIRAa', -- LIRAa ou LIA
    name VARCHAR(150) NOT NULL,
    year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    cycle_number INT NOT NULL DEFAULT 1,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'planejamento', -- planejamento, em_execucao, processamento, finalizado, cancelado
    total_properties INT NOT NULL DEFAULT 0,
    sample_properties INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3. ESTRATOS LIRAa
CREATE TABLE IF NOT EXISTS liraa_strata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES liraa_surveys(id) ON DELETE CASCADE,
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(30) NOT NULL,
    population INT DEFAULT 0,
    total_properties INT NOT NULL DEFAULT 0,
    sample_size INT NOT NULL DEFAULT 0,
    neighborhoods JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'planejamento',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. AMOSTRAGEM LIRAa
CREATE TABLE IF NOT EXISTS liraa_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES liraa_surveys(id) ON DELETE CASCADE,
    stratum_id UUID NOT NULL REFERENCES liraa_strata(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    block_id UUID REFERENCES blocks(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'selecionado', -- selecionado, visitado, fechado, recusa, substituido, cancelado
    replacement_of UUID REFERENCES liraa_samples(id) ON DELETE SET NULL,
    visited_at TIMESTAMPTZ,
    positive BOOLEAN DEFAULT false,
    larvae_found BOOLEAN DEFAULT false,
    deposit_types JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ESTOQUE: PRODUTOS, LOTES E MOVIMENTAÇÕES
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- larvicida, inseticida, EPI, material_de_campo, material_laboratorio, outro
    active_ingredient VARCHAR(150),
    unit VARCHAR(30) NOT NULL DEFAULT 'un',
    manufacturer VARCHAR(150),
    minimum_stock NUMERIC(12,2) NOT NULL DEFAULT 10.00,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS product_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_number VARCHAR(80) NOT NULL,
    expiration_date DATE NOT NULL,
    quantity_received NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    current_quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    received_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES product_batches(id) ON DELETE RESTRICT,
    movement_type VARCHAR(40) NOT NULL, -- entrada, saida, devolucao, ajuste, perda, vencimento
    quantity NUMERIC(12,2) NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    operation_id UUID,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. CONTROLE VETORIAL: OPERAÇÕES, IMÓVEIS E APLICAÇÕES QUÍMICAS
CREATE TABLE IF NOT EXISTS vector_control_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- tratamento_focal, tratamento_perifocal, bloqueio, nebulizacao, fumace, outro
    disease VARCHAR(60) NOT NULL DEFAULT 'DENGUE',
    neighborhood_id UUID REFERENCES neighborhoods(id) ON DELETE SET NULL,
    sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
    radius_meters INT NOT NULL DEFAULT 150,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status VARCHAR(40) NOT NULL DEFAULT 'EM_ANDAMENTO',
    responsible_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    case_id UUID REFERENCES epidemiological_cases(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS vector_control_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID NOT NULL REFERENCES vector_control_operations(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'TRABALHADO',
    treated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    refusal BOOLEAN NOT NULL DEFAULT false,
    closed BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chemical_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID NOT NULL REFERENCES vector_control_operations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES product_batches(id) ON DELETE RESTRICT,
    application_type VARCHAR(50) NOT NULL, -- FOCAL, PERIFOCAL, NEBULIZACAO_COSTAL, UBV_PESADO
    quantity NUMERIC(10,2) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    application_date DATE NOT NULL DEFAULT CURRENT_DATE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. HABILITAR ROW LEVEL SECURITY (RLS) MULTI-TENANT
ALTER TABLE deposit_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE liraa_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE liraa_strata ENABLE ROW LEVEL SECURITY;
ALTER TABLE liraa_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_control_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_control_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE chemical_applications ENABLE ROW LEVEL SECURITY;

-- 8. POLÍTICAS DE RLS
DROP POLICY IF EXISTS "tenant_isolation_deposit_categories" ON deposit_categories;
CREATE POLICY "tenant_isolation_deposit_categories" ON deposit_categories
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "tenant_isolation_liraa_surveys" ON liraa_surveys;
CREATE POLICY "tenant_isolation_liraa_surveys" ON liraa_surveys
    FOR ALL USING (
        deleted_at IS NULL AND (
            is_superadmin() OR auth.uid() IS NULL OR municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    ) WITH CHECK (
        is_superadmin() OR auth.uid() IS NULL OR municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

DROP POLICY IF EXISTS "tenant_isolation_liraa_strata" ON liraa_strata;
CREATE POLICY "tenant_isolation_liraa_strata" ON liraa_strata
    FOR ALL USING (
        is_superadmin() OR auth.uid() IS NULL OR municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
    ) WITH CHECK (
        is_superadmin() OR auth.uid() IS NULL OR municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

DROP POLICY IF EXISTS "tenant_isolation_liraa_samples" ON liraa_samples;
CREATE POLICY "tenant_isolation_liraa_samples" ON liraa_samples
    FOR ALL USING (
        is_superadmin() OR auth.uid() IS NULL OR survey_id IN (
            SELECT id FROM liraa_surveys WHERE municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_products" ON products;
CREATE POLICY "tenant_isolation_products" ON products
    FOR ALL USING (
        deleted_at IS NULL AND (
            is_superadmin() OR auth.uid() IS NULL OR municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    ) WITH CHECK (
        is_superadmin() OR auth.uid() IS NULL OR municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

DROP POLICY IF EXISTS "tenant_isolation_product_batches" ON product_batches;
CREATE POLICY "tenant_isolation_product_batches" ON product_batches
    FOR ALL USING (
        is_superadmin() OR auth.uid() IS NULL OR product_id IN (
            SELECT id FROM products WHERE municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_stock_movements" ON stock_movements;
CREATE POLICY "tenant_isolation_stock_movements" ON stock_movements
    FOR ALL USING (
        is_superadmin() OR auth.uid() IS NULL OR municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
    ) WITH CHECK (
        is_superadmin() OR auth.uid() IS NULL OR municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

DROP POLICY IF EXISTS "tenant_isolation_vector_control_operations" ON vector_control_operations;
CREATE POLICY "tenant_isolation_vector_control_operations" ON vector_control_operations
    FOR ALL USING (
        deleted_at IS NULL AND (
            is_superadmin() OR auth.uid() IS NULL OR municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    ) WITH CHECK (
        is_superadmin() OR auth.uid() IS NULL OR municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
    );

DROP POLICY IF EXISTS "tenant_isolation_vector_control_properties" ON vector_control_properties;
CREATE POLICY "tenant_isolation_vector_control_properties" ON vector_control_properties
    FOR ALL USING (
        is_superadmin() OR auth.uid() IS NULL OR operation_id IN (
            SELECT id FROM vector_control_operations WHERE municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_chemical_applications" ON chemical_applications;
CREATE POLICY "tenant_isolation_chemical_applications" ON chemical_applications
    FOR ALL USING (
        is_superadmin() OR auth.uid() IS NULL OR operation_id IN (
            SELECT id FROM vector_control_operations WHERE municipality_id = current_user_municipality_id() OR municipality_id = '00000000-0000-0000-0000-000000000001'
        )
    );

-- 9. SEED INICIAL: PRODUTOS E LOTES COM FEFO
DO $$
DECLARE
    mun_id UUID := '00000000-0000-0000-0000-000000000001';
    prod_piri UUID;
    prod_bti UUID;
    prod_cielo UUID;
    prod_epi UUID;
    surv_id UUID;
    strat_id UUID;
    prop_rec RECORD;
BEGIN
    -- Inserir Produtos
    INSERT INTO products (municipality_id, name, category, active_ingredient, unit, manufacturer, minimum_stock)
    VALUES 
        (mun_id, 'Piriproxifeno 0,5% G', 'larvicida', 'Piriproxifeno', 'kg', 'Sumitomo Chemical', 15.0)
    RETURNING id INTO prod_piri;

    INSERT INTO products (municipality_id, name, category, active_ingredient, unit, manufacturer, minimum_stock)
    VALUES 
        (mun_id, 'Bacillus thuringiensis israelensis (BTI)', 'larvicida', 'BTI H-14', 'kg', 'Valent BioSciences', 10.0)
    RETURNING id INTO prod_bti;

    INSERT INTO products (municipality_id, name, category, active_ingredient, unit, manufacturer, minimum_stock)
    VALUES 
        (mun_id, 'Cielo UBV (Malation + Permetrina)', 'inseticida', 'Malation 30% + Permetrina 10%', 'litros', 'Bayer Saúde Ambiental', 40.0)
    RETURNING id INTO prod_cielo;

    INSERT INTO products (municipality_id, name, category, active_ingredient, unit, manufacturer, minimum_stock)
    VALUES 
        (mun_id, 'Máscara PFF2 / N95 com Válvula', 'EPI', 'Filtro Eletrostático', 'un', '3M do Brasil', 50.0)
    RETURNING id INTO prod_epi;

    -- Inserir Lotes para FEFO (um vence mais cedo, outro depois)
    IF prod_piri IS NOT NULL THEN
        INSERT INTO product_batches (product_id, batch_number, expiration_date, quantity_received, current_quantity, received_at)
        VALUES 
            (prod_piri, 'LOTE-PIRI-2025-A', CURRENT_DATE + INTERVAL '90 days', 20.0, 18.5, CURRENT_DATE - INTERVAL '60 days'),
            (prod_piri, 'LOTE-PIRI-2026-B', CURRENT_DATE + INTERVAL '540 days', 50.0, 50.0, CURRENT_DATE - INTERVAL '10 days');
    END IF;

    IF prod_cielo IS NOT NULL THEN
        INSERT INTO product_batches (product_id, batch_number, expiration_date, quantity_received, current_quantity, received_at)
        VALUES 
            (prod_cielo, 'LOTE-CIELO-2025-V1', CURRENT_DATE + INTERVAL '45 days', 30.0, 12.0, CURRENT_DATE - INTERVAL '120 days'),
            (prod_cielo, 'LOTE-CIELO-2026-V2', CURRENT_DATE + INTERVAL '400 days', 100.0, 100.0, CURRENT_DATE - INTERVAL '15 days');
    END IF;

    -- Inserir Levantamento LIRAa inicial
    INSERT INTO liraa_surveys (
        municipality_id, type, name, year, cycle_number, start_date, end_date, status, total_properties, sample_properties
    ) VALUES (
        mun_id, 'LIRAa', 'LIRAa Municipal - 1º Levantamento Rápido de 2026', 2026, 1, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '10 days',
        'em_execucao', 1250, 250
    ) RETURNING id INTO surv_id;

    IF surv_id IS NOT NULL THEN
        -- Inserir Estrato 01
        INSERT INTO liraa_strata (
            survey_id, municipality_id, name, code, population, total_properties, sample_size, status
        ) VALUES (
            surv_id, mun_id, 'Estrato 01 - Zona Central & Bairros Tradicionais', 'EST-01', 35000, 1250, 250, 'em_execucao'
        ) RETURNING id INTO strat_id;

        -- Criar amostras com os imóveis existentes
        IF strat_id IS NOT NULL THEN
            FOR prop_rec IN (SELECT id, block_id FROM properties WHERE municipality_id = mun_id LIMIT 5) LOOP
                INSERT INTO liraa_samples (
                    survey_id, stratum_id, property_id, block_id, status, visited_at, positive, larvae_found, deposit_types
                ) VALUES (
                    surv_id, strat_id, prop_rec.id, prop_rec.block_id, 'visitado', NOW() - INTERVAL '1 day',
                    CASE WHEN prop_rec.id = (SELECT id FROM properties WHERE municipality_id = mun_id LIMIT 1) THEN true ELSE false END,
                    CASE WHEN prop_rec.id = (SELECT id FROM properties WHERE municipality_id = mun_id LIMIT 1) THEN true ELSE false END,
                    '["A1", "B"]'::jsonb
                );
            END LOOP;
        END IF;
    END IF;
END $$;
