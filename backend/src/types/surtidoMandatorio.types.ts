import { Cluster } from './cliente.types';

// Surtido Mandatorio mide todo por BIMESTRE (2 meses consecutivos), no mes calendario como el
// resto de la app -- confirmado por el negocio. "bimestre" es el primer mes del par (p.ej.
// '2026-07' representa Jul-Ago 2026).

export interface SurtidoMandatorioClienteRow {
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

export interface SurtidoMandatorioCoberturaRow {
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

export interface SurtidoMandatorioResumenVendedorRow {
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

// Resumenes globales (1 fila por bimestre, sin desglose por vendedor): dos filosofias distintas
// que conviven en el dashboard, ver comentario de la migracion 017.
export interface ResumenGlobalPorVendedorRow {
  id: number;
  bimestre: string;
  act_promedio: number | null;
  logro: number | null;
  colocaciones: number;
  restan_70: number | null;
  restan_45: number | null;
  bronze_logro_pct: number | null;
  silver_logro_pct: number | null;
  gold_logro_pct: number | null;
}

export interface ResumenGlobalGeneralRow {
  id: number;
  bimestre: string;
  total_activos: number;
  total_posiciones: number;
  act_promedio: number | null;
  objetivo_ponderado: number | null;
  logro: number | null;
  restan_80: number | null;
  restan_70: number | null;
}

export interface ResumenGlobalFilter {
  bimestre?: string;
}

export interface SurtidoMandatorioResumenFilter {
  vendedor?: string;
  bimestre?: string;
}

export interface SurtidoMandatorioCoberturaFilter {
  vendedor?: string;
  cluster?: Cluster;
  bimestre?: string;
}

export interface SurtidoMandatorioClienteFilter {
  vendedor?: string;
  cluster?: Cluster;
  bimestre?: string;
}

// ---- Configuracion (Parametros) ----

export interface PosicionSurtidoMandatorioRow {
  id: number;
  posicion_surtido: number;
  u_cluster: string;
  es_obligatorio: boolean;
}

export interface ObjetivoSurtidoMandatorioRow {
  u_cluster: string;
  base_objetivo: number;
  colocaciones_meta: number;
  meta_conservadora_restan: number;
}

export interface ConfigSurtidoMandatorioRow {
  cliente_activo_minimo: number;
}
