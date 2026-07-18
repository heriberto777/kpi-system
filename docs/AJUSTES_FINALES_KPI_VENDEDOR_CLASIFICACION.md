# 📊 AJUSTES Y ADICIONES FINALES - KPIs POR VENDEDOR Y CLUSTER

---

## 1️⃣ PERÍODO DE DISTRIBUCIÓN

### **¿Cuál debe ser el período?**

**Respuesta: 30 DÍAS (1 MES)**

```sql
-- Correcto:
WHERE fv.id_fecha >= CURRENT_DATE - 30  -- Últimos 30 días

-- NO usar 60 días para distribución
-- 60 días es solo para ETL (traer datos históricos)
```

**Justificación:**
- Distribución = métrica de desempeño ACTUAL (mes a mes)
- Objetivos están por MES (anno_mes)
- 60 días sería comparar con objetivo de 1 mes (no coincide)

---

## 2️⃣ NUEVA TABLA: CLASIFICACION (Descripción de SubCategorías)

### **Query para sincronizar CLASIFICACION**

```sql
SELECT
    ISNULL(CLASIFICACION, '') AS codigo_clasificacion,
    ISNULL(DESCRIPCION, '') AS descripcion_clasificacion,
    ISNULL(U_JERARQUIA, '') AS nivel_jerarquia
FROM CATELLI.CLASIFICACION
WHERE CLASIFICACION IN (
    'G21', 'G22', 'G11', 'G13', 'G33', 'G32', 'G44', 
    'G23', 'G24', 'G50', 'G49', 'C10', 'C20', 'C30', 'C40'
)
ORDER BY CLASIFICACION;
```

### **Tabla en PostgreSQL**

```sql
CREATE TABLE dim_clasificacion (
    id SERIAL PRIMARY KEY,
    codigo_clasificacion VARCHAR(50) UNIQUE NOT NULL,
    descripcion_clasificacion VARCHAR(500),
    nivel_jerarquia VARCHAR(20),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Actualizar dim_articulos para enlazar descripción**

```sql
-- Agregar descripción al traer artículos
SELECT
    ISNULL(A.ARTICULO, '') AS codigo_articulo,
    ISNULL(A.DESCRIPCION, '') AS descripcion_articulo,
    ISNULL(A.CLASIFICACION_1, '') AS clasificacion_1,
    ISNULL(A.CLASIFICACION_2, '') AS clasificacion_2,
    -- AGREGAR DESCRIPCIÓN DE SUBCATEGORÍA:
    ISNULL(C.DESCRIPCION, A.CLASIFICACION_2) AS descripcion_subcategoria,
    ISNULL(A.U_SURTIDO_N, 0) AS u_surtido_n,
    ISNULL(A.ARTICULO_DEL_PROV, '') AS articulo_del_proveedor,
    NULL AS precio_unitario
FROM CATELLI.ARTICULO A
LEFT JOIN CATELLI.CLASIFICACION C ON A.CLASIFICACION_2 = C.CLASIFICACION
WHERE A.ACTIVO = 'S'
ORDER BY A.ARTICULO;
```

---

## 3️⃣ NUEVAS VISTAS MATERIALIZADAS

### **MV_DISTRIBUCION_POR_VENDEDOR (Nueva)**

```sql
CREATE MATERIALIZED VIEW mv_distribucion_por_vendedor AS
WITH clientes_x_vendedor AS (
    SELECT
        vendedor_asignado AS vendedor,
        retail,
        COUNT(DISTINCT id_cliente) AS total_clientes
    FROM dim_clientes
    WHERE estado = 'Activo' AND vendedor_asignado IS NOT NULL
    GROUP BY vendedor_asignado, retail
),
clientes_compra_subcategoria AS (
    SELECT
        fv.vendedor,
        fv.retail,
        da.clasificacion_2,
        COUNT(DISTINCT fv.id_cliente) AS clientes_que_compraron
    FROM fact_ventas fv
    JOIN dim_articulos da ON fv.id_articulo = da.id_articulo
    WHERE fv.id_fecha >= CURRENT_DATE - 30  -- 30 DÍAS, NO 60
      AND fv.clasificacion_2 IS NOT NULL
    GROUP BY fv.vendedor, fv.retail, da.clasificacion_2
)
SELECT
    cxv.vendedor,
    cxv.retail,
    od.clasificacion_2,
    COALESCE(cxv.total_clientes, 0) AS total_clientes_vendedor,
    COALESCE(ccq.clientes_que_compraron, 0) AS resultado,
    od.objetivo_clientes AS obj2,
    ROUND(
        (COALESCE(ccq.clientes_que_compraron, 0)::NUMERIC / od.objetivo_clientes) * 100, 2
    ) AS logro_porcentaje,
    ROUND(
        (COALESCE(ccq.clientes_que_compraron, 0)::NUMERIC / cxv.total_clientes) * 100, 2
    ) AS distribucion_porcentaje
