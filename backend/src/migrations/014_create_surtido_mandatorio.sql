-- ============================================
-- 014: SURTIDO MANDATORIO (modulo nuevo, separado del Surtido existente)
--
-- Reutiliza fact_ventas (ya trae u_surtido_n/u_cluster desnormalizados) y dim_clientes -- no se
-- agrega ningun sync nuevo contra el ERP ni tabla de hechos propia. No toca dim_surtido_obligatorio
-- ni mv_surtido_por_cliente/vendedor/cluster (modulo de Surtido existente, sin relacion).
--
-- Objetivos por cluster confirmados con el negocio (dos numeros INDEPENDIENTES, no derivados de
-- contar filas de dim_surtido_mandatorio_posicion):
--   base_objetivo       = meta de posiciones por cliente, usada en "Logro"        (12/19/23)
--   colocaciones_meta   = meta operativa de posiciones activas de un cliente ideal (11/17/21)
-- ============================================

CREATE TABLE IF NOT EXISTS dim_surtido_mandatorio_posicion (
    id SERIAL PRIMARY KEY,
    posicion_surtido INT NOT NULL,
    u_cluster VARCHAR(20) NOT NULL,
    es_obligatorio BOOLEAN NOT NULL DEFAULT TRUE,

    UNIQUE (posicion_surtido, u_cluster)
);
-- No se siembra (igual que dim_dia_no_laborable): que posiciones son obligatorias por cluster es
-- una curaduria de negocio que el admin carga desde Parametros, no algo que debamos inventar.
-- Hasta que se cargue, "posiciones_activas" en las vistas de abajo sera 0 para todos.

CREATE TABLE IF NOT EXISTS dim_objetivo_surtido_mandatorio (
    u_cluster VARCHAR(20) PRIMARY KEY,
    base_objetivo INT NOT NULL,
    colocaciones_meta INT NOT NULL
);
INSERT INTO dim_objetivo_surtido_mandatorio (u_cluster, base_objetivo, colocaciones_meta) VALUES
    ('BRONZE', 12, 11),
    ('SILVER', 19, 17),
    ('GOLD', 23, 21)
ON CONFLICT (u_cluster) DO NOTHING;

