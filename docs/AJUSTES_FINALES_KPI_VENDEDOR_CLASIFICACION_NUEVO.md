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
WITH clientes_compra_subcategoria AS (
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
    dv.codigo_vendedor AS vendedor,
    dv.nombre_vendedor,
    dv.retail_asignado AS retail,
    od.clasificacion_2,
    dv.cantidad_cliente AS total_clientes_vendedor,
    COALESCE(ccq.clientes_que_compraron, 0) AS resultado,
    od.objetivo_clientes AS obj2,
    ROUND(
        (COALESCE(ccq.clientes_que_compraron, 0)::NUMERIC / od.objetivo_clientes) * 100, 2
    ) AS logro_porcentaje,
    ROUND(
        (COALESCE(ccq.clientes_que_compraron, 0)::NUMERIC / dv.cantidad_cliente) * 100, 2
    ) AS distribucion_porcentaje
FROM dim_vendedor dv
CROSS JOIN dim_objetivos_distribucion od
LEFT JOIN clientes_compra_subcategoria ccq 
    ON dv.codigo_vendedor = ccq.vendedor 
    AND dv.retail_asignado = ccq.retail
    AND od.clasificacion_2 = ccq.clasificacion_2
WHERE dv.retail_asignado = od.retail
  AND dv.estado = 'Activo'
ORDER BY dv.codigo_vendedor, od.clasificacion_2;
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
    -- Joinear dim_vendedor con dim_clientes para obtener cluster
    SELECT DISTINCT
        dv.codigo_vendedor AS vendedor,
        dc.u_cluster
    FROM dim_vendedor dv
    JOIN dim_clientes dc ON dv.codigo_vendedor = dc.vendedor_asignado
    WHERE dv.estado = 'Activo' AND dc.estado = 'Activo'
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
    dv.nombre_vendedor,
    cwc.u_cluster,
    dv.cantidad_cliente AS total_clientes_vendedor,
    COALESCE(scv.cant_compradas, 0) AS subcategorias_compradas,
    topc.cant_obligatorio AS subcategorias_obligatorias,
    ROUND(
        (COALESCE(scv.cant_compradas, 0)::NUMERIC / topc.cant_obligatorio) * 100, 2
    ) AS surtido_porcentaje
FROM clientes_x_vendedor_cluster cwc
JOIN dim_vendedor dv ON cwc.vendedor = dv.codigo_vendedor
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

## 6️⃣ NUEVA TABLA: DIM_VENDEDOR (22:55)

### **Query para sincronizar VENDEDOR**

```sql
SELECT 
    V.VENDEDOR AS codigo_vendedor,
    V.NOMBRE AS nombre_vendedor,
    COUNT(C.CLIENTE) AS cantidad_cliente,
    V.U_SUPERASIGNADO AS vendedor_supervisor,
    CASE 
        WHEN C.U_SEMANA IN ('MC1', 'WC1') THEN 'AUTOSERVICIO'
        WHEN C.U_SEMANA IN ('MD1', 'WD1') THEN 'MAYORISTA'
        ELSE V.U_RETAIL
    END AS retail_asignado,
    CASE 
        WHEN C.U_SEMANA IN ('MC1', 'MD1', 'WC1', 'WD1') THEN C.U_SEMANA
        ELSE V.VENDEDOR
    END AS al_vendedor,
    V.U_TIPO_VENDEDOR AS tipo_vendedor
FROM CATELLI.VENDEDOR V
LEFT JOIN CATELLI.CLIENTE C ON V.VENDEDOR = C.VENDEDOR AND C.ACTIVO = 'S'
WHERE V.U_CAMIONF NOT IN ('GND')
GROUP BY V.VENDEDOR, V.NOMBRE, V.U_SUPERASIGNADO, V.U_RETAIL, C.U_SEMANA, V.U_TIPO_VENDEDOR
ORDER BY V.VENDEDOR;
```

### **Tablas PostgreSQL**

```sql
-- Staging
CREATE TABLE IF NOT EXISTS stg_vendedor (
    codigo_vendedor VARCHAR(50),
    nombre_vendedor VARCHAR(300),
    cantidad_cliente INT,
    vendedor_supervisor VARCHAR(50),
    retail_asignado VARCHAR(50),
    al_vendedor VARCHAR(50),
    tipo_vendedor VARCHAR(50)
);

-- Dimensión
CREATE TABLE IF NOT EXISTS dim_vendedor (
    id SERIAL PRIMARY KEY,
    codigo_vendedor VARCHAR(50) UNIQUE NOT NULL,
    nombre_vendedor VARCHAR(300),
    cantidad_cliente INT DEFAULT 0,
    vendedor_supervisor VARCHAR(50),
    retail_asignado VARCHAR(50),
    al_vendedor VARCHAR(50),
    tipo_vendedor VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_vendedor_codigo (codigo_vendedor),
    INDEX idx_vendedor_supervisor (vendedor_supervisor)
);
```

### **Job: sync-vendedor (22:55)**

```typescript
// src/jobs/sync-vendedor.job.ts
import { pgPool } from '../config/database';
import { getMSSQLPool } from '../config/database';
import logger from '../utils/logger';

export const syncVendedorJob = async () => {
  try {
    logger.info('Starting syncVendedorJob');
    
    const pool = await getMSSQLPool();
    
    // Truncate staging
    await pgPool.query('TRUNCATE TABLE stg_vendedor');
    
    // Extract from MSSQL
    const result = await pool.request().query(`
      SELECT 
        V.VENDEDOR AS codigo_vendedor,
        V.NOMBRE AS nombre_vendedor,
        COUNT(C.CLIENTE) AS cantidad_cliente,
        V.U_SUPERASIGNADO AS vendedor_supervisor,
        CASE 
          WHEN C.U_SEMANA IN ('MC1', 'WC1') THEN 'AUTOSERVICIO'
          WHEN C.U_SEMANA IN ('MD1', 'WD1') THEN 'MAYORISTA'
          ELSE V.U_RETAIL
        END AS retail_asignado,
        CASE 
          WHEN C.U_SEMANA IN ('MC1', 'MD1', 'WC1', 'WD1') THEN C.U_SEMANA
          ELSE V.VENDEDOR
        END AS al_vendedor,
        V.U_TIPO_VENDEDOR AS tipo_vendedor
      FROM CATELLI.VENDEDOR V
      LEFT JOIN CATELLI.CLIENTE C ON V.VENDEDOR = C.VENDEDOR AND C.ACTIVO = 'S'
      WHERE V.U_CAMIONF NOT IN ('GND')
      GROUP BY V.VENDEDOR, V.NOMBRE, V.U_SUPERASIGNADO, V.U_RETAIL, C.U_SEMANA, V.U_TIPO_VENDEDOR
    `);
    
    // Insert to staging
    for (const row of result.recordset) {
      await pgPool.query(
        `INSERT INTO stg_vendedor (codigo_vendedor, nombre_vendedor, cantidad_cliente, vendedor_supervisor, retail_asignado, al_vendedor, tipo_vendedor)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [row.codigo_vendedor, row.nombre_vendedor, row.cantidad_cliente, row.vendedor_supervisor, row.retail_asignado, row.al_vendedor, row.tipo_vendedor]
      );
    }
    
    // UPSERT to dim_vendedor
    await pgPool.query(`
      INSERT INTO dim_vendedor (codigo_vendedor, nombre_vendedor, cantidad_cliente, vendedor_supervisor, retail_asignado, al_vendedor, tipo_vendedor)
      SELECT codigo_vendedor, nombre_vendedor, cantidad_cliente, vendedor_supervisor, retail_asignado, al_vendedor, tipo_vendedor
      FROM stg_vendedor
      ON CONFLICT (codigo_vendedor) DO UPDATE SET
        nombre_vendedor = EXCLUDED.nombre_vendedor,
        cantidad_cliente = EXCLUDED.cantidad_cliente,
        vendedor_supervisor = EXCLUDED.vendedor_supervisor,
        retail_asignado = EXCLUDED.retail_asignado,
        al_vendedor = EXCLUDED.al_vendedor,
        tipo_vendedor = EXCLUDED.tipo_vendedor,
        fecha_actualizacion = CURRENT_TIMESTAMP
    `);
    
    logger.info('syncVendedorJob completed');
  } catch (error) {
    logger.error('syncVendedorJob error:', error);
  }
};
```

---

## 7️⃣ JOB SYNC CLASIFICACION (23:10)

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
// 22:55 - Sync Vendedor
cron.schedule('55 22 * * *', syncVendedorJob);
logger.info('Scheduled: syncVendedorJob at 22:55');

// 23:10 - Sync Clasificación
cron.schedule('10 23 * * *', syncClasificacionJob);
logger.info('Scheduled: syncClasificacionJob at 23:10');
```