FROM clientes_x_vendedor cxv
CROSS JOIN dim_objetivos_distribucion od
LEFT JOIN clientes_compra_subcategoria ccq 
    ON cxv.vendedor = ccq.vendedor 
    AND cxv.retail = ccq.retail
    AND od.clasificacion_2 = ccq.clasificacion_2
WHERE cxv.retail = od.retail
ORDER BY cxv.vendedor, od.clasificacion_2;
```

---

### **MV_SURTIDO_POR_VENDEDOR (Nueva)**

```sql
CREATE MATERIALIZED VIEW mv_surtido_por_vendedor AS
WITH total_obligatorio_por_cluster AS (
    SELECT
        u_cluster,
        COUNT(DISTINCT u_surtido_n) AS cant_obligatorio
    FROM dim_surtido_obligatorio
    WHERE es_obligatorio = TRUE
    GROUP BY u_cluster
),
clientes_x_vendedor_cluster AS (
    SELECT
        dc.vendedor_asignado AS vendedor,
        dc.u_cluster,
        COUNT(DISTINCT dc.id_cliente) AS total_clientes_vendedor
    FROM dim_clientes dc
    WHERE dc.estado = 'Activo' AND dc.vendedor_asignado IS NOT NULL
    GROUP BY dc.vendedor_asignado, dc.u_cluster
),
subcategorias_compradas_vendedor AS (
    SELECT
        fv.vendedor,
        fv.u_cluster,
        COUNT(DISTINCT fv.u_surtido_n) AS cant_compradas
    FROM fact_ventas fv
    WHERE fv.id_fecha >= CURRENT_DATE - 30
      AND fv.u_surtido_n IS NOT NULL
    GROUP BY fv.vendedor, fv.u_cluster
)
SELECT
    cwc.vendedor,
    cwc.u_cluster,
    cwc.total_clientes_vendedor,
    COALESCE(scv.cant_compradas, 0) AS subcategorias_compradas,
    topc.cant_obligatorio AS subcategorias_obligatorias,
    ROUND(
        (COALESCE(scv.cant_compradas, 0)::NUMERIC / topc.cant_obligatorio) * 100, 2
    ) AS surtido_porcentaje
FROM clientes_x_vendedor_cluster cwc
LEFT JOIN subcategorias_compradas_vendedor scv 
    ON cwc.vendedor = scv.vendedor 
    AND cwc.u_cluster = scv.u_cluster
JOIN total_obligatorio_por_cluster topc ON cwc.u_cluster = topc.u_cluster
ORDER BY cwc.vendedor, cwc.u_cluster, surtido_porcentaje ASC;
```

---

### **MV_SURTIDO_POR_CLUSTER (Actualizada)**

```sql
CREATE MATERIALIZED VIEW mv_surtido_por_cluster AS
WITH total_obligatorio AS (
    SELECT
        u_cluster,
        COUNT(DISTINCT u_surtido_n) AS cant_obligatorio
    FROM dim_surtido_obligatorio
    WHERE es_obligatorio = TRUE
    GROUP BY u_cluster
),
clientes_por_cluster AS (
    SELECT
        u_cluster,
        COUNT(DISTINCT id_cliente) AS total_clientes
    FROM dim_clientes
    WHERE estado = 'Activo'
    GROUP BY u_cluster
),
subcategorias_compradas AS (
    SELECT
        fv.u_cluster,
        COUNT(DISTINCT fv.u_surtido_n) AS cant_compradas
    FROM fact_ventas fv
    WHERE fv.id_fecha >= CURRENT_DATE - 30  -- 30 DÍAS
      AND fv.u_surtido_n IS NOT NULL
    GROUP BY fv.u_cluster
)
SELECT
    cpc.u_cluster,
    cpc.total_clientes,
    COALESCE(sc.cant_compradas, 0) AS subcategorias_compradas,
    to.cant_obligatorio AS subcategorias_obligatorias,
    ROUND(
        (COALESCE(sc.cant_compradas, 0)::NUMERIC / to.cant_obligatorio) * 100, 2
    ) AS surtido_promedio_porcentaje
