import sql from 'mssql';
import { getMssqlPool } from '../config/database';
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
} from '../types';
import logger from '../config/logger';
import { env } from '../config/env';

// Nombres de tabla/campo validados contra el ERP CATELLI (ver docs/QUERIES_DEFINITIVAS_ERP_CATELLI.md)
const QUERY_CLIENTES = `
  SELECT
      ISNULL(C.CLIENTE, '') AS codigo_cliente,
      ISNULL(C.NOMBRE, '') AS nombre_cliente,
      ISNULL(C.CATEGORIA_CLIENTE, 'OT') AS categoria_cliente,
      ISNULL(C.U_CLUSTER, 'BRONZE') AS u_cluster,
      ISNULL(C.VENDEDOR, '') AS vendedor_asignado,
      CASE WHEN C.ACTIVO = 'S' THEN 'Activo' ELSE 'Inactivo' END AS estado,
      CONVERT(DATE, GETDATE()) AS fecha_creacion,
      -- Igual que catelli.CUBO_EXACTUS_FACTURA_LINEA_ORIGINAL.CAT_CLIENTE_ESP: ruta especial si
      -- existe, si no cae al codigo del vendedor asignado.
      CASE WHEN C.U_SEMANA IS NULL THEN C.VENDEDOR ELSE C.U_SEMANA END AS cat_cliente_esp
  FROM CATELLI.CLIENTE C
  WHERE C.ACTIVO = 'S'
  ORDER BY C.CLIENTE;
`;

const QUERY_ARTICULOS = `
  SELECT
      ISNULL(A.ARTICULO, '') AS codigo_articulo,
      ISNULL(A.DESCRIPCION, '') AS descripcion,
      ISNULL(A.CLASIFICACION_1, '') AS clasificacion_1,
      ISNULL(A.CLASIFICACION_2, '') AS clasificacion_2,
      C.DESCRIPCION AS descripcion_subcategoria,
      ISNULL(A.U_SURTIDO_N, 0) AS u_surtido_n,
      ISNULL(A.ARTICULO_DEL_PROV, '') AS articulo_del_proveedor,
      NULL AS precio_unitario
  FROM CATELLI.ARTICULO A
  LEFT JOIN CATELLI.CLASIFICACION C ON A.CLASIFICACION_2 = C.CLASIFICACION
  WHERE A.ACTIVO = 'S'
  ORDER BY A.ARTICULO;
`;
// precio_unitario se deja en NULL a proposito: el precio real vive en CATELLI.ARTICULO_PRECIO
// y depende de NIVEL_PRECIO/VERSION por cliente; no es necesario para Distribucion/Surtido.
// Sin filtro de U_SURTIDO_N: traemos TODOS los articulos activos porque DISTRIBUCION se mide
// por CLASIFICACION_2 (subcategoria), no solo por los grupos de surtido obligatorio.

// CATEGORIA_CLIENTE = 'OT' (clientes "otros", sin retail real asignado) se excluye: no deben
// contarse en ninguna venta, igual criterio ya usado en dim_clientes/QUERY_VENDEDOR.
const QUERY_FACTURAS = `
  SELECT
      CONVERT(VARCHAR(100), F.FACTURA) AS id_factura,
      F.CLIENTE AS codigo_cliente,
      CONVERT(DATE, F.FECHA) AS fecha_factura,
      CASE
          WHEN F.TIPO_DOCUMENTO = 'D' THEN 'Devolucion'
          ELSE 'Activa'
      END AS estado_factura
  FROM CATELLI.FACTURA F
  INNER JOIN CATELLI.CLIENTE C ON F.CLIENTE = C.CLIENTE
  WHERE CONVERT(DATE, F.FECHA) >= @fechaDesde
    AND CONVERT(DATE, F.FECHA) <= @fechaHasta
    AND F.ANULADA != 'S'
    AND C.CATEGORIA_CLIENTE NOT LIKE 'OT'
  ORDER BY F.FECHA DESC;
`;

