-- ============================================
-- 017: SURTIDO MANDATORIO - resumen GLOBAL (2 secciones distintas, confirmadas por el negocio)
--
-- El dashboard de referencia tiene DOS calculos globales sobre los MISMOS datos, con filosofias
-- de ponderacion distintas -- ninguno reemplaza al otro, ambos se muestran:
--
--   "Por Vendedor"  = promedio de promedios: cada vendedor pesa IGUAL sin importar su tamano de
--                      cartera. Denominador de Act.Promedio/Logro = clientes_activos (Efectividad
--                      >=3 unidades, igual que mv_surtido_mandatorio_resumen_vendedor).
--   "General"       = total/total: ponderado por volumen real, un vendedor con 400 clientes
--                      activos pesa mas que uno con 100. Denominador = total de clientes con
--                      >=1 posicion activa (cubiertos), NO clientes_activos.
--
-- TERCER conjunto de constantes por cluster (ademas de Base 12/19/23 y Colocaciones-por-cluster
-- 11/17/21, ya sembrados en la migracion 014): "meta conservadora" 10/14/17, usada SOLO en los
-- "Restan" de la seccion General (su Logro sigue usando Colocaciones-por-cluster 11/17/21).
-- Confirmado explicitamente por el negocio como intencional ("meta conservadora"), no un error
-- de captura ni los mismos pesos 10/14/18 que aparecian sueltos en el pseudocodigo original
-- (ver comentario de mv_surtido_mandatorio_resumen_vendedor en la migracion 014 -- ESE calculo
-- sigue usando colocaciones_meta, no se toca; esta constante nueva es exclusiva de las vistas
-- de esta migracion).
-- ============================================

ALTER TABLE dim_objetivo_surtido_mandatorio ADD COLUMN IF NOT EXISTS meta_conservadora_restan INT;
UPDATE dim_objetivo_surtido_mandatorio SET meta_conservadora_restan = CASE u_cluster
    WHEN 'BRONZE' THEN 10
    WHEN 'SILVER' THEN 14
    WHEN 'GOLD' THEN 17
END WHERE meta_conservadora_restan IS NULL;
ALTER TABLE dim_objetivo_surtido_mandatorio ALTER COLUMN meta_conservadora_restan SET NOT NULL;

-- --------------------------------------------
-- MV_SURTIDO_MANDATORIO_GLOBAL_POR_VENDEDOR
-- Una fila por bimestre. Promedia SIN PONDERAR (cada vendedor pesa igual) las columnas ya
-- calculadas en mv_surtido_mandatorio_resumen_vendedor.
--   act_promedio = AVG(total_activaciones) entre vendedores (AVG ignora NULLs -- un vendedor sin
--                  clientes activos ese bimestre simplemente no participa del promedio)
--   logro        = AVG(logro_porcentaje) entre vendedores (promedio de logros individuales, NO
--                  recalculado como act_promedio/objetivo_promedio -- son numeros cercanos pero
--                  no identicos, mean(a/b) != mean(a)/mean(b))
--   colocaciones = SUM(suma_activaciones) de TODOS los vendedores x cluster (total real de
--                  posiciones activas en toda la operacion, no un promedio)
--   restan_70/45 = (AVG(objetivo_promedio) * SUM(universo_total) * 0.7105 o 0.45) - colocaciones
--                  usa el objetivo "Base" (12/19/23, via objetivo_promedio de cada vendedor) y el
--                  universo TOTAL de la operacion, no una constante de esta migracion.
--   bronze/silver/gold_logro_pct = AVG, SOLO entre vendedores con universo>0 en ese cluster, de
--                  (promedio_activaciones_del_vendedor_en_ese_cluster / base_objetivo_del_cluster * 100)
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_surtido_mandatorio_global_por_vendedor CASCADE;
CREATE MATERIALIZED VIEW mv_surtido_mandatorio_global_por_vendedor AS
WITH logro_cluster_vendedor AS (
    SELECT
        cv.bimestre,
        cv.u_cluster,
        ROUND(cv.promedio_activaciones / NULLIF(dosm.base_objetivo, 0) * 100, 2) AS logro_vendedor_cluster
    FROM mv_surtido_mandatorio_cobertura_vendedor cv
    JOIN dim_objetivo_surtido_mandatorio dosm ON dosm.u_cluster = cv.u_cluster
    WHERE cv.universo > 0
),
cluster_prom AS (
    SELECT
        bimestre,
        AVG(logro_vendedor_cluster) FILTER (WHERE u_cluster = 'BRONZE') AS bronze_logro_pct,
        AVG(logro_vendedor_cluster) FILTER (WHERE u_cluster = 'SILVER') AS silver_logro_pct,
        AVG(logro_vendedor_cluster) FILTER (WHERE u_cluster = 'GOLD') AS gold_logro_pct
    FROM logro_cluster_vendedor
    GROUP BY bimestre
),
agregado AS (
    SELECT
        bimestre,
        AVG(total_activaciones) AS act_promedio,
        AVG(logro_porcentaje) AS logro,
        AVG(objetivo_promedio) AS objetivo_promedio_prom,
        SUM(universo_total) AS universo_operacion
    FROM mv_surtido_mandatorio_resumen_vendedor
    GROUP BY bimestre
),
colocaciones AS (
    SELECT bimestre, SUM(suma_activaciones) AS colocaciones
    FROM mv_surtido_mandatorio_cobertura_vendedor
    GROUP BY bimestre
)
SELECT
    ROW_NUMBER() OVER () AS id,
    a.bimestre,
    ROUND(a.act_promedio, 2) AS act_promedio,
    ROUND(a.logro, 2) AS logro,
    c.colocaciones,
    ROUND((a.objetivo_promedio_prom * a.universo_operacion * 0.7105) - c.colocaciones, 2) AS restan_70,
    ROUND((a.objetivo_promedio_prom * a.universo_operacion * 0.45) - c.colocaciones, 2) AS restan_45,
    ROUND(cp.bronze_logro_pct, 2) AS bronze_logro_pct,
    ROUND(cp.silver_logro_pct, 2) AS silver_logro_pct,
    ROUND(cp.gold_logro_pct, 2) AS gold_logro_pct