FROM clientes_por_cluster cpc
LEFT JOIN subcategorias_compradas sc ON cpc.u_cluster = sc.u_cluster
JOIN total_obligatorio to ON cpc.u_cluster = to.u_cluster
ORDER BY cpc.u_cluster;
```

---

## 4️⃣ NUEVOS ENDPOINTS REST (Backend)

### **Distribución por Vendedor**

```
GET /api/kpi/distribucion-por-vendedor?vendedor=Juan García&retail=COLMADO

Response:
[
  {
    vendedor: "Juan García",
    retail: "COLMADO",
    clasificacion_2: "G21",
    total_clientes_vendedor: 245,
    resultado: 230,
    obj2: 7723,
    logro_porcentaje: 2.98,
    distribucion_porcentaje: 93.88
  },
  ...
]
```

### **Surtido por Vendedor**

```
GET /api/kpi/surtido-por-vendedor?vendedor=Juan García

Response:
[
  {
    vendedor: "Juan García",
    u_cluster: "BRONZE",
    total_clientes_vendedor: 120,
    subcategorias_compradas: 14,
    subcategorias_obligatorias: 17,
    surtido_porcentaje: 82.35
  },
  ...
]
```

### **Surtido por Cluster**

```
GET /api/kpi/surtido-por-cluster