---

## 📋 HORARIOS FINALES (7 JOBS)

| Hora | Job | Tabla | Notas |
|------|-----|-------|-------|
| 22:45 | sync-universo | `dbo.universo_cliente` | Universo de clientes por retail |
| 22:55 | sync-vendedor | `CATELLI.VENDEDOR` | ⭐ NUEVO - Cantidad de clientes por vendedor |
| 23:00 | sync-clientes | `CATELLI.CLIENTE` | Clientes activos |
| 23:10 | sync-clasificacion | `CATELLI.CLASIFICACION` | ⭐ NUEVO - Descripciones de subcategorías |
| 23:15 | sync-articulos | `CATELLI.ARTICULO` | Todos los artículos |
| 23:30 | sync-ventas | `dbo.distribucion` + ventas | Objetivos + facturas + líneas |
| 23:45 | calcular-kpis | Refrescar vistas | 9 vistas materializadas |

---

## ✅ CHECKLIST DE CAMBIOS

**Nuevas Tablas:**
- [ ] Crear tabla `dim_vendedor` (cantidad_cliente por vendedor)
- [ ] Crear tabla `stg_vendedor`
- [ ] Crear tabla `dim_clasificacion`
- [ ] Crear tabla `stg_clasificacion`

**Nuevos Jobs:**
- [ ] Agregar **sync-vendedor** job (22:55)
- [ ] Agregar **sync-clasificacion** job (23:10)

