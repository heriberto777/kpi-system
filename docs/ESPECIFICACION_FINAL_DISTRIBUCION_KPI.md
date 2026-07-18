# 🎯 ESPECIFICACIÓN FINAL ACTUALIZADA - DISTRIBUCIÓN CON TABLAS DEL ERP

**Versión:** 2.0  
**Estado:** FINAL - Listo para Claude Code

---

## 📊 NUEVA LÓGICA DE DISTRIBUCIÓN

### **Componentes:**

1. **dbo.universo_cliente** - Universo de clientes por RETAIL y MES
2. **dbo.distribucion** - Objetivos de distribución por RETAIL y SUBCATEGORIA
3. **dbo.cuota** - Cuotas de vendedores (futuro - no usar por ahora)

---

## 🔄 JOBS ACTUALIZADOS (5 JOBS TOTALES)

### **Job 1: SYNC UNIVERSO (22:45)**
Traer universo de clientes activos por RETAIL

```sql
SELECT 
    CONVERT(VARCHAR(7), GETDATE(), 121) AS anno_mes,  -- 2026-07
    CASE 
        WHEN retail = 'C' THEN 'COLMADO'
        WHEN retail = 'A' THEN 'AUTOSERVICIO'
        WHEN retail = 'M' THEN 'MAYORISTA'
        ELSE 'OTROS'
    END AS retail,
    COUNT(DISTINCT C.CLIENTE) AS universo,
    'Activo' AS estado
FROM CATELLI.CLIENTE C
WHERE C.ACTIVO = 'S'
GROUP BY CASE 
    WHEN retail = 'C' THEN 'COLMADO'
    WHEN retail = 'A' THEN 'AUTOSERVICIO'
    WHEN retail = 'M' THEN 'MAYORISTA'
    ELSE 'OTROS'
END;
```

**Nota:** Si el campo `retail` en CLIENTE no existe, hacer el mapeo con CATEGORIA_CLIENTE como hicimos antes.

---

### **Job 2: SYNC CLIENTES (23:00)**
```sql
SELECT
    ISNULL(C.CLIENTE, '') AS codigo_cliente,
    ISNULL(C.NOMBRE, '') AS nombre_cliente,
    ISNULL(C.CATEGORIA_CLIENTE, 'OT') AS categoria_cliente,
    ISNULL(C.U_CLUSTER, 'BRONZE') AS u_cluster,
    ISNULL(C.VENDEDOR, '') AS vendedor_asignado,
    CASE WHEN C.ACTIVO = 'S' THEN 'Activo' ELSE 'Inactivo' END AS estado,
    CONVERT(DATE, GETDATE()) AS fecha_creacion
FROM CATELLI.CLIENTE C
WHERE C.ACTIVO = 'S'
ORDER BY C.CLIENTE;
```

---

### **Job 3: SYNC ARTÍCULOS (23:15)**
⚠️ **CAMBIO IMPORTANTE:** Traer TODOS los artículos, no solo surtido

```sql
SELECT
    ISNULL(A.ARTICULO, '') AS codigo_articulo,
    ISNULL(A.DESCRIPCION, '') AS descripcion,
    ISNULL(A.CLASIFICACION_1, '') AS clasificacion_1,
    ISNULL(A.CLASIFICACION_2, '') AS clasificacion_2,  -- G21, G22, G11, etc
    ISNULL(A.U_SURTIDO_N, 0) AS u_surtido_n,
    ISNULL(A.ARTICULO_DEL_PROV, '') AS articulo_del_proveedor,
    NULL AS precio_unitario
FROM CATELLI.ARTICULO A
WHERE A.ACTIVO = 'S'
ORDER BY A.ARTICULO;
```

**Nota:** Sin filtro de `U_SURTIDO_N`. Traemos TODOS porque DISTRIBUCIÓN es por SUBCATEGORIA (G21, G22, G11, etc.), no solo surtido.

---

### **Job 4: SYNC DISTRIBUCIÓN Y VENTAS (23:30)**

#### **PARTE A: Sincronizar tabla dbo.distribucion**

```sql
-- Desde ERP: dbo.distribucion
SELECT
    retail,
    subcategoria AS clasificacion_2,  -- G21, G22, G11, G13, G33, G32, G44, G23, G24, G50, G49
    objetivos AS objetivo_clientes,
    objetivos_pesos AS objetivo_monto
FROM dbo.distribucion
WHERE estado = 'Activo';
```