FROM agregado a
JOIN colocaciones c ON c.bimestre = a.bimestre
LEFT JOIN cluster_prom cp ON cp.bimestre = a.bimestre
ORDER BY a.bimestre DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_surtido_mand_glob_vend_id ON mv_surtido_mandatorio_global_por_vendedor (id);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_mand_glob_vend_bimestre ON mv_surtido_mandatorio_global_por_vendedor (bimestre);

-- --------------------------------------------
-- MV_SURTIDO_MANDATORIO_GLOBAL_GENERAL
-- Una fila por bimestre. Ponderado por volumen: suma TOTALES (no promedios de vendedor) y deriva
-- los porcentajes desde esas sumas.
--   total_activos     = SUM(cubiertos) de TODOS los vendedores x cluster (clientes con >=1
--                       posicion activa, NO clientes_activos -- denominador distinto al de
--                       "Por Vendedor", confirmado explicitamente por el negocio)
--   total_posiciones  = SUM(suma_activaciones) -- mismo total que "colocaciones" de la vista de
--                       arriba (aqui SIEMPRE coinciden: una sola fuente de verdad en esta app, a
--                       diferencia del Excel original donde salian de dos pivots que podian
--                       desalinearse)
--   act_promedio      = total_posiciones / total_activos
--   objetivo_ponderado = SUM(cubiertos_cluster * colocaciones_meta_cluster) / total_activos
--                       -- usa Colocaciones-por-cluster (11/17/21), NO Base (12/19/23)
--   logro             = act_promedio / objetivo_ponderado * 100
--   restan_80/70      = (SUM(cubiertos_cluster * meta_conservadora_restan_cluster) * 0.80 o 0.70)
--                       - total_posiciones -- usa la constante NUEVA de esta migracion (10/14/17)
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_surtido_mandatorio_global_general CASCADE;
CREATE MATERIALIZED VIEW mv_surtido_mandatorio_global_general AS
WITH por_cluster AS (
    SELECT
        cv.bimestre,
        cv.u_cluster,
        SUM(cv.cubiertos) AS activos_cluster,
        SUM(cv.suma_activaciones) AS posiciones_cluster,
        dosm.colocaciones_meta,
        dosm.meta_conservadora_restan
    FROM mv_surtido_mandatorio_cobertura_vendedor cv
    JOIN dim_objetivo_surtido_mandatorio dosm ON dosm.u_cluster = cv.u_cluster
    GROUP BY cv.bimestre, cv.u_cluster, dosm.colocaciones_meta, dosm.meta_conservadora_restan
),
agregado AS (
    SELECT
        bimestre,
        SUM(activos_cluster) AS total_activos,
        SUM(posiciones_cluster) AS total_posiciones,
        SUM(activos_cluster * colocaciones_meta)::NUMERIC AS suma_ponderada_colocaciones_meta,
        SUM(activos_cluster * meta_conservadora_restan) AS meta_conservadora_base
    FROM por_cluster
    GROUP BY bimestre
)
SELECT
    ROW_NUMBER() OVER () AS id,
    bimestre,
    total_activos,
    total_posiciones,
    ROUND(total_posiciones::NUMERIC / NULLIF(total_activos, 0), 2) AS act_promedio,
    ROUND(suma_ponderada_colocaciones_meta / NULLIF(total_activos, 0), 2) AS objetivo_ponderado,
    ROUND(
        (total_posiciones::NUMERIC / NULLIF(total_activos, 0))
        / NULLIF(suma_ponderada_colocaciones_meta / NULLIF(total_activos, 0), 0) * 100,
        2
    ) AS logro,
    ROUND((meta_conservadora_base * 0.80) - total_posiciones, 2) AS restan_80,
    ROUND((meta_conservadora_base * 0.70) - total_posiciones, 2) AS restan_70
FROM agregado
ORDER BY bimestre DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_surtido_mand_glob_gral_id ON mv_surtido_mandatorio_global_general (id);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_mand_glob_gral_bimestre ON mv_surtido_mandatorio_global_general (bimestre);