Response:
[
  {
    u_cluster: "BRONZE",
    total_clientes: 2456,
    subcategorias_compradas: 15,
    subcategorias_obligatorias: 17,
    surtido_promedio_porcentaje: 88.24
  },
  ...
]
```

---

## 5️⃣ CONTROLLERS ACTUALIZADOS (Backend)

### **src/controllers/kpi.controller.ts**

```typescript
async getDistribucionPorVendedor(req: Request, res: Response) {
  try {
    const vendedor = req.query.vendedor as string;
    const retail = req.query.retail as string;

    let query = `SELECT * FROM mv_distribucion_por_vendedor WHERE 1=1`;
    const params: any[] = [];

    if (vendedor) {
      query += ` AND vendedor = $${params.length + 1}`;
      params.push(vendedor);
    }
    if (retail) {
      query += ` AND retail = $${params.length + 1}`;
      params.push(retail);
    }

    query += ` ORDER BY distribucion_porcentaje DESC`;

    const result = await pgPool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching distribucion por vendedor:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
}

async getSurtidoPorVendedor(req: Request, res: Response) {
  try {
    const vendedor = req.query.vendedor as string;

    let query = `SELECT * FROM mv_surtido_por_vendedor WHERE 1=1`;
    const params: any[] = [];

    if (vendedor) {
      query += ` AND vendedor = $${params.length + 1}`;
      params.push(vendedor);
    }

    query += ` ORDER BY u_cluster, surtido_porcentaje ASC`;

    const result = await pgPool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching surtido por vendedor:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
}

async getSurtidoPorCluster(req: Request, res: Response) {
  try {
    const result = await pgPool.query(`SELECT * FROM mv_surtido_por_cluster`);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching surtido por cluster:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
}
```

### **src/routes/kpi.routes.ts**

```typescript
import { Router } from 'express';
import kpiController from '../controllers/kpi.controller';

const router = Router();

router.get('/distribucion', (req, res) => kpiController.getDistribucion(req, res));
router.get('/distribucion-por-cluster', (req, res) => kpiController.getDistribucionPorCluster(req, res));
router.get('/distribucion-por-vendedor', (req, res) => kpiController.getDistribucionPorVendedor(req, res));  // NUEVO

router.get('/surtido', (req, res) => kpiController.getSurtido(req, res));
router.get('/surtido-por-vendedor', (req, res) => kpiController.getSurtidoPorVendedor(req, res));  // NUEVO
router.get('/surtido-por-cluster', (req, res) => kpiController.getSurtidoPorCluster(req, res));   // NUEVO

router.get('/clientes-no-visitados', (req, res) => kpiController.getClientesNoVisitados(req, res));
router.get('/resumen', (req, res) => kpiController.getResumen(req, res));

export default router;
```

---

## 6️⃣ JOB SYNC CLASIFICACION (23:10)

### **Agregar nuevo job entre sync-articulos y sync-ventas**

```typescript
// src/jobs/sync-clasificacion.job.ts
import { pgPool } from '../config/database';
import { getMSSQLPool } from '../config/database';
import logger from '../utils/logger';

export const syncClasificacionJob = async () => {
  try {
    logger.info('Starting syncClasificacionJob');
    
    const pool = await getMSSQLPool();
    
    // Truncate staging
    await pgPool.query('TRUNCATE TABLE stg_clasificacion');
    
    // Extract from MSSQL
    const result = await pool.request().query(`
      SELECT
        ISNULL(CLASIFICACION, '') AS codigo_clasificacion,
        ISNULL(DESCRIPCION, '') AS descripcion_clasificacion,
        ISNULL(U_JERARQUIA, '') AS nivel_jerarquia
      FROM CATELLI.CLASIFICACION
    `);
    
    // Insert to staging
    for (const row of result.recordset) {
      await pgPool.query(
        `INSERT INTO stg_clasificacion (codigo_clasificacion, descripcion_clasificacion, nivel_jerarquia)
         VALUES ($1, $2, $3)`,
        [row.codigo_clasificacion, row.descripcion_clasificacion, row.nivel_jerarquia]
      );
    }
    
    // UPSERT to dim_clasificacion
    await pgPool.query(`
      INSERT INTO dim_clasificacion (codigo_clasificacion, descripcion_clasificacion, nivel_jerarquia)
      SELECT codigo_clasificacion, descripcion_clasificacion, nivel_jerarquia
      FROM stg_clasificacion
      ON CONFLICT (codigo_clasificacion) DO UPDATE SET
        descripcion_clasificacion = EXCLUDED.descripcion_clasificacion,
        nivel_jerarquia = EXCLUDED.nivel_jerarquia,
        fecha_actualizacion = CURRENT_TIMESTAMP
    `);
    
    logger.info('syncClasificacionJob completed');
  } catch (error) {
    logger.error('syncClasificacionJob error:', error);
  }
};
```

### **Actualizar config/cron.ts**

```typescript
// 23:10 - Sync Clasificación
cron.schedule('10 23 * * *', syncClasificacionJob);
logger.info('Scheduled: syncClasificacionJob at 23:10');
```

---

## 📋 HORARIOS FINALES (6 JOBS)

| Hora | Job | Tabla |
|------|-----|-------|
| 22:45 | sync-universo | `dbo.universo_cliente` |
| 23:00 | sync-clientes | `CATELLI.CLIENTE` |
| 23:10 | sync-clasificacion | `CATELLI.CLASIFICACION` ⭐ NUEVO |
| 23:15 | sync-articulos | `CATELLI.ARTICULO` |
| 23:30 | sync-ventas | `dbo.distribucion` + ventas |
| 23:45 | calcular-kpis | Refrescar 9 vistas |

---

## ✅ CHECKLIST DE CAMBIOS

- [ ] Cambiar período de 60 a **30 DÍAS** en todas las queries
- [ ] Agregar **sync-clasificacion** job (23:10)
- [ ] Crear tabla `dim_clasificacion`
- [ ] Crear tabla `stg_clasificacion`
- [ ] Crear vista `mv_distribucion_por_vendedor`
- [ ] Crear vista `mv_surtido_por_vendedor`
- [ ] Actualizar vista `mv_surtido_por_cluster`
- [ ] Agregar descripción a `dim_articulos`
- [ ] Agregar 3 nuevos endpoints REST
- [ ] Actualizar controllers con 3 métodos
- [ ] Actualizar routes

---

## 📝 RESUMEN FINAL

| Métrica | Dimensiones |
|---------|------------|
| **Distribución** | Por Retail, Por Cluster, **Por Vendedor** ✅ |
| **Surtido** | Por Cliente, Por Cluster, **Por Vendedor** ✅ |
| **Descripciones** | SubCategorías con descripción ✅ |
| **Período** | 30 días ✅ |

**Listo. Todo está completo.** 🚀
