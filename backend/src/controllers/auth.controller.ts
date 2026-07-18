import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';

export const AuthController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const { usuario, contraseña } = req.body as { usuario: string; contraseña: string };
    const result = await AuthService.login(usuario, contraseña);
    res.json(result);
  }),
};
