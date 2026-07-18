# 🔧 CORRECCIONES: NOMBRES EXACTOS DE TABLAS Y CAMPOS DEL ERP

## ⚠️ IMPORTANTE: Actualizar el Prompt Maestro ANTES de pasar a Claude Code

Los nombres de tablas y campos en el ERP son diferentes. Aquí están las correcciones:

---

## 📋 NOMBRES CORRECTOS DE TABLAS

| Nombre en Prompt | Nombre Real en ERP |
|-----------------|-------------------|
| CLIENTES | CATELLI.CLIENTES (o solo CLIENTES) |
| ARTICULO | CATELLI.ARTICULO (o solo ARTICULO) |
| FACTURA | CATELLI.FACTURA (o solo FACTURA) |
| FACTURA_LINEAS | CATELLI.FACTURA_LINEA (singular, no plural) |

---

## 📊 CAMPOS CORRECTOS POR TABLA

### FACTURA_LINEA (Correcciones)

**Nombres de Campos Reales:**
```
FACTURA       (no id_factura)
ARTICULO      (no codigo_articulo)
cantidad      (correcto)
precio_unitario (correcto)
monto_total   (SE CALCULA: cantidad * precio_unitario)
```

### Query CORRECTA para FACTURA_LINEA

```sql
-- ✅ QUERY CORRECTA
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
)
ORDER BY FL.FACTURA, FL.ARTICULO;
```

---

## 🔄 CAMBIOS EN EL SERVICIO MSSQL

### Archivo: src/services/mssql.service.ts

**Método `getFacturaLineas()` - ACTUALIZAR A:**

```typescript
async getFacturaLineas(facturaIds?: string[]): Promise<FacturaLinea[]> {
    try {
      const pool = await getMSSQLPool();
      let query = `
        SELECT
          CONVERT(VARCHAR(100), fl.FACTURA) as id_factura,
          fl.ARTICULO as codigo_articulo,
          fl.cantidad,
          fl.precio_unitario,
          (fl.cantidad * fl.precio_unitario) AS monto_total
        FROM CATELLI.FACTURA_LINEA fl
      `;

      if (facturaIds && facturaIds.length > 0) {
        const ids = facturaIds.map(id => `'${id}'`).join(',');
        query += ` WHERE fl.FACTURA IN (${ids})`;
      } else {
        query += ` WHERE fl.FACTURA IN (
          SELECT f.FACTURA FROM CATELLI.FACTURA f
          WHERE CONVERT(DATE, f.FECHA) >= DATEADD(day, -60, CAST(GETDATE() AS DATE))
        )`;
      }

      query += ` ORDER BY fl.FACTURA, fl.ARTICULO`;

      const result = await pool.request().query(query);
      logger.info(`Extracted ${result.recordset.length} factura lineas from MSSQL`);
      return result.recordset;
    } catch (error) {
      logger.error('Error extracting factura_lineas:', error);
      throw error;
    }
  }
```

---

## 📝 ACTUALIZACIÓN REQUERIDA EN src/types/index.ts

```typescript
export interface FacturaLinea {
  id_factura: string;          // Viene de FL.FACTURA
  codigo_articulo: string;     // Viene de FL.ARTICULO
  cantidad: number;
  precio_unitario: number;
  monto_total: number;         // SE CALCULA: cantidad * precio_unitario
}
```

---

## 🗄️ ACTUALIZACIÓN SQL PARA POSTGRESQL

En `src/migrations/001_create_tables.sql`, la tabla `stg_factura_lineas` debe incluir `precio_unitario`:

```sql
CREATE TABLE IF NOT EXISTS stg_factura_lineas (
    id_factura VARCHAR(100),
    codigo_articulo VARCHAR(100),
    cantidad INT,
    precio_unitario NUMERIC(10,2),
    monto_total NUMERIC(12,2)
);
```

---

## ✅ CHECKLIST DE CAMBIOS

Antes de pasar el prompt a Claude Code, asegúrate de:

- [ ] En `mssql.service.ts` → Query de `getFacturaLineas()` calcula monto_total
- [ ] En `types/index.ts` → `FacturaLinea` incluye `precio_unitario`
- [ ] En SQL migrations → `stg_factura_lineas` tiene `precio_unitario`
- [ ] En ETL service → Script de UPSERT a `fact_ventas` usa el monto_total calculado

---

## 🎯 CÓMO APLICAR LOS CAMBIOS

### Opción A: Manual
1. Abre `PROMPT_CLAUDE_CODE_MAESTRO.md`
2. Busca "getFacturaLineas"
3. Reemplaza con el código correcto arriba
4. Repite para las otras secciones

### Opción B: Usa este archivo como referencia
1. Cuando Claude Code genere el archivo `mssql.service.ts`
2. Copia el método `getFacturaLineas()` correcto de arriba
3. Pégalo en tu proyecto

### Opción C: Díselo directamente a Claude Code
Cuando estés en Claude Code, dile:

```
"Los campos del ERP son:
- FACTURA_LINEA (tabla, singular)
- FL.FACTURA (no id_factura)
- FL.ARTICULO (no codigo_articulo)
- FL.precio_unitario
- monto_total = FL.cantidad * FL.precio_unitario (CALCULAR)

Actualiza el servicio MSSQL con esta query correcta..."
```

---

## 📞 RESUMEN DE CAMBIOS

| Archivo | Cambio |
|---------|--------|
| `mssql.service.ts` | Query calcula monto_total = cantidad * precio_unitario |
| `types/index.ts` | FacturaLinea incluye precio_unitario |
| `migrations/001_create_tables.sql` | stg_factura_lineas incluye precio_unitario |
| Nombre tabla | FACTURA_LINEA (singular, no FACTURA_LINEAS) |

---

**Listo. Usa este documento como referencia cuando trabajes con Claude Code.** ✅
