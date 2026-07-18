import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationErrorHandler } from '../middleware/errorHandler';
import {
  addDiaNoLaborableValidators,
  deleteDiaNoLaborableValidators,
  objetivosConfigQueryValidators,
  setSubcategoriaActivaValidators,
  updateCriterioValidators,
  updateSurtidoObligatorioValidators,
} from '../utils/validators';

const router = Router();

router.use(authMiddleware);

router.get('/umbrales', ConfigController.getCriteriosDistribucion);
router.put(
  '/umbrales/:retail',
  updateCriterioValidators,
  validationErrorHandler,
  ConfigController.updateCriterioDistribucion
);

router.get('/subcategorias', ConfigController.getSubcategorias);
router.patch(
  '/subcategorias/:clasificacion2',
  setSubcategoriaActivaValidators,
  validationErrorHandler,
  ConfigController.setSubcategoriaActiva
);

router.get('/surtido-obligatorio', ConfigController.getSurtidoObligatorio);
router.put(
  '/surtido-obligatorio/:id',
  updateSurtidoObligatorioValidators,
  validationErrorHandler,
  ConfigController.updateSurtidoObligatorio
);

router.get('/objetivos', objetivosConfigQueryValidators, validationErrorHandler, ConfigController.getObjetivosDistribucion);
router.get('/universo', objetivosConfigQueryValidators, validationErrorHandler, ConfigController.getUniversoCliente);
router.get('/cuota-vendedor', objetivosConfigQueryValidators, validationErrorHandler, ConfigController.getCuotaVendedor);

router.post('/refrescar-vistas', ConfigController.refrescarVistas);

router.get('/dias-no-laborables', objetivosConfigQueryValidators, validationErrorHandler, ConfigController.getDiasNoLaborables);
router.post('/dias-no-laborables', addDiaNoLaborableValidators, validationErrorHandler, ConfigController.addDiaNoLaborable);
router.delete(
  '/dias-no-laborables/:fecha',
  deleteDiaNoLaborableValidators,
  validationErrorHandler,
  ConfigController.deleteDiaNoLaborable
);
router.get(
  '/dias-laborables',
  objetivosConfigQueryValidators,
  validationErrorHandler,
  ConfigController.getResumenDiasLaborables
);

export default router;
