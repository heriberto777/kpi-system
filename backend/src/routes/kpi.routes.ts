import { Router } from 'express';
import { KpiController } from '../controllers/kpi.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationErrorHandler } from '../middleware/errorHandler';
import {
  clusterQueryValidators,
  distribucionQueryValidators,
  distribucionVendedorQueryValidators,
  mesOnlyQueryValidators,
  noVisitadosQueryValidators,
  surtidoQueryValidators,
  vendedorQueryValidators,
  ventasPorVendedorQueryValidators,
} from '../utils/validators';

const router = Router();

router.use(authMiddleware);

router.get('/distribucion', distribucionQueryValidators, validationErrorHandler, KpiController.distribucion);
router.get(
  '/distribucion-por-cluster',
  clusterQueryValidators,
  validationErrorHandler,
  KpiController.distribucionPorCluster
);
router.get(
  '/distribucion-por-vendedor',
  distribucionVendedorQueryValidators,
  validationErrorHandler,
  KpiController.distribucionPorVendedor
);
router.get(
  '/ventas-por-vendedor',
  ventasPorVendedorQueryValidators,
  validationErrorHandler,
  KpiController.ventasPorVendedor
);
router.get('/surtido', surtidoQueryValidators, validationErrorHandler, KpiController.surtido);
router.get(
  '/surtido-por-vendedor',
  vendedorQueryValidators,
  validationErrorHandler,
  KpiController.surtidoPorVendedor
);
router.get('/surtido-por-cluster', mesOnlyQueryValidators, validationErrorHandler, KpiController.surtidoPorCluster);
router.get(
  '/clientes-no-visitados',
  noVisitadosQueryValidators,
  validationErrorHandler,
  KpiController.clientesNoVisitados
);
router.get('/resumen', mesOnlyQueryValidators, validationErrorHandler, KpiController.resumen);
router.get('/vendedores', KpiController.vendedores);
router.get('/supervisores', KpiController.supervisores);
router.get('/meses-disponibles', KpiController.mesesDisponibles);

export default router;
