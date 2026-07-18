import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AppError } from '../utils/AppError';
import { JwtPayload } from '../types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Token de autenticacion requerido', 401);
  }

  const token = header.slice('Bearer '.length);
  req.user = AuthService.verificarToken(token);
  next();
}
