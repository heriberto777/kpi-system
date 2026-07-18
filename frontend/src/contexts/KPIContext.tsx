import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { kpiApi } from '../api/kpi.api';
import { obtenerToken } from '../api/client';
import { Cluster, ClienteNoVisitadoData, DistribucionData, Retail, ResumenKPIData, SurtidoData } from '../types';

interface KPIContextType {
  distribucion: DistribucionData[];
  surtido: SurtidoData[];
  clientesNoVisitados: ClienteNoVisitadoData[];
  resumenGeneral: ResumenKPIData | null;
  isLoading: boolean;
  retailSeleccionado: Retail | undefined;
  clusterSeleccionado: Cluster | undefined;
  mesSeleccionado: string | undefined;
  mesesDisponibles: string[];
  loadKPIs: () => Promise<void>;
  filterByRetail: (retail: Retail | undefined) => void;
  filterByCluster: (cluster: Cluster | undefined) => void;
  filterByMes: (mes: string | undefined) => void;
}

const KPIContext = createContext<KPIContextType | undefined>(undefined);

export function KPIProvider({ children }: { children: ReactNode }) {
  const [distribucion, setDistribucion] = useState<DistribucionData[]>([]);
  const [surtido, setSurtido] = useState<SurtidoData[]>([]);
  const [clientesNoVisitados, setClientesNoVisitados] = useState<ClienteNoVisitadoData[]>([]);
  const [resumenGeneral, setResumenGeneral] = useState<ResumenKPIData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retailSeleccionado, setRetailSeleccionado] = useState<Retail | undefined>(undefined);
  const [clusterSeleccionado, setClusterSeleccionado] = useState<Cluster | undefined>(undefined);
  const [mesSeleccionado, setMesSeleccionado] = useState<string | undefined>(undefined);
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);

  useEffect(() => {
    if (!obtenerToken()) return;
    void kpiApi.getMesesDisponibles().then(setMesesDisponibles);
  }, []);

  const loadKPIs = useCallback(async () => {
    if (!obtenerToken()) return;
    setIsLoading(true);
    try {
      const [distribucionData, surtidoData, noVisitadosData, resumenData] = await Promise.all([
        kpiApi.getDistribucion({ retail: retailSeleccionado, mes: mesSeleccionado }),
        kpiApi.getSurtido({ cluster: clusterSeleccionado }),
        kpiApi.getClientesNoVisitados({ retail: retailSeleccionado }),
        kpiApi.getResumen(mesSeleccionado),
      ]);
      setDistribucion(distribucionData);
      setSurtido(surtidoData);
      setClientesNoVisitados(noVisitadosData);
      setResumenGeneral(resumenData);
    } finally {
      setIsLoading(false);
    }
  }, [retailSeleccionado, clusterSeleccionado, mesSeleccionado]);

  const filterByRetail = useCallback((retail: Retail | undefined) => {
    setRetailSeleccionado(retail);
  }, []);

  const filterByCluster = useCallback((cluster: Cluster | undefined) => {
    setClusterSeleccionado(cluster);
  }, []);

  const filterByMes = useCallback((mes: string | undefined) => {
    setMesSeleccionado(mes);
  }, []);

  return (
    <KPIContext.Provider
      value={{
        distribucion,
        surtido,
        clientesNoVisitados,
        resumenGeneral,
        isLoading,
        retailSeleccionado,
        clusterSeleccionado,
        mesSeleccionado,
        mesesDisponibles,
        loadKPIs,
        filterByRetail,
        filterByCluster,
        filterByMes,
      }}
    >
      {children}
    </KPIContext.Provider>
  );
}

export function useKPIContext(): KPIContextType {
  const ctx = useContext(KPIContext);
  if (!ctx) throw new Error('useKPIContext debe usarse dentro de KPIProvider');
  return ctx;
}
