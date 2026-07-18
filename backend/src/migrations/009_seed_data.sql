-- ============================================
-- 009: DATOS INICIALES (SEEDS)
-- ============================================

-- --------------------------------------------
-- DIM_CRITERIOS_DISTRIBUCION
-- --------------------------------------------
INSERT INTO dim_criterios_distribucion (retail, minimo_compras, periodo_dias) VALUES
    ('COLMADO', 3, 30),
    ('AUTOSERVICIO', 6, 30),
    ('MAYORISTA', 6, 30),
    ('OTROS', 1, 30)
ON CONFLICT (retail) DO UPDATE SET
    minimo_compras = EXCLUDED.minimo_compras,
    periodo_dias = EXCLUDED.periodo_dias;

-- --------------------------------------------
-- DIM_SURTIDO_OBLIGATORIO
-- BRONZE: grupos 1-17 | SILVER: grupos 1-21 | GOLD: grupos 1-11
-- Se excluye el grupo 13 y 22 (no existen en la especificacion de grupos)
-- --------------------------------------------
INSERT INTO dim_surtido_obligatorio (u_cluster, u_surtido_n, es_obligatorio)
SELECT 'GOLD', g, TRUE
FROM generate_series(1, 11) AS g
WHERE g NOT IN (13)
ON CONFLICT (u_cluster, u_surtido_n) DO NOTHING;

INSERT INTO dim_surtido_obligatorio (u_cluster, u_surtido_n, es_obligatorio)
SELECT 'BRONZE', g, TRUE
FROM generate_series(1, 17) AS g
WHERE g NOT IN (13)
ON CONFLICT (u_cluster, u_surtido_n) DO NOTHING;

INSERT INTO dim_surtido_obligatorio (u_cluster, u_surtido_n, es_obligatorio)
SELECT 'SILVER', g, TRUE
FROM generate_series(1, 21) AS g
WHERE g NOT IN (13)
ON CONFLICT (u_cluster, u_surtido_n) DO NOTHING;

-- --------------------------------------------
-- DIM_TIEMPO: Genera calendario 2024-01-01 a 2027-12-31
-- --------------------------------------------
INSERT INTO dim_tiempo (id_fecha, ano, mes, dia, trimestre, semana, nombre_mes, nombre_dia, es_fin_semana)
SELECT
    d::DATE AS id_fecha,
    EXTRACT(YEAR FROM d)::INT AS ano,
    EXTRACT(MONTH FROM d)::INT AS mes,
    EXTRACT(DAY FROM d)::INT AS dia,
    EXTRACT(QUARTER FROM d)::INT AS trimestre,
    EXTRACT(WEEK FROM d)::INT AS semana,
    TO_CHAR(d, 'TMMonth') AS nombre_mes,
    TO_CHAR(d, 'TMDay') AS nombre_dia,
    EXTRACT(ISODOW FROM d) IN (6, 7) AS es_fin_semana
FROM generate_series('2024-01-01'::DATE, '2027-12-31'::DATE, INTERVAL '1 day') AS d
ON CONFLICT (id_fecha) DO NOTHING;

-- --------------------------------------------
-- CRON_SETTINGS: horarios por defecto
-- --------------------------------------------
INSERT INTO cron_settings (nombre_job, cron_expresion, habilitado) VALUES
    ('sync_clientes', '0 23 * * *', TRUE),
    ('sync_articulos', '15 23 * * *', TRUE),
    ('sync_ventas', '30 23 * * *', TRUE),
    ('calcular_kpis', '45 23 * * *', TRUE),
    ('refresh_views', '0 0 * * *', TRUE),
    ('telegram_resumen', '0 6 * * *', FALSE)
ON CONFLICT (nombre_job) DO NOTHING;

-- --------------------------------------------
-- SYNC_METADATA: inicializa control de sincronizacion
-- --------------------------------------------
INSERT INTO sync_metadata (nombre_tabla, estado) VALUES
    ('clientes', 'pendiente'),
    ('articulos', 'pendiente'),
    ('ventas', 'pendiente'),
    ('kpis', 'pendiente')
ON CONFLICT (nombre_tabla) DO NOTHING;
