import { useEffect } from 'react';
import { useKPIContext } from '../contexts/KPIContext';

export function useKPIData() {
  const ctx = useKPIContext();

  useEffect(() => {
    void ctx.loadKPIs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.retailSeleccionado, ctx.clusterSeleccionado, ctx.mesSeleccionado]);

  return ctx;
}
