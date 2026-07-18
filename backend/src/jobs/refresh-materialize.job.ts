import { PostgresqlService } from '../services/postgresql.service';
import logger from '../config/logger';

export async function refreshMaterializeJob(): Promise<void> {
  const idSync = await PostgresqlService.crearSyncLog('materialized_views', false);
  try {
    await PostgresqlService.refreshMaterializedViews();
    await PostgresqlService.actualizarSyncLog(idSync, {
      estado: 'completado',
      fecha_fin: new Date(),
      registros_procesados: 6,
      registros_actualizados: 6,
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    logger.error('Error refrescando vistas materializadas', { error: mensaje });
    await PostgresqlService.actualizarSyncLog(idSync, {
      estado: 'error',
      fecha_fin: new Date(),
      mensaje_error: mensaje,
    });
    throw error;
  }
}