// Las devoluciones (TIPO_DOCUMENTO = 'D') son documentos propios en CATELLI.FACTURA, con sus
// propias lineas en FACTURA_LINEA (cantidad guardada en positivo, igual que una venta normal).
// Se "netean" invirtiendo el signo de cantidad/monto aqui mismo, para que al sumar por
// cliente+articulo en Postgres el resultado ya sea la cantidad neta (venta - devolucion).
//
// Filtros de articulo agregados tras validar contra el reporte de referencia (Excel VENTAS):
// A.TIPO = 'V' son articulos de servicio/varios que no son venta real; los codigos puntuales
// (975, 971, 2022, 2027, 5155, 5215, 5149) y CLASIFICACION_4 = 'GND' son ajustes/gastos que el
// negocio nunca cuenta como venta.
const QUERY_FACTURA_LINEAS = `
  SELECT
      CONVERT(VARCHAR(100), FL.FACTURA) AS id_factura,
      FL.ARTICULO AS codigo_articulo,
      CASE WHEN F.TIPO_DOCUMENTO = 'D' THEN -FL.cantidad ELSE FL.cantidad END AS cantidad,
      FL.precio_unitario,
      CASE WHEN F.TIPO_DOCUMENTO = 'D' THEN -(FL.cantidad * FL.precio_unitario) ELSE (FL.cantidad * FL.precio_unitario) END AS monto_total
  FROM CATELLI.FACTURA_LINEA FL
  JOIN CATELLI.FACTURA F ON FL.FACTURA = F.FACTURA
  JOIN CATELLI.ARTICULO A ON FL.ARTICULO = A.ARTICULO
  WHERE CONVERT(DATE, F.FECHA) >= @fechaDesde
    AND CONVERT(DATE, F.FECHA) <= @fechaHasta
    AND F.ANULADA != 'S'
    AND A.TIPO NOT IN ('V')
    AND A.ARTICULO NOT IN ('975', '971', '2022', '2027', '5155', '5215', '5149')
    AND A.CLASIFICACION_4 NOT IN ('GND')
  ORDER BY FL.FACTURA, FL.ARTICULO;
`;

// Universo oficial de clientes por RETAIL y MES (ver docs/ESPECIFICACION_FINAL_DISTRIBUCION_KPI.md).
// La tabla trae "retail" con espacios en blanco inconsistentes (p.ej. "AUTOSERVICIO "); se limpia con TRIM.
const QUERY_UNIVERSO_CLIENTE = `
  SELECT
      LTRIM(RTRIM(anno_mes)) AS anno_mes,
      LTRIM(RTRIM(retail)) AS retail,
      universo,
      ISNULL(estado, 'Activo') AS estado
  FROM dbo.universo_cliente
  WHERE estado = 'Activo'
    AND anno_mes >= @annoMesDesde
    AND anno_mes <= @annoMesHasta
  ORDER BY anno_mes DESC, retail;
`;

// Objetivos oficiales de distribucion por RETAIL, SUBCATEGORIA y MES.
// OJO: la tabla real se llama dbo.distribuccion (con doble "c"), no dbo.distribucion.
// SubCategoria viene como "G21 - Dental Creams" (codigo + descripcion); se extrae solo el
// codigo (antes del primer " - ") para poder cruzar con dim_articulos.clasificacion_2.
const QUERY_OBJETIVOS_DISTRIBUCION = `
  SELECT
      LTRIM(RTRIM(anno_mes)) AS anno_mes,
      LTRIM(RTRIM(retail)) AS retail,
      LTRIM(RTRIM(LEFT(
          SubCategoria,
          CASE WHEN CHARINDEX(' - ', SubCategoria) > 0
               THEN CHARINDEX(' - ', SubCategoria) - 1
               ELSE LEN(SubCategoria)
          END
      ))) AS clasificacion_2,
      Objetivos AS objetivo_clientes,
      Objetivos_pesos AS objetivo_monto,
      ISNULL(estado, 'Activo') AS estado
  FROM dbo.distribuccion
  WHERE estado = 'Activo'
    AND anno_mes >= @annoMesDesde
    AND anno_mes <= @annoMesHasta
  ORDER BY anno_mes DESC, retail, clasificacion_2;
`;

