import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../utils/AppError';
import logger from '../config/logger';
import { isProduction } from '../config/env';

export function validationErrorHandler(req: Request, _res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(`Parametros invalidos: ${JSON.stringify(errors.array())}`, 400);
  }
  next();
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn(`Error operacional: ${err.message}`, { statusCode: err.statusCode, path: req.originalUrl });
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  logger.error('Error no controlado', { error: err.message, stack: err.stack, path: req.originalUrl });
  res.status(500).json({
    error: 'Error interno del servidor',
    ...(isProduction ? {} : { detalle: err.message }),
  });
}
