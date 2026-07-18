import { pgPool } from '../config/database';
import { ETLService } from './etl.service';
import { PostgresqlService } from './postgresql.service';
import { ConfigService } from './config.service';
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

jest.mock('./mssql.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MssqlService } = require('./mssql.service') as {
  MssqlService: {
    extraerClientes: jest.Mock;
    extraerArticulos: jest.Mock;
    extraerFacturas: jest.Mock;
    extraerFacturaLineas: jest.Mock;
    extraerObjetivosDistribucion: jest.Mock;
    extraerUniversoCliente: jest.Mock;
    extraerVendedor: jest.Mock;
    extraerClasificacion: jest.Mock;
    extraerCuota: jest.Mock;
  };
};

const ANNO_MES = '2025-01';
const FECHA_FACTURA = '2025-01-15';
const VENDEDOR = 'V1';

const CLIENTES: StgCliente[] = [
  {
    codigo_cliente: 'C1',
    nombre_cliente: 'Cliente Uno',
    categoria_cliente: 'A1',
    u_cluster: 'BRONZE',
    vendedor_asignado: VENDEDOR,
    cat_cliente_esp: VENDEDOR,
    estado: 'Activo',
    fecha_creacion: '2025-01-01',
  },
  {
    codigo_cliente: 'C2',
    nombre_cliente: 'Cliente Dos',
    categoria_cliente: 'A1',
    u_cluster: 'BRONZE',
    vendedor_asignado: VENDEDOR,
    cat_cliente_esp: VENDEDOR,
    estado: 'Activo',
    fecha_creacion: '2025-01-01',
  },
  {
    // Compra y devuelve TODO en G32: sirve para probar que el neteo de devoluciones excluye
    // correctamente a un cliente cuya compra neta termino en cero.
    codigo_cliente: 'C3',
    nombre_cliente: 'Cliente Tres',
    categoria_cliente: 'A1',
    u_cluster: 'BRONZE',
    vendedor_asignado: VENDEDOR,
    cat_cliente_esp: VENDEDOR,
    estado: 'Activo',
    fecha_creacion: '2025-01-01',
  },
];

const ARTICULOS: StgArticulo[] = [
  {
    codigo_articulo: 'ART-G21',
    descripcion: 'Articulo G21',
    clasificacion_1: 'C10',
    clasificacion_2: 'G21',
    descripcion_subcategoria: 'Dental Creams',
    u_surtido_n: 1,
    articulo_del_proveedor: null,
    precio_unitario: null,
  },
  {
    codigo_articulo: 'ART-G22',
    descripcion: 'Articulo G22',
    clasificacion_1: 'C10',
    clasificacion_2: 'G22',
    descripcion_subcategoria: 'Toothbrushes',
    u_surtido_n: 2,
    articulo_del_proveedor: null,
    precio_unitario: null,
  },
  {
    codigo_articulo: 'ART-G32',
    descripcion: 'Articulo G32',
    clasificacion_1: 'C10',
    clasificacion_2: 'G32',
    descripcion_subcategoria: 'Liquid Cleaner',
    u_surtido_n: 3,
    articulo_del_proveedor: null,
    precio_unitario: null,
  },
];

const FACTURAS: StgFactura[] = [
  { id_factura: 'F1', codigo_cliente: 'C1', fecha_factura: FECHA_FACTURA, estado_factura: 'Activa' },
  // F1B/F1C: mismo cliente C1, mismas subcategorias (G21/G22), en facturas distintas. Junto con
  // F1 acumulan cantidad NETA suficiente para alcanzar el minimo de unidades que exige
  // dim_criterios_distribucion para COLMADO (>=3 unidades netas, formula real del negocio:
  // COUNTIFS(dbDistribucion[CANTIDAD], ">=3", ...) sobre la cantidad neta por cliente+subcategoria).
  { id_factura: 'F1B', codigo_cliente: 'C1', fecha_factura: '2025-01-16', estado_factura: 'Activa' },
  { id_factura: 'F1C', codigo_cliente: 'C1', fecha_factura: '2025-01-17', estado_factura: 'Activa' },
  // C2 compra G21 con cantidad neta 1: no alcanza el minimo de 3 unidades de COLMADO. Sirve para
  // probar que el umbral de minimo_compras decide si un cliente cuenta como "compro".
  { id_factura: 'F2X', codigo_cliente: 'C2', fecha_factura: '2025-01-18', estado_factura: 'Activa' },
  { id_factura: 'F2', codigo_cliente: 'C3', fecha_factura: '2025-01-16', estado_factura: 'Activa' },
  { id_factura: 'F3', codigo_cliente: 'C3', fecha_factura: '2025-01-17', estado_factura: 'Devolucion' },
];

