import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { etlApi } from '../api/etl.api';
import { obtenerToken } from '../api/client';
import { EstadoPaso } from '../types';

interface ProgressDetails {
  clientes: number;
  articulos: number;
  ventas: number;
  kpis: number;
}

interface StepStates {
  clientes: EstadoPaso;
  articulos: EstadoPaso;
  ventas: EstadoPaso;
  kpis: EstadoPaso;
}

interface ETLContextType {
  isSyncing: boolean;
  lastSync: Date | null;
  nextSync: Date | null;
  syncProgress: number;
  progressDetails: ProgressDetails;
  stepStates: StepStates;
  isPaused: boolean;
  triggerManualSync: () => Promise<void>;
  pauseSync: () => Promise<void>;
  resumeSync: () => Promise<void>;
  loadStatus: () => Promise<void>;
}

const ETLContext = createContext<ETLContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 30000;

export function ETLProvider({ children }: { children: ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [nextSync, setNextSync] = useState<Date | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progressDetails, setProgressDetails] = useState<ProgressDetails>({
    clientes: 0,
    articulos: 0,
    ventas: 0,
    kpis: 0,
  });
  const [stepStates, setStepStates] = useState<StepStates>({
    clientes: 'pendiente',
    articulos: 'pendiente',
    ventas: 'pendiente',
    kpis: 'pendiente',
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async () => {
    if (!obtenerToken()) return;
    try {
      const status = await etlApi.getStatus();
      setIsSyncing(status.sincronizando);
      setLastSync(status.ultima_sincronizacion ? new Date(status.ultima_sincronizacion) : null);
      setNextSync(status.proxima_sincronizacion ? new Date(status.proxima_sincronizacion) : null);
      setSyncProgress(status.porcentaje_completitud);
      setProgressDetails({
        clientes: status.estado_detalles.clientes.registros,
        articulos: status.estado_detalles.articulos.registros,
        ventas: status.estado_detalles.ventas.registros,
        kpis: status.estado_detalles.kpis.registros,
      });
      setStepStates({
        clientes: status.estado_detalles.clientes.estado,
        articulos: status.estado_detalles.articulos.estado,
        ventas: status.estado_detalles.ventas.estado,
        kpis: status.estado_detalles.kpis.estado,
      });
    } catch {
      // errores de polling se ignoran silenciosamente; el interceptor maneja 401
    }
  }, []);

  const triggerManualSync = useCallback(async () => {
    await etlApi.triggerSync();
    await loadStatus();
  }, [loadStatus]);

  const pauseSync = useCallback(async () => {
    await etlApi.pauseSync();
    setIsPaused(true);
  }, []);

  const resumeSync = useCallback(async () => {
    await etlApi.resumeSync();
    setIsPaused(false);
  }, []);

  useEffect(() => {
    void loadStatus();
    intervalRef.current = setInterval(() => void loadStatus(), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadStatus]);

  return (
    <ETLContext.Provider
      value={{
        isSyncing,
        lastSync,
        nextSync,
        syncProgress,
        progressDetails,
        stepStates,
        isPaused,
        triggerManualSync,
        pauseSync,
        resumeSync,
        loadStatus,
      }}
    >
      {children}
    </ETLContext.Provider>
  );
}

export function useETLContext(): ETLContextType {
  const ctx = useContext(ETLContext);
  if (!ctx) throw new Error('useETLContext debe usarse dentro de ETLProvider');
  return ctx;
}
