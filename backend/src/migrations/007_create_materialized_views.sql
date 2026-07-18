-- ============================================
-- 007: VISTAS MATERIALIZADAS (KPIs precalculados)
-- ============================================

-- FECHA_REFERENCIA_VENTAS se define en la migracion 006 (dim_dia_no_laborable la necesita
-- antes que esta migracion corra).

-- --------------------------------------------
-- MV_DISTRIBUCION_POR_RETAIL
-- Formula oficial (ver docs/ESPECIFICACION_FINAL_DISTRIBUCION_KPI.md):
--   distribucion_porcentaje = clientes que compraron la subcategoria / universo (dim_universo_cliente)
--   logro_porcentaje        = clientes que compraron la subcategoria / objetivo_clientes (dim_objetivos_distribucion)
--   objetivo_porcentaje     = objetivo_clientes / universo (que % del universo deberia comprar)
-- El universo y el objetivo son oficiales del ERP (mensuales), no se calculan localmente.
--
-- Ventana de compra = MES CALENDARIO de anno_mes (no "ultimos 30 dias"), acotada a
-- fecha_referencia_ventas() cuando el mes es el mas reciente/incompleto. Se calcula para
-- TODOS los meses presentes en dim_objetivos_distribucion (no solo el mas reciente), para
-- poder filtrar por mes desde la API/frontend.
--
-- "Compraron" = cantidad NETA (ventas - devoluciones, ver fact_ventas/QUERY_FACTURA_LINEAS donde
-- una devolucion ya viene con cantidad en negativo) >= el minimo de unidades que exige
-- dim_criterios_distribucion para ese retail (formula real del negocio: COUNTIFS(CANTIDAD,">=3",...)
-- sobre la cantidad NETA de unidades por cliente+subcategoria, no sobre cantidad de transacciones).
--
-- Solo se incluyen subcategorias con dim_objetivos_distribucion.activo = TRUE (lista curada por
-- el negocio, ver migracion 003).
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_distribucion_por_retail CASCADE;
CREATE MATERIALIZED VIEW mv_distribucion_por_retail AS
WITH meses_objetivo AS (
    SELECT DISTINCT anno_mes FROM dim_objetivos_distribucion WHERE activo = TRUE
),
compras_por_cliente AS (
    SELECT
        mo.anno_mes,
        fv.id_cliente,
        fv.retail,
        da.clasificacion_2,
        SUM(fv.cantidad) AS cantidad_neta
    FROM meses_objetivo mo
    JOIN fact_ventas fv
        ON fv.id_fecha >= TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD')
       AND fv.id_fecha <= LEAST(
             (TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date,
             fecha_referencia_ventas()
           )
    JOIN dim_articulos da ON fv.id_articulo = da.id_articulo
    WHERE fv.clasificacion_2 IS NOT NULL
    GROUP BY mo.anno_mes, fv.id_cliente, fv.retail, da.clasificacion_2
),
clientes_compra_subcategoria AS (
    SELECT cpc.anno_mes, cpc.retail, cpc.clasificacion_2, COUNT(DISTINCT cpc.id_cliente) AS clientes_que_compraron
    FROM compras_por_cliente cpc
    JOIN dim_criterios_distribucion dcd ON cpc.retail = dcd.retail
    WHERE cpc.cantidad_neta >= dcd.minimo_compras
    GROUP BY cpc.anno_mes, cpc.retail, cpc.clasificacion_2
)
SELECT
    ROW_NUMBER() OVER () AS id,
    od.retail,
    od.clasificacion_2 AS subcategoria,
    duc.universo AS total_clientes,
    COALESCE(ccs.clientes_que_compraron, 0) AS resultado,
    ROUND((COALESCE(ccs.clientes_que_compraron, 0)::NUMERIC / NULLIF(duc.universo, 0)) * 100, 2) AS distribucion_porcentaje,
    od.objetivo_clientes,
    ROUND((COALESCE(ccs.clientes_que_compraron, 0)::NUMERIC / NULLIF(od.objetivo_clientes, 0)) * 100, 2) AS logro_porcentaje,
    ROUND((od.objetivo_clientes::NUMERIC / NULLIF(duc.universo, 0)) * 100, 2) AS objetivo_porcentaje,
    (od.objetivo_clientes - COALESCE(ccs.clientes_que_compraron, 0)) AS restan,
    od.objetivo_monto,
    od.anno_mes
FROM dim_objetivos_distribucion od
LEFT JOIN clientes_compra_subcategoria ccs
    ON od.retail = ccs.retail AND od.clasificacion_2 = ccs.clasificacion_2 AND od.anno_mes = ccs.anno_mes
LEFT JOIN dim_universo_cliente duc
    ON od.retail = duc.retail AND duc.anno_mes = od.anno_mes
WHERE od.activo = TRUE
ORDER BY od.anno_mes DESC, od.retail, od.clasificacion_2;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_distribucion_retail_id ON mv_distribucion_por_retail (id);
CREATE INDEX IF NOT EXISTS idx_mv_distribucion_retail_lookup ON mv_distribucion_por_retail (retail, subcategoria);
CREATE INDEX IF NOT EXISTS idx_mv_distribucion_retail_mes ON mv_distribucion_por_retail (anno_mes);

-- --------------------------------------------
-- MV_DISTRIBUCION_POR_CLUSTER
-- El ERP no provee universo/objetivo por CLUSTER (solo por RETAIL), asi que "total_clientes"
-- sigue siendo el conteo real de dim_clientes por cluster. Pero "compraron" ahora usa EXACTAMENTE
-- la misma logica que Retail/Vendedor: mes calendario (con selector de mes), cantidad NETA de
-- unidades (ventas - devoluciones) >= minimo_compras de dim_criterios_distribucion, y solo
-- subcategorias activas (dim_subcategoria_config) — antes mostraba TODAS las subcategorias y
-- usaba ventana rodante de 30 dias con conteo de lineas, inconsistente con el resto de la app.
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_distribucion_por_cluster CASCADE;
CREATE MATERIALIZED VIEW mv_distribucion_por_cluster AS
WITH meses_objetivo AS (
    SELECT DISTINCT anno_mes FROM dim_objetivos_distribucion WHERE activo = TRUE
),
clientes_por_cluster AS (
    SELECT u_cluster, COUNT(DISTINCT id_cliente) AS total_clientes
    FROM dim_clientes
    WHERE estado = 'Activo'
    GROUP BY u_cluster
),
compras_por_cliente AS (
    SELECT
        mo.anno_mes,
        fv.u_cluster,
        da.clasificacion_2 AS subcategoria,
        fv.id_cliente,
        fv.retail,
        SUM(fv.cantidad) AS cantidad_neta
    FROM meses_objetivo mo
    JOIN fact_ventas fv
        ON fv.id_fecha >= TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD')
       AND fv.id_fecha <= LEAST(
             (TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date,
             fecha_referencia_ventas()
           )
    JOIN dim_articulos da ON fv.id_articulo = da.id_articulo
    WHERE fv.clasificacion_2 IS NOT NULL
    GROUP BY mo.anno_mes, fv.u_cluster, da.clasificacion_2, fv.id_cliente, fv.retail
),
clientes_que_cumplen_umbral AS (
    SELECT
        cpc.anno_mes,
        cpc.u_cluster,
        cpc.subcategoria,
        COUNT(DISTINCT cpc.id_cliente) AS clientes_que_compraron
    FROM compras_por_cliente cpc
    JOIN dim_criterios_distribucion dcd ON cpc.retail = dcd.retail
    WHERE cpc.cantidad_neta >= dcd.minimo_compras
    GROUP BY cpc.anno_mes, cpc.u_cluster, cpc.subcategoria
)
SELECT
    ROW_NUMBER() OVER () AS id,
    cpc.u_cluster,
    subcat.subcategoria,
    cpc.total_clientes,
    COALESCE(ccq.clientes_que_compraron, 0) AS resultado,
    ROUND((COALESCE(ccq.clientes_que_compraron, 0)::NUMERIC / NULLIF(cpc.total_clientes, 0)) * 100, 2) AS distribucion_porcentaje,
    mo.anno_mes
FROM meses_objetivo mo
CROSS JOIN clientes_por_cluster cpc
CROSS JOIN (SELECT clasificacion_2 AS subcategoria FROM dim_subcategoria_config WHERE activo = TRUE) subcat
LEFT JOIN clientes_que_cumplen_umbral ccq
    ON cpc.u_cluster = ccq.u_cluster AND subcat.subcategoria = ccq.subcategoria AND mo.anno_mes = ccq.anno_mes
ORDER BY mo.anno_mes DESC, cpc.u_cluster, subcat.subcategoria;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_distribucion_cluster_id ON mv_distribucion_por_cluster (id);
CREATE INDEX IF NOT EXISTS idx_mv_distribucion_cluster_lookup ON mv_distribucion_por_cluster (u_cluster, subcategoria);
CREATE INDEX IF NOT EXISTS idx_mv_distribucion_cluster_mes ON mv_distribucion_por_cluster (anno_mes);

-- --------------------------------------------
-- MV_DISTRIBUCION_POR_VENDEDOR
-- La "cuota" de un vendedor para una subcategoria se prorratea segun su cartera real:
--   objetivo_porcentaje = objetivo_clientes / universo del retail       (% que debe comprar)
--   cuota                = cantidad_cliente_del_vendedor * objetivo_porcentaje
--   logro_porcentaje     = clientes del vendedor que compraron / cuota
-- distribucion_porcentaje sigue siendo contra la cartera propia del vendedor (no la cuota).
-- obj2 (objetivo completo del retail) se conserva solo como referencia.
--
-- Igual que en mv_distribucion_por_retail: se calcula para TODOS los meses disponibles
-- (con ventana de compra = mes calendario), solo subcategorias activas, y "compraron" = cantidad
-- NETA de unidades (ventas - devoluciones) >= el minimo de dim_criterios_distribucion.
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_distribucion_por_vendedor CASCADE;
CREATE MATERIALIZED VIEW mv_distribucion_por_vendedor AS
WITH meses_objetivo AS (
    SELECT DISTINCT anno_mes FROM dim_objetivos_distribucion WHERE activo = TRUE
),
compras_por_cliente AS (
    SELECT
        mo.anno_mes,
        fv.id_cliente,
        fv.vendedor,
        fv.retail,
        da.clasificacion_2,
        SUM(fv.cantidad) AS cantidad_neta
    FROM meses_objetivo mo
    JOIN fact_ventas fv
        ON fv.id_fecha >= TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD')
       AND fv.id_fecha <= LEAST(
             (TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date,
             fecha_referencia_ventas()
           )
    JOIN dim_articulos da ON fv.id_articulo = da.id_articulo
    WHERE fv.clasificacion_2 IS NOT NULL
    GROUP BY mo.anno_mes, fv.id_cliente, fv.vendedor, fv.retail, da.clasificacion_2
),
clientes_compra_subcategoria AS (
    SELECT cpc.anno_mes, cpc.vendedor, cpc.retail, cpc.clasificacion_2, COUNT(DISTINCT cpc.id_cliente) AS clientes_que_compraron
    FROM compras_por_cliente cpc
    JOIN dim_criterios_distribucion dcd ON cpc.retail = dcd.retail
    WHERE cpc.cantidad_neta >= dcd.minimo_compras
    GROUP BY cpc.anno_mes, cpc.vendedor, cpc.retail, cpc.clasificacion_2
),
objetivo_pct AS (
    SELECT
        od.anno_mes,
        od.retail,
        od.clasificacion_2,
        od.objetivo_clientes,
        od.objetivo_monto,
        duc.universo,
        (od.objetivo_clientes::NUMERIC / NULLIF(duc.universo, 0)) * 100 AS objetivo_porcentaje
    FROM dim_objetivos_distribucion od
    LEFT JOIN dim_universo_cliente duc ON od.retail = duc.retail AND duc.anno_mes = od.anno_mes
    WHERE od.activo = TRUE
)
SELECT
    ROW_NUMBER() OVER () AS id,
    dv.codigo_vendedor AS vendedor,
    dv.nombre_vendedor,
    dv.retail_asignado AS retail,
    op.clasificacion_2 AS subcategoria,
    dv.cantidad_cliente AS total_clientes_vendedor,
    COALESCE(ccq.clientes_que_compraron, 0) AS resultado,
    op.objetivo_clientes AS obj2,
    ROUND(op.objetivo_porcentaje, 2) AS objetivo_porcentaje,
    ROUND(dv.cantidad_cliente * op.objetivo_porcentaje / 100, 2) AS cuota,
    ROUND(
        (COALESCE(ccq.clientes_que_compraron, 0)::NUMERIC / NULLIF(dv.cantidad_cliente * op.objetivo_porcentaje / 100, 0)) * 100, 2
    ) AS logro_porcentaje,
    ROUND((COALESCE(ccq.clientes_que_compraron, 0)::NUMERIC / NULLIF(dv.cantidad_cliente, 0)) * 100, 2) AS distribucion_porcentaje,
    (ROUND(dv.cantidad_cliente * op.objetivo_porcentaje / 100, 2) - COALESCE(ccq.clientes_que_compraron, 0)) AS restan,
    op.objetivo_monto,
    op.anno_mes
FROM dim_vendedor dv
JOIN objetivo_pct op ON dv.retail_asignado = op.retail
LEFT JOIN clientes_compra_subcategoria ccq
    ON dv.codigo_vendedor = ccq.vendedor
    AND dv.retail_asignado = ccq.retail
    AND op.clasificacion_2 = ccq.clasificacion_2
    AND op.anno_mes = ccq.anno_mes
WHERE dv.estado = 'Activo'
ORDER BY op.anno_mes DESC, dv.codigo_vendedor, op.clasificacion_2;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_distribucion_vendedor_id ON mv_distribucion_por_vendedor (id);
CREATE INDEX IF NOT EXISTS idx_mv_distribucion_vendedor_lookup ON mv_distribucion_por_vendedor (vendedor, subcategoria);
CREATE INDEX IF NOT EXISTS idx_mv_distribucion_vendedor_mes ON mv_distribucion_por_vendedor (anno_mes);

-- --------------------------------------------
-- MV_VENTAS_POR_VENDEDOR
-- Vista separada de mv_distribucion_por_vendedor a pedido del negocio: mezclar cantidad-de-
-- clientes con $ en la misma tabla generaba confusion. Aqui todo es en pesos, agregado a nivel
-- (vendedor, retail, mes) sumando TODAS las subcategorias de dim_cuota_vendedor (dbo.cuota trae
-- cuota para subcategorias inactivas tambien; la "Cuota mes" del reporte real del negocio es un
-- total, no solo de las 7 subcategorias activas de Distribucion).
--   venta_neta       = SUM(fact_ventas.monto), ya neteada (ventas - devoluciones)
--   venta_bruta       = SUM(monto) solo de lineas de venta reales (cantidad > 0), antes de
--                        restar devoluciones
--   pct_devolucion    = (venta_bruta - venta_neta) / venta_bruta
--   dropsize          = venta_neta / facturas (ticket promedio $ del vendedor)
--   dias_laborables_mes / dias_transcurridos = funciones de la migracion 006 (excluyen fines de
--                        semana y los feriados curados en dim_dia_no_laborable)
--   proyeccion        = venta_neta / dias_transcurridos * dias_laborables_mes
--   diario            = cuanto le falta vender por CADA DIA HABIL restante para llegar a la
--                        cuota; NULL si ya la alcanzo (igual al "-" del reporte de referencia)
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_ventas_por_vendedor CASCADE;
CREATE MATERIALIZED VIEW mv_ventas_por_vendedor AS
WITH meses_cuota AS (
    SELECT DISTINCT anno_mes FROM dim_cuota_vendedor
),
cuota_total AS (
    SELECT anno_mes, vendedor, retail, SUM(cuota_monto) AS cuota_monto
    FROM dim_cuota_vendedor
    GROUP BY anno_mes, vendedor, retail
),
ventas_total AS (
    SELECT
        mc.anno_mes,
        fv.vendedor,
        fv.retail,
        SUM(fv.monto) AS venta_neta,
        SUM(CASE WHEN fv.cantidad > 0 THEN fv.monto ELSE 0 END) AS venta_bruta,
        COUNT(DISTINCT fv.id_factura) AS facturas
    FROM meses_cuota mc
    JOIN fact_ventas fv
        ON fv.id_fecha >= TO_DATE(mc.anno_mes || '-01', 'YYYY-MM-DD')
       AND fv.id_fecha <= LEAST(
             (TO_DATE(mc.anno_mes || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date,
             fecha_referencia_ventas()
           )
    GROUP BY mc.anno_mes, fv.vendedor, fv.retail
)
SELECT
    ROW_NUMBER() OVER () AS id,
    ct.anno_mes,
    dv.codigo_vendedor AS vendedor,
    dv.nombre_vendedor,
    dv.vendedor_supervisor AS supervisor,
    ct.retail,
    ct.cuota_monto,
    COALESCE(vt.venta_neta, 0) AS venta_neta,
    COALESCE(vt.venta_bruta, 0) AS venta_bruta,
    COALESCE(vt.facturas, 0) AS facturas,
    ROUND(COALESCE(vt.venta_neta, 0) / NULLIF(vt.facturas, 0), 2) AS dropsize,
    ROUND(((COALESCE(vt.venta_bruta, 0) - COALESCE(vt.venta_neta, 0)) / NULLIF(vt.venta_bruta, 0)) * 100, 2) AS pct_devolucion,
    ROUND((COALESCE(vt.venta_neta, 0) / NULLIF(ct.cuota_monto, 0)) * 100, 2) AS alcance_porcentaje,
    (ct.cuota_monto - COALESCE(vt.venta_neta, 0)) AS falta,
    dias_laborables_mes(ct.anno_mes) AS dias_laborables_mes,
    dias_laborables_transcurridos(ct.anno_mes) AS dias_transcurridos,
    ROUND(
        COALESCE(vt.venta_neta, 0) / NULLIF(dias_laborables_transcurridos(ct.anno_mes), 0) * dias_laborables_mes(ct.anno_mes), 2
    ) AS proyeccion,
    ROUND(
        (COALESCE(vt.venta_neta, 0) / NULLIF(dias_laborables_transcurridos(ct.anno_mes), 0) * dias_laborables_mes(ct.anno_mes))
        / NULLIF(ct.cuota_monto, 0) * 100, 2
    ) AS alcance_proyeccion_porcentaje,
    CASE
        WHEN (ct.cuota_monto - COALESCE(vt.venta_neta, 0)) > 0
        THEN ROUND(
            (ct.cuota_monto - COALESCE(vt.venta_neta, 0))
            / NULLIF(dias_laborables_mes(ct.anno_mes) - dias_laborables_transcurridos(ct.anno_mes), 0), 2
        )
    END AS diario
FROM cuota_total ct
JOIN dim_vendedor dv ON dv.codigo_vendedor = ct.vendedor AND dv.retail_asignado = ct.retail
LEFT JOIN ventas_total vt ON vt.anno_mes = ct.anno_mes AND vt.vendedor = ct.vendedor AND vt.retail = ct.retail
WHERE dv.estado = 'Activo'
ORDER BY ct.anno_mes DESC, dv.codigo_vendedor;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ventas_vendedor_id ON mv_ventas_por_vendedor (id);
CREATE INDEX IF NOT EXISTS idx_mv_ventas_vendedor_lookup ON mv_ventas_por_vendedor (vendedor, retail, anno_mes);
CREATE INDEX IF NOT EXISTS idx_mv_ventas_vendedor_supervisor ON mv_ventas_por_vendedor (supervisor);
CREATE INDEX IF NOT EXISTS idx_mv_ventas_vendedor_mes ON mv_ventas_por_vendedor (anno_mes);

-- --------------------------------------------
-- MV_SURTIDO_POR_CLIENTE
-- "subcategorias_compradas" solo cuenta grupos OBLIGATORIOS para el cluster del cliente, con
-- cantidad NETA positiva (ventas - devoluciones) en el MES CALENDARIO (mismo patron que
-- Distribucion: antes usaba una ventana rodante de 30 dias, inconsistente con el resto de la
-- app). Sin el filtro de obligatorios, comprar un grupo no-obligatorio (o el grupo "0" = sin
-- U_SURTIDO_N) inflaria el surtido por encima de 100%. Se calcula para todos los meses
-- disponibles, filtrable por mes igual que las vistas de Distribucion.
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_surtido_por_cliente CASCADE;
CREATE MATERIALIZED VIEW mv_surtido_por_cliente AS
WITH meses_objetivo AS (
    SELECT DISTINCT anno_mes FROM dim_objetivos_distribucion WHERE activo = TRUE
),
subcategorias_obligatorias_cliente AS (
    SELECT
        dc.id_cliente,
        dc.codigo_cliente,
        dc.nombre_cliente,
        dc.retail,
        dc.u_cluster,
        dc.vendedor_asignado
    FROM dim_clientes dc
    WHERE dc.estado = 'Activo'
),
compras_netas_grupo AS (
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
    JOIN dim_surtido_obligatorio dso
        ON dso.u_cluster = fv.u_cluster
        AND dso.u_surtido_n = fv.u_surtido_n
        AND dso.es_obligatorio = TRUE
    GROUP BY mo.anno_mes, fv.id_cliente, fv.u_surtido_n
),
subcategorias_compradas AS (
    SELECT anno_mes, id_cliente, COUNT(*) AS cant_subcategorias_compradas
    FROM compras_netas_grupo
    WHERE cantidad_neta > 0
    GROUP BY anno_mes, id_cliente
),
total_obligatorio_por_cluster AS (
    SELECT u_cluster, COUNT(DISTINCT u_surtido_n) AS cant_obligatorio
    FROM dim_surtido_obligatorio
    WHERE es_obligatorio = TRUE
    GROUP BY u_cluster
)
SELECT
    ROW_NUMBER() OVER () AS id,
    mo.anno_mes,
    socc.id_cliente,
    socc.codigo_cliente,
    socc.nombre_cliente,
    socc.retail,
    socc.u_cluster,
    socc.vendedor_asignado,
    COALESCE(sc.cant_subcategorias_compradas, 0) AS subcategorias_compradas,
    topc.cant_obligatorio AS subcategorias_obligatorias,
    ROUND((COALESCE(sc.cant_subcategorias_compradas, 0)::NUMERIC / NULLIF(topc.cant_obligatorio, 0)) * 100, 2) AS surtido_porcentaje
FROM meses_objetivo mo
CROSS JOIN subcategorias_obligatorias_cliente socc
LEFT JOIN subcategorias_compradas sc ON socc.id_cliente = sc.id_cliente AND mo.anno_mes = sc.anno_mes
JOIN total_obligatorio_por_cluster topc ON socc.u_cluster = topc.u_cluster
ORDER BY mo.anno_mes DESC, socc.u_cluster DESC, surtido_porcentaje ASC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_surtido_cliente_id ON mv_surtido_por_cliente (id);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_cliente_lookup ON mv_surtido_por_cliente (id_cliente, anno_mes);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_cluster ON mv_surtido_por_cliente (u_cluster);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_retail ON mv_surtido_por_cliente (retail);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_vendedor ON mv_surtido_por_cliente (vendedor_asignado);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_cliente_mes ON mv_surtido_por_cliente (anno_mes);

-- --------------------------------------------
-- MV_SURTIDO_POR_VENDEDOR
-- total_clientes_vendedor se calcula por (vendedor, cluster) directo desde dim_clientes,
-- NO desde dim_vendedor.cantidad_cliente (que es por retail, no por cluster: mezclarlos
-- daria un denominador incorrecto). dim_vendedor solo se usa aqui para filtrar vendedores
-- activos y obtener el nombre; se deduplica primero porque puede tener varias filas por
-- vendedor (una por retail_asignado). "subcategorias_compradas" usa cantidad neta positiva
-- en el MES CALENDARIO (mismo patron que mv_surtido_por_cliente; ver esa vista para el porque
-- del cambio de ventana rodante de 30 dias a mes calendario).
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_surtido_por_vendedor CASCADE;
CREATE MATERIALIZED VIEW mv_surtido_por_vendedor AS
WITH meses_objetivo AS (
    SELECT DISTINCT anno_mes FROM dim_objetivos_distribucion WHERE activo = TRUE
),
total_obligatorio_por_cluster AS (
    SELECT u_cluster, COUNT(DISTINCT u_surtido_n) AS cant_obligatorio
    FROM dim_surtido_obligatorio
    WHERE es_obligatorio = TRUE
    GROUP BY u_cluster
),
vendedores_activos AS (
    SELECT codigo_vendedor, MAX(nombre_vendedor) AS nombre_vendedor
    FROM dim_vendedor
    WHERE estado = 'Activo'
    GROUP BY codigo_vendedor
),
clientes_x_vendedor_cluster AS (
    SELECT
        va.codigo_vendedor AS vendedor,
        dc.u_cluster,
        COUNT(DISTINCT dc.id_cliente) AS total_clientes_vendedor
    FROM vendedores_activos va
    JOIN dim_clientes dc ON va.codigo_vendedor = dc.vendedor_asignado
    WHERE dc.estado = 'Activo'
    GROUP BY va.codigo_vendedor, dc.u_cluster
),
compras_netas_grupo AS (
    SELECT
        mo.anno_mes,
        fv.vendedor,
        fv.u_cluster,
        fv.u_surtido_n,
        SUM(fv.cantidad) AS cantidad_neta
    FROM meses_objetivo mo
    JOIN fact_ventas fv
        ON fv.id_fecha >= TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD')
       AND fv.id_fecha <= LEAST(
             (TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date,
             fecha_referencia_ventas()
           )
    JOIN dim_surtido_obligatorio dso
        ON dso.u_cluster = fv.u_cluster
        AND dso.u_surtido_n = fv.u_surtido_n
        AND dso.es_obligatorio = TRUE
    GROUP BY mo.anno_mes, fv.vendedor, fv.u_cluster, fv.u_surtido_n
),
subcategorias_compradas_vendedor AS (
    SELECT anno_mes, vendedor, u_cluster, COUNT(*) AS cant_compradas
    FROM compras_netas_grupo
    WHERE cantidad_neta > 0
    GROUP BY anno_mes, vendedor, u_cluster
)
SELECT
    ROW_NUMBER() OVER () AS id,
    mo.anno_mes,
    cwc.vendedor,
    va.nombre_vendedor,
    cwc.u_cluster,
    cwc.total_clientes_vendedor,
    COALESCE(scv.cant_compradas, 0) AS subcategorias_compradas,
    topc.cant_obligatorio AS subcategorias_obligatorias,
    ROUND((COALESCE(scv.cant_compradas, 0)::NUMERIC / NULLIF(topc.cant_obligatorio, 0)) * 100, 2) AS surtido_porcentaje
FROM meses_objetivo mo
CROSS JOIN clientes_x_vendedor_cluster cwc
JOIN vendedores_activos va ON cwc.vendedor = va.codigo_vendedor
LEFT JOIN subcategorias_compradas_vendedor scv
    ON cwc.vendedor = scv.vendedor AND cwc.u_cluster = scv.u_cluster AND mo.anno_mes = scv.anno_mes
JOIN total_obligatorio_por_cluster topc ON cwc.u_cluster = topc.u_cluster
ORDER BY mo.anno_mes DESC, cwc.vendedor, cwc.u_cluster, surtido_porcentaje ASC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_surtido_vendedor_pk ON mv_surtido_por_vendedor (id);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_vendedor_lookup ON mv_surtido_por_vendedor (vendedor, u_cluster, anno_mes);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_vendedor_mes ON mv_surtido_por_vendedor (anno_mes);

-- --------------------------------------------
-- MV_SURTIDO_POR_CLUSTER
-- "subcategorias_compradas" usa cantidad neta positiva en el MES CALENDARIO (ver nota en
-- mv_surtido_por_cliente sobre el cambio de ventana rodante de 30 dias a mes calendario).
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_surtido_por_cluster CASCADE;
CREATE MATERIALIZED VIEW mv_surtido_por_cluster AS
WITH meses_objetivo AS (
    SELECT DISTINCT anno_mes FROM dim_objetivos_distribucion WHERE activo = TRUE
),
total_obligatorio AS (
    SELECT u_cluster, COUNT(DISTINCT u_surtido_n) AS cant_obligatorio
    FROM dim_surtido_obligatorio
    WHERE es_obligatorio = TRUE
    GROUP BY u_cluster
),
clientes_por_cluster AS (
    SELECT u_cluster, COUNT(DISTINCT id_cliente) AS total_clientes
    FROM dim_clientes
    WHERE estado = 'Activo'
    GROUP BY u_cluster
),
compras_netas_grupo AS (
    SELECT
        mo.anno_mes,
        fv.u_cluster,
        fv.u_surtido_n,
        SUM(fv.cantidad) AS cantidad_neta
    FROM meses_objetivo mo
    JOIN fact_ventas fv
        ON fv.id_fecha >= TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD')
       AND fv.id_fecha <= LEAST(
             (TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date,
             fecha_referencia_ventas()
           )
    JOIN dim_surtido_obligatorio dso
        ON dso.u_cluster = fv.u_cluster
        AND dso.u_surtido_n = fv.u_surtido_n
        AND dso.es_obligatorio = TRUE
    GROUP BY mo.anno_mes, fv.u_cluster, fv.u_surtido_n
),
subcategorias_compradas AS (
    SELECT anno_mes, u_cluster, COUNT(*) AS cant_compradas
    FROM compras_netas_grupo
    WHERE cantidad_neta > 0
    GROUP BY anno_mes, u_cluster
)
SELECT
    ROW_NUMBER() OVER () AS id,
    mo.anno_mes,
    cpc.u_cluster,
    cpc.total_clientes,
    COALESCE(sc.cant_compradas, 0) AS subcategorias_compradas,
    tobl.cant_obligatorio AS subcategorias_obligatorias,
    ROUND((COALESCE(sc.cant_compradas, 0)::NUMERIC / NULLIF(tobl.cant_obligatorio, 0)) * 100, 2) AS surtido_promedio_porcentaje
FROM meses_objetivo mo
CROSS JOIN clientes_por_cluster cpc
LEFT JOIN subcategorias_compradas sc ON cpc.u_cluster = sc.u_cluster AND mo.anno_mes = sc.anno_mes
JOIN total_obligatorio tobl ON cpc.u_cluster = tobl.u_cluster
ORDER BY mo.anno_mes DESC, cpc.u_cluster;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_surtido_cluster_pk ON mv_surtido_por_cluster (id);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_cluster_lookup ON mv_surtido_por_cluster (u_cluster, anno_mes);
CREATE INDEX IF NOT EXISTS idx_mv_surtido_cluster_mes ON mv_surtido_por_cluster (anno_mes);

-- --------------------------------------------
-- MV_CLIENTES_NO_VISITADOS (sin compra en los ultimos 15 dias respecto a fecha_referencia_ventas)
-- No se filtra por cantidad neta: una devolucion sigue implicando contacto/visita al cliente.
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_clientes_no_visitados CASCADE;
CREATE MATERIALIZED VIEW mv_clientes_no_visitados AS
SELECT
    dc.id_cliente,
    dc.codigo_cliente,
    dc.nombre_cliente,
    dc.retail,
    dc.u_cluster,
    dc.vendedor_asignado,
    MAX(fv.id_fecha) AS ultima_compra,
    (fecha_referencia_ventas() - MAX(fv.id_fecha)) AS dias_sin_compra
FROM dim_clientes dc
LEFT JOIN fact_ventas fv ON dc.id_cliente = fv.id_cliente
WHERE dc.estado = 'Activo'
GROUP BY dc.id_cliente, dc.codigo_cliente, dc.nombre_cliente,
         dc.retail, dc.u_cluster, dc.vendedor_asignado
HAVING MAX(fv.id_fecha) IS NULL OR MAX(fv.id_fecha) < fecha_referencia_ventas() - 15
ORDER BY ultima_compra ASC NULLS FIRST;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_no_visitados_cliente_id ON mv_clientes_no_visitados (id_cliente);
CREATE INDEX IF NOT EXISTS idx_mv_no_visitados_retail ON mv_clientes_no_visitados (retail);
CREATE INDEX IF NOT EXISTS idx_mv_no_visitados_vendedor ON mv_clientes_no_visitados (vendedor_asignado);

-- --------------------------------------------
-- MV_RESUMEN_KPI_GENERAL
-- Igual que mv_distribucion_por_retail: se calcula para TODOS los meses disponibles (no solo el
-- mas reciente), con columna anno_mes, para que el selector de mes del dashboard tambien
-- controle las tarjetas de resumen (antes eran una sola fila fija al mes mas reciente y el
-- selector de mes no las afectaba, aunque si afectaba los graficos de abajo).
--
-- clientes_activos_mes cuenta clientes con al menos una linea de venta real (cantidad > 0) DENTRO
-- del mes calendario correspondiente (antes era una ventana rodante de 30 dias sin relacion con
-- el mes seleccionado).
--
-- Indicadores financieros del MES CALENDARIO de cada anno_mes, acotados a fecha_referencia_ventas()
-- para el mes en curso/incompleto:
--   ventas_mes_monto        = SUM(monto) de fact_ventas del mes (neto de devoluciones)
--   facturas_mes            = facturas distintas del mes
--   dropsize_promedio       = ventas_mes_monto / facturas_mes ($ promedio por factura)
--   objetivo_monto_mes      = SUM(objetivo_monto) de subcategorias activas para ese mes
--   logro_monto_porcentaje  = ventas_mes_monto / objetivo_monto_mes * 100
--   proyeccion_ventas_monto = ventas_mes_monto / dias_transcurridos_mes * dias_totales_mes
--     (proyeccion lineal simple; para un mes ya cerrado da lo mismo que ventas_mes_monto, ya
--     que dias_transcurridos_mes = dias_totales_mes en ese caso)
-- --------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_resumen_kpi_general CASCADE;
CREATE MATERIALIZED VIEW mv_resumen_kpi_general AS
WITH meses_objetivo AS (
    SELECT DISTINCT anno_mes FROM dim_objetivos_distribucion WHERE activo = TRUE
),
mes_calc AS (
    SELECT
        mo.anno_mes,
        TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD') AS inicio_mes,
        LEAST(
            (TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date,
            fecha_referencia_ventas()
        ) AS fecha_ref,
        (TO_DATE(mo.anno_mes || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date AS fin_mes
    FROM meses_objetivo mo
),
ventas_mes AS (
    SELECT
        mc.anno_mes,
        COALESCE(SUM(fv.monto), 0) AS ventas_mes_monto,
        COUNT(DISTINCT fv.id_factura) AS facturas_mes
    FROM mes_calc mc
    LEFT JOIN fact_ventas fv ON fv.id_fecha >= mc.inicio_mes AND fv.id_fecha <= mc.fecha_ref
    GROUP BY mc.anno_mes
),
objetivo_mes AS (
    SELECT od.anno_mes, COALESCE(SUM(od.objetivo_monto), 0) AS objetivo_monto_mes
    FROM dim_objetivos_distribucion od
    WHERE od.activo = TRUE
    GROUP BY od.anno_mes
),
clientes_activos_mes AS (
    SELECT mc.anno_mes, COUNT(DISTINCT fv.id_cliente) AS clientes_activos
    FROM mes_calc mc
    LEFT JOIN fact_ventas fv
        ON fv.id_fecha >= mc.inicio_mes AND fv.id_fecha <= mc.fecha_ref AND fv.cantidad > 0
    GROUP BY mc.anno_mes
)
SELECT
    ROW_NUMBER() OVER () AS id,
    mc.anno_mes,
    (SELECT COUNT(*) FROM dim_clientes WHERE estado = 'Activo') AS total_clientes,
    COALESCE(cam.clientes_activos, 0) AS clientes_activos_mes,
    (SELECT ROUND(AVG(surtido_porcentaje), 2) FROM mv_surtido_por_cliente WHERE anno_mes = mc.anno_mes) AS surtido_promedio,
    (SELECT ROUND(AVG(distribucion_porcentaje), 2) FROM mv_distribucion_por_retail WHERE anno_mes = mc.anno_mes) AS distribucion_promedio,
    vm.ventas_mes_monto,
    vm.facturas_mes,
    om.objetivo_monto_mes,
    EXTRACT(DAY FROM mc.fecha_ref)::int AS dias_transcurridos_mes,
    EXTRACT(DAY FROM mc.fin_mes)::int AS dias_totales_mes,
    ROUND(vm.ventas_mes_monto / NULLIF(vm.facturas_mes, 0), 2) AS dropsize_promedio,
    ROUND((vm.ventas_mes_monto / NULLIF(om.objetivo_monto_mes, 0)) * 100, 2) AS logro_monto_porcentaje,
    ROUND((vm.ventas_mes_monto / NULLIF(EXTRACT(DAY FROM mc.fecha_ref), 0)) * EXTRACT(DAY FROM mc.fin_mes), 2) AS proyeccion_ventas_monto,
    CURRENT_TIMESTAMP AS fecha_actualizacion
FROM mes_calc mc
JOIN ventas_mes vm ON vm.anno_mes = mc.anno_mes
JOIN objetivo_mes om ON om.anno_mes = mc.anno_mes
LEFT JOIN clientes_activos_mes cam ON cam.anno_mes = mc.anno_mes
ORDER BY mc.anno_mes DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_resumen_kpi_id ON mv_resumen_kpi_general (id);
CREATE INDEX IF NOT EXISTS idx_mv_resumen_kpi_mes ON mv_resumen_kpi_general (anno_mes);
