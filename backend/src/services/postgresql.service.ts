import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { pgPool } from '../config/database';
import logger from '../config/logger';
import {
  StgArticulo,
  StgClasificacion,
  StgCliente,
  StgCuota,
  StgFactura,
  StgFacturaLinea,
  StgObjetivoDistribucion,
  StgUniversoCliente,
  StgVendedor,
  SyncResult,
  TipoSincronizacion,
  EstadoSincronizacion,
  SyncLog,
  SyncLogFilter,
} from '../types';

const CHUNK_SIZE = 500;

async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pgPool.query<T>(text, params);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function bulkInsert(
  client: PoolClient,
  table: string,
  columns: string[],
  rows: unknown[][]
): Promise<number> {
  if (rows.length === 0) return 0;

  let totalInserted = 0;
  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const values: unknown[] = [];
    const placeholders = batch
      .map((row, rowIdx) => {
        const rowPlaceholders = row.map((_, colIdx) => {
          values.push(row[colIdx]);
          return `$${rowIdx * columns.length + colIdx + 1}`;
        });
        return `(${rowPlaceholders.join(', ')})`;
      })
      .join(', ');

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
    const result = await client.query(sql, values);
    totalInserted += result.rowCount ?? 0;
  }
  return totalInserted;
}

export const PostgresqlService = {
  query,

  // ============================================
  // STAGING: truncar + carga masiva
  // ============================================
  async cargarStagingClientes(rows: StgCliente[]): Promise<number> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE stg_clientes');
      const inserted = await bulkInsert(
        client,
        'stg_clientes',
        ['codigo_cliente', 'nombre_cliente', 'categoria_cliente', 'u_cluster', 'vendedor_asignado', 'cat_cliente_esp', 'estado', 'fecha_creacion'],
        rows.map((r) => [
          r.codigo_cliente,
          r.nombre_cliente,
          r.categoria_cliente,
          r.u_cluster,
          r.vendedor_asignado,
          r.cat_cliente_esp,
          r.estado,
          r.fecha_creacion,
        ])
      );
      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async cargarStagingArticulos(rows: StgArticulo[]): Promise<number> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE stg_articulos');
      const inserted = await bulkInsert(
        client,
        'stg_articulos',
        [
          'codigo_articulo',
          'descripcion',
          'clasificacion_1',
          'clasificacion_2',
          'descripcion_subcategoria',
          'u_surtido_n',
          'articulo_del_proveedor',
          'precio_unitario',
        ],
        rows.map((r) => [
          r.codigo_articulo,
          r.descripcion,
          r.clasificacion_1,
          r.clasificacion_2,
          r.descripcion_subcategoria,
          r.u_surtido_n,
          r.articulo_del_proveedor,
          r.precio_unitario,
        ])
      );
      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async cargarStagingVentas(facturas: StgFactura[], lineas: StgFacturaLinea[]): Promise<{ facturas: number; lineas: number }> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE stg_facturas');
      await client.query('TRUNCATE TABLE stg_factura_lineas');

      const facturasInsertadas = await bulkInsert(
        client,
        'stg_facturas',
        ['id_factura', 'codigo_cliente', 'fecha_factura', 'estado_factura'],
        facturas.map((f) => [f.id_factura, f.codigo_cliente, f.fecha_factura, f.estado_factura])
      );

      const lineasInsertadas = await bulkInsert(
        client,
        'stg_factura_lineas',
        ['id_factura', 'codigo_articulo', 'cantidad', 'precio_unitario', 'monto_total'],
        lineas.map((l) => [l.id_factura, l.codigo_articulo, l.cantidad, l.precio_unitario, l.monto_total])
      );

      await client.query('COMMIT');
      return { facturas: facturasInsertadas, lineas: lineasInsertadas };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async cargarStagingUniverso(rows: StgUniversoCliente[]): Promise<number> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE stg_universo_cliente');
      const inserted = await bulkInsert(
        client,
        'stg_universo_cliente',
        ['anno_mes', 'retail', 'universo', 'estado'],
        rows.map((r) => [r.anno_mes, r.retail, r.universo, r.estado])
      );
      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async cargarStagingObjetivos(rows: StgObjetivoDistribucion[]): Promise<number> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE stg_objetivos_distribucion');
      const inserted = await bulkInsert(
        client,
        'stg_objetivos_distribucion',
        ['anno_mes', 'retail', 'clasificacion_2', 'objetivo_clientes', 'objetivo_monto', 'estado'],
        rows.map((r) => [r.anno_mes, r.retail, r.clasificacion_2, r.objetivo_clientes, r.objetivo_monto, r.estado])
      );
      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async cargarStagingCuota(rows: StgCuota[]): Promise<number> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE stg_cuota');
      const inserted = await bulkInsert(
        client,
        'stg_cuota',
        ['anno_mes', 'vendedor', 'retail', 'clasificacion_2', 'cuota_monto'],
        rows.map((r) => [r.anno_mes, r.vendedor, r.retail, r.clasificacion_2, r.cuota_monto])
      );
      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async cargarStagingVendedor(rows: StgVendedor[]): Promise<number> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE stg_vendedor');
      const inserted = await bulkInsert(
        client,
        'stg_vendedor',
        ['codigo_vendedor', 'nombre_vendedor', 'cantidad_cliente', 'vendedor_supervisor', 'retail_asignado', 'al_vendedor', 'tipo_vendedor'],
        rows.map((r) => [
          r.codigo_vendedor,
          r.nombre_vendedor,
          r.cantidad_cliente,
          r.vendedor_supervisor,
          r.retail_asignado,
          r.al_vendedor,
          r.tipo_vendedor,
        ])
      );
      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async cargarStagingClasificacion(rows: StgClasificacion[]): Promise<number> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE stg_clasificacion');
      const inserted = await bulkInsert(
        client,
        'stg_clasificacion',
        ['codigo_clasificacion', 'descripcion_clasificacion', 'nivel_jerarquia'],
        rows.map((r) => [r.codigo_clasificacion, r.descripcion_clasificacion, r.nivel_jerarquia])
      );
      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // ============================================
  // UPSERT: staging -> dimensiones / hechos
  // ============================================
  async upsertDimClientes(): Promise<SyncResult> {
    const sql = `
      INSERT INTO dim_clientes (codigo_cliente, nombre_cliente, categoria_cliente, retail, u_cluster, vendedor_asignado, cat_cliente_esp, estado, fecha_creacion)
      SELECT
          stc.codigo_cliente,
          stc.nombre_cliente,
          stc.categoria_cliente,
          -- Igual que catelli.CUBO_EXACTUS_FACTURA_LINEA_ORIGINAL.RETAIL (fuente oficial de
          -- ventas/distribucion, ya corriendo en produccion): A3=MINIMARKET SI cuenta como
          -- COLMADO, SM=Supermercados Especiales cuenta como AUTOSERVICIO.
          CASE stc.categoria_cliente
              WHEN 'A1' THEN 'COLMADO'
              WHEN 'A2' THEN 'COLMADO'
              WHEN 'A3' THEN 'COLMADO'
              WHEN 'C1' THEN 'AUTOSERVICIO'
              WHEN 'C2' THEN 'AUTOSERVICIO'
              WHEN 'SM' THEN 'AUTOSERVICIO'
              WHEN 'D1' THEN 'MAYORISTA'
              WHEN 'D2' THEN 'MAYORISTA'
              WHEN 'Q1' THEN 'MAYORISTA'
              WHEN 'SUR' THEN 'MAYORISTA'
              ELSE 'OTROS'
          END AS retail,
          stc.u_cluster,
          stc.vendedor_asignado,
          stc.cat_cliente_esp,
          stc.estado,
          stc.fecha_creacion
      FROM stg_clientes stc
      WHERE stc.codigo_cliente IS NOT NULL AND stc.codigo_cliente <> ''
      ON CONFLICT (codigo_cliente) DO UPDATE SET
          nombre_cliente = EXCLUDED.nombre_cliente,
          categoria_cliente = EXCLUDED.categoria_cliente,
          retail = EXCLUDED.retail,
          u_cluster = EXCLUDED.u_cluster,
          vendedor_asignado = EXCLUDED.vendedor_asignado,
          cat_cliente_esp = EXCLUDED.cat_cliente_esp,
          estado = EXCLUDED.estado,
          fecha_actualizacion = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS inserted;
    `;
    const result = await query<{ inserted: boolean }>(sql);
    const insertados = result.rows.filter((r) => r.inserted).length;
    return {
      registros_procesados: result.rowCount ?? 0,
      registros_insertados: insertados,
      registros_actualizados: (result.rowCount ?? 0) - insertados,
      registros_error: 0,
    };
  },

  async upsertDimArticulos(): Promise<SyncResult> {
    const sql = `
      INSERT INTO dim_articulos (codigo_articulo, descripcion, clasificacion_1, clasificacion_2, descripcion_subcategoria, u_surtido_n, articulo_del_proveedor, precio_unitario)
      SELECT
          sta.codigo_articulo,
          sta.descripcion,
          sta.clasificacion_1,
          sta.clasificacion_2,
          sta.descripcion_subcategoria,
          sta.u_surtido_n,
          sta.articulo_del_proveedor,
          sta.precio_unitario
      FROM stg_articulos sta
      WHERE sta.codigo_articulo IS NOT NULL AND sta.codigo_articulo <> ''
      ON CONFLICT (codigo_articulo) DO UPDATE SET
          descripcion = EXCLUDED.descripcion,
          clasificacion_1 = EXCLUDED.clasificacion_1,
          clasificacion_2 = EXCLUDED.clasificacion_2,
          descripcion_subcategoria = EXCLUDED.descripcion_subcategoria,
          u_surtido_n = EXCLUDED.u_surtido_n,
          precio_unitario = EXCLUDED.precio_unitario,
          fecha_actualizacion = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS inserted;
    `;
    const result = await query<{ inserted: boolean }>(sql);
    const insertados = result.rows.filter((r) => r.inserted).length;
    return {
      registros_procesados: result.rowCount ?? 0,
      registros_insertados: insertados,
      registros_actualizados: (result.rowCount ?? 0) - insertados,
      registros_error: 0,
    };
  },

  async upsertFactVentas(fechaDesde: string, fechaHasta: string): Promise<SyncResult> {
    // Borra de fact_ventas, dentro de la ventana sincronizada, las filas (factura, articulo)
    // que ya no aparecen en el staging recien cargado: facturas/lineas que un cambio de filtro
    // en QUERY_FACTURAS/QUERY_FACTURA_LINEAS (mssql.service.ts) excluyo (p.ej. cliente
    // CATEGORIA_CLIENTE='OT', articulo de ajuste) quedaban "zombis" en fact_ventas para
    // siempre, porque el INSERT...ON CONFLICT de mas abajo solo agrega/actualiza, nunca borra.
    // Acotado a [fechaDesde, fechaHasta] para no tocar historico fuera de la ventana sincronizada.
    // El JOIN contra stg_facturas es imprescindible aqui: QUERY_FACTURA_LINEAS no filtra por
    // cliente (solo QUERY_FACTURAS lo hace, excluyendo CATEGORIA_CLIENTE='OT'), asi que una
    // linea de un cliente OT sigue presente en stg_factura_lineas aunque su factura ya no este
    // en stg_facturas. Comprobar solo contra stg_factura_lineas (como en un intento anterior)
    // encontraba esa linea "huerfana" y NO borraba la fila -- el mismo join que usa el INSERT
    // de mas abajo es el que determina que factura+articulo son realmente validos hoy.
    await query(
      `
      DELETE FROM fact_ventas fv
      WHERE fv.id_fecha >= $1 AND fv.id_fecha <= $2
        AND NOT EXISTS (
          SELECT 1
          FROM stg_factura_lineas stfl
          JOIN stg_facturas stf ON stfl.id_factura = stf.id_factura
          WHERE stfl.id_factura = fv.id_factura AND stfl.codigo_articulo = fv.codigo_articulo
        );
      `,
      [fechaDesde, fechaHasta]
    );

    // Asegura que existan las filas de dim_tiempo para las fechas de las facturas
    await query(`
      INSERT INTO dim_tiempo (id_fecha, ano, mes, dia, trimestre, semana, nombre_mes, nombre_dia, es_fin_semana)
      SELECT DISTINCT
          stf.fecha_factura,
          EXTRACT(YEAR FROM stf.fecha_factura)::INT,
          EXTRACT(MONTH FROM stf.fecha_factura)::INT,
          EXTRACT(DAY FROM stf.fecha_factura)::INT,
          EXTRACT(QUARTER FROM stf.fecha_factura)::INT,
          EXTRACT(WEEK FROM stf.fecha_factura)::INT,
          TO_CHAR(stf.fecha_factura, 'TMMonth'),
          TO_CHAR(stf.fecha_factura, 'TMDay'),
          EXTRACT(ISODOW FROM stf.fecha_factura) IN (6, 7)
      FROM stg_facturas stf
      WHERE stf.fecha_factura IS NOT NULL
      ON CONFLICT (id_fecha) DO NOTHING;
    `);

    // Nota: una misma factura puede tener varias lineas para el mismo articulo (lotes,
    // promociones, etc). Se agregan (SUM) por (factura, articulo) antes del upsert porque
    // fact_ventas tiene UNIQUE(id_factura, id_articulo) y un solo INSERT no puede afectar
    // la misma fila de conflicto dos veces ("ON CONFLICT DO UPDATE command cannot affect
    // row a second time").
    const sql = `
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
          SUM(stfl.cantidad) AS cantidad,
          SUM(stfl.monto_total) AS monto,
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
      GROUP BY stfl.id_factura, dc.id_cliente, da.id_articulo, stf.fecha_factura,
               stf.codigo_cliente, stfl.codigo_articulo, dc.retail, dc.u_cluster,
               dc.vendedor_asignado, da.clasificacion_2, da.u_surtido_n
      ON CONFLICT (id_factura, id_articulo) DO UPDATE SET
          cantidad = EXCLUDED.cantidad,
          monto = EXCLUDED.monto
      RETURNING (xmax = 0) AS inserted;
    `;
    const result = await query<{ inserted: boolean }>(sql);
    const insertados = result.rows.filter((r) => r.inserted).length;
    return {
      registros_procesados: result.rowCount ?? 0,
      registros_insertados: insertados,
      registros_actualizados: (result.rowCount ?? 0) - insertados,
      registros_error: 0,
    };
  },

  async upsertDimUniverso(): Promise<SyncResult> {
    const sql = `
      INSERT INTO dim_universo_cliente (anno_mes, retail, universo, estado)
      SELECT suc.anno_mes, suc.retail, suc.universo, suc.estado
      FROM stg_universo_cliente suc
      WHERE suc.anno_mes IS NOT NULL AND suc.retail IS NOT NULL AND suc.retail <> ''
      ON CONFLICT (anno_mes, retail) DO UPDATE SET
          universo = EXCLUDED.universo,
          estado = EXCLUDED.estado,
          fecha_actualizacion = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS inserted;
    `;
    const result = await query<{ inserted: boolean }>(sql);
    const insertados = result.rows.filter((r) => r.inserted).length;
    return {
      registros_procesados: result.rowCount ?? 0,
      registros_insertados: insertados,
      registros_actualizados: (result.rowCount ?? 0) - insertados,
      registros_error: 0,
    };
  },

  async upsertDimObjetivos(): Promise<SyncResult> {
    // "activo" es curado a mano por el negocio en dim_subcategoria_config (ver migracion 013),
    // NO lo trae el ERP: solo se fija al INSERTAR una combinacion (anno_mes, retail,
    // clasificacion_2) nueva, tomando el valor configurado para esa clasificacion_2 (FALSE si
    // es una subcategoria nunca vista), y nunca se toca en el UPDATE del UPSERT diario, para no
    // pisar ajustes manuales posteriores hechos desde la pantalla de Parametros.
    const sql = `
      INSERT INTO dim_objetivos_distribucion (anno_mes, retail, clasificacion_2, objetivo_clientes, objetivo_monto, estado, activo)
      SELECT
          sod.anno_mes, sod.retail, sod.clasificacion_2, sod.objetivo_clientes, sod.objetivo_monto, sod.estado,
          COALESCE(dsc.activo, FALSE) AS activo
      FROM stg_objetivos_distribucion sod
      LEFT JOIN dim_subcategoria_config dsc ON dsc.clasificacion_2 = sod.clasificacion_2
      WHERE sod.anno_mes IS NOT NULL AND sod.retail IS NOT NULL AND sod.retail <> ''
        AND sod.clasificacion_2 IS NOT NULL AND sod.clasificacion_2 <> ''
      ON CONFLICT (anno_mes, retail, clasificacion_2) DO UPDATE SET
          objetivo_clientes = EXCLUDED.objetivo_clientes,
          objetivo_monto = EXCLUDED.objetivo_monto,
          estado = EXCLUDED.estado,
          fecha_actualizacion = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS inserted;
    `;
    const result = await query<{ inserted: boolean }>(sql);
    const insertados = result.rows.filter((r) => r.inserted).length;
    return {
      registros_procesados: result.rowCount ?? 0,
      registros_insertados: insertados,
      registros_actualizados: (result.rowCount ?? 0) - insertados,
      registros_error: 0,
    };
  },

  async upsertDimCuotaVendedor(): Promise<SyncResult> {
    // Cuota de $ oficial del ERP (dbo.cuota, ya ajustada por el negocio): se pisa por completo
    // en cada sync, igual que universo (no hay campo curado a mano que proteger aqui).
    const sql = `
      INSERT INTO dim_cuota_vendedor (anno_mes, vendedor, retail, clasificacion_2, cuota_monto)
      SELECT sc.anno_mes, sc.vendedor, sc.retail, sc.clasificacion_2, sc.cuota_monto
      FROM stg_cuota sc
      WHERE sc.anno_mes IS NOT NULL AND sc.vendedor IS NOT NULL AND sc.vendedor <> ''
        AND sc.retail IS NOT NULL AND sc.retail <> ''
        AND sc.clasificacion_2 IS NOT NULL AND sc.clasificacion_2 <> ''
      ON CONFLICT (anno_mes, vendedor, retail, clasificacion_2) DO UPDATE SET
          cuota_monto = EXCLUDED.cuota_monto,
          fecha_actualizacion = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS inserted;
    `;
    const result = await query<{ inserted: boolean }>(sql);
    const insertados = result.rows.filter((r) => r.inserted).length;
    return {
      registros_procesados: result.rowCount ?? 0,
      registros_insertados: insertados,
      registros_actualizados: (result.rowCount ?? 0) - insertados,
      registros_error: 0,
    };
  },

  async upsertDimVendedor(): Promise<SyncResult> {
    // El ERP puede traer varias filas del mismo vendedor cuando su cartera esta repartida
    // en distintos retail (rutas especiales U_SEMANA). Se agregan (SUM de cantidad_cliente,
    // MAX del resto) por (codigo_vendedor, retail_asignado) antes del upsert por la misma
    // razon que fact_ventas: un solo INSERT no puede afectar la misma fila de conflicto
    // dos veces. retail_asignado nulo se normaliza a 'SIN_RETAIL' para que la clave
    // compuesta quede bien definida (NULL no es comparable a si mismo en UNIQUE).
    const sql = `
      INSERT INTO dim_vendedor (codigo_vendedor, nombre_vendedor, cantidad_cliente, vendedor_supervisor, retail_asignado, al_vendedor, tipo_vendedor, estado)
      SELECT
          sv.codigo_vendedor,
          MAX(sv.nombre_vendedor) AS nombre_vendedor,
          SUM(sv.cantidad_cliente) AS cantidad_cliente,
          MAX(sv.vendedor_supervisor) AS vendedor_supervisor,
          COALESCE(sv.retail_asignado, 'SIN_RETAIL') AS retail_asignado,
          MAX(sv.al_vendedor) AS al_vendedor,
          MAX(sv.tipo_vendedor) AS tipo_vendedor,
          'Activo' AS estado
      FROM stg_vendedor sv
      WHERE sv.codigo_vendedor IS NOT NULL AND sv.codigo_vendedor <> ''
      GROUP BY sv.codigo_vendedor, COALESCE(sv.retail_asignado, 'SIN_RETAIL')
      ON CONFLICT (codigo_vendedor, retail_asignado) DO UPDATE SET
          nombre_vendedor = EXCLUDED.nombre_vendedor,
          cantidad_cliente = EXCLUDED.cantidad_cliente,
          vendedor_supervisor = EXCLUDED.vendedor_supervisor,
          al_vendedor = EXCLUDED.al_vendedor,
          tipo_vendedor = EXCLUDED.tipo_vendedor,
          estado = EXCLUDED.estado,
          fecha_actualizacion = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS inserted;
    `;
    const result = await query<{ inserted: boolean }>(sql);
    const insertados = result.rows.filter((r) => r.inserted).length;
    return {
      registros_procesados: result.rowCount ?? 0,
      registros_insertados: insertados,
      registros_actualizados: (result.rowCount ?? 0) - insertados,
      registros_error: 0,
    };
  },

  async upsertDimClasificacion(): Promise<SyncResult> {
    const sql = `
      INSERT INTO dim_clasificacion (codigo_clasificacion, descripcion_clasificacion, nivel_jerarquia)
      SELECT sc.codigo_clasificacion, sc.descripcion_clasificacion, sc.nivel_jerarquia
      FROM stg_clasificacion sc
      WHERE sc.codigo_clasificacion IS NOT NULL AND sc.codigo_clasificacion <> ''
      ON CONFLICT (codigo_clasificacion) DO UPDATE SET
          descripcion_clasificacion = EXCLUDED.descripcion_clasificacion,
          nivel_jerarquia = EXCLUDED.nivel_jerarquia,
          fecha_actualizacion = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS inserted;
    `;
    const result = await query<{ inserted: boolean }>(sql);
    const insertados = result.rows.filter((r) => r.inserted).length;
    return {
      registros_procesados: result.rowCount ?? 0,
      registros_insertados: insertados,
      registros_actualizados: (result.rowCount ?? 0) - insertados,
      registros_error: 0,
    };
  },

  // ============================================
  // VISTAS MATERIALIZADAS
  // ============================================
  async refreshMaterializedViews(): Promise<void> {
    const views = [
      'mv_distribucion_por_retail',
      'mv_distribucion_por_cluster',
      'mv_distribucion_por_vendedor',
      'mv_ventas_por_vendedor',
      'mv_surtido_por_cliente',
      'mv_surtido_por_vendedor',
      'mv_surtido_por_cluster',
      'mv_clientes_no_visitados',
      // Orden importa: cada una lee de la anterior (cliente -> cobertura_vendedor -> resumen_vendedor).
      'mv_surtido_mandatorio_cliente',
      'mv_surtido_mandatorio_cobertura_vendedor',
      'mv_surtido_mandatorio_resumen_vendedor',
      'mv_surtido_mandatorio_global_por_vendedor',
      'mv_surtido_mandatorio_global_general',
      'mv_resumen_kpi_general',
    ];
    for (const view of views) {
      logger.info(`Refrescando vista materializada: ${view}`);
      await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
    }
  },

  // ============================================
  // SYNC_LOGS
  // ============================================
  async crearSyncLog(tipo: TipoSincronizacion, disparadoManualmente = false): Promise<number> {
    const result = await query<{ id_sync: number }>(
      `INSERT INTO sync_logs (tipo_tabla, estado, disparado_manualmente) VALUES ($1, 'iniciado', $2) RETURNING id_sync`,
      [tipo, disparadoManualmente]
    );
    return result.rows[0].id_sync;
  },

  async actualizarSyncLog(
    idSync: number,
    patch: Partial<{
      estado: EstadoSincronizacion;
      registros_procesados: number;
      registros_insertados: number;
      registros_actualizados: number;
      registros_error: number;
      mensaje_error: string | null;
      fecha_fin: Date;
    }>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(patch)) {
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx += 1;
    }
    if (fields.length === 0) return;

    values.push(idSync);
    await query(`UPDATE sync_logs SET ${fields.join(', ')} WHERE id_sync = $${idx}`, values);
  },

  async obtenerSyncLogs(filter: SyncLogFilter): Promise<SyncLog[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.tipo) {
      conditions.push(`tipo_tabla = $${idx}`);
      values.push(filter.tipo);
      idx += 1;
    }
    if (filter.estado) {
      conditions.push(`estado = $${idx}`);
      values.push(filter.estado);
      idx += 1;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(filter.limit ?? 50);

    const result = await query<SyncLog>(
      `SELECT * FROM sync_logs ${where} ORDER BY fecha_inicio DESC LIMIT $${idx}`,
      values
    );
    return result.rows;
  },

  async obtenerSyncLogPorId(id: number): Promise<SyncLog | null> {
    const result = await query<SyncLog>(`SELECT * FROM sync_logs WHERE id_sync = $1`, [id]);
    return result.rows[0] ?? null;
  },

  async obtenerUltimoSyncLogPorTipo(tipo: TipoSincronizacion): Promise<SyncLog | null> {
    const result = await query<SyncLog>(
      `SELECT * FROM sync_logs WHERE tipo_tabla = $1 ORDER BY fecha_inicio DESC LIMIT 1`,
      [tipo]
    );
    return result.rows[0] ?? null;
  },

  // ============================================
  // SYNC_METADATA
  // ============================================
  async actualizarSyncMetadata(nombreTabla: string, estado: string): Promise<void> {
    await query(
      `INSERT INTO sync_metadata (nombre_tabla, ultima_sincronizacion, estado)
       VALUES ($1, CURRENT_TIMESTAMP, $2)
       ON CONFLICT (nombre_tabla) DO UPDATE SET
         ultima_sincronizacion = CURRENT_TIMESTAMP,
         estado = EXCLUDED.estado`,
      [nombreTabla, estado]
    );
  },
};
