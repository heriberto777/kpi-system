import { Cluster } from './cliente.types';

export interface SurtidoMandatorioClienteRow {
  id: number;
  anno_mes: string;
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
  anno_mes: string;
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
  anno_mes: string;
  vendedor: string;
  nombre_vendedor: string | null;
  universo_total: number;
  cubiertos_total: number;
  objetivo_promedio: number | null;
  total_activaciones: number | null;
  logro_porcentaje: number | null;
  logro_a_la_fecha_porcentaje: number | null;
  dias_laborables_mes: number;
  dias_transcurridos: number;
  proyeccion_diaria: number | null;
  proyeccion_98: number | null;
}

export interface SurtidoMandatorioResumenFilter {
  vendedor?: string;
  mes?: string;
}

export interface SurtidoMandatorioCoberturaFilter {
  vendedor?: string;
  cluster?: Cluster;
  mes?: string;
}

export interface SurtidoMandatorioClienteFilter {
  vendedor?: string;
  cluster?: Cluster;
  mes?: string;
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
}

export interface ConfigSurtidoMandatorioRow {
  cliente_activo_minimo: number;
}
