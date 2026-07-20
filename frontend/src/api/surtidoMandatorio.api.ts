import { apiClient } from './client';
import {
  Cluster,
  ConfigSurtidoMandatorioData,
  ObjetivoSurtidoMandatorioData,
  PosicionSurtidoMandatorioData,
  ResumenGlobalGeneralData,
  ResumenGlobalPorVendedorData,
  SurtidoMandatorioClienteData,
  SurtidoMandatorioCoberturaData,
  SurtidoMandatorioResumenVendedorData,
} from '../types';

export interface SurtidoMandatorioResumenFilters {
  vendedor?: string;
  bimestre?: string;
}

export interface SurtidoMandatorioFiltroFilters {
  vendedor?: string;
  cluster?: Cluster;
  bimestre?: string;
}

export const surtidoMandatorioApi = {
  async getBimestresDisponibles(): Promise<string[]> {
    const { data } = await apiClient.get<string[]>('/surtido-mandatorio/bimestres-disponibles');
    return data;
  },

  async getResumenGlobalPorVendedor(bimestre?: string): Promise<ResumenGlobalPorVendedorData | null> {
    const { data } = await apiClient.get<ResumenGlobalPorVendedorData | null>(
      '/surtido-mandatorio/resumen-global-por-vendedor',
      { params: { bimestre } }
    );
    return data;
  },

  async getResumenGlobalGeneral(bimestre?: string): Promise<ResumenGlobalGeneralData | null> {
    const { data } = await apiClient.get<ResumenGlobalGeneralData | null>('/surtido-mandatorio/resumen-global-general', {
      params: { bimestre },
    });
    return data;
  },

  async getResumenPorVendedor(filters: SurtidoMandatorioResumenFilters = {}): Promise<SurtidoMandatorioResumenVendedorData[]> {
    const { data } = await apiClient.get<SurtidoMandatorioResumenVendedorData[]>('/surtido-mandatorio/resumen-vendedor', {
      params: filters,
    });
    return data;
  },

  async getCoberturaPorVendedor(filters: SurtidoMandatorioFiltroFilters = {}): Promise<SurtidoMandatorioCoberturaData[]> {
    const { data } = await apiClient.get<SurtidoMandatorioCoberturaData[]>('/surtido-mandatorio/cobertura-vendedor', {
      params: filters,
    });
    return data;
  },

  async getDetallePorCliente(filters: SurtidoMandatorioFiltroFilters = {}): Promise<SurtidoMandatorioClienteData[]> {
    const { data } = await apiClient.get<SurtidoMandatorioClienteData[]>('/surtido-mandatorio/detalle-cliente', {
      params: filters,
    });
    return data;
  },

  async getPosiciones(): Promise<PosicionSurtidoMandatorioData[]> {
    const { data } = await apiClient.get<PosicionSurtidoMandatorioData[]>('/surtido-mandatorio/posiciones');
    return data;
  },

  async setPosicion(posicionSurtido: number, uCluster: string, esObligatorio: boolean): Promise<PosicionSurtidoMandatorioData> {
    const { data } = await apiClient.post<PosicionSurtidoMandatorioData>('/surtido-mandatorio/posiciones', {
      posicion_surtido: posicionSurtido,
      u_cluster: uCluster,
      es_obligatorio: esObligatorio,
    });
    return data;
  },

  async deletePosicion(id: number): Promise<void> {
    await apiClient.delete(`/surtido-mandatorio/posiciones/${id}`);
  },

  async getObjetivos(): Promise<ObjetivoSurtidoMandatorioData[]> {
    const { data } = await apiClient.get<ObjetivoSurtidoMandatorioData[]>('/surtido-mandatorio/objetivos');
    return data;
  },

  async updateObjetivo(
    uCluster: string,
    datos: { base_objetivo: number; colocaciones_meta: number; meta_conservadora_restan: number }
  ): Promise<ObjetivoSurtidoMandatorioData> {
    const { data } = await apiClient.put<ObjetivoSurtidoMandatorioData>(`/surtido-mandatorio/objetivos/${uCluster}`, datos);
    return data;
  },

  async getConfig(): Promise<ConfigSurtidoMandatorioData> {
    const { data } = await apiClient.get<ConfigSurtidoMandatorioData>('/surtido-mandatorio/config');
    return data;
  },

  async updateConfig(clienteActivoMinimo: number): Promise<ConfigSurtidoMandatorioData> {
    const { data } = await apiClient.put<ConfigSurtidoMandatorioData>('/surtido-mandatorio/config', {
      cliente_activo_minimo: clienteActivoMinimo,
    });
    return data;
  },
};
