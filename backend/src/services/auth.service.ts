import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { JwtPayload } from '../types';

export const AuthService = {
  async login(usuario: string, contraseña: string): Promise<{ token: string; expira_en: number }> {
    if (usuario !== env.adminUser) {
      throw new AppError('Usuario o contraseña invalidos', 401);
    }

    if (!env.adminPasswordHash) {
      throw new AppError('ADMIN_PASSWORD_HASH no configurado en el servidor', 500);
    }

    const esValido = await bcrypt.compare(contraseña, env.adminPasswordHash);
    if (!esValido) {
      throw new AppError('Usuario o contraseña invalidos', 401);
    }

    const payload: JwtPayload = { sub: usuario, usuario };
    const token = jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

    return { token, expira_en: env.jwtExpiresIn };
  },

  verificarToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, env.jwtSecret) as JwtPayload;
    } catch {
      throw new AppError('Token invalido o expirado', 401);
    }
  },

  async generarHash(contraseña: string): Promise<string> {
    return bcrypt.hash(contraseña, 10);
  },
};
