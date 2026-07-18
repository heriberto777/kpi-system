-- ============================================
-- 006: DIM_DIA_NO_LABORABLE + funciones de dias habiles
-- El negocio mide "cuanto falta vender por dia" (Ventas por Vendedor) en dias HABILES, no
-- dias calendario: fines de semana no cuentan, y los feriados dominicanos (algunos variables
-- como Viernes Santo/Corpus Christi, o trasladados a lunes por la Ley 139-97) no se pueden
-- calcular con una formula fija. Esta tabla la cura el negocio a mano desde Parametros; no la
-- toca el ETL. No se siembra con feriados por defecto para no afirmar fechas incorrectas.
-- ============================================

CREATE TABLE IF NOT EXISTS dim_dia_no_laborable (
    fecha DATE PRIMARY KEY,
    descripcion VARCHAR(200)
);

-- --------------------------------------------
-- FECHA_REFERENCIA_VENTAS
-- "Hoy" para efectos de ventanas de analisis es la fecha mas reciente que exista realmente en
-- fact_ventas, no CURRENT_DATE. Se define aqui (no en 007_create_materialized_views.sql) porque
-- dias_laborables_transcurridos() la necesita y esta migracion corre antes.
-- --------------------------------------------
CREATE OR REPLACE FUNCTION fecha_referencia_ventas() RETURNS DATE AS $$
    SELECT COALESCE(MAX(id_fecha), CURRENT_DATE) FROM fact_ventas;
$$ LANGUAGE sql STABLE;

-- --------------------------------------------
-- DIAS_LABORABLES_MES
-- Cuenta los dias de lunes a viernes de todo el mes (anno_mes = 'YYYY-MM') que no esten en
-- dim_dia_no_laborable.
-- --------------------------------------------
CREATE OR REPLACE FUNCTION dias_laborables_mes(p_anno_mes VARCHAR) RETURNS INT AS $$
    SELECT COUNT(*)::INT
    FROM generate_series(
        TO_DATE(p_anno_mes || '-01', 'YYYY-MM-DD'),
        (TO_DATE(p_anno_mes || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date,
        INTERVAL '1 day'
    ) AS dia(fecha)
    WHERE EXTRACT(ISODOW FROM dia.fecha) NOT IN (6, 7)
      AND NOT EXISTS (SELECT 1 FROM dim_dia_no_laborable dnl WHERE dnl.fecha = dia.fecha::date);
$$ LANGUAGE sql STABLE;

-- --------------------------------------------
-- DIAS_LABORABLES_TRANSCURRIDOS
-- Igual que dias_laborables_mes pero solo hasta fecha_referencia_ventas() (o hasta fin de mes
-- si el mes ya cerro por completo).
-- --------------------------------------------
CREATE OR REPLACE FUNCTION dias_laborables_transcurridos(p_anno_mes VARCHAR) RETURNS INT AS $$
    SELECT COUNT(*)::INT
    FROM generate_series(
        TO_DATE(p_anno_mes || '-01', 'YYYY-MM-DD'),
        LEAST(
            (TO_DATE(p_anno_mes || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date,
            fecha_referencia_ventas()
        ),
        INTERVAL '1 day'
    ) AS dia(fecha)
    WHERE EXTRACT(ISODOW FROM dia.fecha) NOT IN (6, 7)
      AND NOT EXISTS (SELECT 1 FROM dim_dia_no_laborable dnl WHERE dnl.fecha = dia.fecha::date);
$$ LANGUAGE sql STABLE;
