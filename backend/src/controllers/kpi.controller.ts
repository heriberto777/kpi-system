import { Request, Response } from 'express';
import { KpiService } from '../services/kpi.service';
import { asyncHandler } from '../utils/asyncHandler';
import { Cluster, Retail } from '../types';

export const KpiController = {
  distribucion: asyncHandler(async (req: Request, res: Response) => {
    const { retail, sku, mes } = req.query as { retail?: Retail; sku?: string; mes?: string };
    const rows = await KpiService.getDistribucionPorRetail({ retail, sku, mes });
    res.json(rows);
  }),

  distribucionPorCluster: asyncHandler(async (req: Request, res: Response) => {
    const { cluster, mes } = req.query as { cluster?: Cluster; mes?: string };
    const rows = await KpiService.getDistribucionPorCluster(cluster, mes);
    res.json(rows);
  }),

  distribucionPorVendedor: asyncHandler(async (req: Request, res: Response) => {
    const { vendedor, retail, mes } = req.query as { vendedor?: string; retail?: Retail; mes?: string };
    const rows = await KpiService.getDistribucionPorVendedor(vendedor, retail, mes);
    res.json(rows);
  }),

  ventasPorVendedor: asyncHandler(async (req: Request, res: Response) => {
    const { vendedor, retail, supervisor, mes } = req.query as {
      vendedor?: string;
      retail?: Retail;
      supervisor?: string;
      mes?: string;
    };
    const rows = await KpiService.getVentasPorVendedor({ vendedor, retail, supervisor, mes });
    res.json(rows);
  }),

  surtido: asyncHandler(async (req: Request, res: Response) => {
    const { cluster, limit, mes } = req.query as { cluster?: Cluster; limit?: number; mes?: string };
    const rows = await KpiService.getSurtido({ cluster, limit, mes });
    res.json(rows);
  }),

  surtidoPorVendedor: asyncHandler(async (req: Request, res: Response) => {
    const { vendedor, mes } = req.query as { vendedor?: string; mes?: string };
    const rows = await KpiService.getSurtidoPorVendedor(vendedor, mes);
    res.json(rows);
  }),

  surtidoPorCluster: asyncHandler(async (req: Request, res: Response) => {
    const { mes } = req.query as { mes?: string };
    const rows = await KpiService.getSurtidoPorCluster(mes);
    res.json(rows);
  }),

  clientesNoVisitados: asyncHandler(async (req: Request, res: Response) => {
    const { dias, retail } = req.query as { dias?: number; retail?: Retail };
    const rows = await KpiService.getClientesNoVisitados({ dias, retail });
    res.json(rows);
  }),

  resumen: asyncHandler(async (req: Request, res: Response) => {
    const { mes } = req.query as { mes?: string };
    const resumen = await KpiService.getResumen(mes);
    res.json(resumen);
  }),

  vendedores: asyncHandler(async (_req: Request, res: Response) => {
    const rows = await KpiService.getVendedores();
    res.json(rows);
  }),

  supervisores: asyncHandler(async (_req: Request, res: Response) => {
    const rows = await KpiService.getSupervisores();
    res.json(rows);
  }),

  mesesDisponibles: asyncHandler(async (_req: Request, res: Response) => {
    const meses = await KpiService.getMesesDisponibles();
    res.json(meses);
  }),
};
