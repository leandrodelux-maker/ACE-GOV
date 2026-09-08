-- Migration: 20260907000016_historical_predictive_weather_targets.sql
-- Módulos de Meteorologia Desacoplada e Metas de Gestão Municipal

-- ========================================================
-- 1. TABELA DE DADOS METEOROLÓGICOS DIÁRIOS (weather_daily)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.weather_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    rainfall_mm NUMERIC(6,2) DEFAULT 0.00,
    temp_min NUMERIC(4,1),
    temp_max NUMERIC(4,1),
    temp_avg NUMERIC(4,1),
    humidity_avg NUMERIC(4,1),
    source VARCHAR(50) DEFAULT 'INMET',
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_weather_municipality_date UNIQUE (municipality_id, date)
);

CREATE INDEX IF NOT EXISTS idx_weather_daily_mun_date ON public.weather_daily(municipality_id, date DESC);

-- Habilitar RLS
ALTER TABLE public.weather_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_weather_daily ON public.weather_daily;
CREATE POLICY rls_weather_daily ON public.weather_daily
    FOR ALL USING (
        is_superadmin()
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'::uuid
    );

-- ========================================================
-- 2. TABELA DE METAS E INDICADORES DE GESTÃO (management_targets)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.management_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
    year INT NOT NULL,
    indicator VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    target_value NUMERIC(10,2) NOT NULL,
    comparison_operator VARCHAR(10) NOT NULL DEFAULT '>=',
    periodicity VARCHAR(20) NOT NULL DEFAULT 'ciclo',
    unit VARCHAR(20) DEFAULT '%',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_management_targets_mun_year ON public.management_targets(municipality_id, year, active);

-- Habilitar RLS
ALTER TABLE public.management_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_management_targets ON public.management_targets;
CREATE POLICY rls_management_targets ON public.management_targets
    FOR ALL USING (
        is_superadmin()
        OR municipality_id = current_user_municipality_id()
        OR municipality_id = '00000000-0000-0000-0000-000000000001'::uuid
    );

-- ========================================================
-- 3. SEED DE DADOS INICIAIS (METEOROLOGIA E METAS 2026)
-- ========================================================
INSERT INTO public.weather_daily (municipality_id, date, rainfall_mm, temp_min, temp_max, temp_avg, humidity_avg, source)
VALUES
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '13 days', 0.0, 19.5, 29.8, 24.6, 68.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '12 days', 4.2, 20.1, 28.5, 24.3, 75.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '11 days', 18.6, 21.0, 27.2, 24.1, 88.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '10 days', 32.4, 21.5, 26.0, 23.7, 92.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '9 days', 8.0, 20.8, 28.0, 24.4, 82.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '8 days', 0.0, 19.8, 30.2, 25.0, 69.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '7 days', 0.0, 19.2, 31.0, 25.1, 64.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '6 days', 0.0, 20.0, 31.5, 25.7, 62.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '5 days', 12.0, 21.2, 28.4, 24.8, 80.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '4 days', 24.5, 21.8, 27.0, 24.4, 89.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '3 days', 5.8, 20.5, 29.0, 24.7, 78.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '2 days', 0.0, 19.8, 30.5, 25.1, 71.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '1 day', 2.0, 20.4, 30.1, 25.2, 74.0, 'INMET'),
    ('00000000-0000-0000-0000-000000000001', CURRENT_DATE, 0.0, 20.8, 31.2, 26.0, 70.0, 'INMET')
ON CONFLICT (municipality_id, date) DO NOTHING;

INSERT INTO public.management_targets (municipality_id, year, indicator, title, description, target_value, comparison_operator, periodicity, unit, active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 2026, 'cobertura_ciclo', 'Cobertura Territorial do Ciclo', 'Percentual mínimo de imóveis trabalhados em cada ciclo bimestral', 85.0, '>=', 'ciclo', '%', true),
    ('00000000-0000-0000-0000-000000000001', 2026, 'pe_vencidos', 'Pontos Estratégicos Vencidos', 'Tolerância zero de PEs sem inspeção quinzenal obrigatória', 0.0, '<=', 'mensal', 'unid', true),
    ('00000000-0000-0000-0000-000000000001', 2026, 'denuncias_prazo', 'Atendimento de Denúncias em até 5 dias', 'Percentual de denúncias vistoriadas dentro do prazo regulamentar', 90.0, '>=', 'mensal', '%', true),
    ('00000000-0000-0000-0000-000000000001', 2026, 'pendencias_visita', 'Índice de Pendências e Imóveis Fechados', 'Manter imóveis sem visitação por recusa/fechamento abaixo do teto', 10.0, '<=', 'ciclo', '%', true),
    ('00000000-0000-0000-0000-000000000001', 2026, 'cobertura_liraa', 'Cobertura Amostral LIRAa / LIA', 'Percentual de quarteirões sorteados com amostragem larvária concluída', 95.0, '>=', 'ciclo', '%', true)
ON CONFLICT DO NOTHING;
