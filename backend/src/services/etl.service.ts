import { MssqlService } from './mssql.service';
import { PostgresqlService } from './postgresql.service';
import logger from '../config/logger';
import { limpiarStgArticulo, limpiarStgCliente, limpiarStgVendedor } from '../utils/transformers';
import { SyncResult } from '../types';

let syncing = false;
const activeSteps = {
  clientes: 'pendiente',
  articulos: 'pendiente',
  ventas: 'pendiente',
  kpis: 'pendiente',
};
const activeCounts = {
  clientes: 0,
  articulos: 0,
  ventas: 0,
  kpis: 0,
};

function isBusy(): boolean {
  return syncing;
}

export const ETLService = {
  isSyncing: isBusy,
  getStepStatus() {
    return { ...activeSteps };
  },
  getStepCounts() {
    return { ...activeCounts };
  },

  async syncClientes(disparadoManualmente = false): Promise<SyncResult> {
    syncing = true;
    activeSteps.clientes = 'en_proceso';
    const idSync = await PostgresqlService.crearSyncLog('clientes', disparadoManualmente);
    try {
      // La cartera real por vendedor (CATELLI.VENDEDOR) viaja junto con clientes, igual que
      // en docs/AJUSTES_FINALES_KPI_VENDEDOR_CLASIFICACION_NUEVO.md (Job "sync-vendedor").
      const vendedorRaw = await MssqlService.extraerVendedor();
      const vendedorRows = vendedorRaw.map(limpiarStgVendedor);
      await PostgresqlService.cargarStagingVendedor(vendedorRows);
      const resultVendedor = await PostgresqlService.upsertDimVendedor();

      const rawRows = await MssqlService.extraerClientes();
      const rows = rawRows.map(limpiarStgCliente);
      await PostgresqlService.cargarStagingClientes(rows);
      const resultClientes = await PostgresqlService.upsertDimClientes();

      const result: SyncResult = {
        registros_procesados: resultClientes.registros_procesados + resultVendedor.registros_procesados,
        registros_insertados: resultClientes.registros_insertados + resultVendedor.registros_insertados,
        registros_actualizados: resultClientes.registros_actualizados + resultVendedor.registros_actualizados,
        registros_error: 0,
      };

      await PostgresqlService.actualizarSyncLog(idSync, {
        estado: 'completado',
        fecha_fin: new Date(),
        ...result,
      });
      await PostgresqlService.actualizarSyncMetadata('clientes', 'completado');
      activeSteps.clientes = 'completado';
      // Solo el conteo de clientes (no sumado con vendedor, que es una tabla distinta):
      // sumarlos infla el numero mostrado en el dashboard sin representar clientes reales.
      activeCounts.clientes = resultClientes.registros_procesados;
      logger.info('Sincronizacion de clientes completada', { clientes: resultClientes, vendedor: resultVendedor });
      return result;
    } catch (error) {
      await this.registrarError(idSync, 'clientes', error);
      throw error;
    } finally {
      syncing = false;
    }
  },

  async syncArticulos(disparadoManualmente = false): Promise<SyncResult> {
    syncing = true;
    activeSteps.articulos = 'en_proceso';
    const idSync = await PostgresqlService.crearSyncLog('articulos', disparadoManualmente);
    try {
      // Las descripciones de subcategoria (CATELLI.CLASIFICACION) viajan junto con articulos,
      // igual que en docs/AJUSTES_FINALES_KPI_VENDEDOR_CLASIFICACION_NUEVO.md (Job "sync-clasificacion").
      const clasificacionRaw = await MssqlService.extraerClasificacion();
      await PostgresqlService.cargarStagingClasificacion(clasificacionRaw);
      const resultClasificacion = await PostgresqlService.upsertDimClasificacion();

      const rawRows = await MssqlService.extraerArticulos();
      const rows = rawRows.map(limpiarStgArticulo);
      await PostgresqlService.cargarStagingArticulos(rows);
      const resultArticulos = await PostgresqlService.upsertDimArticulos();

      const result: SyncResult = {
        registros_procesados: resultArticulos.registros_procesados + resultClasificacion.registros_procesados,
        registros_insertados: resultArticulos.registros_insertados + resultClasificacion.registros_insertados,
        registros_actualizados: resultArticulos.registros_actualizados + resultClasificacion.registros_actualizados,
        registros_error: 0,
      };

      await PostgresqlService.actualizarSyncLog(idSync, {
        estado: 'completado',
        fecha_fin: new Date(),
        ...result,
      });
      await PostgresqlService.actualizarSyncMetadata('articulos', 'completado');
      activeSteps.articulos = 'completado';
      // Solo el conteo de articulos (no sumado con clasificacion, que es una tabla distinta):
      // sumarlos infla el numero mostrado en el dashboard (bug real: 381 + 288 = 669).
      activeCounts.articulos = resultArticulos.registros_procesados;
      logger.info('Sincronizacion de articulos completada', { articulos: resultArticulos, clasificacion: resultClasificacion });
      return result;
    } catch (error) {
      await this.registrarError(idSync, 'articulos', error);
      throw error;
    } finally {
      syncing = false;
    }
  },

  async syncVentas(disparadoManualmente = false): Promise<SyncResult> {
    syncing = true;
    activeSteps.ventas = 'en_proceso';
    const idSync = await PostgresqlService.crearSyncLog('ventas', disparadoManualmente);
    try {
      const [facturas, lineas] = await Promise.all([
        MssqlService.extraerFacturas(),
        MssqlService.extraerFacturaLineas(),
      ]);
      await PostgresqlService.cargarStagingVentas(facturas, lineas);
      const resultVentas = await PostgresqlService.upsertFactVentas();

      // Los objetivos de distribucion (dbo.distribuccion) viajan junto con ventas,
      // igual que en docs/ESPECIFICACION_FINAL_DISTRIBUCION_KPI.md (Job 4).
      const objetivosRaw = await MssqlService.extraerObjetivosDistribucion();
      await PostgresqlService.cargarStagingObjetivos(objetivosRaw);
      const resultObjetivos = await PostgresqlService.upsertDimObjetivos();

      // La cuota de $ por vendedor (dbo.cuota) viaja junto con ventas: es otra meta mensual
      // del ERP, misma familia que objetivos.
      const cuotaRaw = await MssqlService.extraerCuota();
      await PostgresqlService.cargarStagingCuota(cuotaRaw);
      const resultCuota = await PostgresqlService.upsertDimCuotaVendedor();

      const result: SyncResult = {
        registros_procesados: resultVentas.registros_procesados + resultObjetivos.registros_procesados + resultCuota.registros_procesados,
        registros_insertados: resultVentas.registros_insertados + resultObjetivos.registros_insertados + resultCuota.registros_insertados,
        registros_actualizados: resultVentas.registros_actualizados + resultObjetivos.registros_actualizados + resultCuota.registros_actualizados,
        registros_error: 0,
      };

      await PostgresqlService.actualizarSyncLog(idSync, {
        estado: 'completado',
        fecha_fin: new Date(),
        ...result,
      });
      await PostgresqlService.actualizarSyncMetadata('ventas', 'completado');
      activeSteps.ventas = 'completado';
      // Solo el conteo de ventas (no sumado con objetivos/cuota, que son tablas distintas).
      activeCounts.ventas = resultVentas.registros_procesados;
      logger.info('Sincronizacion de ventas completada', { ventas: resultVentas, objetivos: resultObjetivos, cuota: resultCuota });
      return result;
    } catch (error) {
      await this.registrarError(idSync, 'ventas', error);
      throw error;
    } finally {
      syncing = false;
    }
  },

  async calcularKpis(disparadoManualmente = false): Promise<SyncResult> {
    syncing = true;
    activeSteps.kpis = 'en_proceso';
    const idSync = await PostgresqlService.crearSyncLog('kpis', disparadoManualmente);
    try {
      // El universo oficial de clientes (dbo.universo_cliente) viaja junto con el calculo
      // de KPIs, igual que en docs/ESPECIFICACION_FINAL_DISTRIBUCION_KPI.md (Job 5).
      const universoRaw = await MssqlService.extraerUniversoCliente();
      await PostgresqlService.cargarStagingUniverso(universoRaw);
      const resultUniverso = await PostgresqlService.upsertDimUniverso();

      const ventasRecientes = await PostgresqlService.query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM fact_ventas WHERE id_fecha >= fecha_referencia_ventas() - 30`
      );
      const total = Number(ventasRecientes.rows[0]?.total ?? 0);
      const result: SyncResult = {
        registros_procesados: total + resultUniverso.registros_procesados,
        registros_insertados: resultUniverso.registros_insertados,
        registros_actualizados: total + resultUniverso.registros_actualizados,
        registros_error: 0,
      };

      await PostgresqlService.actualizarSyncLog(idSync, {
        estado: 'completado',
        fecha_fin: new Date(),
        ...result,
      });
      await PostgresqlService.actualizarSyncMetadata('kpis', 'completado');
      activeSteps.kpis = 'completado';
      activeCounts.kpis = total;
      logger.info('Calculo de KPIs completado', { ventasRecientes: total, universo: resultUniverso });
      return result;
    } catch (error) {
      await this.registrarError(idSync, 'kpis', error);
      throw error;
    } finally {
      syncing = false;
    }
  },

  async triggerManualFullSync(): Promise<number> {
    if (isBusy()) {
      throw new Error('Ya hay una sincronizacion en curso');
    }

    const idSync = await PostgresqlService.crearSyncLog('manual', true);

    void (async () => {
      try {
        await this.syncClientes(true);
        await this.syncArticulos(true);
        await this.syncVentas(true);
        await this.calcularKpis(true);
        await PostgresqlService.refreshMaterializedViews();
        await PostgresqlService.actualizarSyncLog(idSync, {
          estado: 'completado',
          fecha_fin: new Date(),
        });
        logger.info('Sincronizacion manual completa finalizada', { idSync });
      } catch (error) {
        await this.registrarError(idSync, 'manual', error);
      }
    })();

    return idSync;
  },

  async registrarError(idSync: number, tipo: string, error: unknown): Promise<void> {
    const mensaje = error instanceof Error ? error.message : String(error);
    logger.error(`Error en sincronizacion de ${tipo}`, { error: mensaje });
    await PostgresqlService.actualizarSyncLog(idSync, {
      estado: 'error',
      fecha_fin: new Date(),
      mensaje_error: mensaje,
    });
    await PostgresqlService.actualizarSyncMetadata(tipo, 'error');
  },
};
