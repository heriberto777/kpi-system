import { Retail, StgArticulo, StgCliente, StgVendedor } from '../types';

// Igual que catelli.CUBO_EXACTUS_FACTURA_LINEA_ORIGINAL.RETAIL (fuente oficial de
// ventas/distribucion, ya corriendo en produccion): A3=MINIMARKET SI cuenta como COLMADO,
// SM=Supermercados Especiales cuenta como AUTOSERVICIO.
const CATEGORIA_A_RETAIL: Record<string, Retail> = {
  A1: 'COLMADO',
  A2: 'COLMADO',
  A3: 'COLMADO',
  C1: 'AUTOSERVICIO',
  C2: 'AUTOSERVICIO',
  SM: 'AUTOSERVICIO',
  D1: 'MAYORISTA',
  D2: 'MAYORISTA',
  Q1: 'MAYORISTA',
  SUR: 'MAYORISTA',
};

export function categoriaClienteARetail(categoriaCliente: string): Retail {
  return CATEGORIA_A_RETAIL[categoriaCliente?.toUpperCase()?.trim()] ?? 'OTROS';
}

const CLUSTERS_VALIDOS = new Set(['BRONZE', 'SILVER', 'GOLD']);

export function normalizarCluster(cluster: string | null | undefined): string {
  const value = (cluster ?? '').toUpperCase().trim();
  return CLUSTERS_VALIDOS.has(value) ? value : 'BRONZE';
}

export function normalizarEstado(estado: string | null | undefined): 'Activo' | 'Inactivo' {
  return (estado ?? '').toLowerCase().trim() === 'inactivo' ? 'Inactivo' : 'Activo';
}

export function limpiarStgCliente(raw: Partial<StgCliente>): StgCliente {
  return {
    codigo_cliente: (raw.codigo_cliente ?? '').trim(),
    nombre_cliente: (raw.nombre_cliente ?? 'SIN NOMBRE').trim(),
    categoria_cliente: (raw.categoria_cliente ?? 'OT').trim().toUpperCase(),
    u_cluster: normalizarCluster(raw.u_cluster),
    vendedor_asignado: raw.vendedor_asignado?.trim() || null,
    cat_cliente_esp: raw.cat_cliente_esp?.trim() || null,
    estado: normalizarEstado(raw.estado),
    fecha_creacion: raw.fecha_creacion ?? null,
  };
}

export function limpiarStgArticulo(raw: Partial<StgArticulo>): StgArticulo {
  return {
    codigo_articulo: (raw.codigo_articulo ?? '').trim(),
    descripcion: (raw.descripcion ?? 'SIN DESCRIPCION').trim(),
    clasificacion_1: (raw.clasificacion_1 ?? '').trim(),
    clasificacion_2: (raw.clasificacion_2 ?? '').trim(),
    descripcion_subcategoria: raw.descripcion_subcategoria?.trim() || null,
    u_surtido_n: Number(raw.u_surtido_n) || 0,
    articulo_del_proveedor: raw.articulo_del_proveedor?.trim() || null,
    precio_unitario: raw.precio_unitario == null ? null : Number(raw.precio_unitario),
  };
}

export function limpiarStgVendedor(raw: Partial<StgVendedor>): StgVendedor {
  return {
    codigo_vendedor: (raw.codigo_vendedor ?? '').trim(),
    nombre_vendedor: raw.nombre_vendedor?.trim() || null,
    cantidad_cliente: Number(raw.cantidad_cliente) || 0,
    vendedor_supervisor: raw.vendedor_supervisor?.trim() || null,
    retail_asignado: raw.retail_asignado?.trim().toUpperCase() || null,
    al_vendedor: raw.al_vendedor?.trim() || null,
    tipo_vendedor: raw.tipo_vendedor?.trim() || null,
  };
}
