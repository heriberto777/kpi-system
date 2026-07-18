import { useEffect, useState } from 'react';
import Button from '../atomos/Button';
import Card from '../atomos/Card';
import Badge from '../atomos/Badge';
import Icon from '../atomos/Icon';
import AlertBanner from '../moleculas/AlertBanner';
import SyncStatus from '../moleculas/SyncStatus';
import LogEntry from '../moleculas/LogEntry';
import { useETLContext } from '../../contexts/ETLContext';
import { etlApi } from '../../api/etl.api';
import { EstadoPaso, SyncLog } from '../../types';

const ESTADO_BADGE: Record<EstadoPaso, 'success' | 'error' | 'warning' | 'neutral'> = {
  completado: 'success',
  en_proceso: 'warning',
  error: 'error',
  pendiente: 'neutral',
};

const PASO_LABEL: Record<'clientes' | 'articulos' | 'ventas' | 'kpis', string> = {
  clientes: 'Clientes',
  articulos: 'Articulos',
  ventas: 'Ventas',
  kpis: 'KPIs',
};

export default function ETLDashboard() {
  const {
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
  } = useETLContext();

  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [ultimosLogs, setUltimosLogs] = useState<SyncLog[]>([]);
  const [cargandoAccion, setCargandoAccion] = useState<string | null>(null);

  const cargarLogs = async () => {
    try {
      const logs = await etlApi.getLogs({ limit: 10 });
      setUltimosLogs(logs);
    } catch {
      // se ignora, la tabla queda vacia
    }
  };

  useEffect(() => {
    void cargarLogs();
  }, [isSyncing]);

  async function manejarAccion(accion: () => Promise<void>, nombre: string, textoExito: string) {
    setCargandoAccion(nombre);
    setMensaje(null);
    try {
      await accion();
      setMensaje({ tipo: 'success', texto: textoExito });
    } catch {
      setMensaje({ tipo: 'error', texto: `No se pudo completar la accion: ${nombre}` });
    } finally {
      setCargandoAccion(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Panel de Control ETL</h2>
            <div className="mt-1">
              <SyncStatus isSyncing={isSyncing} progress={syncProgress} lastSync={lastSync} />
            </div>
            {nextSync && !isPaused && (
              <p className="mt-1 text-xs text-gray-400">
                Proxima sincronizacion automatica: {nextSync.toLocaleString('es-DO')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={isSyncing || cargandoAccion !== null}
              onClick={() =>
                manejarAccion(triggerManualSync, 'sync', 'Sincronización iniciada correctamente')
              }
            >
              <Icon name="play" className="h-4 w-4" /> Sincronizar Ahora
            </Button>
            <Button
              variant="secondary"
              disabled={isPaused || cargandoAccion !== null}
              onClick={() => manejarAccion(pauseSync, 'pause', 'Cron jobs pausados')}
            >
              <Icon name="pause" className="h-4 w-4" /> Pausar
            </Button>
            <Button
              variant="secondary"
              disabled={!isPaused || cargandoAccion !== null}
              onClick={() => manejarAccion(resumeSync, 'resume', 'Cron jobs reanudados')}
            >
              <Icon name="play" className="h-4 w-4" /> Reanudar
            </Button>
            <Button
              variant="secondary"
              disabled={cargandoAccion !== null}
              onClick={() => manejarAccion(async () => { await loadStatus(); await cargarLogs(); }, 'refresh', 'Datos actualizados')}
            >
              <Icon name="refresh" className="h-4 w-4" /> Refrescar
            </Button>
          </div>
        </div>
      </Card>

      {mensaje && (
        <AlertBanner tipo={mensaje.tipo} mensaje={mensaje.texto} onDismiss={() => setMensaje(null)} />
      )}

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Progreso por tabla</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(PASO_LABEL) as Array<keyof typeof PASO_LABEL>).map((paso) => (
            <div key={paso} className="rounded-md border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{PASO_LABEL[paso]}</span>
                <Badge color={ESTADO_BADGE[stepStates[paso]]}>{stepStates[paso]}</Badge>
              </div>
              <p className="mt-2 text-xl font-bold text-gray-900">{progressDetails[paso].toLocaleString('es-DO')}</p>
              <p className="text-xs text-gray-400">registros procesados</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Ultimas 10 sincronizaciones</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Fecha</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Tipo</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Registros</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ultimosLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">
                    Aun no hay sincronizaciones registradas
                  </td>
                </tr>
              )}
              {ultimosLogs.map((log) => (
                <LogEntry key={log.id_sync} log={log} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
