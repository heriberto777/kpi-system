import { body, query, param } from 'express-validator';

export const loginValidators = [
  body('usuario').isString().trim().notEmpty().withMessage('usuario es requerido'),
  body('contraseña').isString().notEmpty().withMessage('contraseña es requerida'),
];

export const logsQueryValidators = [
  query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  query('tipo')
    .optional()
    .isIn(['clientes', 'articulos', 'ventas', 'kpis', 'materialized_views']),
  query('estado').optional().isIn(['iniciado', 'en_proceso', 'completado', 'error']),
];

export const logByIdValidators = [param('id').isInt({ min: 1 }).toInt()];

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const distribucionQueryValidators = [
  query('retail').optional().isIn(['COLMADO', 'AUTOSERVICIO', 'MAYORISTA', 'OTROS']),
  query('periodo').optional().isInt({ min: 1, max: 365 }).toInt(),
  query('sku').optional().isString().trim(),
  query('mes').optional().matches(MES_REGEX).withMessage('mes debe tener formato YYYY-MM'),
];

export const clusterQueryValidators = [
  query('cluster').optional().isIn(['BRONZE', 'SILVER', 'GOLD']),
  query('mes').optional().matches(MES_REGEX).withMessage('mes debe tener formato YYYY-MM'),
];

export const vendedorQueryValidators = [
  query('vendedor').optional().isString().trim().notEmpty(),
  query('mes').optional().matches(MES_REGEX).withMessage('mes debe tener formato YYYY-MM'),
];

export const mesOnlyQueryValidators = [
  query('mes').optional().matches(MES_REGEX).withMessage('mes debe tener formato YYYY-MM'),
];

export const distribucionVendedorQueryValidators = [
  query('vendedor').optional().isString().trim().notEmpty(),
  query('retail').optional().isIn(['COLMADO', 'AUTOSERVICIO', 'MAYORISTA', 'OTROS']),
  query('mes').optional().matches(MES_REGEX).withMessage('mes debe tener formato YYYY-MM'),
];

export const surtidoQueryValidators = [
  query('cluster').optional().isIn(['BRONZE', 'SILVER', 'GOLD']),
  query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('mes').optional().matches(MES_REGEX).withMessage('mes debe tener formato YYYY-MM'),
];

export const noVisitadosQueryValidators = [
  query('dias').optional().isInt({ min: 1, max: 365 }).toInt(),
  query('retail').optional().isIn(['COLMADO', 'AUTOSERVICIO', 'MAYORISTA', 'OTROS']),
];

export const updateJobValidators = [
  param('name').isIn([
    'sync_clientes',
    'sync_articulos',
    'sync_ventas',
    'calcular_kpis',
    'refresh_views',
    'telegram_resumen',
  ]),
  body('cron_expresion').optional().isString().trim().notEmpty(),
  body('habilitado').optional().isBoolean().toBoolean(),
];

export const triggerJobValidators = [
  body('job')
    .optional()
    .isIn(['sync_clientes', 'sync_articulos', 'sync_ventas', 'calcular_kpis', 'refresh_views', 'telegram_resumen']),
];

export const objetivosConfigQueryValidators = [
  query('mes').optional().matches(MES_REGEX).withMessage('mes debe tener formato YYYY-MM'),
];

export const updateCriterioValidators = [
  param('retail').isIn(['COLMADO', 'AUTOSERVICIO', 'MAYORISTA', 'OTROS']),
  body('minimo_compras').isInt({ min: 1, max: 999 }).toInt(),
  body('periodo_dias').isInt({ min: 1, max: 365 }).toInt(),
];

export const setSubcategoriaActivaValidators = [
  param('clasificacion2').isString().trim().notEmpty(),
  body('activo').isBoolean().toBoolean(),
];

export const updateSurtidoObligatorioValidators = [
  param('id').isInt({ min: 1 }).toInt(),
  body('es_obligatorio').isBoolean().toBoolean(),
  body('cantidad_articulos').optional({ nullable: true }).isInt({ min: 0 }).toInt(),
];

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const addDiaNoLaborableValidators = [
  body('fecha').matches(FECHA_REGEX).withMessage('fecha debe tener formato YYYY-MM-DD'),
  body('descripcion').optional({ nullable: true }).isString().trim(),
];

export const deleteDiaNoLaborableValidators = [param('fecha').matches(FECHA_REGEX).withMessage('fecha debe tener formato YYYY-MM-DD')];

export const ventasPorVendedorQueryValidators = [
  query('vendedor').optional().isString().trim().notEmpty(),
  query('retail').optional().isIn(['COLMADO', 'AUTOSERVICIO', 'MAYORISTA', 'OTROS']),
  query('supervisor').optional().isString().trim().notEmpty(),
  query('mes').optional().matches(MES_REGEX).withMessage('mes debe tener formato YYYY-MM'),
];

// ============================================
// SURTIDO MANDATORIO
// ============================================
// "bimestre" se valida con el mismo formato YYYY-MM que "mes" (identifica el primer mes del par).
export const surtidoMandatorioResumenQueryValidators = [
  query('vendedor').optional().isString().trim().notEmpty(),
  query('bimestre').optional().matches(MES_REGEX).withMessage('bimestre debe tener formato YYYY-MM'),
];

export const surtidoMandatorioFiltroQueryValidators = [
  query('vendedor').optional().isString().trim().notEmpty(),
  query('cluster').optional().isIn(['BRONZE', 'SILVER', 'GOLD']),
  query('bimestre').optional().matches(MES_REGEX).withMessage('bimestre debe tener formato YYYY-MM'),
];

export const setPosicionSurtidoMandatorioValidators = [
  body('posicion_surtido').isInt({ min: 1 }).toInt(),
  body('u_cluster').isIn(['BRONZE', 'SILVER', 'GOLD']),
  body('es_obligatorio').isBoolean().toBoolean(),
];

export const deletePosicionSurtidoMandatorioValidators = [param('id').isInt({ min: 1 }).toInt()];

export const updateObjetivoSurtidoMandatorioValidators = [
  param('uCluster').isIn(['BRONZE', 'SILVER', 'GOLD']),
  body('base_objetivo').isInt({ min: 1 }).toInt(),
  body('colocaciones_meta').isInt({ min: 1 }).toInt(),
  body('meta_conservadora_restan').isInt({ min: 1 }).toInt(),
];

export const updateConfigSurtidoMandatorioValidators = [body('cliente_activo_minimo').isInt({ min: 1 }).toInt()];