**Esto en PostgreSQL se carga en:**
```sql
CREATE TABLE dim_objetivos_distribucion (
    id SERIAL PRIMARY KEY,
    retail VARCHAR(50) NOT NULL,
    clasificacion_2 VARCHAR(50) NOT NULL,
    objetivo_clientes INT,
    objetivo_monto NUMERIC(15,2),
    UNIQUE(retail, clasificacion_2)
);
```

#### **PARTE B: Sincronizar ventas (igual que antes)**

```sql
-- Facturas
SELECT
    CONVERT(VARCHAR(100), F.FACTURA) AS id_factura,
    F.CLIENTE AS codigo_cliente,
    CONVERT(DATE, F.FECHA) AS fecha_factura,
    CASE WHEN F.ANULADA = 'S' THEN 'Anulada' ELSE 'Activa' END AS estado_factura
FROM CATELLI.FACTURA F
WHERE CONVERT(DATE, F.FECHA) >= DATEADD(day, -60, CAST(GETDATE() AS DATE))
  AND F.ANULADA != 'S'
ORDER BY F.FECHA DESC;

-- Líneas
SELECT 
    CONVERT(VARCHAR(100), FL.FACTURA) AS id_factura,
    FL.ARTICULO AS codigo_articulo,
    FL.cantidad,
    FL.precio_unitario,
    (FL.cantidad * FL.precio_unitario) AS monto_total
FROM CATELLI.FACTURA_LINEA FL
WHERE FL.FACTURA IN (
    SELECT F.FACTURA FROM CATELLI.FACTURA F
    WHERE CONVERT(DATE, F.FECHA) >= DATEADD(day, -60, CAST(GETDATE() AS DATE))
      AND F.ANULADA != 'S'
)
ORDER BY FL.FACTURA, FL.ARTICULO;
```

---

### **Job 5: SYNC UNIVERSO Y CALCULAR KPIs (23:45)**

#### **PARTE A: Sincronizar universo_cliente**

```sql
-- Desde ERP: dbo.universo_cliente
SELECT
    anno_mes,
    retail,
    universo,
    estado
FROM dbo.universo_cliente
WHERE estado = 'Activo'
  AND anno_mes >= CONVERT(VARCHAR(7), DATEADD(month, -3, GETDATE()), 121)  -- Últimos 3 meses
ORDER BY anno_mes DESC;
```

**En PostgreSQL:**
```sql
CREATE TABLE dim_universo_cliente (
    id SERIAL PRIMARY KEY,
    anno_mes VARCHAR(7),  -- 2026-07
    retail VARCHAR(50) NOT NULL,
    universo INT NOT NULL,
    estado VARCHAR(20),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(anno_mes, retail)
);
```

#### **PARTE B: Refrescar vistas materializadas**

```sql
REFRESH MATERIALIZED VIEW mv_distribucion_por_retail;
REFRESH MATERIALIZED VIEW mv_distribucion_por_cluster;
REFRESH MATERIALIZED VIEW mv_distribucion_por_vendedor;
REFRESH MATERIALIZED VIEW mv_surtido_por_cliente;
REFRESH MATERIALIZED VIEW mv_clientes_no_visitados;
REFRESH MATERIALIZED VIEW mv_resumen_kpi_general;
```

---

## 📐 NUEVA VISTA: DISTRIBUCIÓN CORRECTA

### **MV_DISTRIBUCION_POR_RETAIL (Actualizada)**

```sql
CREATE MATERIALIZED VIEW mv_distribucion_por_retail AS
WITH clientes_compra_subcategoria AS (
    -- Contar clientes que compraron cada SUBCATEGORIA (con umbral)
    SELECT
        fv.retail,
        da.clasificacion_2,
        COUNT(DISTINCT fv.id_cliente) AS clientes_que_compraron
    FROM fact_ventas fv
    JOIN dim_articulos da ON fv.id_articulo = da.id_articulo
    WHERE fv.id_fecha >= CURRENT_DATE - 30
      AND fv.clasificacion_2 IS NOT NULL
    GROUP BY fv.retail, da.clasificacion_2
)
SELECT
    od.retail,
    od.clasificacion_2,
    COALESCE(cwc.clientes_que_compraron, 0) AS resultado,
    od.objetivo_clientes AS obj2,
    ROUND(
        (COALESCE(cwc.clientes_que_compraron, 0)::NUMERIC / od.objetivo_clientes) * 100, 2
    ) AS logro_porcentaje,
    ROUND(
        (COALESCE(cwc.clientes_que_compraron, 0)::NUMERIC / duc.universo) * 100, 2
    ) AS distribucion_porcentaje
FROM dim_objetivos_distribucion od
LEFT JOIN clientes_compra_subcategoria cwc 
    ON od.retail = cwc.retail 
    AND od.clasificacion_2 = cwc.clasificacion_2
LEFT JOIN dim_universo_cliente duc 
    ON od.retail = duc.retail 
    AND duc.anno_mes = CONVERT(VARCHAR(7), CURRENT_DATE, 121)
ORDER BY od.retail, od.clasificacion_2;
```

