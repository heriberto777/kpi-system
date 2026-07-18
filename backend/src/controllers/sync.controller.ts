import { Request, Response } from 'express';
import { PostgresqlService } from '../services/postgresql.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { EstadoSincronizacion, TipoSincronizacion } from '../types';

export const SyncController = {
  getLogs: asyncHandler(async (req: Request, res: Response) => {
    const { limit, tipo, estado } = req.query as {
      limit?: number;
      tipo?: TipoSincronizacion;
      estado?: EstadoSincronizacion;
    };
    const logs = await PostgresqlService.obtenerSyncLogs({ limit, tipo, estado });
    res.json(logs);
  }),

  getLogById: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const log = await PostgresqlService.obtenerSyncLogPorId(id);
    if (!log) {
      throw new AppError(`No se encontro el log de sincronizacion ${id}`, 404);
    }
    res.json(log);
  }),
};
