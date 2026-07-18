import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { loginValidators } from '../utils/validators';
import { validationErrorHandler } from '../middleware/errorHandler';

const router = Router();

router.post('/login', loginValidators, validationErrorHandler, AuthController.login);

export default router;
