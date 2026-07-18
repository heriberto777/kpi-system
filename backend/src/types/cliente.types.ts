export type Retail = 'COLMADO' | 'AUTOSERVICIO' | 'MAYORISTA' | 'OTROS';
export type Cluster = 'BRONZE' | 'SILVER' | 'GOLD';
export type EstadoRegistro = 'Activo' | 'Inactivo';

export interface StgCliente {
  codigo_cliente: string;
  nombre_cliente: string;
  categoria_cliente: string;
  u_cluster: string;
  vendedor_asignado: string | null;
  estado: string;
  fecha_creacion: string | null;
  // Segmento especial del cliente (ver catelli.CUBO_EXACTUS_FACTURA_LINEA_ORIGINAL.CAT_CLIENTE_ESP):
  // si el cliente tiene ruta especial (U_SEMANA: MC1/MD1/WC1/WD1) usa esa; si no, cae al codigo
  // de su vendedor asignado. Se usa para segmentar reportes de distribucion por canal especial.
  cat_cliente_esp: string | null;
}

export interface DimCliente {
  id_cliente: number;
  codigo_cliente: string;
  nombre_cliente: string;
  categoria_cliente: string;
  retail: Retail;
  u_cluster: Cluster;
  vendedor_asignado: string | null;
  cat_cliente_esp: string | null;
  estado: EstadoRegistro;
  fecha_creacion: string | null;
  fecha_actualizacion: string;
}

export interface StgArticulo {
  codigo_articulo: string;
  descripcion: string;
  clasificacion_1: string;
  clasificacion_2: string;
  descripcion_subcategoria: string | null;
  u_surtido_n: number;
  articulo_del_proveedor: string | null;
  // El ERP no expone un precio unico por articulo (depende de NIVEL_PRECIO/VERSION por cliente
  // en CATELLI.ARTICULO_PRECIO); se deja en null deliberadamente.
  precio_unitario: number | null;
}

export interface DimArticulo {
  id_articulo: number;
  codigo_articulo: string;
  descripcion: string;
  clasificacion_1: string;
  clasificacion_2: string;
  descripcion_subcategoria: string | null;
  u_surtido_n: number;
  articulo_del_proveedor: string | null;
  precio_unitario: number | null;
  estado: EstadoRegistro;
  fecha_actualizacion: string;
}

export interface StgFactura {
  id_factura: string;
  codigo_cliente: string;
  fecha_factura: string;
  estado_factura: string;
}

export interface StgFacturaLinea {
  id_factura: string;
  codigo_articulo: string;
  cantidad: number;
  precio_unitario: number;
  monto_total: number; // calculado en la query: cantidad * precio_unitario
}

export interface StgUniversoCliente {
  anno_mes: string; // YYYY-MM
  retail: string;
  universo: number;
  estado: string;
}

export interface StgObjetivoDistribucion {
  anno_mes: string; // YYYY-MM
  retail: string;
  clasificacion_2: string;
  objetivo_clientes: number | null;
  objetivo_monto: number | null;
  estado: string;
}

export interface StgVendedor {
  codigo_vendedor: string;
  nombre_vendedor: string | null;
  cantidad_cliente: number;
  vendedor_supervisor: string | null;
  retail_asignado: string | null;
  al_vendedor: string | null;
  tipo_vendedor: string | null;
}

export interface StgClasificacion {
  codigo_clasificacion: string;
  descripcion_clasificacion: string | null;
  nivel_jerarquia: string | null;
}

// Cuota de ventas en pesos por vendedor+subcategoria+mes (dbo.cuota del ERP). Distinta de la
// "cuota" de cantidad-de-clientes que ya calcula mv_distribucion_por_vendedor.
export interface StgCuota {
  anno_mes: string; // YYYY-MM
  vendedor: string;
  retail: string;
  clasificacion_2: string;
  cuota_monto: number;
}
