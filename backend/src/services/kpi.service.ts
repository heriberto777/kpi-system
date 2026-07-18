import { PostgresqlService } from './postgresql.service';
import {
  ClienteNoVisitadoRow,
  DistribucionClusterRow,
  DistribucionFilter,
  DistribucionRetailRow,
  DistribucionVendedorRow,
  NoVisitadosFilter,
  ResumenKpiRow,
  Retail,
  SurtidoClienteRow,
  SurtidoClusterRow,
  SurtidoFilter,
  SurtidoVendedorRow,
  VendedorOption,
  VentasVendedorFilter,
  VentasVendedorRow,
} from '../types';

export const KpiService = {
  async getDistribucionPorRetail(filter: DistribucionFilter): Promise<DistribucionRetailRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.retail) {
      conditions.push(`retail = $${idx}`);
      values.push(filter.retail);
      idx += 1;
    }
    if (filter.sku) {
      conditions.push(`subcategoria = $${idx}`);
      values.push(filter.sku);
      idx += 1;
    }
    // Sin "mes" explicito, usa el mas reciente disponible (comportamiento anterior).
    conditions.push(`anno_mes = COALESCE($${idx}, (SELECT MAX(anno_mes) FROM mv_distribucion_por_retail))`);
    values.push(filter.mes ?? null);
    idx += 1;

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await PostgresqlService.query<DistribucionRetailRow>(
      `SELECT * FROM mv_distribucion_por_retail ${where} ORDER BY retail, subcategoria`,
      values
    );
    return result.rows;
  },

  async getDistribucionPorCluster(cluster?: string, mes?: string): Promise<DistribucionClusterRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (cluster) {
      conditions.push(`u_cluster = $${idx}`);
      values.push(cluster);
      idx += 1;
    }
    // Sin "mes" explicito, usa el mas reciente disponible.
    conditions.push(`anno_mes = COALESCE($${idx}, (SELECT MAX(anno_mes) FROM mv_distribucion_por_cluster))`);
    values.push(mes ?? null);
    idx += 1;

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await PostgresqlService.query<DistribucionClusterRow>(
      `SELECT * FROM mv_distribucion_por_cluster ${where} ORDER BY u_cluster, subcategoria`,
      values
    );
    return result.rows;
  },

  async getDistribucionPorVendedor(vendedor?: string, retail?: Retail, mes?: string): Promise<DistribucionVendedorRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (vendedor) {
      conditions.push(`vendedor = $${idx}`);
      values.push(vendedor);
      idx += 1;
    }
    if (retail) {
      conditions.push(`retail = $${idx}`);
      values.push(retail);
      idx += 1;
    }
    // Sin "mes" explicito, usa el mas reciente disponible (comportamiento anterior).
    conditions.push(`anno_mes = COALESCE($${idx}, (SELECT MAX(anno_mes) FROM mv_distribucion_por_vendedor))`);
    values.push(mes ?? null);
    idx += 1;

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await PostgresqlService.query<DistribucionVendedorRow>(
      // NULLS LAST: por defecto Postgres pone los NULL primero en ORDER BY ... DESC, lo que
      // sacaria a los vendedores con 0 clientes asignados (distribucion_porcentaje = NULL por
      // division entre cero) al tope de la lista en vez de los mejores desempeños.
      `SELECT * FROM mv_distribucion_por_vendedor ${where} ORDER BY distribucion_porcentaje DESC NULLS LAST`,
      values
    );
    return result.rows;
  },

  async getVentasPorVendedor(filter: VentasVendedorFilter): Promise<VentasVendedorRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.vendedor) {
      conditions.push(`vendedor = $${idx}`);
      values.push(filter.vendedor);
      idx += 1;
    }
    if (filter.retail) {
      conditions.push(`retail = $${idx}`);
      values.push(filter.retail);
      idx += 1;
    }
    if (filter.supervisor) {
      conditions.push(`supervisor = $${idx}`);
      values.push(filter.supervisor);
      idx += 1;
    }
    conditions.push(`anno_mes = COALESCE($${idx}, (SELECT MAX(anno_mes) FROM mv_ventas_por_vendedor))`);
    values.push(filter.mes ?? null);
    idx += 1;

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await PostgresqlService.query<VentasVendedorRow>(
      `SELECT * FROM mv_ventas_por_vendedor ${where} ORDER BY alcance_porcentaje DESC NULLS LAST`,
      values
    );
    return result.rows;
  },

  async getSurtido(filter: SurtidoFilter): Promise<SurtidoClienteRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.cluster) {
      conditions.push(`u_cluster = $${idx}`);
      values.push(filter.cluster);
      idx += 1;
    }
    // Sin "mes" explicito, usa el mas reciente disponible.
    conditions.push(`anno_mes = COALESCE($${idx}, (SELECT MAX(anno_mes) FROM mv_surtido_por_cliente))`);
    values.push(filter.mes ?? null);
    idx += 1;

    const where = `WHERE ${conditions.join(' AND ')}`;
    values.push(filter.limit ?? 100);

    const result = await PostgresqlService.query<SurtidoClienteRow>(
      `SELECT * FROM mv_surtido_por_cliente ${where} ORDER BY u_cluster DESC, surtido_porcentaje ASC LIMIT $${idx}`,
      values
    );
    return result.rows;
  },

  async getSurtidoPorVendedor(vendedor?: string, mes?: string): Promise<SurtidoVendedorRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (vendedor) {
      conditions.push(`vendedor = $${idx}`);
      values.push(vendedor);
      idx += 1;
    }
    conditions.push(`anno_mes = COALESCE($${idx}, (SELECT MAX(anno_mes) FROM mv_surtido_por_vendedor))`);
    values.push(mes ?? null);
    idx += 1;

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await PostgresqlService.query<SurtidoVendedorRow>(
      `SELECT * FROM mv_surtido_por_vendedor ${where} ORDER BY u_cluster, surtido_porcentaje ASC`,
      values
    );
    return result.rows;
  },

  async getSurtidoPorCluster(mes?: string): Promise<SurtidoClusterRow[]> {
    const result = await PostgresqlService.query<SurtidoClusterRow>(
      `SELECT * FROM mv_surtido_por_cluster
        WHERE anno_mes = COALESCE($1, (SELECT MAX(anno_mes) FROM mv_surtido_por_cluster))
        ORDER BY u_cluster`,
      [mes ?? null]
    );
    return result.rows;
  },

  async getClientesNoVisitados(filter: NoVisitadosFilter): Promise<ClienteNoVisitadoRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const diasMinimo = filter.dias ?? 15;
    conditions.push(`(dias_sin_compra IS NULL OR dias_sin_compra >= $${idx})`);
    values.push(diasMinimo);
    idx += 1;

    if (filter.retail) {
      conditions.push(`retail = $${idx}`);
      values.push(filter.retail);
      idx += 1;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await PostgresqlService.query<ClienteNoVisitadoRow>(
      `SELECT * FROM mv_clientes_no_visitados ${where} ORDER BY ultima_compra ASC NULLS FIRST`,
      values
    );
    return result.rows;
  },

  async getResumen(mes?: string): Promise<ResumenKpiRow | null> {
    const result = await PostgresqlService.query<ResumenKpiRow>(
      `SELECT * FROM mv_resumen_kpi_general
        WHERE anno_mes = COALESCE($1, (SELECT MAX(anno_mes) FROM mv_resumen_kpi_general))`,
      [mes ?? null]
    );
    return result.rows[0] ?? null;
  },

  async getMesesDisponibles(): Promise<string[]> {
    const result = await PostgresqlService.query<{ anno_mes: string }>(
      `SELECT DISTINCT anno_mes FROM dim_objetivos_distribucion ORDER BY anno_mes DESC`
    );
    return result.rows.map((r) => r.anno_mes);
  },

  async getVendedores(): Promise<VendedorOption[]> {
    const result = await PostgresqlService.query<VendedorOption>(
      `SELECT codigo_vendedor, MAX(nombre_vendedor) AS nombre_vendedor
       FROM dim_vendedor
       WHERE estado = 'Activo'
       GROUP BY codigo_vendedor
       ORDER BY MAX(nombre_vendedor)`
    );
    return result.rows;
  },

  async getSupervisores(): Promise<string[]> {
    const result = await PostgresqlService.query<{ vendedor_supervisor: string }>(
      `SELECT DISTINCT vendedor_supervisor
       FROM dim_vendedor
       WHERE estado = 'Activo' AND vendedor_supervisor IS NOT NULL AND vendedor_supervisor <> ''
       ORDER BY vendedor_supervisor`
    );
    return result.rows.map((r) => r.vendedor_supervisor);
  },
};
