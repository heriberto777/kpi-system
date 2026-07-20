import { Router } from 'express';
import authRoutes from './auth.routes';
import etlRoutes from './etl.routes';
import kpiRoutes from './kpi.routes';
import configRoutes from './config.routes';
import surtidoMandatorioRoutes from './surtidoMandatorio.routes';
import { checkMssqlConnection, checkPostgresConnection } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const [postgres, mssql] = await Promise.all([checkPostgresConnection(), checkMssqlConnection()]);
    const healthy = postgres && mssql;
    res.status(healthy ? 200 : 503).json({
      estado: healthy ? 'ok' : 'degradado',
      postgres,
      mssql,
      timestamp: new Date().toISOString(),
    });
  })
);

router.use('/auth', authRoutes);
router.use('/etl', etlRoutes);
router.use('/kpi', kpiRoutes);
router.use('/config', configRoutes);
router.use('/surtido-mandatorio', surtidoMandatorioRoutes);

export default router;
