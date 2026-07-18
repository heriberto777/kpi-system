import { apiClient } from './client';
import {
  Cluster,
  ClienteNoVisitadoData,
  DistribucionData,
  DistribucionVendedorData,
  Retail,
  ResumenKPIData,
  SurtidoClusterData,
  SurtidoData,
  SurtidoVendedorData,
  VendedorOption,
  VentasVendedorData,
} from '../types';

export interface VentasVendedorFilters {
  vendedor?: string;
  retail?: Retail;
  supervisor?: string;
  mes?: string;
}

export interface DistribucionFilters {
  retail?: Retail;
  sku?: string;
  mes?: string;
}

export interface SurtidoFilters {
  cluster?: Cluster;
  limit?: number;
  mes?: string;
}

export interface NoVisitadosFilters {
  dias?: number;
  retail?: Retail;
}

export const kpiApi = {
  async getDistribucion(filters: DistribucionFilters = {}): Promise<DistribucionData[]> {
    const { data } = await apiClient.get<DistribucionData[]>('/kpi/distribucion', { params: filters });
    return data;
  },

  async getDistribucionPorCluster(cluster?: Cluster, mes?: string): Promise<DistribucionData[]> {
    const { data } = await apiClient.get<DistribucionData[]>('/kpi/distribucion-por-cluster', {
      params: { cluster, mes },
    });
    return data;
  },

  async getDistribucionPorVendedor(
    vendedor?: string,
    retail?: Retail,
    mes?: string
  ): Promise<DistribucionVendedorData[]> {
    const { data } = await apiClient.get<DistribucionVendedorData[]>('/kpi/distribucion-por-vendedor', {
      params: { vendedor, retail, mes },
    });
    return data;
  },

  async getVentasPorVendedor(filters: VentasVendedorFilters = {}): Promise<VentasVendedorData[]> {
    const { data } = await apiClient.get<VentasVendedorData[]>('/kpi/ventas-por-vendedor', { params: filters });
    return data;
  },

  async getSurtido(filters: SurtidoFilters = {}): Promise<SurtidoData[]> {
    const { data } = await apiClient.get<SurtidoData[]>('/kpi/surtido', { params: filters });
    return data;
  },

  async getSurtidoPorVendedor(vendedor?: string, mes?: string): Promise<SurtidoVendedorData[]> {
    const { data } = await apiClient.get<SurtidoVendedorData[]>('/kpi/surtido-por-vendedor', {
      params: { vendedor, mes },
    });
    return data;
  },

  async getSurtidoPorCluster(mes?: string): Promise<SurtidoClusterData[]> {
    const { data } = await apiClient.get<SurtidoClusterData[]>('/kpi/surtido-por-cluster', { params: { mes } });
    return data;
  },

  async getClientesNoVisitados(filters: NoVisitadosFilters = {}): Promise<ClienteNoVisitadoData[]> {
    const { data } = await apiClient.get<ClienteNoVisitadoData[]>('/kpi/clientes-no-visitados', {
      params: filters,
    });
    return data;
  },

  async getResumen(mes?: string): Promise<ResumenKPIData> {
    const { data } = await apiClient.get<ResumenKPIData>('/kpi/resumen', { params: { mes } });
    return data;
  },

  async getVendedores(): Promise<VendedorOption[]> {
    const { data } = await apiClient.get<VendedorOption[]>('/kpi/vendedores');
    return data;
  },

  async getSupervisores(): Promise<string[]> {
    const { data } = await apiClient.get<string[]>('/kpi/supervisores');
    return data;
  },

  async getMesesDisponibles(): Promise<string[]> {
    const { data } = await apiClient.get<string[]>('/kpi/meses-disponibles');
    return data;
  },
};
