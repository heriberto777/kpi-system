import { PostgresqlService } from './postgresql.service';
import { AppError } from '../utils/AppError';
import {
  CriterioDistribucionRow,
  CuotaVendedorConfigRow,
  DiaNoLaborableRow,
  ObjetivoDistribucionConfigRow,
  Retail,
  ResumenDiasLaborablesRow,
  SubcategoriaConfigRow,
  SurtidoObligatorioRow,
  UniversoClienteConfigRow,
} from '../types';

export const ConfigService = {
  // ============================================
  // UMBRALES (dim_criterios_distribucion) - editable
  // ============================================
  async getCriteriosDistribucion(): Promise<CriterioDistribucionRow[]> {
    const result = await PostgresqlService.query<CriterioDistribucionRow>(
      `SELECT id, retail, minimo_compras, periodo_dias FROM dim_criterios_distribucion ORDER BY retail`
    );
    return result.rows;
  },

  async updateCriterioDistribucion(
    retail: Retail,
    datos: { minimo_compras: number; periodo_dias: number }
  ): Promise<CriterioDistribucionRow> {
    const result = await PostgresqlService.query<CriterioDistribucionRow>(
      `UPDATE dim_criterios_distribucion
          SET minimo_compras = $2, periodo_dias = $3
        WHERE retail = $1
        RETURNING id, retail, minimo_compras, periodo_dias`,
      [retail, datos.minimo_compras, datos.periodo_dias]
    );
    if (result.rows.length === 0) {
      throw new AppError(`No existe un criterio de distribucion para el retail "${retail}"`, 404);
    }
    return result.rows[0];
  },

  // ============================================
  // SUBCATEGORIAS ACTIVAS (dim_subcategoria_config) - editable
  // ============================================
  async getSubcategorias(): Promise<SubcategoriaConfigRow[]> {
    const result = await PostgresqlService.query<SubcategoriaConfigRow>(
      `SELECT clasificacion_2, descripcion, activo, fecha_actualizacion
         FROM dim_subcategoria_config
        ORDER BY clasificacion_2`
    );
    return result.rows;
  },

  async setSubcategoriaActiva(clasificacion2: string, activo: boolean): Promise<SubcategoriaConfigRow> {
    const result = await PostgresqlService.query<SubcategoriaConfigRow>(
      `INSERT INTO dim_subcategoria_config (clasificacion_2, activo)
       VALUES ($1, $2)
       ON CONFLICT (clasificacion_2) DO UPDATE SET
           activo = EXCLUDED.activo,
           fecha_actualizacion = CURRENT_TIMESTAMP
       RETURNING clasificacion_2, descripcion, activo, fecha_actualizacion`,
      [clasificacion2, activo]
    );
    // Aplica de inmediato a los meses/retail ya sincronizados (no solo a los futuros).
    await PostgresqlService.query(`UPDATE dim_objetivos_distribucion SET activo = $2 WHERE clasificacion_2 = $1`, [
      clasificacion2,
      activo,
    ]);
    return result.rows[0];
  },

  // ============================================
  // SURTIDO OBLIGATORIO (dim_surtido_obligatorio) - editable
  // ============================================
  async getSurtidoObligatorio(): Promise<SurtidoObligatorioRow[]> {
    const result = await PostgresqlService.query<SurtidoObligatorioRow>(
      `SELECT id_surtido, u_cluster, u_surtido_n, cantidad_articulos, es_obligatorio
         FROM dim_surtido_obligatorio
        ORDER BY u_cluster, u_surtido_n`
    );
    return result.rows;
  },

  async updateSurtidoObligatorio(
    idSurtido: number,
    datos: { es_obligatorio: boolean; cantidad_articulos: number | null }
  ): Promise<SurtidoObligatorioRow> {
    const result = await PostgresqlService.query<SurtidoObligatorioRow>(
      `UPDATE dim_surtido_obligatorio
          SET es_obligatorio = $2, cantidad_articulos = $3
        WHERE id_surtido = $1
        RETURNING id_surtido, u_cluster, u_surtido_n, cantidad_articulos, es_obligatorio`,
      [idSurtido, datos.es_obligatorio, datos.cantidad_articulos]
    );
    if (result.rows.length === 0) {
      throw new AppError(`No existe un grupo de surtido con id ${idSurtido}`, 404);
    }
    return result.rows[0];
  },

  // ============================================
  // OBJETIVOS DE DISTRIBUCION (dim_objetivos_distribucion) - solo lectura, viene del ERP
  // ============================================
  async getObjetivosDistribucion(mes?: string): Promise<ObjetivoDistribucionConfigRow[]> {
    const result = await PostgresqlService.query<ObjetivoDistribucionConfigRow>(
      `SELECT id, anno_mes, retail, clasificacion_2, objetivo_clientes, objetivo_monto, activo
         FROM dim_objetivos_distribucion
        WHERE anno_mes = COALESCE($1, (SELECT MAX(anno_mes) FROM dim_objetivos_distribucion))
        ORDER BY retail, clasificacion_2`,
      [mes ?? null]
    );
    return result.rows;
  },

  // ============================================
  // UNIVERSO DE CLIENTES (dim_universo_cliente) - solo lectura, viene del ERP
  // ============================================
  async getUniversoCliente(mes?: string): Promise<UniversoClienteConfigRow[]> {
    const result = await PostgresqlService.query<UniversoClienteConfigRow>(
      `SELECT id, anno_mes, retail, universo
         FROM dim_universo_cliente
        WHERE anno_mes = COALESCE($1, (SELECT MAX(anno_mes) FROM dim_universo_cliente))
        ORDER BY retail`,
      [mes ?? null]
    );
    return result.rows;
  },

  // ============================================
  // CUOTA $ POR VENDEDOR (dim_cuota_vendedor) - solo lectura, viene del ERP (dbo.cuota)
  // ============================================
  async getCuotaVendedor(mes?: string): Promise<CuotaVendedorConfigRow[]> {
    const result = await PostgresqlService.query<CuotaVendedorConfigRow>(
      `SELECT id, anno_mes, vendedor, retail, clasificacion_2, cuota_monto
         FROM dim_cuota_vendedor
        WHERE anno_mes = COALESCE($1, (SELECT MAX(anno_mes) FROM dim_cuota_vendedor))
        ORDER BY vendedor, retail, clasificacion_2`,
      [mes ?? null]
    );
    return result.rows;
  },

  // ============================================
  // DIAS NO LABORABLES (dim_dia_no_laborable) - editable
  // Feriados/dias sin venta curados a mano; alimentan dias_laborables_mes() y
  // dias_laborables_transcurridos() (migracion 006), usadas por mv_ventas_por_vendedor.
  // ============================================
  async getDiasNoLaborables(mes?: string): Promise<DiaNoLaborableRow[]> {
    const result = await PostgresqlService.query<DiaNoLaborableRow>(
      `SELECT fecha, descripcion
         FROM dim_dia_no_laborable
        WHERE $1::VARCHAR IS NULL OR TO_CHAR(fecha, 'YYYY-MM') = $1
        ORDER BY fecha`,
      [mes ?? null]
    );
    return result.rows;
  },

  async addDiaNoLaborable(fecha: string, descripcion: string | null): Promise<DiaNoLaborableRow> {
    const result = await PostgresqlService.query<DiaNoLaborableRow>(
      `INSERT INTO dim_dia_no_laborable (fecha, descripcion)
       VALUES ($1, $2)
       ON CONFLICT (fecha) DO UPDATE SET descripcion = EXCLUDED.descripcion
       RETURNING fecha, descripcion`,
      [fecha, descripcion]
    );
    return result.rows[0];
  },

  async deleteDiaNoLaborable(fecha: string): Promise<void> {
    await PostgresqlService.query(`DELETE FROM dim_dia_no_laborable WHERE fecha = $1`, [fecha]);
  },

  async getResumenDiasLaborables(mes?: string): Promise<ResumenDiasLaborablesRow> {
    const annoMes = mes ?? new Date().toISOString().slice(0, 7);
    const result = await PostgresqlService.query<{ dias_laborables_mes: number; dias_laborables_transcurridos: number }>(
      `SELECT dias_laborables_mes($1) AS dias_laborables_mes, dias_laborables_transcurridos($1) AS dias_laborables_transcurridos`,
      [annoMes]
    );
    return { anno_mes: annoMes, ...result.rows[0] };
  },

  // ============================================
  // Refrescar vistas materializadas bajo demanda (sin resync completo del ERP)
  // ============================================
  async refrescarVistas(): Promise<void> {
    await PostgresqlService.refreshMaterializedViews();
  },
};
