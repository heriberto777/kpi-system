import { apiClient } from './client';
import {
  CriterioDistribucionData,
  CuotaVendedorConfigData,
  DiaNoLaborableData,
  ObjetivoDistribucionConfigData,
  Retail,
  ResumenDiasLaborablesData,
  SubcategoriaConfigData,
  SurtidoObligatorioData,
  UniversoClienteConfigData,
} from '../types';

export const configApi = {
  async getCriteriosDistribucion(): Promise<CriterioDistribucionData[]> {
    const { data } = await apiClient.get<CriterioDistribucionData[]>('/config/umbrales');
    return data;
  },

  async updateCriterioDistribucion(
    retail: Retail,
    datos: { minimo_compras: number; periodo_dias: number }
  ): Promise<CriterioDistribucionData> {
    const { data } = await apiClient.put<CriterioDistribucionData>(`/config/umbrales/${retail}`, datos);
    return data;
  },

  async getSubcategorias(): Promise<SubcategoriaConfigData[]> {
    const { data } = await apiClient.get<SubcategoriaConfigData[]>('/config/subcategorias');
    return data;
  },

  async setSubcategoriaActiva(clasificacion2: string, activo: boolean): Promise<SubcategoriaConfigData> {
    const { data } = await apiClient.patch<SubcategoriaConfigData>(`/config/subcategorias/${clasificacion2}`, {
      activo,
    });
    return data;
  },

  async getSurtidoObligatorio(): Promise<SurtidoObligatorioData[]> {
    const { data } = await apiClient.get<SurtidoObligatorioData[]>('/config/surtido-obligatorio');
    return data;
  },

  async updateSurtidoObligatorio(
    idSurtido: number,
    datos: { es_obligatorio: boolean; cantidad_articulos: number | null }
  ): Promise<SurtidoObligatorioData> {
    const { data } = await apiClient.put<SurtidoObligatorioData>(`/config/surtido-obligatorio/${idSurtido}`, datos);
    return data;
  },

  async getObjetivosDistribucion(mes?: string): Promise<ObjetivoDistribucionConfigData[]> {
    const { data } = await apiClient.get<ObjetivoDistribucionConfigData[]>('/config/objetivos', {
      params: { mes },
    });
    return data;
  },

  async getUniversoCliente(mes?: string): Promise<UniversoClienteConfigData[]> {
    const { data } = await apiClient.get<UniversoClienteConfigData[]>('/config/universo', {
      params: { mes },
    });
    return data;
  },

  async getCuotaVendedor(mes?: string): Promise<CuotaVendedorConfigData[]> {
    const { data } = await apiClient.get<CuotaVendedorConfigData[]>('/config/cuota-vendedor', {
      params: { mes },
    });
    return data;
  },

  async refrescarVistas(): Promise<void> {
    await apiClient.post('/config/refrescar-vistas');
  },

  async getDiasNoLaborables(mes?: string): Promise<DiaNoLaborableData[]> {
    const { data } = await apiClient.get<DiaNoLaborableData[]>('/config/dias-no-laborables', { params: { mes } });
    return data;
  },

  async addDiaNoLaborable(fecha: string, descripcion: string | null): Promise<DiaNoLaborableData> {
    const { data } = await apiClient.post<DiaNoLaborableData>('/config/dias-no-laborables', { fecha, descripcion });
    return data;
  },

  async deleteDiaNoLaborable(fecha: string): Promise<void> {
    await apiClient.delete(`/config/dias-no-laborables/${fecha}`);
  },

  async getResumenDiasLaborables(mes?: string): Promise<ResumenDiasLaborablesData> {
    const { data } = await apiClient.get<ResumenDiasLaborablesData>('/config/dias-laborables', { params: { mes } });
    return data;
  },
};
