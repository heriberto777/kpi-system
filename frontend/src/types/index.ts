export type Retail = 'COLMADO' | 'AUTOSERVICIO' | 'MAYORISTA' | 'OTROS';
export type Cluster = 'BRONZE' | 'SILVER' | 'GOLD';

export interface DistribucionData {
  id: number;
  retail?: Retail;
  u_cluster?: Cluster;
  vendedor?: string;
  subcategoria: string;
  total_clientes: number;
  resultado: number;
  distribucion_porcentaje: number;
  objetivo_clientes?: number | null;
  objetivo_porcentaje?: number | null;
  logro_porcentaje?: number | null;
  restan?: number | null;
  anno_mes?: string | null;
}

export interface SurtidoData {
  id: number;
  id_cliente: number;
  codigo_cliente: string;
  nombre_cliente: string;
  retail: Retail;
  u_cluster: Cluster;
  vendedor_asignado: string | null;
  subcategorias_compradas: number;
  subcategorias_obligatorias: number;
  surtido_porcentaje: number;
  anno_mes: string | null;
}

export interface DistribucionVendedorData {
  id: number;
  vendedor: string;
  nombre_vendedor: string | null;
  retail: Retail;
  subcategoria: string;
  total_clientes_vendedor: number;
  resultado: number;
  obj2: number | null;
  objetivo_porcentaje: number | null;
  cuota: number | null;
  logro_porcentaje: number | null;
  distribucion_porcentaje: number | null;
  restan: number | null;
  anno_mes: string | null;
}

export interface VentasVendedorData {
  id: number;
  anno_mes: string;
  vendedor: string;
  nombre_vendedor: string | null;
  supervisor: string | null;
  retail: Retail;
  cuota_monto: number | null;
  venta_neta: number;
  venta_bruta: number;
  facturas: number;
  dropsize: number | null;
  pct_devolucion: number | null;
  alcance_porcentaje: number | null;
  falta: number | null;
  dias_laborables_mes: number;
  dias_transcurridos: number;
  proyeccion: number | null;
  alcance_proyeccion_porcentaje: number | null;
  diario: number | null;
}

export interface SurtidoVendedorData {
  id: number;
  vendedor: string;
  nombre_vendedor: string | null;
  u_cluster: Cluster;
  total_clientes_vendedor: number;
  subcategorias_compradas: number;
  subcategorias_obligatorias: number;
  surtido_porcentaje: number;
  anno_mes: string | null;
}

export interface SurtidoClusterData {
  id: number;
  u_cluster: Cluster;
  total_clientes: number;
  subcategorias_compradas: number;
  subcategorias_obligatorias: number;
  surtido_promedio_porcentaje: number;
  anno_mes: string | null;
}

export interface VendedorOption {
  codigo_vendedor: string;
  nombre_vendedor: string | null;
}

export interface ClienteNoVisitadoData {
  id_cliente: number;
  codigo_cliente: string;
  nombre_cliente: string;
  retail: Retail;
  u_cluster: Cluster;
  vendedor_asignado: string | null;
  ultima_compra: string | null;
  dias_sin_compra: number | null;
}

export interface ResumenKPIData {
  total_clientes: number;
  clientes_activos_mes: number;
  surtido_promedio: number;
  distribucion_promedio: number;
  ventas_mes_monto: number;
  facturas_mes: number;
  objetivo_monto_mes: number;
  dias_transcurridos_mes: number;
  dias_totales_mes: number;
  dropsize_promedio: number | null;
  logro_monto_porcentaje: number | null;
  proyeccion_ventas_monto: number | null;
  anno_mes: string | null;
  fecha_actualizacion: string;
}

export type EstadoPaso = 'pendiente' | 'en_proceso' | 'completado' | 'error';

export interface EtlStatus {
  sincronizando: boolean;
  ultima_sincronizacion: string | null;
  proxima_sincronizacion: string | null;
  porcentaje_completitud: number;
  estado_detalles: {
    clientes: { estado: EstadoPaso; registros: number };
    articulos: { estado: EstadoPaso; registros: number };
    ventas: { estado: EstadoPaso; registros: number };
    kpis: { estado: EstadoPaso; registros: number };
  };
}

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

export interface CronJobStatus {
  name: string;
  expression: string;
  enabled: boolean;
}

export interface CriterioDistribucionData {
  id: number;
  retail: Retail;
  minimo_compras: number;
  periodo_dias: number;
}

export interface SubcategoriaConfigData {
  clasificacion_2: string;
  descripcion: string | null;
  activo: boolean;
  fecha_actualizacion: string;
}

export interface SurtidoObligatorioData {
  id_surtido: number;
  u_cluster: Cluster;
  u_surtido_n: number;
  cantidad_articulos: number | null;
  es_obligatorio: boolean;
}

export interface ObjetivoDistribucionConfigData {
  id: number;
  anno_mes: string;
  retail: Retail;
  clasificacion_2: string;
  objetivo_clientes: number | null;
  objetivo_monto: number | null;
  activo: boolean;
}

export interface UniversoClienteConfigData {
  id: number;
  anno_mes: string;
  retail: Retail;
  universo: number;
}

export interface CuotaVendedorConfigData {
  id: number;
  anno_mes: string;
  vendedor: string;
  retail: Retail;
  clasificacion_2: string;
  cuota_monto: number | null;
}

export interface DiaNoLaborableData {
  fecha: string;
  descripcion: string | null;
}

export interface ResumenDiasLaborablesData {
  anno_mes: string;
  dias_laborables_mes: number;
  dias_laborables_transcurridos: number;
}

// ---- Surtido Mandatorio (modulo separado del Surtido existente) ----
// Mide todo por BIMESTRE (2 meses consecutivos: Ene-Feb, Mar-Abr, ...), no mes calendario --
// "bimestre" es el primer mes del par (p.ej. '2026-07' representa Jul-Ago 2026).

export interface SurtidoMandatorioClienteData {
  id: number;
  bimestre: string;
  id_cliente: number;
  codigo_cliente: string;
  u_cluster: Cluster;
  vendedor: string | null;
  posiciones_activas: number;
  posiciones_obligatorias: number;
  cliente_activo: boolean;
}

export interface SurtidoMandatorioCoberturaData {
  id: number;
  bimestre: string;
  vendedor: string;
  nombre_vendedor: string | null;
  u_cluster: Cluster;
  universo: number;
  cubiertos: number;
  promedio_activaciones: number | null;
  suma_activaciones: number;
  clientes_activos: number;
}

export interface SurtidoMandatorioResumenVendedorData {
  id: number;
  bimestre: string;
  vendedor: string;
  nombre_vendedor: string | null;
  universo_total: number;
  cubiertos_total: number;
  objetivo_promedio: number | null;
  total_activaciones: number | null;
  logro_porcentaje: number | null;
  logro_a_la_fecha_porcentaje: number | null;
  dias_laborables_bimestre: number;
  dias_transcurridos: number;
  proyeccion_diaria: number | null;
  proyeccion_98: number | null;
}

export interface PosicionSurtidoMandatorioData {
  id: number;
  posicion_surtido: number;
  u_cluster: string;
  es_obligatorio: boolean;
}

export interface ObjetivoSurtidoMandatorioData {
  u_cluster: string;
  base_objetivo: number;
  colocaciones_meta: number;
}

export interface ConfigSurtidoMandatorioData {
  cliente_activo_minimo: number;
}