// Dos lineas para (F1, ART-G21): regresion del bug real "ON CONFLICT DO UPDATE command
// cannot affect row a second time" que se arreglo agregando (SUM) por factura+articulo.
const FACTURA_LINEAS: StgFacturaLinea[] = [
  { id_factura: 'F1', codigo_articulo: 'ART-G21', cantidad: 2, precio_unitario: 100, monto_total: 200 },
  { id_factura: 'F1', codigo_articulo: 'ART-G21', cantidad: 3, precio_unitario: 100, monto_total: 300 },
  { id_factura: 'F1', codigo_articulo: 'ART-G22', cantidad: 1, precio_unitario: 50, monto_total: 50 },
  // Con F1B y F1C, C1 acumula cantidad neta 7 en G21 (5+1+1) y 3 en G22 (1+1+1): ambas alcanzan
  // el minimo de unidades de COLMADO (>=3).
  { id_factura: 'F1B', codigo_articulo: 'ART-G21', cantidad: 1, precio_unitario: 100, monto_total: 100 },
  { id_factura: 'F1B', codigo_articulo: 'ART-G22', cantidad: 1, precio_unitario: 50, monto_total: 50 },
  { id_factura: 'F1C', codigo_articulo: 'ART-G21', cantidad: 1, precio_unitario: 100, monto_total: 100 },
  { id_factura: 'F1C', codigo_articulo: 'ART-G22', cantidad: 1, precio_unitario: 50, monto_total: 50 },
  // C2 compra G21 con cantidad neta 1 (no llega a las 3 unidades que exige COLMADO).
  { id_factura: 'F2X', codigo_articulo: 'ART-G21', cantidad: 1, precio_unitario: 100, monto_total: 100 },
  // C3 compra 2 de G32 y luego lo devuelve todo (F3 ya viene con cantidad/monto en negativo,
  // igual que el signo que aplica QUERY_FACTURA_LINEAS para TIPO_DOCUMENTO='D'). Cantidad neta = 0:
  // no alcanza el minimo de 3 unidades (el neteo de devoluciones y el umbral son, de hecho, la
  // misma condicion: cantidad_neta >= minimo_compras).
  { id_factura: 'F2', codigo_articulo: 'ART-G32', cantidad: 2, precio_unitario: 10, monto_total: 20 },
  { id_factura: 'F3', codigo_articulo: 'ART-G32', cantidad: -2, precio_unitario: 10, monto_total: -20 },
];

const OBJETIVOS: StgObjetivoDistribucion[] = [
  { anno_mes: ANNO_MES, retail: 'COLMADO', clasificacion_2: 'G21', objetivo_clientes: 1, objetivo_monto: 1000, estado: 'Activo' },
  { anno_mes: ANNO_MES, retail: 'COLMADO', clasificacion_2: 'G22', objetivo_clientes: 2, objetivo_monto: 500, estado: 'Activo' },
  { anno_mes: ANNO_MES, retail: 'COLMADO', clasificacion_2: 'G32', objetivo_clientes: 1, objetivo_monto: 100, estado: 'Activo' },
];

const UNIVERSO: StgUniversoCliente[] = [{ anno_mes: ANNO_MES, retail: 'COLMADO', universo: 2, estado: 'Activo' }];