**Nuevas Vistas:**
- [ ] Crear vista `mv_distribucion_por_vendedor` (con cantidad_cliente de dim_vendedor)
- [ ] Crear vista `mv_surtido_por_vendedor` (con cantidad_cliente de dim_vendedor)
- [ ] Actualizar vista `mv_surtido_por_cluster` (período 30 días)

**Backend:**
- [ ] Cambiar período de 60 a **30 DÍAS** en todas las queries
- [ ] Agregar 3 nuevos endpoints REST
- [ ] Actualizar controllers con 3 métodos
- [ ] Actualizar routes
- [ ] Agregar descripción de subcategoría a `dim_articulos`

**Cron Jobs:**
- [ ] Actualizar config/cron.ts con los 7 jobs en orden correcto

---

## 📝 RESUMEN FINAL

### **Tablas de Dimensión**
| Tabla | Información | Origen ERP |
|-------|-----------|-----------|
| `dim_vendedor` | Código, nombre, cantidad de clientes asignados, supervisor, retail | CATELLI.VENDEDOR |
| `dim_clasificacion` | Código y descripción de subcategorías | CATELLI.CLASIFICACION |
| `dim_objetivos_distribucion` | Objetivos por retail y subcategoría | dbo.distribucion |
| `dim_universo_cliente` | Universo de clientes por retail y mes | dbo.universo_cliente |

### **KPIs por Dimensión**
| Métrica | Dimensiones |
|---------|------------|
| **Distribución** | Por Retail, Por Cluster, **Por Vendedor con cantidad_cliente** ✅ |
| **Surtido** | Por Cliente, Por Cluster, **Por Vendedor con cantidad_cliente** ✅ |
| **Descripciones** | SubCategorías con descripción (CATELLI.CLASIFICACION) ✅ |
| **Período** | 30 días ✅ |
| **Cantidad Clientes** | Por vendedor (de CATELLI.VENDEDOR) ✅ |

### **Jobs (7 Total)**
1. 22:45 - sync-universo
2. 22:55 - sync-vendedor ⭐ NUEVO
3. 23:00 - sync-clientes
4. 23:10 - sync-clasificacion ⭐ NUEVO
5. 23:15 - sync-articulos
6. 23:30 - sync-ventas
7. 23:45 - calcular-kpis (refrescar 9 vistas)

**Listo. Todo está completo con cantidad_cliente por vendedor.** 🚀
