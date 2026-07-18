-- ============================================
-- 005: CUOTA $ POR VENDEDOR (dbo.cuota del ERP)
-- Cuota de VENTAS EN PESOS por vendedor+subcategoria+mes, distinta de la cuota de cantidad de
-- clientes que ya calcula mv_distribucion_por_vendedor (cartera x objetivo%). Es un valor
-- oficial del ERP (ya ajustado por el negocio, columna Cuota_ajustada): se visualiza, no se
-- edita en la app (igual criterio que objetivos/universo).
-- ============================================

-- --------------------------------------------
-- STAGING: stg_cuota (se trunca en cada sincronizacion)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS stg_cuota (
    anno_mes VARCHAR(7),
    vendedor VARCHAR(50),
    retail VARCHAR(50),
    clasificacion_2 VARCHAR(50),
    cuota_monto NUMERIC(15, 2)
);

-- --------------------------------------------
-- DIM_CUOTA_VENDEDOR
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS dim_cuota_vendedor (
    id SERIAL PRIMARY KEY,
    anno_mes VARCHAR(7) NOT NULL,
    vendedor VARCHAR(50) NOT NULL,
    retail VARCHAR(50) NOT NULL,
    clasificacion_2 VARCHAR(50) NOT NULL,
    cuota_monto NUMERIC(15, 2),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (anno_mes, vendedor, retail, clasificacion_2)
);

CREATE INDEX IF NOT EXISTS idx_dim_cuota_vendedor_lookup ON dim_cuota_vendedor (vendedor, retail, clasificacion_2, anno_mes);