// Cantidad real de clientes asignados por vendedor (ver
// docs/INTEGRACION_TABLA_DBVENDEDOR_CANTIDAD_CLIENTES.md). Un mismo vendedor puede aparecer
// en varias filas si su cartera esta repartida en distintos retail (rutas especiales
// U_SEMANA = MC1/MD1/WC1/WD1); el UPSERT del lado Postgres agrupa por (vendedor, retail).
//
// NOTA: se EXCLUYEN los clientes U_ESTATUS='EnEspera' (decision de negocio confirmada,
// validada contra el conteo real de cartera del vendedor 7: 403 activos sin EnEspera vs
// 427 con ellos incluidos).
//
// IMPORTANTE: solo se cuenta un cliente si su RETAIL REAL (derivado de su propia
// CATEGORIA_CLIENTE, igual mapeo que usa dim_clientes) coincide con el retail_asignado que le
// corresponde a esta fila del vendedor. Sin este filtro, un cliente de otra categoria (p.ej.
// D1/MAYORISTA) asignado al mismo codigo de vendedor se cuenta como si fuera parte de la
// cartera COLMADO del vendedor, inflando "cartera" con clientes que "compraron" nunca podria
// incluir (porque fact_ventas.retail usa el retail real del cliente, no el del vendedor).
const QUERY_VENDEDOR = `
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
      CONVERT(VARCHAR(20), V.U_TIPO_VENDEDOR) AS tipo_vendedor
  FROM CATELLI.VENDEDOR V
  LEFT JOIN CATELLI.CLIENTE C
      ON V.VENDEDOR = C.VENDEDOR
      AND C.ACTIVO = 'S'
      AND C.U_ESTATUS NOT LIKE 'EnEspera'
      AND (
          -- Igual que catelli.CUBO_EXACTUS_FACTURA_LINEA_ORIGINAL.RETAIL (fuente oficial de
          -- ventas/distribucion): A3=MINIMARKET SI cuenta como COLMADO, SM=Supermercados
          -- Especiales cuenta como AUTOSERVICIO.
          CASE C.CATEGORIA_CLIENTE
              WHEN 'A1' THEN 'COLMADO' WHEN 'A2' THEN 'COLMADO' WHEN 'A3' THEN 'COLMADO'
              WHEN 'C1' THEN 'AUTOSERVICIO' WHEN 'C2' THEN 'AUTOSERVICIO' WHEN 'SM' THEN 'AUTOSERVICIO'
              WHEN 'D1' THEN 'MAYORISTA' WHEN 'D2' THEN 'MAYORISTA' WHEN 'Q1' THEN 'MAYORISTA' WHEN 'SUR' THEN 'MAYORISTA'
              ELSE 'OTROS'
          END
      ) = (
          CASE
              WHEN C.U_SEMANA IN ('MC1', 'WC1') THEN 'AUTOSERVICIO'
              WHEN C.U_SEMANA IN ('MD1', 'WD1') THEN 'MAYORISTA'
              ELSE V.U_RETAIL
          END
      )
  WHERE V.U_CAMIONF NOT IN ('GND')
  GROUP BY V.VENDEDOR, V.NOMBRE, V.U_SUPERASIGNADO, V.U_RETAIL, C.U_SEMANA, V.U_TIPO_VENDEDOR
  ORDER BY V.VENDEDOR;
`;

