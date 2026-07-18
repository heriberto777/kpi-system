# 📊 INTEGRACIÓN TABLA dbVENDEDOR - CANTIDAD DE CLIENTES POR VENDEDOR

**Análisis de la tabla dbVendedor y su impacto en KPIs**

---

## 🔍 ANÁLISIS DE LA TABLA dbVENDEDOR

### **Query Original (ERP)**

```sql
SELECT 
    V.VENDEDOR, 
    V.NOMBRE, 
    CANTIDAD_CLIENTE = COUNT(C.CLIENTE), 
    V.U_SUPERASIGNADO, 
    AL_VENDEDOR = CASE C.U_SEMANA 
        WHEN 'MC1' THEN C.U_SEMANA
        WHEN 'MD1' THEN C.U_SEMANA
        WHEN 'WC1' THEN C.U_SEMANA
        WHEN 'WD1' THEN C.U_SEMANA 
        ELSE V.VENDEDOR 
    END, 
    RT = CASE C.U_SEMANA  
        WHEN 'WC1' THEN 'AUTOSERVICIO'
        WHEN 'WD1' THEN 'MAYORISTA'
        WHEN 'MC1' THEN 'AUTOSERVICIO'
        WHEN 'MD1' THEN 'MAYORISTA'
        ELSE V.U_RETAIL 
    END
FROM CATELLI.VENDEDOR V,
CATELLI.CLIENTE C 
WHERE V.VENDEDOR = C.VENDEDOR 
  AND C.ACTIVO = 'S' 
  AND V.U_CAMIONF NOT IN ('GND') 
  AND C.U_ESTATUS NOT LIKE 'EnEspera'
GROUP BY V.VENDEDOR, V.NOMBRE, V.U_SUPERASIGNADO, V.U_TIPO_VENDEDOR, C.U_SEMANA, V.U_RETAIL;
```

---

## 📋 CAMPOS CLAVE

| Campo | Descripción | Impacto |
|-------|-------------|---------|
| **VENDEDOR** | Código único del vendedor | PK - Identifica al vendedor |
| **NOMBRE** | Nombre del vendedor | Información descriptiva |
| **CANTIDAD_CLIENTE** | # de clientes asignados | ⭐ **CRÍTICO** para distribuci/surtido |
| **U_SUPERASIGNADO** | Vendedor supervisor | Jerarquía de vendedores |
| **AL_VENDEDOR** | A quién se asigna (supervisor o él mismo) | Reporta a este vendedor |
| **RT (Retail)** | COLMADO, AUTOSERVICIO, MAYORISTA | ⭐ **CRÍTICO** para objetivos |

---

## ⚠️ CONCEPTOS IMPORTANTES

### **1. U_SEMANA (Rutas/Zonas)**
- **MC1, MD1** → Clientes de Metro/Centro (Distrito Nacional)
- **WC1, WD1** → Clientes fuera de Metro (Western)
- **Formato:** 
  - "C" = AUTOSERVICIO
  - "D" = MAYORISTA

### **2. AL_VENDEDOR**
- Si el cliente tiene U_SEMANA especial (MC1, WC1, etc.) → se asigna al código de la ruta
- Si no → se asigna al vendedor directo

### **3. U_RETAIL**
- Si cliente tiene U_SEMANA → se usa ese (MC1→AUTOSERVICIO, MD1→MAYORISTA, etc.)
- Si no → se usa el retail del vendedor (V.U_RETAIL)

---

## 🎯 IMPACTO EN KPIs

### **Distribución por Vendedor**

**Antes (INCORRECTO):**
```sql
-- Contaba activos sin cantidad asignada
SELECT vendedor, COUNT(DISTINCT cliente) FROM dim_clientes
```

**Ahora (CORRECTO):**
```sql
-- Usa cantidad_cliente de dim_vendedor
SELECT 
    dv.codigo_vendedor,
    dv.cantidad_cliente,  -- ← Cantidad REAL de clientes asignados
    COUNT(DISTINCT clientes_que_compraron) as resultado
```

**Ejemplo:**
- Vendedor Juan García: tiene asignados 245 clientes
- Clientes que compraron G21: 230
- Distribución: (230 / 245) * 100 = 93.88%

### **Surtido por Vendedor**

**Impacto:**
- Se cuenta por clientes asignados del vendedor
- No se cuenta universalmente sino por la cartera del vendedor

---

## 📊 TABLA dim_vendedor (PostgreSQL)

```sql
CREATE TABLE dim_vendedor (
    id SERIAL PRIMARY KEY,
    codigo_vendedor VARCHAR(50) UNIQUE NOT NULL,      -- V.VENDEDOR
    nombre_vendedor VARCHAR(300),                     -- V.NOMBRE
    cantidad_cliente INT DEFAULT 0,                   -- COUNT(CLIENTE)
    vendedor_supervisor VARCHAR(50),                  -- V.U_SUPERASIGNADO
    retail_asignado VARCHAR(50),                      -- RT (COLMADO, AUTOSERVICIO, MAYORISTA)
    al_vendedor VARCHAR(50),                          -- AL_VENDEDOR
    tipo_vendedor VARCHAR(50),                        -- V.U_TIPO_VENDEDOR (opcional)
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_vendedor_codigo (codigo_vendedor),
    INDEX idx_vendedor_supervisor (vendedor_supervisor)
);
```

