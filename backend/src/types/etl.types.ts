export type TipoSincronizacion = 'clientes' | 'articulos' | 'ventas' | 'kpis' | 'materialized_views' | 'manual';
export type EstadoSincronizacion = 'iniciado' | 'en_proceso' | 'completado' | 'error';

export interface SyncLog {
  id_sync: number;
  tipo_tabla: TipoSincronizacion;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: EstadoSincronizacion;
  registros_procesados: number;
  registros_insertados: number;
  registros_actualizados: number;
  registros_error: number;
  mensaje_error: string | null;
  disparado_manualmente: boolean;
}

export interface SyncResult {
  registros_procesados: number;
  registros_insertados: number;
  registros_actualizados: number;
  registros_error: number;
}

export interface EtlStatusResponse {
  sincronizando: boolean;
  ultima_sincronizacion: string | null;
  proxima_sincronizacion: string | null;
  porcentaje_completitud: number;
  estado_detalles: {
    clientes: { estado: string; registros: number };
    articulos: { estado: string; registros: number };
    ventas: { estado: string; registros: number };
    kpis: { estado: string; registros: number };
  };
}

export interface SyncLogFilter {
  limit?: number;
  tipo?: TipoSincronizacion;
  estado?: EstadoSincronizacion;
}
