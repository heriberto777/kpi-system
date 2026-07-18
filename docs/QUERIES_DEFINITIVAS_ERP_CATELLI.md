# 🔥 QUERIES DEFINITIVAS DEL ERP - CATELLI

**Versión Final Validada**

---

## 1️⃣ JOB: SYNC CLIENTES (23:00)

**Tabla:** `CATELLI.CLIENTE`  
**Campos:** CLIENTE, NOMBRE, CATEGORIA_CLIENTE, U_CLUSTER, VENDEDOR, ACTIVO

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

**Notas:**
- `ACTIVO` es 'S' o 'N' en ERP, convertir a 'Activo'/'Inactivo'
- `CLIENTE` es el código del cliente
- `VENDEDOR` es quien lo tiene asignado

---

## 2️⃣ JOB: SYNC ARTÍCULOS (23:15)

**Tabla:** `CATELLI.ARTICULO`  
**Campos:** ARTICULO, descripcion, clasificacion_1, clasificacion_2, U_SURTIDO_N, ARTICULO_DEL_PROV

```sql
SELECT
    ISNULL(A.ARTICULO, '') AS codigo_articulo,
    ISNULL(A.DESCRIPCION, '') AS descripcion,
    ISNULL(A.CLASIFICACION_1, '') AS clasificacion_1,
    ISNULL(A.CLASIFICACION_2, '') AS clasificacion_2,
    ISNULL(A.U_SURTIDO_N, 0) AS u_surtido_n,
    ISNULL(A.ARTICULO_DEL_PROV, '') AS articulo_del_proveedor,
    NULL AS precio_unitario
FROM CATELLI.ARTICULO A
WHERE A.ACTIVO = 'S' 
  AND A.U_SURTIDO_N IS NOT NULL 
  AND A.U_SURTIDO_N > 0
ORDER BY A.ARTICULO;
```

**Notas:**
- `precio_unitario` es NULL (deliberado)
- El precio está en `CATELLI.ARTICULO_PRECIO` pero tiene complejidad (NIVEL_PRECIO, VERSION)
- No se recomienda cargar precio aquí porque cada cliente tiene diferente NIVEL_PRECIO y VERSION
- El PRECIO se puede consultar después si se necesita, pero NO es crítico para Distribución/Surtido
- `CLASIFICACION_2` es la que contiene G21, G11, G13, etc.

---

## 3️⃣ JOB: SYNC VENTAS (23:30) - PARTE A: FACTURAS

**Tabla:** `CATELLI.FACTURA`  
**Campos:** FACTURA, CLIENTE, FECHA, ANULADA

```sql
SELECT
    CONVERT(VARCHAR(100), F.FACTURA) AS id_factura,
    F.CLIENTE AS codigo_cliente,
    CONVERT(DATE, F.FECHA) AS fecha_factura,
    CASE WHEN F.ANULADA = 'S' THEN 'Anulada' ELSE 'Activa' END AS estado_factura
FROM CATELLI.FACTURA F
WHERE CONVERT(DATE, F.FECHA) >= DATEADD(day, -60, CAST(GETDATE() AS DATE))
  AND F.ANULADA != 'S'
ORDER BY F.FECHA DESC;
```

**Notas:**
- `ANULADA` es 'S' o 'N'
- Solo traer facturas de últimos 60 días
- Filtrar por `F.ANULADA != 'S'`

---

## 4️⃣ JOB: SYNC VENTAS (23:30) - PARTE B: LÍNEAS DE FACTURA

**Tabla:** `CATELLI.FACTURA_LINEA`  
**Campos:** FACTURA, ARTICULO, cantidad, precio_unitario

```sql
SELECT 
    CONVERT(VARCHAR(100), FL.FACTURA) AS id_factura,
    FL.ARTICULO AS codigo_articulo,
    FL.cantidad,
    FL.precio_unitario,
    (FL.cantidad * FL.precio_unitario) AS monto_total
FROM CATELLI.FACTURA_LINEA FL
WHERE FL.FACTURA IN (
    SELECT F.FACTURA
    FROM CATELLI.FACTURA F
    WHERE CONVERT(DATE, F.FECHA) >= DATEADD(day, -60, CAST(GETDATE() AS DATE))
      AND F.ANULADA != 'S'
)
ORDER BY FL.FACTURA, FL.ARTICULO;
```

**Notas:**
- `monto_total` se calcula aquí: `cantidad * precio_unitario`
- Mismo filtro de 60 días que en FACTURA
- Solo traer líneas de facturas NO anuladas

---

## 5️⃣ JOB: CALCULAR KPIs (23:45)

**Acción:** Refrescar vistas materializadas en PostgreSQL

```javascript
// Backend: src/services/postgresql.service.ts
await pgPool.query('REFRESH MATERIALIZED VIEW mv_distribucion_por_retail');
await pgPool.query('REFRESH MATERIALIZED VIEW mv_distribucion_por_cluster');
await pgPool.query('REFRESH MATERIALIZED VIEW mv_distribucion_por_vendedor');
await pgPool.query('REFRESH MATERIALIZED VIEW mv_surtido_por_cliente');
await pgPool.query('REFRESH MATERIALIZED VIEW mv_clientes_no_visitados');
await pgPool.query('REFRESH MATERIALIZED VIEW mv_resumen_kpi_general');
```

---

## 📋 RESUMEN DE NOMBRES