---

## 🔄 ETL: SINCRONIZAR dbVENDEDOR

### **Job: sync-vendedor (22:55)**

```sql
-- QUERY EXACTA DEL ERP
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
LEFT JOIN CATELLI.CLIENTE C 
    ON V.VENDEDOR = C.VENDEDOR 
    AND C.ACTIVO = 'S'
    AND C.U_ESTATUS NOT LIKE 'EnEspera'
WHERE V.U_CAMIONF NOT IN ('GND')
GROUP BY V.VENDEDOR, V.NOMBRE, V.U_SUPERASIGNADO, V.U_RETAIL, C.U_SEMANA, V.U_TIPO_VENDEDOR
ORDER BY V.VENDEDOR;
```

---

## 📈 VISTAS ACTUALIZADAS

### **mv_distribucion_por_vendedor**

**Cambio clave:**
```sql
-- ANTES (INCORRECTO):
COUNT(DISTINCT cliente) as total_clientes  

-- AHORA (CORRECTO):
dv.cantidad_cliente as total_clientes_vendedor  -- de dim_vendedor
```

**Resultado:**
```
Vendedor: Juan García
Retail: COLMADO
SubCategoría: G21
Total Clientes: 245  ← de dim_vendedor.cantidad_cliente
Clientes que compraron: 230
Distribución: 93.88%
Objetivo: 7723 clientes
Logro: 2.98%
```

### **mv_surtido_por_vendedor**

```sql
-- Usa cantidad_cliente para normalizar el surtido
dv.cantidad_cliente AS total_clientes_vendedor
COALESCE(scv.cant_compradas, 0) AS subcategorias_compradas
topc.cant_obligatorio AS subcategorias_obligatorias
```

---

## 🎯 IMPACTO COMERCIAL

### **Ejemplo Real (de la imagen)**

**Vendedor: Mary Rodriguez (0001)**

| Retail | Clientes Asignados | KPI |
|--------|-------------------|-----|
| AUTOSERVICIO | 18 | Distribucion / Surtido se calcula sobre 18 clientes |
| COLMADO | 18 (otra asignación) | Distribucion / Surtido se calcula sobre 18 clientes |

Antes (INCORRECTO):
- Se calculaba sobre TODOS los clientes activos del sistema (8000+)

Ahora (CORRECTO):
- Se calcula solo sobre los 18 clientes asignados a Mary

---

## 📋 CHECKLIST INTEGRACIÓN

### **Tablas**
- [ ] Crear `dim_vendedor` con campos exactos
- [ ] Crear `stg_vendedor` para staging

### **Jobs**
- [ ] Crear `sync-vendedor` job (22:55)
- [ ] Query exacta con U_SEMANA mappings
- [ ] UPSERT a dim_vendedor

### **Vistas**
- [ ] Actualizar `mv_distribucion_por_vendedor`
  - Usar `dv.cantidad_cliente`
  - Join con `dim_vendedor`
  
- [ ] Actualizar `mv_surtido_por_vendedor`
  - Usar `dv.cantidad_cliente`
  - Join con `dim_vendedor`

### **Backend**
- [ ] Controllers: Parámetro vendedor opcional
- [ ] Endpoints: Filtrar por vendedor_codigo o nombre

### **Frontend**
- [ ] Selector de vendedor en dashboard
- [ ] Gráficos por vendedor
- [ ] Comparativa vendedor vs promedio retail

---

## 🚀 FLUJO COMPLETO

```
22:55: sync-vendedor
├─ Extrae de CATELLI.VENDEDOR + CATELLI.CLIENTE
├─ Calcula CANTIDAD_CLIENTE por vendedor
├─ Mapea RETAIL según U_SEMANA
└─ Carga en dim_vendedor

23:30: sync-ventas
├─ Extrae FACTURAS + FACTURA_LINEAS
├─ Carga en fact_ventas
│  └─ Incluye vendedor (de dim_clientes)
│  └─ Incluye retail (de dim_clientes)

23:45: calcular-kpis
├─ Refrescar mv_distribucion_por_vendedor
│  └─ Usa cantidad_cliente de dim_vendedor
├─ Refrescar mv_surtido_por_vendedor
│  └─ Usa cantidad_cliente de dim_vendedor
└─ Refrescar otras vistas

RESULTADO: KPIs precisos por vendedor 🎯
```

---

## ✅ CONCLUSIÓN

La tabla **dbVENDEDOR** es CRÍTICA porque:

1. ✅ Define la **cantidad real de clientes** por vendedor
2. ✅ Mapea **retail correcto** según U_SEMANA
3. ✅ Permite cálculos precisos de **distribución y surtido**
4. ✅ Evita comparar vendedores con diferentes universos de clientes
5. ✅ Permite comparativa equitativa entre vendedores

**Sin esto, los KPIs por vendedor serían INCORRECTO.** 🚨

---

**Listo. dim_vendedor está integrado.** 🚀