// Cuota de VENTAS EN PESOS por vendedor+subcategoria+mes (dbo.cuota). Distinta de la cuota de
// cantidad-de-clientes que ya calcula mv_distribucion_por_vendedor (cartera x objetivo%): esta
// es la meta de $ que el negocio le asigna a cada vendedor, ya ajustada (Cuota_ajustada).
// La tabla trae detalle por marca; se agrega (SUM) porque esta ronda no necesita ese desglose.
// mes_anno viene con una codificacion rara del ERP (dia=mes, mes fijo en 01: '2024-01-06' para
// junio-2024), por eso el anno_mes real se arma con YEAR(mes_anno) + el campo "mes" (nvarchar).
// "vendedor" a veces trae codigos de ruta especial (MC1/MD1/WC1/WD1, igual que CAT_CLIENTE_ESP)
// y codigos de vendedor con casing inconsistente ("o2" vs "O2" en CATELLI.VENDEDOR); se
// normaliza a mayusculas para que cruce bien con dim_vendedor.codigo_vendedor.
const QUERY_CUOTA = `
  SELECT
      CAST(YEAR(mes_anno) AS VARCHAR(4)) + '-' + RIGHT('0' + LTRIM(RTRIM(mes)), 2) AS anno_mes,
      UPPER(LTRIM(RTRIM(vendedor))) AS vendedor,
      LTRIM(RTRIM(retail)) AS retail,
      LTRIM(RTRIM(LEFT(
          Subcategoria,
          CASE WHEN CHARINDEX(' - ', Subcategoria) > 0
               THEN CHARINDEX(' - ', Subcategoria) - 1
               ELSE LEN(Subcategoria)
          END
      ))) AS clasificacion_2,
      SUM(Cuota_ajustada) AS cuota_monto
  FROM dbo.cuota
  WHERE CAST(YEAR(mes_anno) AS VARCHAR(4)) + '-' + RIGHT('0' + LTRIM(RTRIM(mes)), 2) >= @annoMesDesde
    AND CAST(YEAR(mes_anno) AS VARCHAR(4)) + '-' + RIGHT('0' + LTRIM(RTRIM(mes)), 2) <= @annoMesHasta
  GROUP BY YEAR(mes_anno), mes, vendedor, retail, Subcategoria
  ORDER BY anno_mes DESC, vendedor;
`;

// Descripcion legible de cada codigo de clasificacion (usada para enriquecer articulos).
const QUERY_CLASIFICACION = `
  SELECT
      ISNULL(CLASIFICACION, '') AS codigo_clasificacion,
      DESCRIPCION AS descripcion_clasificacion,
      U_JERARQUIA AS nivel_jerarquia
  FROM CATELLI.CLASIFICACION
  ORDER BY CLASIFICACION;
`;

function calcularVentanaSincronizacionVentas(): { desde: string; hasta: string } {
  if (env.mssql.syncFechaDesde && env.mssql.syncFechaHasta) {
    return { desde: env.mssql.syncFechaDesde, hasta: env.mssql.syncFechaHasta };
  }
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - 60);
  return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) };
}

// Deriva el rango de anno_mes (YYYY-MM) a partir de la misma ventana usada para ventas,
// para mantener una unica fuente de verdad sobre "que periodo estamos sincronizando".
function calcularVentanaMeses(): { annoMesDesde: string; annoMesHasta: string } {
  const { desde, hasta } = calcularVentanaSincronizacionVentas();
  return { annoMesDesde: desde.slice(0, 7), annoMesHasta: hasta.slice(0, 7) };
}

