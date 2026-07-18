import { useEffect, useState } from 'react';
import Card from '../atomos/Card';
import Button from '../atomos/Button';
import Input from '../atomos/Input';
import Badge from '../atomos/Badge';
import AlertBanner from '../moleculas/AlertBanner';
import Spinner from '../atomos/Spinner';
import { etlApi } from '../../api/etl.api';
import { useETLContext } from '../../contexts/ETLContext';
import { CronJobStatus } from '../../types';

const JOB_LABELS: Record<string, string> = {
  sync_clientes: 'Sincronizar Clientes',
  sync_articulos: 'Sincronizar Articulos',
  sync_ventas: 'Sincronizar Ventas',
  calcular_kpis: 'Calcular KPIs',
  refresh_views: 'Refrescar Vistas Materializadas',
  telegram_resumen: 'Resumen diario por Telegram',
};

function cronAHora(expresion: string): string {
  const partes = expresion.trim().split(/\s+/);
  if (partes.length < 2) return '00:00';
  const [minuto, hora] = partes;
  return `${hora.padStart(2, '0')}:${minuto.padStart(2, '0')}`;
}

function horaACron(hora: string): string {
  const [h, m] = hora.split(':');
  return `${parseInt(m, 10)} ${parseInt(h, 10)} * * *`;
}

export default function Settings() {
  const { isPaused, pauseSync, resumeSync } = useETLContext();
  const [jobs, setJobs] = useState<CronJobStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [config, setConfig] = useState<{
    mssql: { server: string; port: number; database: string; encrypt: boolean; configurado: boolean };
    telegram: { configurado: boolean };
  } | null>(null);

  const cargar = async () => {
    setIsLoading(true);
    try {
      const [jobsData, configData] = await Promise.all([etlApi.getJobsStatus(), etlApi.getConfig()]);
      setJobs(jobsData.jobs);
      setConfig(configData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  async function actualizarHora(name: string, hora: string) {
    setGuardando(name);
    try {
      const actualizado = await etlApi.updateJob(name, { cron_expresion: horaACron(hora) });
      setJobs((prev) => prev.map((j) => (j.name === name ? actualizado : j)));
      setMensaje({ tipo: 'success', texto: `Horario de "${JOB_LABELS[name] ?? name}" actualizado` });
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo actualizar el horario' });
    } finally {
      setGuardando(null);
    }
  }

  async function alternarHabilitado(job: CronJobStatus) {
    setGuardando(job.name);
    try {
      const actualizado = await etlApi.updateJob(job.name, { habilitado: !job.enabled });
      setJobs((prev) => prev.map((j) => (j.name === job.name ? actualizado : j)));
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo cambiar el estado del job' });
    } finally {
      setGuardando(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-gray-900">Configuracion</h2>

      {mensaje && <AlertBanner tipo={mensaje.tipo} mensaje={mensaje.texto} onDismiss={() => setMensaje(null)} />}

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Control global de cron jobs</h3>
            <p className="text-xs text-gray-400">Pausar detiene temporalmente todas las sincronizaciones automaticas.</p>
          </div>
          <Button variant={isPaused ? 'success' : 'secondary'} onClick={() => (isPaused ? resumeSync() : pauseSync())}>
            {isPaused ? 'Reanudar todo' : 'Pausar todo'}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Horarios de sincronizacion</h3>
        <div className="flex flex-col divide-y divide-gray-100">
          {jobs.map((job) => (
            <div key={job.name} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{JOB_LABELS[job.name] ?? job.name}</p>
                <Badge color={job.enabled ? 'success' : 'neutral'}>{job.enabled ? 'Habilitado' : 'Deshabilitado'}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="time"
                  aria-label={`Horario de ${job.name}`}
                  defaultValue={cronAHora(job.expression)}
                  disabled={guardando === job.name}
                  onBlur={(e) => {
                    if (e.target.value) void actualizarHora(job.name, e.target.value);
                  }}
                />
                <Button
                  variant="secondary"
                  disabled={guardando === job.name}
                  onClick={() => alternarHabilitado(job)}
                >
                  {job.enabled ? 'Deshabilitar' : 'Habilitar'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Conexion MSSQL (ERP)</h3>
        <p className="mb-3 text-xs text-gray-400">
          Por seguridad, las credenciales solo se configuran mediante variables de entorno en el servidor
          (.env). La contraseña nunca se muestra ni se transmite al frontend.
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-gray-500">Servidor</dt>
            <dd className="font-medium text-gray-900">{config?.mssql.server || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Puerto</dt>
            <dd className="font-medium text-gray-900">{config?.mssql.port ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Base de datos</dt>
            <dd className="font-medium text-gray-900">{config?.mssql.database || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Estado</dt>
            <dd>
              <Badge color={config?.mssql.configurado ? 'success' : 'error'}>
                {config?.mssql.configurado ? 'Configurado' : 'Sin configurar'}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Notificaciones Telegram (opcional)</h3>
        <p className="mb-3 text-xs text-gray-400">
          El bot token y chat id se configuran via variables de entorno (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).
        </p>
        <Badge color={config?.telegram.configurado ? 'success' : 'neutral'}>
          {config?.telegram.configurado ? 'Configurado' : 'No configurado'}
        </Badge>
      </Card>
    </div>
  );
}
