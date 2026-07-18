# ESPECIFICACIÓN TÉCNICA: SISTEMA ETL DE KPIs DE VENTAS Y DISTRIBUCIÓN

**Proyecto:** Sistema de Automatización de Carga ETL y Dashboard de KPIs  
**Cliente:** Inversiones Catelli  
**Tecnologías:** Node.js + Express, React, PostgreSQL, MSSQL  
**Fecha:** Julio 2026  
**Versión:** 1.0  

---

## 📋 TABLA DE CONTENIDOS

1. [Visión General](#visión-general)
2. [Modelo de Datos](#modelo-de-datos)
3. [Lógica de Negocio](#lógica-de-negocio)
4. [Arquitectura ETL](#arquitectura-etl)
5. [Diseño PostgreSQL](#diseño-postgresql)
6. [Queries ETL](#queries-etl)
7. [APIs REST](#apis-rest)
8. [Aplicación React](#aplicación-react)
9. [Cron Jobs](#cron-jobs)
10. [Prompts para Hermes](#prompts-para-hermes)

---

## 🎯 VISIÓN GENERAL

El sistema automatiza la extracción diaria de datos del ERP (MSSQL), transforma esa información en una base de datos analítica (PostgreSQL), calcula KPIs en tiempo real y expone estos datos a través de:
- **Dashboard React** para visualización
- **APIs REST** para integración con Telegram/Hermes
- **Cron Jobs** para sincronización automática (cada noche)

**Objetivo:** Medir y analizar **Distribución** y **Surtido** de productos por cliente, vendedor y cluster.

---

## 📊 MODELO DE DATOS

### TABLAS ERP (MSSQL - PRODUCCIÓN)

#### **CLIENTES**
```sql
-- Campos necesarios:
- id_cliente (PK)
- codigo_cliente (VARCHAR, UNIQUE)
- nombre_cliente (VARCHAR)
- CATEGORIA_CLIENTE (VARCHAR) -- Valores: A1, A2, A3, C1, C2, C3, D1, D2, Q1, SUR, SM, B1, OT, EM, FA, CA, H1, CG
- U_CLUSTER (VARCHAR) -- Valores: BRONZE, SILVER, GOLD
- vendedor_asignado (VARCHAR) -- Nombre del vendedor responsable
- estado (VARCHAR) -- Activo/Inactivo
- fecha_creacion (DATE)
```

#### **ARTICULO**
```sql
-- Campos necesarios:
- codigo_articulo (PK, VARCHAR)
- descripcion (VARCHAR)
- clasificacion_1 (VARCHAR) -- Ej: C10, C20, C30, C40
- clasificacion_2 (VARCHAR) -- SubCategoría: G21, G11, G13, G33, G32, G44, G23, G24, G50, G49, etc.
- U_SURTIDO_N (INT) -- Grupo de surtido: 1-23
- ARTICULO_DEL_PROVEEDOR (VARCHAR) -- Identificador del proveedor
- precio_unitario (NUMERIC)
```

#### **FACTURA**
```sql
-- Campos necesarios:
- id_factura (PK, VARCHAR o INT)
- codigo_cliente (FK -> CLIENTES.codigo_cliente)
- fecha_factura (DATE)
- estado_factura (VARCHAR) -- Activo/Cancelada
```

#### **FACTURA_LINEAS**
```sql
-- Campos necesarios:
- id_factura (FK -> FACTURA)
- codigo_articulo (FK -> ARTICULO.codigo_articulo)
- cantidad (INT)
- monto_total (NUMERIC)
```

#### **CLASIFICACION**
```sql
-- Tabla jerárquica
- CLASIFICACION (PK, VARCHAR) -- Ej: C10, G21, G11
- DESCRIPCION (VARCHAR) -- Ej: "BODY CARE", "Dental Creams"
- U_JERARQUIA (VARCHAR) -- Nivel: 1 (padre), 2 (hijo)
```

### MAPEO: CATEGORIA_CLIENTE → RETAIL

```
COLMADO: A1, A2, A3
AUTOSERVICIO: C1, C2, C3
MAYORISTA: D1, D2, Q1, SUR
OTROS: SM, B1, OT, EM, FA, CA, H1, CG
```

### MAPEO: GRUPO (U_SURTIDO_N) → CLUSTERS

```
BRONZE obligatorio: Grupos 1-17
SILVER obligatorio: Grupos 1-21
GOLD obligatorio: Grupos 1-11

Detalle por Grupo:
Grupo  | SKU Count | Silver | Bronze | Gold | SKUs
-------|-----------|--------|--------|------|------
1      | 1         | x      | x      | x    | GT01040A
2      | 1         | x      | x      | x    | GT01038A
3      | 1         | x      | x      | x    | 61037222
4      | 1         | x      | x      | x    | GT01039A
5      | 1         | x      | x      | x    | FGTT92234
6      | 1         | x      | x      | x    | GT01552A
7      | 7         | x      | x      | x    | FMX01547A, MX01918A, MX04876A, FMX02050A, FMX05258, MX00424B, ...
8      | 1         | x      | x      | x    | 61046213
9      | 1         | x      | x      | x    | 61049603
10     | 1         | x      | x      | x    | 61048922
11     | 1         | x      | x      | x    | 61020104
12     | 1         | x      | x      |      | 61054367
14     | 1         | x      | x      |      | 61020100
15     | 2         | x      | x      |      | 61049604, 61048921
16     | 1         | x      | x      |      | 61046214
17     | 1         | x      | x      |      | 61039105
18     | 3         | x      |        |      | FGTT92226, FGTT92224, FGTT92257
19     | 1         | x      |        |      | GT02046A
20     | 1         | x      |        |      | FGTT13259
21     | 1         | x      |        |      | 61034514
23     | 2         | x      | x      |      | 61020296, 61020297
```

---

## 🎯 LÓGICA DE NEGOCIO

### **RETAIL (Categoría de Cliente)**
Es una agrupación de las categorías técnicas del ERP:
- **COLMADO:** Pequeñas tiendas (A1, A2, A3)
- **AUTOSERVICIO:** Supermercados pequeños (C1, C2, C3)
- **MAYORISTA:** Distribuidoras grandes (D1, D2, Q1, SUR)

### **CLUSTER (Segmentación por Volumen)**
- **BRONZE:** Menor volumen de compra
- **SILVER:** Volumen medio
- **GOLD:** Mayor volumen

**Nota:** Un cliente es "COLMADO BRONZE" (dos dimensiones independientes)

### **DISTRIBUCIÓN**
**Definición:** Porcentaje de clientes que han comprado un SKU/SubCategoría en un período.

**Fórmula:**
```
DISTRIBUCION (%) = (Clientes que compraron SKU X / Total clientes en RETAIL) * 100
```

**Criterios por RETAIL:**
- **COLMADO:** Cliente con ≥ 3 compras del SKU en los últimos 30 días
- **AUTOSERVICIO:** Cliente con ≥ 6 compras del SKU en los últimos 30 días
- **MAYORISTA:** Cliente con ≥ 6 compras del SKU en los últimos 30 días

**Dimensiones de Análisis:**
1. Por RETAIL (Colmado, Autoservicio, Mayorista)
2. Por CLUSTER (Bronze, Silver, Gold)
3. Por CLUSTER + RETAIL (Colmado-Bronze, Colmado-Silver, etc.)
4. Por VENDEDOR (dentro de su RETAIL)
5. Por SUBCATEGORIA (G21, G11, etc.) o por GRUPO (1-23)

### **SURTIDO**
**Definición:** Porcentaje de cumplimiento de SKUs obligatorios que tiene un cliente.

**Fórmula:**
```
SURTIDO (%) = (SubCategorías compradas de surtido obligatorio / SubCategorías obligatorias del CLUSTER) * 100
```

**Lógica:**
- Un cliente **BRONZE** DEBE tener al menos 1 SKU de cada Grupo (1-17)
- Un cliente **SILVER** DEBE tener al menos 1 SKU de cada Grupo (1-21)
- Un cliente **GOLD** DEBE tener al menos 1 SKU de cada Grupo (1-11)

**Criterio:** Se cuenta como "comprado" si tiene ≥ 1 compra en los últimos 30 días.

### **CLIENTES NO VISITADOS**
Clientes que no registran factura en los últimos 15 días (se asume que no fueron visitados).

### **OBJETIVOS Y LOGRO**
**Objetivo:** Número de clientes que DEBEN comprar un SKU (definido por negocio).

**Logro:**
```
LOGRO (%) = (Clientes que cumplieron criterio / Objetivo) * 100
```

---

## 🏛️ ARQUITECTURA ETL

```
┌─────────────────────┐
│  MSSQL ERP          │
│ (Production)        │
│ - CLIENTES          │
│ - ARTICULO          │
│ - FACTURA           │
│ - FACTURA_LINEAS    │
└──────────┬──────────┘
           │
           │ (Conexión ODBC/TCP)
           │
           ▼
┌─────────────────────────────────────┐
│ Node.js ETL Script (Cron Jobs)      │
│                                     │
│ 23:00 → Sync Clientes               │
│ 23:15 → Sync Artículos              │
│ 23:30 → Sync Ventas                 │
│ 23:45 → Calcular KPIs               │
│ 00:00 → Refresh Materialized Views  │
└──────────┬──────────────────────────┘
           │
           │ (INSERT/UPDATE/UPSERT)
           │
           ▼
┌──────────────────────────────────────┐
│ PostgreSQL (Analytics)               │
│                                      │
│ Staging Tables:                      │
│  └─ stg_clientes                     │
│  └─ stg_articulos                    │
│  └─ stg_facturas                     │
│  └─ stg_factura_lineas               │
│                                      │
│ Dimension Tables:                    │
│  └─ dim_clientes                     │
│  └─ dim_articulos                    │
│  └─ dim_tiempo                       │
│  └─ dim_surtido_obligatorio          │
│                                      │
│ Fact Tables:                         │
│  └─ fact_ventas                      │
│                                      │
│ Materialized Views (KPIs):           │
│  └─ mv_distribucion_por_retail       │
│  └─ mv_distribucion_por_cluster      │
│  └─ mv_distribucion_por_vendedor     │
│  └─ mv_surtido_por_cliente           │
│  └─ mv_clientes_no_visitados         │
└──────────┬───────────────────────────┘
           │
      ┌────┴────┬─────────┬────────┐
      ▼         ▼         ▼        ▼
    React   Node.js   Telegram  Hermes
   Dashboard  API     Alerts     Agent
```

---

## 🗄️ DISEÑO POSTGRESQL

### TABLAS DE CONTROL ETL

```sql
-- ============================================
-- TABLA: sync_logs (Control de sincronizaciones)
-- ============================================
CREATE TABLE sync_logs (
    id_sync SERIAL PRIMARY KEY,
    tipo_tabla VARCHAR(50) NOT NULL, -- clientes, articulos, ventas, kpis
    fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,
    estado VARCHAR(20), -- iniciado, en_proceso, completado, error
    registros_procesados INT,
    registros_insertados INT,
    registros_actualizados INT,
    registros_error INT,
    mensaje_error TEXT,
    
    INDEX idx_sync_logs_fecha (fecha_inicio DESC),
    INDEX idx_sync_logs_tipo (tipo_tabla)
);

-- ============================================
-- TABLA: sync_metadata (Último timestamp de cada tabla)
-- ============================================
CREATE TABLE sync_metadata (
    id SERIAL PRIMARY KEY,
    nombre_tabla VARCHAR(100) UNIQUE NOT NULL,
    ultima_sincronizacion TIMESTAMP,
    proximo_intento TIMESTAMP,
    estado VARCHAR(20)
);
```

### STAGING TABLES (Temporal - Se truncan cada sincronización)

```sql
-- ============================================
-- STAGING: stg_clientes
-- ============================================
CREATE TABLE stg_clientes (
    codigo_cliente VARCHAR(50),
    nombre_cliente VARCHAR(300),
    categoria_cliente VARCHAR(50),
    u_cluster VARCHAR(20),
    vendedor_asignado VARCHAR(200),
    estado VARCHAR(20),
    fecha_creacion DATE
);

-- ============================================
-- STAGING: stg_articulos
-- ============================================
CREATE TABLE stg_articulos (
    codigo_articulo VARCHAR(100),
    descripcion VARCHAR(500),
    clasificacion_1 VARCHAR(50),
    clasificacion_2 VARCHAR(50),
    u_surtido_n INT,
    articulo_del_proveedor VARCHAR(200),
    precio_unitario NUMERIC(10,2)
);

-- ============================================
-- STAGING: stg_facturas
-- ============================================
CREATE TABLE stg_facturas (
    id_factura VARCHAR(100),
    codigo_cliente VARCHAR(50),
    fecha_factura DATE,
    estado_factura VARCHAR(20)
);

-- ============================================
-- STAGING: stg_factura_lineas
-- ============================================
CREATE TABLE stg_factura_lineas (
    id_factura VARCHAR(100),
    codigo_articulo VARCHAR(100),
    cantidad INT,
    monto_total NUMERIC(12,2)
);
```

### DIMENSION TABLES (Datos Limpiados)

```sql
-- ============================================
-- DIM_TIEMPO (Calendario)
-- ============================================
CREATE TABLE dim_tiempo (
    id_fecha DATE PRIMARY KEY,
    ano INT NOT NULL,
    mes INT NOT NULL,
    dia INT NOT NULL,
    trimestre INT,
    semana INT,
    nombre_mes VARCHAR(20),
    nombre_dia VARCHAR(20),
    es_fin_semana BOOLEAN,
    
    INDEX idx_dim_tiempo_ano_mes (ano, mes)
);

-- ============================================
-- DIM_CLIENTES
-- ============================================
CREATE TABLE dim_clientes (
    id_cliente SERIAL PRIMARY KEY,
    codigo_cliente VARCHAR(50) UNIQUE NOT NULL,
    nombre_cliente VARCHAR(300) NOT NULL,
    categoria_cliente VARCHAR(50) NOT NULL,
    retail VARCHAR(50) NOT NULL, -- Agrupado: COLMADO, AUTOSERVICIO, MAYORISTA, OTROS
    u_cluster VARCHAR(20) NOT NULL,
    vendedor_asignado VARCHAR(200),
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_creacion DATE,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_dim_clientes_cluster (u_cluster),
    INDEX idx_dim_clientes_retail (retail),
    INDEX idx_dim_clientes_vendedor (vendedor_asignado),
    INDEX idx_dim_clientes_estado (estado)
);

-- ============================================
-- DIM_ARTICULOS
-- ============================================
CREATE TABLE dim_articulos (
    id_articulo SERIAL PRIMARY KEY,
    codigo_articulo VARCHAR(100) UNIQUE NOT NULL,
    descripcion VARCHAR(500),
    clasificacion_1 VARCHAR(50),
    clasificacion_2 VARCHAR(50) NOT NULL, -- SubCategoría: G21, G11, etc
    u_surtido_n INT NOT NULL, -- Grupo 1-23
    articulo_del_proveedor VARCHAR(200),
    precio_unitario NUMERIC(10,2),
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_dim_articulos_surtido (u_surtido_n),
    INDEX idx_dim_articulos_subcategoria (clasificacion_2)
);

-- ============================================
-- DIM_SURTIDO_OBLIGATORIO
-- Mapea: CLUSTER → GRUPO → Cantidad de SKUs
-- ============================================
CREATE TABLE dim_surtido_obligatorio (
    id_surtido SERIAL PRIMARY KEY,
    u_cluster VARCHAR(20) NOT NULL,
    u_surtido_n INT NOT NULL,
    cantidad_articulos INT, -- Cuántos SKUs distintos hay en este grupo
    es_obligatorio BOOLEAN DEFAULT TRUE,
    
    UNIQUE(u_cluster, u_surtido_n),
    INDEX idx_surtido_cluster (u_cluster),
    INDEX idx_surtido_grupo (u_surtido_n)
);

-- Datos iniciales para esta tabla:
-- BRONZE: Grupos 1-17
-- SILVER: Grupos 1-21
-- GOLD: Grupos 1-11

-- ============================================
-- DIM_CRITERIOS_DISTRIBUCION
-- Define umbrales por RETAIL
-- ============================================
CREATE TABLE dim_criterios_distribucion (
    id SERIAL PRIMARY KEY,
    retail VARCHAR(50) UNIQUE NOT NULL,
    minimo_compras INT NOT NULL,
    periodo_dias INT NOT NULL DEFAULT 30,
    
    -- Datos:
    -- COLMADO: 3 compras, 30 días
    -- AUTOSERVICIO: 6 compras, 30 días
    -- MAYORISTA: 6 compras, 30 días
);
```

### FACT TABLES (Transacciones)

```sql
-- ============================================
-- FACT_VENTAS
-- ============================================
CREATE TABLE fact_ventas (
    id_venta SERIAL PRIMARY KEY,
    id_factura VARCHAR(100) NOT NULL,
    id_cliente INT NOT NULL REFERENCES dim_clientes(id_cliente),
    id_articulo INT NOT NULL REFERENCES dim_articulos(id_articulo),
    id_fecha DATE NOT NULL REFERENCES dim_tiempo(id_fecha),
    cantidad INT NOT NULL,
    monto NUMERIC(12,2),
    
    -- Desnormalizadas para performance
    codigo_cliente VARCHAR(50),
    codigo_articulo VARCHAR(100),
    retail VARCHAR(50),
    u_cluster VARCHAR(20),
    vendedor VARCHAR(200),
    clasificacion_2 VARCHAR(50),
    u_surtido_n INT,
    
    UNIQUE(id_factura, id_articulo),
    
    INDEX idx_fact_ventas_cliente (id_cliente),
    INDEX idx_fact_ventas_fecha (id_fecha),
    INDEX idx_fact_ventas_articulo (id_articulo),
    INDEX idx_fact_ventas_retail (retail),
    INDEX idx_fact_ventas_cluster (u_cluster),
    INDEX idx_fact_ventas_vendedor (vendedor),
    INDEX idx_fact_ventas_fecha_cliente (id_fecha, id_cliente)
);
```

### MATERIALIZED VIEWS (KPIs Precalculados)

```sql
-- ============================================
-- MV_DISTRIBUCION_POR_RETAIL_Y_SUBCATEGORIA
-- ============================================
CREATE MATERIALIZED VIEW mv_distribucion_por_retail AS
WITH clientes_por_retail AS (
    SELECT
        retail,
        COUNT(DISTINCT id_cliente) AS total_clientes
    FROM dim_clientes
    WHERE estado = 'Activo'
    GROUP BY retail
),
clientes_compra_sku AS (
    SELECT
        fv.retail,
        da.clasificacion_2 AS subcategoria,
        fv.id_cliente,
        COUNT(*) AS cantidad_compras
    FROM fact_ventas fv
    JOIN dim_articulos da ON fv.id_articulo = da.id_articulo
    WHERE fv.id_fecha >= CURRENT_DATE - 30
    GROUP BY fv.retail, da.clasificacion_2, fv.id_cliente
),
clientes_que_cumplen_umbral AS (
    SELECT
        ccs.retail,
        ccs.subcategoria,
        COUNT(DISTINCT ccs.id_cliente) AS clientes_que_compraron,
        dcd.minimo_compras
    FROM clientes_compra_sku ccs
    JOIN dim_criterios_distribucion dcd ON ccs.retail = dcd.retail
    WHERE ccs.cantidad_compras >= dcd.minimo_compras
    GROUP BY ccs.retail, ccs.subcategoria, dcd.minimo_compras
)
SELECT
    cpr.retail,
    ccq.subcategoria,
    cpr.total_clientes,
    COALESCE(ccq.clientes_que_compraron, 0) AS resultado,
    ROUND(
        (COALESCE(ccq.clientes_que_compraron, 0)::NUMERIC / cpr.total_clientes) * 100, 2
    ) AS distribucion_porcentaje
FROM clientes_por_retail cpr
CROSS JOIN (SELECT DISTINCT subcategoria FROM dim_articulos) subcat
LEFT JOIN clientes_que_cumplen_umbral ccq 
    ON cpr.retail = ccq.retail 
    AND subcat.subcategoria = ccq.subcategoria
ORDER BY cpr.retail, ccq.subcategoria;

-- ============================================
-- MV_DISTRIBUCION_POR_CLUSTER_Y_SUBCATEGORIA
-- ============================================
CREATE MATERIALIZED VIEW mv_distribucion_por_cluster AS
WITH clientes_por_cluster AS (
    SELECT
        u_cluster,
        COUNT(DISTINCT id_cliente) AS total_clientes
    FROM dim_clientes
    WHERE estado = 'Activo'
    GROUP BY u_cluster
),
clientes_compra_sku AS (
    SELECT
        fv.u_cluster,
        da.clasificacion_2 AS subcategoria,
        fv.id_cliente,
        COUNT(*) AS cantidad_compras,
        fv.retail
    FROM fact_ventas fv
    JOIN dim_articulos da ON fv.id_articulo = da.id_articulo
    WHERE fv.id_fecha >= CURRENT_DATE - 30
    GROUP BY fv.u_cluster, da.clasificacion_2, fv.id_cliente, fv.retail
),
clientes_que_cumplen_umbral AS (
    SELECT
        ccs.u_cluster,
        ccs.subcategoria,
        COUNT(DISTINCT ccs.id_cliente) AS clientes_que_compraron
    FROM clientes_compra_sku ccs
    JOIN dim_criterios_distribucion dcd ON ccs.retail = dcd.retail
    WHERE ccs.cantidad_compras >= dcd.minimo_compras
    GROUP BY ccs.u_cluster, ccs.subcategoria
)
SELECT
    cpc.u_cluster,
    ccq.subcategoria,
    cpc.total_clientes,
    COALESCE(ccq.clientes_que_compraron, 0) AS resultado,
    ROUND(
        (COALESCE(ccq.clientes_que_compraron, 0)::NUMERIC / cpc.total_clientes) * 100, 2
    ) AS distribucion_porcentaje
FROM clientes_por_cluster cpc
CROSS JOIN (SELECT DISTINCT subcategoria FROM dim_articulos) subcat
LEFT JOIN clientes_que_cumplen_umbral ccq 
    ON cpc.u_cluster = ccq.u_cluster 
    AND subcat.subcategoria = ccq.subcategoria
ORDER BY cpc.u_cluster, ccq.subcategoria;

-- ============================================
-- MV_DISTRIBUCION_POR_VENDEDOR
-- ============================================
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
clientes_compra_sku AS (
    SELECT
        fv.vendedor,
        fv.retail,
        da.clasificacion_2 AS subcategoria,
        fv.id_cliente,
        COUNT(*) AS cantidad_compras
    FROM fact_ventas fv
    JOIN dim_articulos da ON fv.id_articulo = da.id_articulo
    WHERE fv.id_fecha >= CURRENT_DATE - 30
    GROUP BY fv.vendedor, fv.retail, da.clasificacion_2, fv.id_cliente
),
clientes_que_cumplen_umbral AS (
    SELECT
        ccs.vendedor,
        ccs.subcategoria,
        COUNT(DISTINCT ccs.id_cliente) AS clientes_que_compraron
    FROM clientes_compra_sku ccs
    JOIN dim_criterios_distribucion dcd ON ccs.retail = dcd.retail
    WHERE ccs.cantidad_compras >= dcd.minimo_compras
    GROUP BY ccs.vendedor, ccs.subcategoria
)
SELECT
    cxv.vendedor,
    cxv.retail,
    ccq.subcategoria,
    cxv.total_clientes,
    COALESCE(ccq.clientes_que_compraron, 0) AS resultado,
    ROUND(
        (COALESCE(ccq.clientes_que_compraron, 0)::NUMERIC / cxv.total_clientes) * 100, 2
    ) AS distribucion_porcentaje
FROM clientes_x_vendedor cxv
CROSS JOIN (SELECT DISTINCT subcategoria FROM dim_articulos) subcat
LEFT JOIN clientes_que_cumplen_umbral ccq 
    ON cxv.vendedor = ccq.vendedor 
    AND subcat.subcategoria = ccq.subcategoria
ORDER BY cxv.vendedor, ccq.subcategoria;

-- ============================================
-- MV_SURTIDO_POR_CLIENTE
-- ============================================
CREATE MATERIALIZED VIEW mv_surtido_por_cliente AS
WITH subcategorias_obligatorias_cliente AS (
    SELECT
        dc.id_cliente,
        dc.codigo_cliente,
        dc.nombre_cliente,
        dc.retail,
        dc.u_cluster,
        dc.vendedor_asignado,
        dso.u_surtido_n
    FROM dim_clientes dc
    JOIN dim_surtido_obligatorio dso ON dc.u_cluster = dso.u_cluster
    WHERE dc.estado = 'Activo'
),
subcategorias_compradas AS (
    SELECT
        fv.id_cliente,
        fv.u_cluster,
        COUNT(DISTINCT fv.u_surtido_n) AS cant_subcategorias_compradas
    FROM fact_ventas fv
    WHERE fv.id_fecha >= CURRENT_DATE - 30
    GROUP BY fv.id_cliente, fv.u_cluster
),
total_obligatorio_por_cluster AS (
    SELECT
        u_cluster,
        COUNT(DISTINCT u_surtido_n) AS cant_obligatorio
    FROM dim_surtido_obligatorio
    WHERE es_obligatorio = TRUE
    GROUP BY u_cluster
)
SELECT
    socc.id_cliente,
    socc.codigo_cliente,
    socc.nombre_cliente,
    socc.retail,
    socc.u_cluster,
    socc.vendedor_asignado,
    COALESCE(sc.cant_subcategorias_compradas, 0) AS subcategorias_compradas,
    topc.cant_obligatorio AS subcategorias_obligatorias,
    ROUND(
        (COALESCE(sc.cant_subcategorias_compradas, 0)::NUMERIC / topc.cant_obligatorio) * 100, 2
    ) AS surtido_porcentaje
FROM subcategorias_obligatorias_cliente socc
LEFT JOIN subcategorias_compradas sc ON socc.id_cliente = sc.id_cliente
JOIN total_obligatorio_por_cluster topc ON socc.u_cluster = topc.u_cluster
GROUP BY socc.id_cliente, socc.codigo_cliente, socc.nombre_cliente, 
         socc.retail, socc.u_cluster, socc.vendedor_asignado,
         sc.cant_subcategorias_compradas, topc.cant_obligatorio
ORDER BY socc.u_cluster DESC, surtido_porcentaje ASC;

-- ============================================
-- MV_CLIENTES_NO_VISITADOS
-- ============================================
CREATE MATERIALIZED VIEW mv_clientes_no_visitados AS
SELECT
    dc.id_cliente,
    dc.codigo_cliente,
    dc.nombre_cliente,
    dc.retail,
    dc.u_cluster,
    dc.vendedor_asignado,
    MAX(fv.id_fecha) AS ultima_compra,
    CURRENT_DATE - MAX(fv.id_fecha) AS dias_sin_compra
FROM dim_clientes dc
LEFT JOIN fact_ventas fv ON dc.id_cliente = fv.id_cliente
WHERE dc.estado = 'Activo'
GROUP BY dc.id_cliente, dc.codigo_cliente, dc.nombre_cliente, 
         dc.retail, dc.u_cluster, dc.vendedor_asignado
HAVING MAX(fv.id_fecha) IS NULL OR MAX(fv.id_fecha) < CURRENT_DATE - 15
ORDER BY ultima_compra ASC NULLS FIRST;

-- ============================================
-- MV_RESUMEN_KPI_GENERAL
-- ============================================
CREATE MATERIALIZED VIEW mv_resumen_kpi_general AS
SELECT
    (SELECT COUNT(*) FROM dim_clientes WHERE estado = 'Activo') AS total_clientes,
    (SELECT COUNT(DISTINCT id_cliente) FROM fact_ventas WHERE id_fecha >= CURRENT_DATE - 30) AS clientes_activos_mes,
    (SELECT ROUND(AVG(surtido_porcentaje), 2) FROM mv_surtido_por_cliente) AS surtido_promedio,
    (SELECT ROUND(AVG(distribucion_porcentaje), 2) FROM mv_distribucion_por_retail) AS distribucion_promedio,
    CURRENT_DATE AS fecha_actualizacion;
```

---

## 🔄 QUERIES ETL

### EXTRACCIÓN DESDE MSSQL

#### Query 1: Extrae Clientes
```sql
-- Ejecutar en MSSQL contra ERP
SELECT
    ISNULL(C.codigo_cliente, '') AS codigo_cliente,
    ISNULL(C.nombre_cliente, '') AS nombre_cliente,
    ISNULL(C.CATEGORIA_CLIENTE, 'OT') AS categoria_cliente,
    ISNULL(C.U_CLUSTER, 'BRONZE') AS u_cluster,
    ISNULL(C.vendedor_responsable, '') AS vendedor_asignado,
    ISNULL(C.estado, 'Activo') AS estado,
    CONVERT(DATE, GETDATE()) AS fecha_creacion
FROM CLIENTES C
WHERE C.estado = 'Activo'
ORDER BY C.codigo_cliente;
```

#### Query 2: Extrae Artículos
```sql
-- Ejecutar en MSSQL contra ERP
SELECT
    ISNULL(A.codigo_articulo, '') AS codigo_articulo,
    ISNULL(A.descripcion, '') AS descripcion,
    ISNULL(A.clasificacion_1, '') AS clasificacion_1,
    ISNULL(A.clasificacion_2, '') AS clasificacion_2,
    ISNULL(A.U_SURTIDO_N, 0) AS u_surtido_n,
    ISNULL(A.ARTICULO_DEL_PROVEEDOR, '') AS articulo_del_proveedor,
    ISNULL(A.precio_unitario, 0) AS precio_unitario
FROM ARTICULO A
WHERE A.estado = 'Activo' AND A.U_SURTIDO_N IS NOT NULL AND A.U_SURTIDO_N > 0
ORDER BY A.codigo_articulo;
```

#### Query 3: Extrae Facturas (últimos 60 días)
```sql
-- Ejecutar en MSSQL contra ERP
SELECT
    CONVERT(VARCHAR(100), F.id_factura) AS id_factura,
    F.codigo_cliente,
    CONVERT(DATE, F.fecha_factura) AS fecha_factura,
    ISNULL(F.estado_factura, 'Activo') AS estado_factura
FROM FACTURA F
WHERE CONVERT(DATE, F.fecha_factura) >= DATEADD(day, -60, CAST(GETDATE() AS DATE))
  AND F.estado_factura != 'Cancelada'
ORDER BY F.fecha_factura DESC;
```

#### Query 4: Extrae Líneas de Factura
```sql
-- Ejecutar en MSSQL contra ERP
SELECT
    CONVERT(VARCHAR(100), FL.id_factura) AS id_factura,
    FL.codigo_articulo,
    FL.cantidad,
    FL.monto_total
FROM FACTURA_LINEAS FL
WHERE FL.id_factura IN (
    SELECT F.id_factura
    FROM FACTURA F
    WHERE CONVERT(DATE, F.fecha_factura) >= DATEADD(day, -60, CAST(GETDATE() AS DATE))
)
ORDER BY FL.id_factura, FL.codigo_articulo;
```

### CARGA EN POSTGRESQL

#### Script 1: Cargar Clientes (UPSERT)
```sql
-- PostgreSQL
INSERT INTO dim_clientes (codigo_cliente, nombre_cliente, categoria_cliente, retail, u_cluster, vendedor_asignado, estado, fecha_creacion)
SELECT
    stc.codigo_cliente,
    stc.nombre_cliente,
    stc.categoria_cliente,
    CASE stc.categoria_cliente
        WHEN 'A1' THEN 'COLMADO'
        WHEN 'A2' THEN 'COLMADO'
        WHEN 'A3' THEN 'COLMADO'
        WHEN 'C1' THEN 'AUTOSERVICIO'
        WHEN 'C2' THEN 'AUTOSERVICIO'
        WHEN 'C3' THEN 'AUTOSERVICIO'
        WHEN 'D1' THEN 'MAYORISTA'
        WHEN 'D2' THEN 'MAYORISTA'
        WHEN 'Q1' THEN 'MAYORISTA'
        WHEN 'SUR' THEN 'MAYORISTA'
        ELSE 'OTROS'
    END AS retail,
    stc.u_cluster,
    stc.vendedor_asignado,
    stc.estado,
    stc.fecha_creacion
FROM stg_clientes stc
ON CONFLICT (codigo_cliente) DO UPDATE SET
    nombre_cliente = EXCLUDED.nombre_cliente,
    categoria_cliente = EXCLUDED.categoria_cliente,
    u_cluster = EXCLUDED.u_cluster,
    vendedor_asignado = EXCLUDED.vendedor_asignado,
    estado = EXCLUDED.estado,
    fecha_actualizacion = CURRENT_TIMESTAMP;
```

#### Script 2: Cargar Artículos (UPSERT)
```sql
-- PostgreSQL
INSERT INTO dim_articulos (codigo_articulo, descripcion, clasificacion_1, clasificacion_2, u_surtido_n, articulo_del_proveedor, precio_unitario)
SELECT
    sta.codigo_articulo,
    sta.descripcion,
    sta.clasificacion_1,
    sta.clasificacion_2,
    sta.u_surtido_n,
    sta.articulo_del_proveedor,
    sta.precio_unitario
FROM stg_articulos sta
ON CONFLICT (codigo_articulo) DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    clasificacion_1 = EXCLUDED.clasificacion_1,
    clasificacion_2 = EXCLUDED.clasificacion_2,
    u_surtido_n = EXCLUDED.u_surtido_n,
    precio_unitario = EXCLUDED.precio_unitario,
    fecha_actualizacion = CURRENT_TIMESTAMP;
```

#### Script 3: Cargar Ventas (UPSERT)
```sql
-- PostgreSQL
INSERT INTO fact_ventas (
    id_factura, id_cliente, id_articulo, id_fecha, cantidad, monto,
    codigo_cliente, codigo_articulo, retail, u_cluster, vendedor,
    clasificacion_2, u_surtido_n
)
SELECT
    stfl.id_factura,
    dc.id_cliente,
    da.id_articulo,
    stf.fecha_factura,
    stfl.cantidad,
    stfl.monto_total,
    stf.codigo_cliente,
    stfl.codigo_articulo,
    dc.retail,
    dc.u_cluster,
    dc.vendedor_asignado,
    da.clasificacion_2,
    da.u_surtido_n
FROM stg_factura_lineas stfl
JOIN stg_facturas stf ON stfl.id_factura = stf.id_factura
JOIN dim_clientes dc ON stf.codigo_cliente = dc.codigo_cliente
JOIN dim_articulos da ON stfl.codigo_articulo = da.codigo_articulo
ON CONFLICT (id_factura, id_articulo) DO UPDATE SET
    cantidad = EXCLUDED.cantidad,
    monto = EXCLUDED.monto;
```

---

## 🌐 APIS REST (Backend Node.js/Express)

### Autenticación
```
POST /api/auth/login
Entrada: { usuario: "admin", contraseña: "..." }
Salida: { token: "jwt_token", expira_en: 3600 }
```

### ETL Control
```
GET /api/etl/status
Salida: {
  sincronizando: boolean,
  ultima_sincronizacion: "2026-07-17 23:45:00",
  proxima_sincronizacion: "2026-07-18 23:00:00",
  procentaje_completitud: 87,
  estado_detalles: {
    clientes: { estado: "completado", registros: 8055 },
    articulos: { estado: "completado", registros: 450 },
    ventas: { estado: "en_proceso", registros: 15000 },
    kpis: { estado: "pendiente" }
  }
}

POST /api/etl/trigger-manual
Salida: { mensaje: "Sincronización iniciada", id_sync: 123 }

POST /api/etl/pause
Salida: { mensaje: "Cron jobs pausados" }

POST /api/etl/resume
Salida: { mensaje: "Cron jobs reanudados" }
```

### Logs
```
GET /api/etl/logs?limite=50&tipo=ventas
Salida: [
  {
    id_sync: 123,
    tipo_tabla: "ventas",
    fecha_inicio: "2026-07-17 23:30:00",
    fecha_fin: "2026-07-17 23:45:00",
    estado: "completado",
    registros_procesados: 15000,
    registros_insertados: 14500,
    registros_actualizados: 500
  },
  ...
]

GET /api/etl/logs/:id
Salida: { ...detalles completos del log... }
```

### KPIs
```
GET /api/kpi/distribucion?retail=COLMADO&periodo=30
Salida: [
  {
    subcategoria: "G21",
    resultado: 7723,
    objetivo: 7723,
    distribucion_porcentaje: 97.08,
    logro_porcentaje: 100.00
  },
  ...
]

GET /api/kpi/distribucion-por-vendedor?vendedor=Juan García
Salida: [
  {
    subcategoria: "G21",
    resultado: 245,
    distribucion_porcentaje: 95.30
  },
  ...
]

GET /api/kpi/surtido?cluster=BRONZE
Salida: [
  {
    id_cliente: 1,
    codigo_cliente: "12504",
    nombre_cliente: "Colmado El Pollo",
    surtido_porcentaje: 87.50,
    subcategorias_compradas: 14,
    subcategorias_obligatorias: 16
  },
  ...
]

GET /api/kpi/clientes-no-visitados?dias=15
Salida: [
  {
    id_cliente: 55,
    codigo_cliente: "10200",
    nombre_cliente: "Bodega La Economia",
    retail: "COLMADO",
    cluster: "SILVER",
    vendedor: "María López",
    dias_sin_compra: 25
  },
  ...
]

GET /api/kpi/resumen
Salida: {
  total_clientes: 8055,
  clientes_activos_mes: 6200,
  surtido_promedio: 82.45,
  distribucion_promedio: 78.90,
  fecha_actualizacion: "2026-07-17 23:45:00"
}
```

---

## ⚙️ CRON JOBS

### Configuración con node-cron

```javascript
// backend/src/config/cron.ts

const cron = require('node-cron');

// 23:00 - Sincronizar Clientes
cron.schedule('0 23 * * *', async () => {
  await ETLService.syncClientes();
});

// 23:15 - Sincronizar Artículos
cron.schedule('15 23 * * *', async () => {
  await ETLService.syncArticulos();
});

// 23:30 - Sincronizar Ventas
cron.schedule('30 23 * * *', async () => {
  await ETLService.syncVentas();
});

// 23:45 - Calcular KPIs
cron.schedule('45 23 * * *', async () => {
  await KPIService.calcularKPIs();
});

// 00:00 - Refrescar Vistas Materializadas
cron.schedule('0 0 * * *', async () => {
  await PostgreSQLService.refreshMaterializedViews();
});

// 06:00 - Enviar Resumen por Telegram (Opcional)
cron.schedule('0 6 * * *', async () => {
  await TelegramService.enviarResumen();
});
```

---

## 📱 APLICACIÓN REACT

### Estructura de Componentes (Atomic Design)

**Atomos:**
- Button.tsx (variants: primary, danger, success)
- Badge.tsx (estado: activo, error, advertencia)
- Spinner.tsx (loading indicator)
- Icon.tsx (iconos SVG)
- ProgressBar.tsx

**Moléculas:**
- SyncStatus.tsx (muestra si está sincronizando)
- KPICard.tsx (tarjeta con KPI + métrica)
- LogEntry.tsx (fila de log)
- AlertBanner.tsx (notificación)

**Organismos:**
- ETLDashboard.tsx (panel principal)
- KPIMonitor.tsx (KPIs principales)
- SyncHistory.tsx (historial de sincronizaciones)
- Settings.tsx (configuración de cron jobs)

**Páginas:**
- /dashboard → ETLControlPanel
- /kpis → KPIDashboard
- /logs → SyncLogs
- /settings → Settings

### Context (Estado Global)

```javascript
// src/contexts/ETLContext.tsx
interface ETLContextType {
  isSyncing: boolean;
  lastSync: Date | null;
  nextSync: Date | null;
  syncProgress: number; // 0-100
  triggerManualSync: () => Promise<void>;
  pauseSync: () => Promise<void>;
  resumeSync: () => Promise<void>;
  loadStatus: () => Promise<void>;
}

// src/contexts/KPIContext.tsx
interface KPIContextType {
  distribucion: DistribucionData[];
  surtido: SurtidoData[];
  clientesNoVisitados: ClienteNoVisitadoData[];
  resumenGeneral: ResumenKPIData;
  isLoading: boolean;
  loadKPIs: () => Promise<void>;
  filterByRetail: (retail: string) => void;
}
```

---

## 📋 RESUMEN DE IMPLEMENTACIÓN

### Fase 1: Base de Datos (PostgreSQL)
- [ ] Crear todas las tablas
- [ ] Crear índices
- [ ] Crear vistas materializadas
- [ ] Insertar datos iniciales (surtido_obligatorio, criterios_distribucion)

### Fase 2: Backend ETL (Node.js)
- [ ] Conectar a MSSQL ERP
- [ ] Crear servicios de extracción (queries MSSQL)
- [ ] Crear servicios de carga (UPSERT a PostgreSQL)
- [ ] Implementar cron jobs
- [ ] Crear APIs REST
- [ ] Implementar autenticación JWT
- [ ] Logging y manejo de errores

### Fase 3: Frontend (React)
- [ ] Crear componentes atómicos
- [ ] Implementar contexts (ETL, KPI)
- [ ] Crear páginas principales
- [ ] Integrar con APIs
- [ ] Diseño responsive con Tailwind CSS

### Fase 4: Testing y Deployment
- [ ] Tests unitarios e integración
- [ ] Docker Compose
- [ ] Documentación completa

---

## 📞 CONTACTO Y NOTAS

**Desarrollador:** Heriberto González  
**Email:** heriberto777@gmail.com  
**Teléfono:** +1 (829) 848-0314

**Notas Técnicas:**
- Usar TypeScript en backend y frontend
- Naming convention: camelCase para JS, snake_case para SQL
- Seguir principios SOLID en código
- Implementar DRY (Don't Repeat Yourself)
- Versionamiento semántico: v1.0.0

---

**FIN DE ESPECIFICACIÓN TÉCNICA**
