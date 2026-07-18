import { Retail } from './cliente.types';

export interface CriterioDistribucionRow {
  id: number;
  retail: Retail;
  minimo_compras: number;
  periodo_dias: number;
}

export interface SubcategoriaConfigRow {
  clasificacion_2: string;
  descripcion: string | null;
  activo: boolean;
  fecha_actualizacion: string;
}

export interface SurtidoObligatorioRow {
  id_surtido: number;
  u_cluster: string;
  u_surtido_n: number;
  cantidad_articulos: number | null;
  es_obligatorio: boolean;
}

export interface ObjetivoDistribucionConfigRow {
  id: number;
  anno_mes: string;
  retail: Retail;
  clasificacion_2: string;
  objetivo_clientes: number | null;
  objetivo_monto: number | null;
  activo: boolean;
}

export interface UniversoClienteConfigRow {
  id: number;
  anno_mes: string;
  retail: Retail;
  universo: number;
}

export interface CuotaVendedorConfigRow {
  id: number;
  anno_mes: string;
  vendedor: string;
  retail: Retail;
  clasificacion_2: string;
  cuota_monto: number | null;
}

export interface DiaNoLaborableRow {
  fecha: string;
  descripcion: string | null;
}

export interface ResumenDiasLaborablesRow {
  anno_mes: string;
  dias_laborables_mes: number;
  dias_laborables_transcurridos: number;
}