export const MssqlService = {
  async extraerClientes(): Promise<StgCliente[]> {
    const pool = await getMssqlPool();
    const result = await pool.request().query<StgCliente>(QUERY_CLIENTES);
    logger.info(`MSSQL: ${result.recordset.length} clientes extraidos`);
    return result.recordset;
  },

  async extraerArticulos(): Promise<StgArticulo[]> {
    const pool = await getMssqlPool();
    const result = await pool.request().query<StgArticulo>(QUERY_ARTICULOS);
    logger.info(`MSSQL: ${result.recordset.length} articulos extraidos`);
    return result.recordset;
  },

  async extraerFacturas(): Promise<StgFactura[]> {
    const pool = await getMssqlPool();
    const { desde, hasta } = calcularVentanaSincronizacionVentas();
    const result = await pool
      .request()
      .input('fechaDesde', sql.Date, desde)
      .input('fechaHasta', sql.Date, hasta)
      .query<StgFactura>(QUERY_FACTURAS);
    logger.info(`MSSQL: ${result.recordset.length} facturas extraidas (${desde} a ${hasta})`);
    return result.recordset;
  },

  async extraerFacturaLineas(): Promise<StgFacturaLinea[]> {
    const pool = await getMssqlPool();
    const { desde, hasta } = calcularVentanaSincronizacionVentas();
    const result = await pool
      .request()
      .input('fechaDesde', sql.Date, desde)
      .input('fechaHasta', sql.Date, hasta)
      .query<StgFacturaLinea>(QUERY_FACTURA_LINEAS);
    logger.info(`MSSQL: ${result.recordset.length} lineas de factura extraidas (${desde} a ${hasta})`);
    return result.recordset;
  },

  async extraerUniversoCliente(): Promise<StgUniversoCliente[]> {
    const pool = await getMssqlPool();
    const { annoMesDesde, annoMesHasta } = calcularVentanaMeses();
    const result = await pool
      .request()
      .input('annoMesDesde', sql.VarChar(7), annoMesDesde)
      .input('annoMesHasta', sql.VarChar(7), annoMesHasta)
      .query<StgUniversoCliente>(QUERY_UNIVERSO_CLIENTE);
    logger.info(`MSSQL: ${result.recordset.length} filas de universo_cliente extraidas (${annoMesDesde} a ${annoMesHasta})`);
    return result.recordset;
  },

  async extraerObjetivosDistribucion(): Promise<StgObjetivoDistribucion[]> {
    const pool = await getMssqlPool();
    const { annoMesDesde, annoMesHasta } = calcularVentanaMeses();
    const result = await pool
      .request()
      .input('annoMesDesde', sql.VarChar(7), annoMesDesde)
      .input('annoMesHasta', sql.VarChar(7), annoMesHasta)
      .query<StgObjetivoDistribucion>(QUERY_OBJETIVOS_DISTRIBUCION);
    logger.info(`MSSQL: ${result.recordset.length} objetivos de distribucion extraidos (${annoMesDesde} a ${annoMesHasta})`);
    return result.recordset;
  },

  async extraerCuota(): Promise<StgCuota[]> {
    const pool = await getMssqlPool();
    const { annoMesDesde, annoMesHasta } = calcularVentanaMeses();
    const result = await pool
      .request()
      .input('annoMesDesde', sql.VarChar(7), annoMesDesde)
      .input('annoMesHasta', sql.VarChar(7), annoMesHasta)
      .query<StgCuota>(QUERY_CUOTA);
    logger.info(`MSSQL: ${result.recordset.length} filas de cuota extraidas (${annoMesDesde} a ${annoMesHasta})`);
    return result.recordset;
  },

  async extraerVendedor(): Promise<StgVendedor[]> {
    const pool = await getMssqlPool();
    const result = await pool.request().query<StgVendedor>(QUERY_VENDEDOR);
    logger.info(`MSSQL: ${result.recordset.length} filas de vendedor extraidas`);
    return result.recordset;
  },

  async extraerClasificacion(): Promise<StgClasificacion[]> {
    const pool = await getMssqlPool();
    const result = await pool.request().query<StgClasificacion>(QUERY_CLASIFICACION);
    logger.info(`MSSQL: ${result.recordset.length} clasificaciones extraidas`);
    return result.recordset;
  },
};
