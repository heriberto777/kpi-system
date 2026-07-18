import { Cluster, Retail } from './cliente.types';

export interface DistribucionRetailRow {
  id: number;
  retail: Retail;
  subcategoria: string;
  total_clientes: number | null; // universo oficial del ERP (dim_universo_cliente) para ese mes
  resultado: number;
  distribucion_porcentaje: number | null;
  objetivo_clientes: number | null; // objetivo oficial del ERP (dim_objetivos_distribucion)
  logro_porcentaje: number | null;
  objetivo_porcentaje: number | null; // objetivo_clientes / universo
  restan: number | null; // objetivo_clientes - resultado
  objetivo_monto: number | null;
  anno_mes: string | null;
}

export interface DistribucionClusterRow {
  id: number;
  u_cluster: Cluster;
  subcategoria: string;
  total_clientes: number;
  resultado: number;
  distribucion_porcentaje: number;
  anno_mes: string | null;
}

export interface DistribucionVendedorRow {
  id: number;
  vendedor: string;
  nombre_vendedor: string | null;
  retail: Retail;
  subcategoria: string;
  total_clientes_vendedor: number; // dim_vendedor.cantidad_cliente (cartera real del ERP)
  resultado: number;
  obj2: number | null; // objetivo_clientes del retail completo (referencia)
  objetivo_porcentaje: number | null; // objetivo_clientes / universo del retail
  cuota: number | null; // total_clientes_vendedor * objetivo_porcentaje (meta prorrateada del vendedor)
  logro_porcentaje: number | null; // resultado / cuota
  distribucion_porcentaje: number | null; // resultado / total_clientes_vendedor
  restan: number | null; // cuota - resultado
  objetivo_monto: number | null;
  anno_mes: string | null;
}

export interface SurtidoVendedorRow {
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

export interface SurtidoClusterRow {
  id: number;
  u_cluster: Cluster;
  total_clientes: number;
  subcategorias_compradas: number;
  subcategorias_obligatorias: number;
  surtido_promedio_porcentaje: number;
  anno_mes: string | null;
}

export interface SurtidoClienteRow {
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

export interface ClienteNoVisitadoRow {
  id_cliente: number;
  codigo_cliente: string;
  nombre_cliente: string;
  retail: Retail;
  u_cluster: Cluster;
  vendedor_asignado: string | null;
  ultima_compra: string | null;
  dias_sin_compra: number | null;
}

export interface ResumenKpiRow {
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

export interface VentasVendedorRow {
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

export interface VentasVendedorFilter {
  vendedor?: string;
  retail?: Retail;
  supervisor?: string;
  mes?: string;
}

export interface DistribucionFilter {
  retail?: Retail;
  periodo?: number;
  sku?: string;
  mes?: string;
}

export interface ClusterFilter {
  cluster?: Cluster;
}

export interface VendedorFilter {
  vendedor?: string;
}

export interface SurtidoFilter {
  cluster?: Cluster;
  limit?: number;
  mes?: string;
}

export interface NoVisitadosFilter {
  dias?: number;
  retail?: Retail;
}

export interface VendedorOption {
  codigo_vendedor: string;
  nombre_vendedor: string | null;
}