**Campos:**
- `resultado` = Clientes que compraron la subcategoría
- `obj2` = Objetivo de clientes (del ERP)
- `logro_porcentaje` = (resultado / obj2) * 100
- `distribucion_porcentaje` = (resultado / universo) * 100

---

## 🗄️ ESTRUCTURA POSTGRESQL FINAL

### **Tablas Nuevas/Actualizadas**

```sql
-- Universo de clientes por retail y mes
CREATE TABLE dim_universo_cliente (
    id SERIAL PRIMARY KEY,
    anno_mes VARCHAR(7),
    retail VARCHAR(50),
    universo INT,
    estado VARCHAR(20),
    UNIQUE(anno_mes, retail)
);

-- Objetivos de distribución (del ERP)
CREATE TABLE dim_objetivos_distribucion (
    id SERIAL PRIMARY KEY,
    retail VARCHAR(50),
    clasificacion_2 VARCHAR(50),
    objetivo_clientes INT,
    objetivo_monto NUMERIC(15,2),
    UNIQUE(retail, clasificacion_2)
);

-- Cuotas de vendedores (futuro)
CREATE TABLE dim_cuota_vendedor (
    id SERIAL PRIMARY KEY,
    anno_mes VARCHAR(7),
    vendedor VARCHAR(200),
    cuota_monto NUMERIC(15,2),
    estado VARCHAR(20)
);

-- Artículos (SIN filtro de surtido - TODOS)
-- fact_ventas sigue igual

-- Vistas materializadas (actualizadas con nueva lógica)
-- mv_distribucion_por_retail (arriba)
-- mv_distribucion_por_cluster (usar clasificacion_2)
-- mv_distribucion_por_vendedor (usar clasificacion_2)
```

---

## 🔀 MAPEO RETAIL (Actualizado)

Si CLIENTE no tiene campo `retail`, usar CATEGORIA_CLIENTE:

```typescript
const mapRetail = (categoria_cliente: string): string => {
  const retail: Record<string, string> = {
    'A1': 'COLMADO',
    'A2': 'COLMADO',
    'A3': 'COLMADO',
    'C1': 'AUTOSERVICIO',
    'C2': 'AUTOSERVICIO',
    'C3': 'AUTOSERVICIO',
    'D1': 'MAYORISTA',
    'D2': 'MAYORISTA',
    'Q1': 'MAYORISTA',
    'SUR': 'MAYORISTA',
  };
  return retail[categoria_cliente] || 'OTROS';
};
```

---

## 📋 CHECKLIST FINAL

- [ ] Queries exactas del ERP (CLIENTE, ARTICULO, FACTURA, FACTURA_LINEA)
- [ ] **NUEVA:** Query de dbo.distribucion (objetivos)
- [ ] **NUEVA:** Query de dbo.universo_cliente
- [ ] **NUEVA:** Query de dbo.cuota (opcional por ahora)
- [ ] **ARTÍCULOS:** Sin filtro U_SURTIDO_N (traer TODOS)
- [ ] **5 JOBS:** 22:45, 23:00, 23:15, 23:30, 23:45
- [ ] Tablas PostgreSQL actualizadas
- [ ] Vistas materializadas con nueva lógica
- [ ] DISTRIBUCIÓN por CLASIFICACION_2 (no por GRUPO)

---

## ✅ LISTO PARA CLAUDE CODE

Esta es la especificación DEFINITIVA. 

**Siguiente paso:** Crear prompt maestro actualizado con:
1. ✅ Queries correctas del ERP
2. ✅ Tablas dbo.distribucion y dbo.universo_cliente
3. ✅ 5 jobs en horarios correctos
4. ✅ Nueva lógica de DISTRIBUCIÓN
5. ✅ PostgreSQL con todas las tablas
6. ✅ Backend + Frontend completamente integrados

¿Quieres que actualice el PROMPT_CLAUDE_CODE_MAESTRO.md con todos estos cambios? 🚀