-- Fila unica, editable desde Parametros. "Cliente activo" es independiente del surtido: cuenta
-- TODAS sus unidades compradas ese mes, sin filtrar por posicion obligatoria.
CREATE TABLE IF NOT EXISTS dim_config_surtido_mandatorio (
    id INT PRIMARY KEY DEFAULT 1,
    cliente_activo_minimo INT NOT NULL DEFAULT 3,

    CHECK (id = 1)
);
INSERT INTO dim_config_surtido_mandatorio (id, cliente_activo_minimo) VALUES (1, 3)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------
-- MV_SURTIDO_MANDATORIO_CLIENTE
-- Por (cliente, mes calendario): cuantas posiciones obligatorias de SU cluster tuvo con cantidad
-- neta >= 1 ("posicion activa", igual umbral que ya usa mv_surtido_por_cliente), y si el cliente
-- es "activo" (SUM de TODAS sus unidades ese mes >= dim_config_surtido_mandatorio.cliente_activo_minimo,
-- sin filtrar por posicion -- son dos preguntas independientes).
-- "posiciones_obligatorias" sale de dim_objetivo_surtido_mandatorio.base_objetivo (constante de
-- negocio), NO de contar filas de dim_surtido_mandatorio_posicion.
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_surtido_mandatorio_cliente CASCADE;
CREATE MATERIALIZED VIEW mv_surtido_mandatorio_cliente AS
WITH meses_objetivo AS (
    SELECT DISTINCT anno_mes FROM dim_objetivos_distribucion WHERE activo = TRUE
),
clientes_base AS (
    SELECT dc.id_cliente, dc.codigo_cliente, dc.u_cluster, dc.vendedor_asignado
    FROM dim_clientes dc
    WHERE dc.estado = 'Activo'
),
posiciones_netas AS (
    SELECT
        mo.anno_mes,
        fv.id_cliente,
        fv.u_surtido_n,
        SUM(fv.cantidad) AS cantidad_neta
    FROM meses_objetivo mo
    JOIN fact_ventas fv
        ON fv.id_fecha >= TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD')
       AND fv.id_fecha <= LEAST(
             (TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date,
             fecha_referencia_ventas()
           )
    JOIN dim_surtido_mandatorio_posicion dsmp
        ON dsmp.u_cluster = fv.u_cluster
       AND dsmp.posicion_surtido = fv.u_surtido_n
       AND dsmp.es_obligatorio = TRUE
    GROUP BY mo.anno_mes, fv.id_cliente, fv.u_surtido_n
),
posiciones_activas_cliente AS (
    SELECT anno_mes, id_cliente, COUNT(*) AS cant_posiciones_activas
    FROM posiciones_netas
    WHERE cantidad_neta >= 1
    GROUP BY anno_mes, id_cliente
),
total_neto_cliente AS (
    SELECT
        mo.anno_mes,
        fv.id_cliente,
        SUM(fv.cantidad) AS cantidad_total
    FROM meses_objetivo mo
    JOIN fact_ventas fv
        ON fv.id_fecha >= TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD')
       AND fv.id_fecha <= LEAST(
             (TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date,
             fecha_referencia_ventas()
           )
    GROUP BY mo.anno_mes, fv.id_cliente
)
SELECT
    ROW_NUMBER() OVER () AS id,
    mo.anno_mes,
    cb.id_cliente,
    cb.codigo_cliente,
    cb.u_cluster,
    cb.vendedor_asignado AS vendedor,
    COALESCE(pac.cant_posiciones_activas, 0) AS posiciones_activas,
    dosm.base_objetivo AS posiciones_obligatorias,
    (COALESCE(tnc.cantidad_total, 0) >= dcsm.cliente_activo_minimo) AS cliente_activo
FROM meses_objetivo mo
CROSS JOIN clientes_base cb
LEFT JOIN posiciones_activas_cliente pac ON pac.id_cliente = cb.id_cliente AND pac.anno_mes = mo.anno_mes
LEFT JOIN total_neto_cliente tnc ON tnc.id_cliente = cb.id_cliente AND tnc.anno_mes = mo.anno_mes
JOIN dim_objetivo_surtido_mandatorio dosm ON dosm.u_cluster = cb.u_cluster
CROSS JOIN dim_config_surtido_mandatorio dcsm
ORDER BY mo.anno_mes DESC, cb.u_cluster, cb.id_cliente;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_surtido_mand_cliente_id ON mv_surtido_mandatorio_cliente (id);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_mand_cliente_lookup ON mv_surtido_mandatorio_cliente (id_cliente, anno_mes);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_mand_cliente_vendedor ON mv_surtido_mandatorio_cliente (vendedor, u_cluster, anno_mes);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_mand_cliente_mes ON mv_surtido_mandatorio_cliente (anno_mes);

-- --------------------------------------------
-- MV_SURTIDO_MANDATORIO_COBERTURA_VENDEDOR
-- Agrega la vista anterior por (vendedor, cluster, mes): universo (todos los clientes del
-- vendedor en ese cluster), cubiertos (con >=1 posicion activa), promedio de posiciones activas
-- SOBRE EL UNIVERSO completo (no solo los cubiertos -- un cliente con 0 posiciones SI cuenta en
-- el promedio, pseudocodigo de referencia 3.2), y clientes_activos (para el denominador de
-- "Total Activaciones" del resumen, ver vista siguiente).
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_surtido_mandatorio_cobertura_vendedor CASCADE;
CREATE MATERIALIZED VIEW mv_surtido_mandatorio_cobertura_vendedor AS
WITH vendedores_activos AS (
    SELECT codigo_vendedor, MAX(nombre_vendedor) AS nombre_vendedor
    FROM dim_vendedor
    WHERE estado = 'Activo'
    GROUP BY codigo_vendedor
)
SELECT
    ROW_NUMBER() OVER () AS id,
    smc.anno_mes,
    smc.vendedor,
    va.nombre_vendedor,
    smc.u_cluster,
    COUNT(*) AS universo,
    COUNT(*) FILTER (WHERE smc.posiciones_activas >= 1) AS cubiertos,
    ROUND(AVG(smc.posiciones_activas), 2) AS promedio_activaciones,
    SUM(smc.posiciones_activas) AS suma_activaciones,
    COUNT(*) FILTER (WHERE smc.cliente_activo) AS clientes_activos
FROM mv_surtido_mandatorio_cliente smc
JOIN vendedores_activos va ON va.codigo_vendedor = smc.vendedor
WHERE smc.vendedor IS NOT NULL
GROUP BY smc.anno_mes, smc.vendedor, va.nombre_vendedor, smc.u_cluster
ORDER BY smc.anno_mes DESC, smc.vendedor, smc.u_cluster;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_surtido_mand_cobertura_id ON mv_surtido_mandatorio_cobertura_vendedor (id);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_mand_cobertura_lookup ON mv_surtido_mandatorio_cobertura_vendedor (vendedor, u_cluster, anno_mes);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_mand_cobertura_mes ON mv_surtido_mandatorio_cobertura_vendedor (anno_mes);

-- --------------------------------------------
-- MV_SURTIDO_MANDATORIO_RESUMEN_VENDEDOR
-- Agrega la cobertura de los 3 clusters por vendedor. Formulas (pseudocodigo de referencia,
-- adaptadas a mes calendario en vez de bimestre, y con colocaciones_meta -- no los pesos sueltos
-- 10/14/18 del pseudocodigo original 3.8, que no coinciden con la tabla de objetivos 2.2):
--   objetivo_promedio    = promedio de base_objetivo PONDERADO por universo de cada cluster
--                          (equivale a AVG(base_objetivo) sobre cada cliente individual)
--   total_activaciones   = SUM(posiciones activas de los 3 clusters) / clientes_activos (total)
--   logro_porcentaje     = total_activaciones / objetivo_promedio * 100
--   logro_a_la_fecha     = SUM(cubiertos de los 3 clusters) / SUM(universo de los 3 clusters) * 100
--   proyeccion_diaria    = (objetivo_promedio * dias_laborables_mes - total_activaciones)
--                          * cubiertos_total / (dias_laborables_mes - dias_transcurridos)
--   proyeccion_98        = (SUM(universo_cluster * colocaciones_meta_cluster * 0.98) * dias_laborables_mes
--                          - SUM(promedio_activaciones_cluster * cubiertos_cluster))
--                          / (dias_laborables_mes - dias_transcurridos)
-- Todas las divisiones usan NULLIF para no reventar si un vendedor no tiene clientes activos ese
-- mes (edge case explicito de referencia: "vendedor_sin_clientes" / "vendedor sin clientes activos").
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_surtido_mandatorio_resumen_vendedor CASCADE;
CREATE MATERIALIZED VIEW mv_surtido_mandatorio_resumen_vendedor AS
WITH por_cluster AS (
    SELECT
        cv.anno_mes,
        cv.vendedor,
        cv.nombre_vendedor,
        cv.universo,
        cv.cubiertos,
        cv.promedio_activaciones,
        cv.suma_activaciones,
        cv.clientes_activos,
        dosm.base_objetivo,
        dosm.colocaciones_meta
    FROM mv_surtido_mandatorio_cobertura_vendedor cv
    JOIN dim_objetivo_surtido_mandatorio dosm ON dosm.u_cluster = cv.u_cluster
),
agregado AS (
    SELECT
        anno_mes,
        vendedor,
        MAX(nombre_vendedor) AS nombre_vendedor,
        SUM(universo) AS universo_total,
        SUM(cubiertos) AS cubiertos_total,
        SUM(suma_activaciones) AS suma_activaciones_total,
        SUM(clientes_activos) AS clientes_activos_total,
        SUM(universo * base_objetivo)::NUMERIC / NULLIF(SUM(universo), 0) AS objetivo_promedio,
        SUM(universo * colocaciones_meta * 0.98) AS meta_colocaciones_ponderada,
        SUM(promedio_activaciones * cubiertos) AS actual_ponderado
    FROM por_cluster
    GROUP BY anno_mes, vendedor
)
SELECT
    ROW_NUMBER() OVER () AS id,
    a.anno_mes,
    a.vendedor,
    a.nombre_vendedor,
    a.universo_total,
    a.cubiertos_total,
    ROUND(a.objetivo_promedio, 2) AS objetivo_promedio,
    ROUND(a.suma_activaciones_total::NUMERIC / NULLIF(a.clientes_activos_total, 0), 2) AS total_activaciones,
    ROUND(
        (a.suma_activaciones_total::NUMERIC / NULLIF(a.clientes_activos_total, 0))
        / NULLIF(a.objetivo_promedio, 0) * 100,
        2
    ) AS logro_porcentaje,
    ROUND(a.cubiertos_total::NUMERIC / NULLIF(a.universo_total, 0) * 100, 2) AS logro_a_la_fecha_porcentaje,
    dias_laborables_mes(a.anno_mes) AS dias_laborables_mes,
    dias_laborables_transcurridos(a.anno_mes) AS dias_transcurridos,
    ROUND(
        (
            (a.objetivo_promedio * dias_laborables_mes(a.anno_mes))
            - (a.suma_activaciones_total::NUMERIC / NULLIF(a.clientes_activos_total, 0))
        ) * a.cubiertos_total
        / NULLIF(dias_laborables_mes(a.anno_mes) - dias_laborables_transcurridos(a.anno_mes), 0),
        2
    ) AS proyeccion_diaria,
    ROUND(
        (
            (a.meta_colocaciones_ponderada * dias_laborables_mes(a.anno_mes)) - a.actual_ponderado
        ) / NULLIF(dias_laborables_mes(a.anno_mes) - dias_laborables_transcurridos(a.anno_mes), 0),
        2
    ) AS proyeccion_98
FROM agregado a
ORDER BY a.anno_mes DESC, a.vendedor;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_surtido_mand_resumen_id ON mv_surtido_mandatorio_resumen_vendedor (id);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_mand_resumen_lookup ON mv_surtido_mandatorio_resumen_vendedor (vendedor, anno_mes);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_mand_resumen_mes ON mv_surtido_mandatorio_resumen_vendedor (anno_mes);
