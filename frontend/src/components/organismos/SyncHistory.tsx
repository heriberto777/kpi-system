import { useEffect, useMemo, useState } from 'react';
import Card from '../atomos/Card';
import Select from '../atomos/Select';
import Button from '../atomos/Button';
import Spinner from '../atomos/Spinner';
import Icon from '../atomos/Icon';
import LogEntry from '../moleculas/LogEntry';
import DateRangePicker from '../moleculas/DateRangePicker';
import { etlApi } from '../../api/etl.api';
import { EstadoSincronizacion, SyncLog, TipoSincronizacion } from '../../types';

const TIPO_OPTIONS = [
  { value: 'clientes', label: 'Clientes' },
  { value: 'articulos', label: 'Articulos' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'kpis', label: 'KPIs' },
  { value: 'materialized_views', label: 'Vistas Materializadas' },
  { value: 'manual', label: 'Manual (completo)' },
];

const ESTADO_OPTIONS = [
  { value: 'completado', label: 'Completado' },
  { value: 'error', label: 'Error' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'iniciado', label: 'Iniciado' },
];

function exportarCSV(logs: SyncLog[]): void {
  const headers = [
    'id_sync',
    'tipo_tabla',
    'fecha_inicio',
    'fecha_fin',
    'estado',
    'registros_procesados',
    'registros_insertados',
    'registros_actualizados',
    'registros_error',
    'disparado_manualmente',
  ];
  const filas = logs.map((l) =>
    [
      l.id_sync,
      l.tipo_tabla,
      l.fecha_inicio,
      l.fecha_fin ?? '',
      l.estado,
      l.registros_procesados,
      l.registros_insertados,
      l.registros_actualizados,
      l.registros_error,
      l.disparado_manualmente,
    ].join(',')
  );
  const csv = [headers.join(','), ...filas].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sync_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SyncHistory() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tipo, setTipo] = useState<TipoSincronizacion | ''>('');
  const [estado, setEstado] = useState<EstadoSincronizacion | ''>('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [seleccionado, setSeleccionado] = useState<SyncLog | null>(null);

  const cargarLogs = async () => {
    setIsLoading(true);
    try {
      const data = await etlApi.getLogs({
        limit: 200,
        tipo: tipo || undefined,
        estado: estado || undefined,
      });
      setLogs(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void cargarLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, estado]);

  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      const fecha = new Date(log.fecha_inicio);
      if (desde && fecha < new Date(desde)) return false;
      if (hasta && fecha > new Date(`${hasta}T23:59:59`)) return false;
      return true;
    });
  }, [logs, desde, hasta]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Historial de Sincronizaciones</h2>
        <Button variant="secondary" onClick={() => exportarCSV(logsFiltrados)} disabled={logsFiltrados.length === 0}>
          <Icon name="download" className="h-4 w-4" /> Exportar a CSV
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <Select
              label="Tipo de tabla"
              placeholder="Todos"
              options={TIPO_OPTIONS}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoSincronizacion | '')}
            />
          </div>
          <div className="w-48">
            <Select
              label="Estado"
              placeholder="Todos"
              options={ESTADO_OPTIONS}
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoSincronizacion | '')}
            />
          </div>
          <DateRangePicker desde={desde} hasta={hasta} onChange={(d, h) => { setDesde(d); setHasta(h); }} />
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : (
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
                {logsFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">
                      No hay registros para los filtros seleccionados
                    </td>
                  </tr>
                )}
                {logsFiltrados.map((log) => (
                  <LogEntry key={log.id_sync} log={log} onClick={setSeleccionado} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {seleccionado && (
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Detalle sincronizacion #{seleccionado.id_sync}</h3>
            <button className="text-sm text-gray-400 hover:text-gray-600" onClick={() => setSeleccionado(null)}>
              Cerrar ✕
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-gray-500">Tipo</dt>
              <dd className="font-medium text-gray-900">{seleccionado.tipo_tabla}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Estado</dt>
              <dd className="font-medium text-gray-900">{seleccionado.estado}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Inicio</dt>
              <dd className="font-medium text-gray-900">{new Date(seleccionado.fecha_inicio).toLocaleString('es-DO')}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Fin</dt>
              <dd className="font-medium text-gray-900">
                {seleccionado.fecha_fin ? new Date(seleccionado.fecha_fin).toLocaleString('es-DO') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Procesados</dt>
              <dd className="font-medium text-gray-900">{seleccionado.registros_procesados}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Insertados / Actualizados</dt>
              <dd className="font-medium text-gray-900">
                {seleccionado.registros_insertados} / {seleccionado.registros_actualizados}
              </dd>
            </div>
            {seleccionado.mensaje_error && (
              <div className="col-span-full">
                <dt className="text-gray-500">Mensaje de error</dt>
                <dd className="font-mono text-xs text-danger">{seleccionado.mensaje_error}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}
    </div>
  );
}
