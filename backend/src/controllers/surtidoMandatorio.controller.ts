import { Request, Response } from 'express';
import { SurtidoMandatorioService } from '../services/surtidoMandatorio.service';
import { asyncHandler } from '../utils/asyncHandler';
import { Cluster } from '../types';

export const SurtidoMandatorioController = {
  bimestresDisponibles: asyncHandler(async (_req: Request, res: Response) => {
    const bimestres = await SurtidoMandatorioService.getBimestresDisponibles();
    res.json(bimestres);
  }),

  resumenGlobalPorVendedor: asyncHandler(async (req: Request, res: Response) => {
    const { bimestre } = req.query as { bimestre?: string };
    const row = await SurtidoMandatorioService.getResumenGlobalPorVendedor({ bimestre });
    res.json(row);
  }),

  resumenGlobalGeneral: asyncHandler(async (req: Request, res: Response) => {
    const { bimestre } = req.query as { bimestre?: string };
    const row = await SurtidoMandatorioService.getResumenGlobalGeneral({ bimestre });
    res.json(row);
  }),

  resumenPorVendedor: asyncHandler(async (req: Request, res: Response) => {
    const { vendedor, bimestre } = req.query as { vendedor?: string; bimestre?: string };
    const rows = await SurtidoMandatorioService.getResumenPorVendedor({ vendedor, bimestre });
    res.json(rows);
  }),

  coberturaPorVendedor: asyncHandler(async (req: Request, res: Response) => {
    const { vendedor, cluster, bimestre } = req.query as { vendedor?: string; cluster?: Cluster; bimestre?: string };
    const rows = await SurtidoMandatorioService.getCoberturaPorVendedor({ vendedor, cluster, bimestre });
    res.json(rows);
  }),

  detallePorCliente: asyncHandler(async (req: Request, res: Response) => {
    const { vendedor, cluster, bimestre } = req.query as { vendedor?: string; cluster?: Cluster; bimestre?: string };
    const rows = await SurtidoMandatorioService.getDetallePorCliente({ vendedor, cluster, bimestre });
    res.json(rows);
  }),

  getPosiciones: asyncHandler(async (_req: Request, res: Response) => {
    const rows = await SurtidoMandatorioService.getPosiciones();
    res.json(rows);
  }),

  setPosicion: asyncHandler(async (req: Request, res: Response) => {
    const { posicion_surtido, u_cluster, es_obligatorio } = req.body as {
      posicion_surtido: number;
      u_cluster: string;
      es_obligatorio: boolean;
    };
    const row = await SurtidoMandatorioService.setPosicion(posicion_surtido, u_cluster, es_obligatorio);
    res.json(row);
  }),

  deletePosicion: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: number };
    await SurtidoMandatorioService.deletePosicion(id);
    res.json({ mensaje: 'Posicion eliminada' });
  }),

  getObjetivos: asyncHandler(async (_req: Request, res: Response) => {
    const rows = await SurtidoMandatorioService.getObjetivos();
    res.json(rows);
  }),

  updateObjetivo: asyncHandler(async (req: Request, res: Response) => {
    const { uCluster } = req.params as { uCluster: string };
    const { base_objetivo, colocaciones_meta, meta_conservadora_restan } = req.body as {
      base_objetivo: number;
      colocaciones_meta: number;
      meta_conservadora_restan: number;
    };
    const row = await SurtidoMandatorioService.updateObjetivo(uCluster, {
      base_objetivo,
      colocaciones_meta,
      meta_conservadora_restan,
    });
    res.json(row);
  }),

  getConfig: asyncHandler(async (_req: Request, res: Response) => {
    const row = await SurtidoMandatorioService.getConfigClienteActivo();
    res.json(row);
  }),

  updateConfig: asyncHandler(async (req: Request, res: Response) => {
    const { cliente_activo_minimo } = req.body as { cliente_activo_minimo: number };
    const row = await SurtidoMandatorioService.updateConfigClienteActivo(cliente_activo_minimo);
    res.json(row);
  }),
};
