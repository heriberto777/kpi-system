import { Router } from 'express';
import { SurtidoMandatorioController } from '../controllers/surtidoMandatorio.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationErrorHandler } from '../middleware/errorHandler';
import {
  deletePosicionSurtidoMandatorioValidators,
  setPosicionSurtidoMandatorioValidators,
  surtidoMandatorioFiltroQueryValidators,
  surtidoMandatorioResumenQueryValidators,
  updateConfigSurtidoMandatorioValidators,
  updateObjetivoSurtidoMandatorioValidators,
} from '../utils/validators';

const router = Router();

router.use(authMiddleware);

router.get('/bimestres-disponibles', SurtidoMandatorioController.bimestresDisponibles);

router.get(
  '/resumen-global-por-vendedor',
  surtidoMandatorioResumenQueryValidators,
  validationErrorHandler,
  SurtidoMandatorioController.resumenGlobalPorVendedor
);
router.get(
  '/resumen-global-general',
  surtidoMandatorioResumenQueryValidators,
  validationErrorHandler,
  SurtidoMandatorioController.resumenGlobalGeneral
);

router.get(
  '/resumen-vendedor',
  surtidoMandatorioResumenQueryValidators,
  validationErrorHandler,
  SurtidoMandatorioController.resumenPorVendedor
);
router.get(
  '/cobertura-vendedor',
  surtidoMandatorioFiltroQueryValidators,
  validationErrorHandler,
  SurtidoMandatorioController.coberturaPorVendedor
);
router.get(
  '/detalle-cliente',
  surtidoMandatorioFiltroQueryValidators,
  validationErrorHandler,
  SurtidoMandatorioController.detallePorCliente
);

router.get('/posiciones', SurtidoMandatorioController.getPosiciones);
router.post(
  '/posiciones',
  setPosicionSurtidoMandatorioValidators,
  validationErrorHandler,
  SurtidoMandatorioController.setPosicion
);
router.delete(
  '/posiciones/:id',
  deletePosicionSurtidoMandatorioValidators,
  validationErrorHandler,
  SurtidoMandatorioController.deletePosicion
);

router.get('/objetivos', SurtidoMandatorioController.getObjetivos);
router.put(
  '/objetivos/:uCluster',
  updateObjetivoSurtidoMandatorioValidators,
  validationErrorHandler,
  SurtidoMandatorioController.updateObjetivo
);

router.get('/config', SurtidoMandatorioController.getConfig);
router.put(
  '/config',
  updateConfigSurtidoMandatorioValidators,
  validationErrorHandler,
  SurtidoMandatorioController.updateConfig
);

export default router;