| Elemento | Nombre en ERP | Notas |
|----------|---------------|-------|
| Tabla Clientes | `CATELLI.CLIENTE` | Singular |
| Tabla Artículos | `CATELLI.ARTICULO` | Singular |
| Tabla Facturas | `CATELLI.FACTURA` | Singular |
| Tabla Líneas | `CATELLI.FACTURA_LINEA` | Singular |
| Campo ID Cliente | CLIENTE | No es id_cliente |
| Campo Estado Activo | ACTIVO | 'S' o 'N' |
| Campo Anulada | ANULADA | 'S' o 'N' |
| SubCategoría | CLASIFICACION_2 | G21, G11, G13, etc |
| Grupo Surtido | U_SURTIDO_N | 1-23 |

---

## 🎯 CAMBIOS EN TYPESCRIPT

### Archivo: src/services/mssql.service.ts

```typescript
export class MSSQLService {
  async getClientes(): Promise<Cliente[]> {
    try {
      const pool = await getMSSQLPool();
      const result = await pool.request().query(`
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
        ORDER BY C.CLIENTE
      `);
      logger.info(`Extracted ${result.recordset.length} clientes from MSSQL`);
      return result.recordset;
    } catch (error) {
      logger.error('Error extracting clientes:', error);
      throw error;
    }
  }

  async getArticulos(): Promise<Articulo[]> {
    try {
      const pool = await getMSSQLPool();
      const result = await pool.request().query(`
        SELECT
          ISNULL(A.ARTICULO, '') AS codigo_articulo,
          ISNULL(A.DESCRIPCION, '') AS descripcion,
          ISNULL(A.CLASIFICACION_1, '') AS clasificacion_1,
          ISNULL(A.CLASIFICACION_2, '') AS clasificacion_2,
          ISNULL(A.U_SURTIDO_N, 0) AS u_surtido_n,
          ISNULL(A.ARTICULO_DEL_PROV, '') AS articulo_del_proveedor,
          NULL AS precio_unitario
        FROM CATELLI.ARTICULO A
        WHERE A.ACTIVO = 'S' 
          AND A.U_SURTIDO_N IS NOT NULL 
          AND A.U_SURTIDO_N > 0
        ORDER BY A.ARTICULO
      `);
      logger.info(`Extracted ${result.recordset.length} articulos from MSSQL`);
      return result.recordset;
    } catch (error) {
      logger.error('Error extracting articulos:', error);
      throw error;
    }
  }

  async getFacturas(diasAtras: number = 60): Promise<Factura[]> {
    try {
      const pool = await getMSSQLPool();
      const result = await pool.request()
        .input('diasAtras', diasAtras)
        .query(`
          SELECT
            CONVERT(VARCHAR(100), F.FACTURA) AS id_factura,
            F.CLIENTE AS codigo_cliente,
            CONVERT(DATE, F.FECHA) AS fecha_factura,
            CASE WHEN F.ANULADA = 'S' THEN 'Anulada' ELSE 'Activa' END AS estado_factura
          FROM CATELLI.FACTURA F
          WHERE CONVERT(DATE, F.FECHA) >= DATEADD(day, -@diasAtras, CAST(GETDATE() AS DATE))
            AND F.ANULADA != 'S'
          ORDER BY F.FECHA DESC
        `);
      logger.info(`Extracted ${result.recordset.length} facturas from MSSQL`);
      return result.recordset;
    } catch (error) {
      logger.error('Error extracting facturas:', error);
      throw error;
    }
  }

  async getFacturaLineas(facturaIds?: string[]): Promise<FacturaLinea[]> {
    try {
      const pool = await getMSSQLPool();
      let query = `
        SELECT 
          CONVERT(VARCHAR(100), FL.FACTURA) AS id_factura,
          FL.ARTICULO AS codigo_articulo,
          FL.cantidad,
          FL.precio_unitario,
          (FL.cantidad * FL.precio_unitario) AS monto_total
        FROM CATELLI.FACTURA_LINEA FL
      `;

      if (facturaIds && facturaIds.length > 0) {
        const ids = facturaIds.map(id => `'${id}'`).join(',');
        query += ` WHERE FL.FACTURA IN (${ids})`;
      } else {
        query += ` WHERE FL.FACTURA IN (
          SELECT F.FACTURA FROM CATELLI.FACTURA F
          WHERE CONVERT(DATE, F.FECHA) >= DATEADD(day, -60, CAST(GETDATE() AS DATE))
            AND F.ANULADA != 'S'
        )`;
      }

      query += ` ORDER BY FL.FACTURA, FL.ARTICULO`;

      const result = await pool.request().query(query);
      logger.info(`Extracted ${result.recordset.length} factura lineas from MSSQL`);
      return result.recordset;
    } catch (error) {
      logger.error('Error extracting factura_lineas:', error);
      throw error;
    }
  }
}
```

---

## ✅ CHECKLIST

- [ ] Nombres de tablas correctos (CLIENTE, ARTICULO, FACTURA, FACTURA_LINEA)
- [ ] Campos con mayúsculas correctas
- [ ] Conversión de ACTIVO/ANULADA (S/N → Activo/Inactivo)
- [ ] monto_total se calcula en FACTURA_LINEA
- [ ] precio_unitario es NULL (no se carga precio)
- [ ] Filtro de 60 días en FACTURA y FACTURA_LINEA
- [ ] Jobs en horarios correctos (23:00, 23:15, 23:30, 23:45)

---

**Listo. Estas son las queries DEFINITIVAS del ERP.** ✅