// Cuota $ oficial del ERP (dbo.cuota) para el vendedor V1 en COLMADO. Ventas reales del
// vendedor en el mes (SUM(monto) de fact_ventas, sin filtrar por umbral de "compraron"):
// G21 = 800 (F1:500 + F1B:100 + F1C:100 + F2X:100), G22 = 150 (F1:50 + F1B:50 + F1C:50),
// G32 = 0 (F2:20 - F3:20, la venta y la devolucion se anulan).
const CUOTA: StgCuota[] = [
  { anno_mes: ANNO_MES, vendedor: VENDEDOR, retail: 'COLMADO', clasificacion_2: 'G21', cuota_monto: 1000 },
  { anno_mes: ANNO_MES, vendedor: VENDEDOR, retail: 'COLMADO', clasificacion_2: 'G22', cuota_monto: 300 },
  { anno_mes: ANNO_MES, vendedor: VENDEDOR, retail: 'COLMADO', clasificacion_2: 'G32', cuota_monto: 500 },
];

// Regresion del bug real: un vendedor con cartera repartida en retail (rutas especiales
// U_SEMANA) produce varias filas crudas del ERP. Dos de ellas comparten (vendedor, retail)
// y deben SUMARSE (2+3=5); la tercera tiene un retail distinto y debe quedar en fila aparte.
const VENDEDORES: StgVendedor[] = [
  { codigo_vendedor: VENDEDOR, nombre_vendedor: 'Vendedor Uno', cantidad_cliente: 2, vendedor_supervisor: 'SUP1', retail_asignado: 'COLMADO', al_vendedor: VENDEDOR, tipo_vendedor: '1' },
  { codigo_vendedor: VENDEDOR, nombre_vendedor: 'Vendedor Uno', cantidad_cliente: 3, vendedor_supervisor: 'SUP1', retail_asignado: 'COLMADO', al_vendedor: VENDEDOR, tipo_vendedor: '1' },
  { codigo_vendedor: VENDEDOR, nombre_vendedor: 'Vendedor Uno', cantidad_cliente: 1, vendedor_supervisor: 'SUP1', retail_asignado: 'MAYORISTA', al_vendedor: 'RUTA1', tipo_vendedor: '1' },
];

const CLASIFICACIONES: StgClasificacion[] = [
  { codigo_clasificacion: 'G21', descripcion_clasificacion: 'Dental Creams', nivel_jerarquia: 'C20' },
  { codigo_clasificacion: 'G22', descripcion_clasificacion: 'Toothbrushes', nivel_jerarquia: 'C20' },
];

async function limpiarBaseDeDatos(): Promise<void> {
  await pgPool.query(
    `TRUNCATE TABLE fact_ventas, dim_clientes, dim_articulos, dim_tiempo,
       dim_universo_cliente, dim_objetivos_distribucion, dim_vendedor, dim_clasificacion,
       dim_cuota_vendedor, dim_dia_no_laborable
       RESTART IDENTITY CASCADE`
  );
  await pgPool.query(
    `TRUNCATE TABLE stg_clientes, stg_articulos, stg_facturas, stg_factura_lineas,
       stg_universo_cliente, stg_objetivos_distribucion, stg_vendedor, stg_clasificacion,
       stg_cuota`
  );
  await pgPool.query(`TRUNCATE TABLE sync_logs, sync_metadata RESTART IDENTITY CASCADE`);
}

