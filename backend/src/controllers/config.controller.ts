import { Request, Response } from 'express';
import { ConfigService } from '../services/config.service';
import { asyncHandler } from '../utils/asyncHandler';
import { Retail } from '../types';

export const ConfigController = {
  getCriteriosDistribucion: asyncHandler(async (_req: Request, res: Response) => {
    const rows = await ConfigService.getCriteriosDistribucion();
    res.json(rows);
  }),

  updateCriterioDistribucion: asyncHandler(async (req: Request, res: Response) => {
    const { retail } = req.params as { retail: Retail };
    const { minimo_compras, periodo_dias } = req.body as { minimo_compras: number; periodo_dias: number };
    const row = await ConfigService.updateCriterioDistribucion(retail, { minimo_compras, periodo_dias });
    res.json(row);
  }),

  getSubcategorias: asyncHandler(async (_req: Request, res: Response) => {
    const rows = await ConfigService.getSubcategorias();
    res.json(rows);
  }),

  setSubcategoriaActiva: asyncHandler(async (req: Request, res: Response) => {
    const { clasificacion2 } = req.params as { clasificacion2: string };
    const { activo } = req.body as { activo: boolean };
    const row = await ConfigService.setSubcategoriaActiva(clasificacion2, activo);
    res.json(row);
  }),

  getSurtidoObligatorio: asyncHandler(async (_req: Request, res: Response) => {
    const rows = await ConfigService.getSurtidoObligatorio();
    res.json(rows);
  }),

  updateSurtidoObligatorio: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: number };
    const { es_obligatorio, cantidad_articulos } = req.body as {
      es_obligatorio: boolean;
      cantidad_articulos: number | null;
    };
    const row = await ConfigService.updateSurtidoObligatorio(id, {
      es_obligatorio,
      cantidad_articulos: cantidad_articulos ?? null,
    });
    res.json(row);
  }),

  getObjetivosDistribucion: asyncHandler(async (req: Request, res: Response) => {
    const { mes } = req.query as { mes?: string };
    const rows = await ConfigService.getObjetivosDistribucion(mes);
    res.json(rows);
  }),

  getUniversoCliente: asyncHandler(async (req: Request, res: Response) => {
    const { mes } = req.query as { mes?: string };
    const rows = await ConfigService.getUniversoCliente(mes);
    res.json(rows);
  }),

  getCuotaVendedor: asyncHandler(async (req: Request, res: Response) => {
    const { mes } = req.query as { mes?: string };
    const rows = await ConfigService.getCuotaVendedor(mes);
    res.json(rows);
  }),

  refrescarVistas: asyncHandler(async (_req: Request, res: Response) => {
    await ConfigService.refrescarVistas();
    res.json({ mensaje: 'Vistas materializadas refrescadas' });
  }),

  getDiasNoLaborables: asyncHandler(async (req: Request, res: Response) => {
    const { mes } = req.query as { mes?: string };
    const rows = await ConfigService.getDiasNoLaborables(mes);
    res.json(rows);
  }),

  addDiaNoLaborable: asyncHandler(async (req: Request, res: Response) => {
    const { fecha, descripcion } = req.body as { fecha: string; descripcion?: string | null };
    const row = await ConfigService.addDiaNoLaborable(fecha, descripcion ?? null);
    res.json(row);
  }),

  deleteDiaNoLaborable: asyncHandler(async (req: Request, res: Response) => {
    const { fecha } = req.params as { fecha: string };
    await ConfigService.deleteDiaNoLaborable(fecha);
    res.json({ mensaje: 'Dia no laborable eliminado' });
  }),

  getResumenDiasLaborables: asyncHandler(async (req: Request, res: Response) => {
    const { mes } = req.query as { mes?: string };
    const resumen = await ConfigService.getResumenDiasLaborables(mes);
    res.json(resumen);
  }),
};
