import { Request, Response } from 'express';
import parser from 'cron-parser';
import { ETLService } from '../services/etl.service';
import { PostgresqlService } from '../services/postgresql.service';
import { CronJobName, getJobsStatus, isPaused, pauseAllJobs, resumeAllJobs, updateJobSchedule } from '../config/cron';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { EtlStatusResponse } from '../types';

function calcularProximaSincronizacion(): string | null {
  const jobs = getJobsStatus().filter((j) => j.enabled && j.name !== 'telegram_resumen');
  if (isPaused() || jobs.length === 0) return null;

  let proxima: Date | null = null;
  for (const job of jobs) {
    try {
      const interval = parser.parseExpression(job.expression, { tz: 'America/Santo_Domingo' });
      const next = interval.next().toDate();
      if (!proxima || next < proxima) {
        proxima = next;
      }
    } catch {
      // expresion invalida, se omite
    }
  }
  return proxima ? proxima.toISOString() : null;
}

export const EtlController = {
  status: asyncHandler(async (_req: Request, res: Response) => {
    const metadataResult = await PostgresqlService.query<{ nombre_tabla: string; ultima_sincronizacion: string | null }>(
      'SELECT nombre_tabla, ultima_sincronizacion FROM sync_metadata'
    );
    const ultimaPorTabla = new Map(metadataResult.rows.map((r) => [r.nombre_tabla, r.ultima_sincronizacion]));

    const ultimaSincronizacion = Array.from(ultimaPorTabla.values())
      .filter((v): v is string => Boolean(v))
      .sort()
      .reverse()[0] ?? null;

    const pasos = ETLService.getStepStatus();
    const counts = ETLService.getStepCounts();
    const completados = Object.values(pasos).filter((s) => s === 'completado').length;

    const response: EtlStatusResponse = {
      sincronizando: ETLService.isSyncing(),
      ultima_sincronizacion: ultimaSincronizacion,
      proxima_sincronizacion: calcularProximaSincronizacion(),
      porcentaje_completitud: Math.round((completados / 4) * 100),
      estado_detalles: {
        clientes: { estado: pasos.clientes, registros: counts.clientes },
        articulos: { estado: pasos.articulos, registros: counts.articulos },
        ventas: { estado: pasos.ventas, registros: counts.ventas },
        kpis: { estado: pasos.kpis, registros: counts.kpis },
      },
    };
    res.json(response);
  }),

  triggerManual: asyncHandler(async (_req: Request, res: Response) => {
    if (ETLService.isSyncing()) {
      throw new AppError('Ya hay una sincronizacion en curso', 409);
    }
    const idSync = await ETLService.triggerManualFullSync();
    res.json({ mensaje: 'Sincronización iniciada', id_sync: idSync });
  }),

  pause: asyncHandler(async (_req: Request, res: Response) => {
    pauseAllJobs();
    res.json({ mensaje: 'Cron jobs pausados' });
  }),

  resume: asyncHandler(async (_req: Request, res: Response) => {
    resumeAllJobs();
    res.json({ mensaje: 'Cron jobs reanudados' });
  }),

  jobsStatus: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ pausado: isPaused(), jobs: getJobsStatus() });
  }),

  updateJob: asyncHandler(async (req: Request, res: Response) => {
    const name = req.params.name as CronJobName;
    const { cron_expresion, habilitado } = req.body as { cron_expresion?: string; habilitado?: boolean };
    try {
      const result = await updateJobSchedule(name, { expression: cron_expresion, enabled: habilitado });
      res.json(result);
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : 'No se pudo actualizar el job', 400);
    }
  }),

  getConfig: asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      mssql: {
        server: env.mssql.server ? env.mssql.server.replace(/.(?=.{3})/g, '*') : '',
        port: env.mssql.port,
        database: env.mssql.database,
        encrypt: env.mssql.encrypt,
        configurado: Boolean(env.mssql.server && env.mssql.database && env.mssql.user),
      },
      telegram: {
        configurado: Boolean(env.telegram.botToken && env.telegram.chatId),
      },
    });
  }),
};
