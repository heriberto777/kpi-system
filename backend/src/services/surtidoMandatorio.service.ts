import { PostgresqlService } from './postgresql.service';
import { AppError } from '../utils/AppError';
import {
  ConfigSurtidoMandatorioRow,
  ObjetivoSurtidoMandatorioRow,
  PosicionSurtidoMandatorioRow,
  SurtidoMandatorioClienteFilter,
  SurtidoMandatorioClienteRow,
  SurtidoMandatorioCoberturaFilter,
  SurtidoMandatorioCoberturaRow,
  SurtidoMandatorioResumenFilter,
  SurtidoMandatorioResumenVendedorRow,
} from '../types';

export const SurtidoMandatorioService = {
  // ============================================
  // LECTURA (mv_surtido_mandatorio_*)
  // ============================================
  async getResumenPorVendedor(filter: SurtidoMandatorioResumenFilter): Promise<SurtidoMandatorioResumenVendedorRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.vendedor) {
      conditions.push(`vendedor = $${idx}`);
      values.push(filter.vendedor);
      idx += 1;
    }
    // Sin "mes" explicito, usa el mas reciente disponible.
    conditions.push(`anno_mes = COALESCE($${idx}, (SELECT MAX(anno_mes) FROM mv_surtido_mandatorio_resumen_vendedor))`);
    values.push(filter.mes ?? null);
    idx += 1;

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await PostgresqlService.query<SurtidoMandatorioResumenVendedorRow>(
      `SELECT * FROM mv_surtido_mandatorio_resumen_vendedor ${where} ORDER BY logro_porcentaje ASC NULLS LAST`,
      values
    );
    return result.rows;
  },

  async getCoberturaPorVendedor(filter: SurtidoMandatorioCoberturaFilter): Promise<SurtidoMandatorioCoberturaRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.vendedor) {
      conditions.push(`vendedor = $${idx}`);
      values.push(filter.vendedor);
      idx += 1;
    }
    if (filter.cluster) {
      conditions.push(`u_cluster = $${idx}`);
      values.push(filter.cluster);
      idx += 1;
    }
    conditions.push(`anno_mes = COALESCE($${idx}, (SELECT MAX(anno_mes) FROM mv_surtido_mandatorio_cobertura_vendedor))`);
    values.push(filter.mes ?? null);
    idx += 1;

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await PostgresqlService.query<SurtidoMandatorioCoberturaRow>(
      `SELECT * FROM mv_surtido_mandatorio_cobertura_vendedor ${where} ORDER BY vendedor, u_cluster`,
      values
    );
    return result.rows;
  },

  async getDetallePorCliente(filter: SurtidoMandatorioClienteFilter): Promise<SurtidoMandatorioClienteRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.vendedor) {
      conditions.push(`vendedor = $${idx}`);
      values.push(filter.vendedor);
      idx += 1;
    }
    if (filter.cluster) {
      conditions.push(`u_cluster = $${idx}`);
      values.push(filter.cluster);
      idx += 1;
    }
    conditions.push(`anno_mes = COALESCE($${idx}, (SELECT MAX(anno_mes) FROM mv_surtido_mandatorio_cliente))`);
    values.push(filter.mes ?? null);
    idx += 1;

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await PostgresqlService.query<SurtidoMandatorioClienteRow>(
      `SELECT * FROM mv_surtido_mandatorio_cliente ${where} ORDER BY posiciones_activas ASC`,
      values
    );
    return result.rows;
  },

  // ============================================
  // POSICIONES OBLIGATORIAS (dim_surtido_mandatorio_posicion) - editable
  // Tabla arranca vacia (curaduria de negocio, no se siembra): usa upsert, no solo UPDATE,
  // porque el admin tiene que poder CREAR combinaciones posicion+cluster nuevas.
  // ============================================
  async getPosiciones(): Promise<PosicionSurtidoMandatorioRow[]> {
    const result = await PostgresqlService.query<PosicionSurtidoMandatorioRow>(
      `SELECT id, posicion_surtido, u_cluster, es_obligatorio
         FROM dim_surtido_mandatorio_posicion
        ORDER BY u_cluster, posicion_surtido`
    );
    return result.rows;
  },

  async setPosicion(
    posicionSurtido: number,
    uCluster: string,
    esObligatorio: boolean
  ): Promise<PosicionSurtidoMandatorioRow> {
    const result = await PostgresqlService.query<PosicionSurtidoMandatorioRow>(
      `INSERT INTO dim_surtido_mandatorio_posicion (posicion_surtido, u_cluster, es_obligatorio)
       VALUES ($1, $2, $3)
       ON CONFLICT (posicion_surtido, u_cluster) DO UPDATE SET
           es_obligatorio = EXCLUDED.es_obligatorio
       RETURNING id, posicion_surtido, u_cluster, es_obligatorio`,
      [posicionSurtido, uCluster, esObligatorio]
    );
    return result.rows[0];
  },

  async deletePosicion(id: number): Promise<void> {
    const result = await PostgresqlService.query(`DELETE FROM dim_surtido_mandatorio_posicion WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      throw new AppError(`No existe una posicion de surtido mandatorio con id ${id}`, 404);
    }
  },

  // ============================================
  // OBJETIVOS POR CLUSTER (dim_objetivo_surtido_mandatorio) - editable
  // ============================================
  async getObjetivos(): Promise<ObjetivoSurtidoMandatorioRow[]> {
    const result = await PostgresqlService.query<ObjetivoSurtidoMandatorioRow>(
      `SELECT u_cluster, base_objetivo, colocaciones_meta
         FROM dim_objetivo_surtido_mandatorio
        ORDER BY u_cluster`
    );
    return result.rows;
  },

  async updateObjetivo(
    uCluster: string,
    datos: { base_objetivo: number; colocaciones_meta: number }
  ): Promise<ObjetivoSurtidoMandatorioRow> {
    const result = await PostgresqlService.query<ObjetivoSurtidoMandatorioRow>(
      `UPDATE dim_objetivo_surtido_mandatorio
          SET base_objetivo = $2, colocaciones_meta = $3
        WHERE u_cluster = $1
        RETURNING u_cluster, base_objetivo, colocaciones_meta`,
      [uCluster, datos.base_objetivo, datos.colocaciones_meta]
    );
    if (result.rows.length === 0) {
      throw new AppError(`No existe un objetivo de surtido mandatorio para el cluster "${uCluster}"`, 404);
    }
    return result.rows[0];
  },

  // ============================================
  // CONFIG GLOBAL (dim_config_surtido_mandatorio, fila unica) - editable
  // ============================================
  async getConfigClienteActivo(): Promise<ConfigSurtidoMandatorioRow> {
    const result = await PostgresqlService.query<ConfigSurtidoMandatorioRow>(
      `SELECT cliente_activo_minimo FROM dim_config_surtido_mandatorio WHERE id = 1`
    );
    return result.rows[0];
  },

  async updateConfigClienteActivo(clienteActivoMinimo: number): Promise<ConfigSurtidoMandatorioRow> {
    const result = await PostgresqlService.query<ConfigSurtidoMandatorioRow>(
      `UPDATE dim_config_surtido_mandatorio SET cliente_activo_minimo = $1 WHERE id = 1
       RETURNING cliente_activo_minimo`,
      [clienteActivoMinimo]
    );
    return result.rows[0];
  },
};
