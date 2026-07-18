import cron, { ScheduledTask } from 'node-cron';
import { pgPool } from './database';
import { env } from './env';
import logger from './logger';
import { syncClientesJob } from '../jobs/sync-clientes.job';
import { syncArticulosJob } from '../jobs/sync-articulos.job';
import { syncVentasJob } from '../jobs/sync-ventas.job';
import { calcularKpisJob } from '../jobs/calcular-kpis.job';
import { refreshMaterializeJob } from '../jobs/refresh-materialize.job';
import { telegramResumenJob } from '../jobs/telegram-resumen.job';

export type CronJobName =
  | 'sync_clientes'
  | 'sync_articulos'
  | 'sync_ventas'
  | 'calcular_kpis'
  | 'refresh_views'
  | 'telegram_resumen';

interface JobDefinition {
  name: CronJobName;
  defaultExpression: string;
  run: () => Promise<void>;
}

const JOB_DEFINITIONS: JobDefinition[] = [
  { name: 'sync_clientes', defaultExpression: '0 23 * * *', run: syncClientesJob },
  { name: 'sync_articulos', defaultExpression: '15 23 * * *', run: syncArticulosJob },
  { name: 'sync_ventas', defaultExpression: '30 23 * * *', run: syncVentasJob },
  { name: 'calcular_kpis', defaultExpression: '45 23 * * *', run: calcularKpisJob },
  { name: 'refresh_views', defaultExpression: '0 0 * * *', run: refreshMaterializeJob },
  { name: 'telegram_resumen', defaultExpression: '0 6 * * *', run: telegramResumenJob },
];

interface RegisteredJob {
  definition: JobDefinition;
  task: ScheduledTask;
  expression: string;
  enabled: boolean;
}

const registry = new Map<CronJobName, RegisteredJob>();
let globallyPaused = false;

async function loadJobSettings(): Promise<Map<CronJobName, { expression: string; enabled: boolean }>> {
  const settings = new Map<CronJobName, { expression: string; enabled: boolean }>();
  try {
    const result = await pgPool.query(
      'SELECT nombre_job, cron_expresion, habilitado FROM cron_settings'
    );
    for (const row of result.rows) {
      settings.set(row.nombre_job as CronJobName, {
        expression: row.cron_expresion,
        enabled: row.habilitado,
      });
    }
  } catch (error) {
    logger.warn('No se pudieron cargar cron_settings desde PostgreSQL, se usaran valores por defecto', {
      error,
    });
  }
  return settings;
}

export async function initCronJobs(): Promise<void> {
  const dbSettings = await loadJobSettings();

  for (const definition of JOB_DEFINITIONS) {
    const dbSetting = dbSettings.get(definition.name);
    const expression = dbSetting?.expression ?? definition.defaultExpression;
    const enabled = dbSetting?.enabled ?? true;

    const task = cron.schedule(
      expression,
      async () => {
        if (globallyPaused || !registry.get(definition.name)?.enabled) {
          logger.debug(`Job ${definition.name} omitido (pausado)`);
          return;
        }
        logger.info(`Iniciando job: ${definition.name}`);
        try {
          await definition.run();
          logger.info(`Job completado: ${definition.name}`);
        } catch (error) {
          logger.error(`Error en job ${definition.name}`, { error });
        }
      },
      { timezone: 'America/Santo_Domingo' }
    );

    registry.set(definition.name, { definition, task, expression, enabled });
    logger.info(`Cron job registrado: ${definition.name} (${expression}) habilitado=${enabled}`);
  }

  if (!env.cronEnabled) {
    pauseAllJobs();
  }
}

export function pauseAllJobs(): void {
  globallyPaused = true;
  logger.info('Todos los cron jobs han sido pausados');
}

export function resumeAllJobs(): void {
  globallyPaused = false;
  logger.info('Todos los cron jobs han sido reanudados');
}

export function isPaused(): boolean {
  return globallyPaused;
}

export function getJobsStatus(): Array<{ name: CronJobName; expression: string; enabled: boolean }> {
  return Array.from(registry.values()).map((job) => ({
    name: job.definition.name,
    expression: job.expression,
    enabled: job.enabled,
  }));
}

export async function triggerJobManually(name: CronJobName): Promise<void> {
  const job = registry.get(name);
  if (!job) {
    throw new Error(`Job desconocido: ${name}`);
  }
  await job.definition.run();
}

export async function updateJobSchedule(
  name: CronJobName,
  patch: { expression?: string; enabled?: boolean }
): Promise<{ name: CronJobName; expression: string; enabled: boolean }> {
  const job = registry.get(name);
  if (!job) {
    throw new Error(`Job desconocido: ${name}`);
  }

  if (patch.expression && !cron.validate(patch.expression)) {
    throw new Error(`Expresion cron invalida: ${patch.expression}`);
  }

  const nuevaExpresion = patch.expression ?? job.expression;
  const nuevoHabilitado = patch.enabled ?? job.enabled;

  if (patch.expression && patch.expression !== job.expression) {
    job.task.stop();
    const nuevaTask = cron.schedule(
      nuevaExpresion,
      async () => {
        if (globallyPaused || !registry.get(name)?.enabled) {
          logger.debug(`Job ${name} omitido (pausado)`);
          return;
        }
        logger.info(`Iniciando job: ${name}`);
        try {
          await job.definition.run();
          logger.info(`Job completado: ${name}`);
        } catch (error) {
          logger.error(`Error en job ${name}`, { error });
        }
      },
      { timezone: 'America/Santo_Domingo' }
    );
    job.task = nuevaTask;
  }

  job.expression = nuevaExpresion;
  job.enabled = nuevoHabilitado;
  registry.set(name, job);

  await pgPool.query(
    `INSERT INTO cron_settings (nombre_job, cron_expresion, habilitado, fecha_actualizacion)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (nombre_job) DO UPDATE SET
       cron_expresion = EXCLUDED.cron_expresion,
       habilitado = EXCLUDED.habilitado,
       fecha_actualizacion = CURRENT_TIMESTAMP`,
    [name, nuevaExpresion, nuevoHabilitado]
  );

  logger.info(`Cron job actualizado: ${name} (${nuevaExpresion}) habilitado=${nuevoHabilitado}`);
  return { name, expression: nuevaExpresion, enabled: nuevoHabilitado };
}

export async function runFullSyncManually(): Promise<void> {
  await syncClientesJob();
  await syncArticulosJob();
  await syncVentasJob();
  await calcularKpisJob();
  await refreshMaterializeJob();
}