describe('ETL pipeline (integracion contra PostgreSQL real)', () => {
  beforeAll(async () => {
    await limpiarBaseDeDatos();

    MssqlService.extraerClientes.mockResolvedValue(CLIENTES);
    MssqlService.extraerArticulos.mockResolvedValue(ARTICULOS);
    MssqlService.extraerFacturas.mockResolvedValue(FACTURAS);
    MssqlService.extraerFacturaLineas.mockResolvedValue(FACTURA_LINEAS);
    MssqlService.extraerObjetivosDistribucion.mockResolvedValue(OBJETIVOS);
    MssqlService.extraerUniversoCliente.mockResolvedValue(UNIVERSO);
    MssqlService.extraerVendedor.mockResolvedValue(VENDEDORES);
    MssqlService.extraerClasificacion.mockResolvedValue(CLASIFICACIONES);
    MssqlService.extraerCuota.mockResolvedValue(CUOTA);

    await ETLService.syncClientes(true);
    await ETLService.syncArticulos(true);
    await ETLService.syncVentas(true);
    await ETLService.calcularKpis(true);

    // Feriado curado a mano (miercoles, no cae en fin de semana) dentro de ANNO_MES, para
    // probar que dias_laborables_mes()/dias_laborables_transcurridos() lo excluyen ademas de
    // los fines de semana. Enero-2025 tiene 23 dias habiles (lunes a viernes); con este feriado
    // quedan 22. fecha_referencia_ventas() = 2025-01-18, y el feriado (08-ene) cae antes de esa
    // fecha, asi que "transcurridos" tambien baja de 13 a 12.
    await pgPool.query(
      `INSERT INTO dim_dia_no_laborable (fecha, descripcion) VALUES ('2025-01-08', 'Feriado de prueba')`
    );

    await PostgresqlService.refreshMaterializedViews();
  });

  afterAll(async () => {
    await pgPool.end();
  });

  it('sincroniza clientes con el mapeo correcto de retail', async () => {
    const result = await pgPool.query(
      `SELECT codigo_cliente, retail, u_cluster, estado FROM dim_clientes ORDER BY codigo_cliente`
    );
    expect(result.rows).toEqual([
      { codigo_cliente: 'C1', retail: 'COLMADO', u_cluster: 'BRONZE', estado: 'Activo' },
      { codigo_cliente: 'C2', retail: 'COLMADO', u_cluster: 'BRONZE', estado: 'Activo' },
      { codigo_cliente: 'C3', retail: 'COLMADO', u_cluster: 'BRONZE', estado: 'Activo' },
    ]);
  });

  it('sincroniza articulos con precio_unitario nulo y descripcion_subcategoria', async () => {
    const result = await pgPool.query(
      `SELECT codigo_articulo, clasificacion_2, descripcion_subcategoria, precio_unitario FROM dim_articulos ORDER BY codigo_articulo`
    );
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].precio_unitario).toBeNull();
    expect(result.rows[0].descripcion_subcategoria).toBe('Dental Creams');
  });

  it('agrega (SUM) lineas duplicadas de la misma factura+articulo en fact_ventas', async () => {
    const result = await pgPool.query(
      `SELECT codigo_articulo, cantidad, monto FROM fact_ventas WHERE id_factura = 'F1' ORDER BY codigo_articulo`
    );
    // 3 lineas de entrada (2 duplicadas para ART-G21 + 1 para ART-G22) deben colapsar en 2 filas
    expect(result.rows).toHaveLength(2);

    const filaG21 = result.rows.find((r) => r.codigo_articulo === 'ART-G21');
    expect(Number(filaG21.cantidad)).toBe(5); // 2 + 3
    expect(Number(filaG21.monto)).toBe(500); // 200 + 300

    const filaG22 = result.rows.find((r) => r.codigo_articulo === 'ART-G22');
    expect(Number(filaG22.cantidad)).toBe(1);
  });

  it('sincroniza objetivos_distribucion y universo_cliente desde el ERP', async () => {
    const objetivos = await pgPool.query(
      `SELECT retail, clasificacion_2, objetivo_clientes FROM dim_objetivos_distribucion ORDER BY clasificacion_2`
    );
    expect(objetivos.rows).toEqual([
      { retail: 'COLMADO', clasificacion_2: 'G21', objetivo_clientes: 1 },
      { retail: 'COLMADO', clasificacion_2: 'G22', objetivo_clientes: 2 },
      { retail: 'COLMADO', clasificacion_2: 'G32', objetivo_clientes: 1 },
    ]);

    const universo = await pgPool.query(`SELECT retail, universo FROM dim_universo_cliente`);
    expect(universo.rows).toEqual([{ retail: 'COLMADO', universo: 2 }]);
  });

  it('sincroniza dim_clasificacion desde el ERP', async () => {
    const result = await pgPool.query(
      `SELECT codigo_clasificacion, descripcion_clasificacion FROM dim_clasificacion ORDER BY codigo_clasificacion`
    );
    expect(result.rows).toEqual([
      { codigo_clasificacion: 'G21', descripcion_clasificacion: 'Dental Creams' },
      { codigo_clasificacion: 'G22', descripcion_clasificacion: 'Toothbrushes' },
    ]);
  });

  it('agrega (SUM) filas de vendedor duplicadas por (codigo_vendedor, retail_asignado), y mantiene filas separadas por retail distinto', async () => {
    const result = await pgPool.query(
      `SELECT codigo_vendedor, retail_asignado, cantidad_cliente FROM dim_vendedor ORDER BY retail_asignado`
    );
    // Regresion del bug real: sin el fix, la segunda y tercera fila del ERP sobreescribian
    // a la primera (UNIQUE solo por codigo_vendedor), perdiendo la cartera de MAYORISTA.
    expect(result.rows).toEqual([
      { codigo_vendedor: VENDEDOR, retail_asignado: 'COLMADO', cantidad_cliente: 5 }, // 2 + 3
      { codigo_vendedor: VENDEDOR, retail_asignado: 'MAYORISTA', cantidad_cliente: 1 },
    ]);
  });

  it('calcula mv_distribucion_por_retail con la formula universo/objetivo del ERP, exigiendo el minimo de compras por retail', async () => {
    const result = await pgPool.query(
      `SELECT subcategoria, total_clientes, resultado, distribucion_porcentaje, objetivo_clientes, objetivo_porcentaje, logro_porcentaje, restan, anno_mes
       FROM mv_distribucion_por_retail
       WHERE retail = 'COLMADO'
       ORDER BY subcategoria`
    );
    expect(result.rows).toEqual([
      {
        // C1 acumula cantidad neta 7 en G21 (F1+F1B+F1C = 5+1+1): alcanza el minimo de unidades
        // de COLMADO (>=3). C2 solo llega a cantidad neta 1 (F2X): NO alcanza el minimo, no cuenta.
        subcategoria: 'G21',
        total_clientes: 2, // universo oficial
        resultado: 1, // solo C1 (C2 se quedo corto del minimo de unidades)
        distribucion_porcentaje: 50,
        objetivo_clientes: 1,
        objetivo_porcentaje: 50, // 1 / 2 * 100
        logro_porcentaje: 100,
        restan: 0, // 1 - 1
        anno_mes: ANNO_MES,
      },
      {
        // C1 acumula cantidad neta 3 en G22 (F1+F1B+F1C = 1+1+1): justo en el minimo de COLMADO.
        subcategoria: 'G22',
        total_clientes: 2,
        resultado: 1,
        distribucion_porcentaje: 50,
        objetivo_clientes: 2,
        objetivo_porcentaje: 100, // 2 / 2 * 100
        logro_porcentaje: 50,
        restan: 1, // 2 - 1
        anno_mes: ANNO_MES,
      },
      {
        // C3 compro y devolvio TODO en G32: cantidad neta = 0, no alcanza el minimo de unidades
        // de COLMADO (el neteo de devoluciones y el umbral de compras son la misma condicion).
        subcategoria: 'G32',
        total_clientes: 2,
        resultado: 0,
        distribucion_porcentaje: 0,
        objetivo_clientes: 1,
        objetivo_porcentaje: 50, // 1 / 2 * 100
        logro_porcentaje: 0,
        restan: 1, // 1 - 0
        anno_mes: ANNO_MES,
      },
    ]);
  });

  it('calcula mv_distribucion_por_cluster con el mismo umbral, mes calendario y filtro de subcategorias activas que Retail/Vendedor', async () => {
    const result = await pgPool.query(
      `SELECT subcategoria, total_clientes, resultado, distribucion_porcentaje, anno_mes
       FROM mv_distribucion_por_cluster
       WHERE u_cluster = 'BRONZE' AND anno_mes = '${ANNO_MES}'
       ORDER BY subcategoria`
    );
    // total_clientes = 3 (C1+C2+C3, todos BRONZE) - NO el universo oficial del retail (eso solo
    // existe en Retail/Vendedor). Aparecen las 7 subcategorias curadas como activas (dim_subcategoria_config),
    // no solo las que tienen articulos en el fixture (G21/G22/G32): las demas quedan en 0 por falta de datos.
    expect(result.rows).toEqual([
      { subcategoria: 'G11', total_clientes: 3, resultado: 0, distribucion_porcentaje: 0, anno_mes: ANNO_MES },
      { subcategoria: 'G13', total_clientes: 3, resultado: 0, distribucion_porcentaje: 0, anno_mes: ANNO_MES },
      { subcategoria: 'G21', total_clientes: 3, resultado: 1, distribucion_porcentaje: 33.33, anno_mes: ANNO_MES }, // C1 (33.33 = 1/3*100)
      { subcategoria: 'G22', total_clientes: 3, resultado: 1, distribucion_porcentaje: 33.33, anno_mes: ANNO_MES }, // C1
      { subcategoria: 'G32', total_clientes: 3, resultado: 0, distribucion_porcentaje: 0, anno_mes: ANNO_MES }, // C3 neteo en 0
      { subcategoria: 'G33', total_clientes: 3, resultado: 0, distribucion_porcentaje: 0, anno_mes: ANNO_MES },
      { subcategoria: 'G44', total_clientes: 3, resultado: 0, distribucion_porcentaje: 0, anno_mes: ANNO_MES },
    ]);
  });

  it('calcula mv_distribucion_por_vendedor con cuota prorrateada (cartera_vendedor x objetivo_porcentaje), exigiendo el minimo de compras por retail', async () => {
    // Nota: esta vista es solo de cantidad-de-clientes; la cuota/ventas en $ (dbo.cuota) viven
    // en mv_ventas_por_vendedor, mezclarlas aqui generaba confusion en la UI (ver esa vista mas
    // abajo para las aserciones de cuota_monto/venta_neta/etc).
    const result = await pgPool.query(
      `SELECT retail, subcategoria, total_clientes_vendedor, resultado, obj2, objetivo_porcentaje, cuota, logro_porcentaje, distribucion_porcentaje, restan
       FROM mv_distribucion_por_vendedor
       WHERE vendedor = '${VENDEDOR}'
       ORDER BY retail, subcategoria`
    );
    // Solo aparece el retail COLMADO: MAYORISTA no tiene fila en dim_objetivos_distribucion
    // para este mes, asi que el JOIN no produce resultado para esa fila de dim_vendedor.
    // cuota = cantidad_cliente_vendedor(5) * objetivo_porcentaje / 100
    expect(result.rows).toEqual([
      {
        // C1 alcanza el minimo de unidades de COLMADO (cantidad neta 7, via F1+F1B+F1C); C2 se
        // queda en cantidad neta 1 (F2X) y no cuenta.
        retail: 'COLMADO',
        subcategoria: 'G21',
        total_clientes_vendedor: 5,
        resultado: 1,
        obj2: 1,
        objetivo_porcentaje: 50, // 1 / 2 * 100
        cuota: 2.5, // 5 * 50%
        logro_porcentaje: 40, // 1 / 2.5 * 100
        distribucion_porcentaje: 20, // 1 / 5 * 100
        restan: 1.5, // 2.5 - 1
      },
      {
        retail: 'COLMADO',
        subcategoria: 'G22',
        total_clientes_vendedor: 5,
        resultado: 1,
        obj2: 2,
        objetivo_porcentaje: 100, // 2 / 2 * 100
        cuota: 5, // 5 * 100%
        logro_porcentaje: 20, // 1 / 5 * 100
        distribucion_porcentaje: 20,
        restan: 4, // 5 - 1
      },
      {
        // C3 (cartera de V1) compro y devolvio TODO en G32: cantidad neta = 0, no alcanza el
        // minimo de unidades de COLMADO; no cuenta como "compro" para el vendedor tampoco.
        retail: 'COLMADO',
        subcategoria: 'G32',
        total_clientes_vendedor: 5,
        resultado: 0,
        obj2: 1,
        objetivo_porcentaje: 50, // 1 / 2 * 100
        cuota: 2.5, // 5 * 50%
        logro_porcentaje: 0,
        distribucion_porcentaje: 0,
        restan: 2.5, // 2.5 - 0
      },
    ]);
  });

  it('calcula mv_ventas_por_vendedor: cuota total (todas las subcategorias), venta neta/bruta, dropsize y proyeccion/diario en dias habiles', async () => {
    const result = await pgPool.query(
      `SELECT retail, cuota_monto, venta_neta, venta_bruta, facturas, dropsize, pct_devolucion, alcance_porcentaje,
              falta, dias_laborables_mes, dias_transcurridos, proyeccion, alcance_proyeccion_porcentaje, diario
       FROM mv_ventas_por_vendedor
       WHERE vendedor = '${VENDEDOR}' AND anno_mes = '${ANNO_MES}'`
    );
    // cuota_monto = SUM de TODAS las subcategorias del fixture CUOTA (1000+300+500=1800), no solo
    // las que tienen resultado en Distribucion. venta_neta/venta_bruta suman TODOS los clientes
    // del vendedor (C1+C2+C3), sin el filtro de minimo_compras que aplica "resultado" en
    // Distribucion: venta_bruta = 970 (500+50+100+50+100+50+100+20, todas las lineas con
    // cantidad > 0); venta_neta = 950 (resta la devolucion de C3: 970-20).
    expect(result.rows).toEqual([
      {
        retail: 'COLMADO',
        cuota_monto: 1800,
        venta_neta: 950,
        venta_bruta: 970,
        facturas: 6,
        dropsize: 158.33, // 950 / 6
        pct_devolucion: 2.06, // (970 - 950) / 970 * 100
        alcance_porcentaje: 52.78, // 950 / 1800 * 100
        falta: 850, // 1800 - 950
        dias_laborables_mes: 22, // 23 dias habiles de enero-2025 menos el feriado curado (08-ene)
        dias_transcurridos: 12, // 13 menos el feriado (cae antes de fecha_referencia_ventas)
        proyeccion: 1741.67, // 950 / 12 * 22
        alcance_proyeccion_porcentaje: 96.76, // 1741.6666... / 1800 * 100
        diario: 85, // 850 / (22 - 12)
      },
    ]);
  });

  it('calcula mv_surtido_por_vendedor usando el conteo real de clientes del vendedor por cluster (no dim_vendedor.cantidad_cliente)', async () => {
    const result = await pgPool.query(
      `SELECT vendedor, u_cluster, total_clientes_vendedor, subcategorias_compradas, subcategorias_obligatorias, surtido_porcentaje, anno_mes
       FROM mv_surtido_por_vendedor WHERE vendedor = '${VENDEDOR}' AND anno_mes = '${ANNO_MES}'`
    );
    expect(result.rows).toEqual([
      {
        vendedor: VENDEDOR,
        u_cluster: 'BRONZE',
        // C1 + C2 + C3 (NO 5: eso seria mezclar el denominador de retail). C3 se agrega aqui
        // pese a que su unica compra (G32) neteo en cero, porque el conteo es de clientes del
        // cluster, no de clientes que compraron.
        total_clientes_vendedor: 3,
        subcategorias_compradas: 2, // u_surtido_n 1 y 2 (el 3 de C3 neteo en cero, no cuenta)
        subcategorias_obligatorias: 16, // BRONZE: grupos 1-17 sin el 13
        surtido_porcentaje: 12.5,
        anno_mes: ANNO_MES,
      },
    ]);
  });

  it('calcula mv_surtido_por_cluster', async () => {
    const result = await pgPool.query(
      `SELECT u_cluster, total_clientes, subcategorias_compradas, subcategorias_obligatorias, surtido_promedio_porcentaje, anno_mes
       FROM mv_surtido_por_cluster WHERE u_cluster = 'BRONZE' AND anno_mes = '${ANNO_MES}'`
    );
    expect(result.rows).toEqual([
      { u_cluster: 'BRONZE', total_clientes: 3, subcategorias_compradas: 2, subcategorias_obligatorias: 16, surtido_promedio_porcentaje: 12.5, anno_mes: ANNO_MES },
    ]);
  });

  it('dias_laborables_mes/dias_laborables_transcurridos excluyen fines de semana y los feriados curados en dim_dia_no_laborable', async () => {
    const result = await pgPool.query(
      `SELECT dias_laborables_mes('${ANNO_MES}') AS mes, dias_laborables_transcurridos('${ANNO_MES}') AS transcurridos`
    );
    // Enero-2025 tiene 23 dias habiles (lunes a viernes); el feriado curado (08-ene, miercoles)
    // resta 1. fecha_referencia_ventas() = 2025-01-18: de los 13 dias habiles hasta esa fecha,
    // el feriado tambien cae dentro del rango, restando 1 (13 -> 12).
    expect(result.rows[0].mes).toBe(22);
    expect(result.rows[0].transcurridos).toBe(12);
  });

  it('calcula mv_resumen_kpi_general con valores numericos reales (no strings)', async () => {
    const result = await pgPool.query(
      `SELECT total_clientes, distribucion_promedio, ventas_mes_monto, facturas_mes, objetivo_monto_mes,
              dias_transcurridos_mes, dias_totales_mes, dropsize_promedio, logro_monto_porcentaje, proyeccion_ventas_monto
       FROM mv_resumen_kpi_general`
    );
    const fila = result.rows[0];
    expect(typeof fila.total_clientes).toBe('number');
    expect(typeof fila.distribucion_promedio).toBe('number');
    expect(fila.total_clientes).toBe(3);

    // fecha_referencia_ventas() = 2025-01-18 (F2X, la factura mas reciente del fixture).
    // ventas_mes_monto = SUM(monto) de TODAS las facturas del fixture (todas caen en enero-2025,
    // dentro de la ventana 01-18): F1(500+50) + F1B(100+50) + F1C(100+50) + F2X(100) + F2(20) + F3(-20) = 950.
    expect(fila.ventas_mes_monto).toBe(950);
    expect(fila.facturas_mes).toBe(6); // F1, F1B, F1C, F2X, F2, F3
    expect(fila.dropsize_promedio).toBe(158.33); // 950 / 6
    // objetivo_monto_mes = SUM(objetivo_monto) de subcategorias activas en 2025-01: G21(1000) + G22(500) + G32(100).
    expect(fila.objetivo_monto_mes).toBe(1600);
    expect(fila.logro_monto_porcentaje).toBe(59.38); // 950 / 1600 * 100
    expect(fila.dias_transcurridos_mes).toBe(18); // dia de fecha_referencia_ventas()
    expect(fila.dias_totales_mes).toBe(31); // enero tiene 31 dias
    expect(fila.proyeccion_ventas_monto).toBe(1636.11); // 950 / 18 * 31
  });

  it('ConfigService.setSubcategoriaActiva cascada de inmediato a dim_objetivos_distribucion (no solo a meses futuros)', async () => {
    // G33 no esta en la lista curada por defecto: arranca inactiva.
    const antes = await pgPool.query(`SELECT activo FROM dim_objetivos_distribucion WHERE clasificacion_2 = 'G21'`);
    expect(antes.rows.every((r) => r.activo === true)).toBe(true);

    await ConfigService.setSubcategoriaActiva('G21', false);

    const config = await pgPool.query(`SELECT activo FROM dim_subcategoria_config WHERE clasificacion_2 = 'G21'`);
    expect(config.rows[0].activo).toBe(false);

    // La fila de dim_objetivos_distribucion ya sincronizada (mes ANNO_MES) tambien cambia,
    // sin esperar a un nuevo sync del ERP.
    const despues = await pgPool.query(
      `SELECT activo FROM dim_objetivos_distribucion WHERE clasificacion_2 = 'G21' AND anno_mes = '${ANNO_MES}'`
    );
    expect(despues.rows[0].activo).toBe(false);

    // Restaura el estado para no afectar el orden de otros tests si Jest los reordenara.
    await ConfigService.setSubcategoriaActiva('G21', true);
  });
});
