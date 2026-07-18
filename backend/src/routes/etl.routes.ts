import { Router } from 'express';
import { EtlController } from '../controllers/etl.controller';
import { SyncController } from '../controllers/sync.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationErrorHandler } from '../middleware/errorHandler';
import { logByIdValidators, logsQueryValidators, updateJobValidators } from '../utils/validators';

const router = Router();

router.use(authMiddleware);

router.get('/status', EtlController.status);
router.post('/trigger-manual', EtlController.triggerManual);
router.post('/pause', EtlController.pause);
router.post('/resume', EtlController.resume);
router.get('/jobs', EtlController.jobsStatus);
router.put('/jobs/:name', updateJobValidators, validationErrorHandler, EtlController.updateJob);
router.get('/config', EtlController.getConfig);

router.get('/logs', logsQueryValidators, validationErrorHandler, SyncController.getLogs);
router.get('/logs/:id', logByIdValidators, validationErrorHandler, SyncController.getLogById);

export default router;
