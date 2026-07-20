import https from 'https';
import { env } from '../config/env';
import logger from '../config/logger';
import { PostgresqlService } from './postgresql.service';
import { DistribucionRetailRow, ResumenKpiRow, VentasVendedorRow } from '../types';

const LIMITE_FOCO = 5;

function enviarMensaje(texto: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!env.telegram.botToken || !env.telegram.chatId) {
      logger.debug('Telegram no configurado, se omite el envio');
      resolve();
      return;
    }

    const payload = JSON.stringify({
      chat_id: env.telegram.chatId,
      text: texto,
      parse_mode: 'Markdown',
    });

    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${env.telegram.botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        res.on('data', () => undefined);
        res.on('end', () => resolve());
      }
    );

    req.on('error', (error) => {
      logger.error('Error enviando mensaje a Telegram', { error });
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

function moneda(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `RD$${Math.round(value).toLocaleString('es-DO')}`;
}

function porcentaje(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)}%`;
}

export const TelegramService = {
  enviarMensaje,

  async enviarResumenDiario(): Promise<void> {
    const result = await PostgresqlService.query<ResumenKpiRow>('SELECT * FROM mv_resumen_kpi_general');
    const resumen = result.rows[0];
    if (!resumen) {
      logger.warn('No hay resumen de KPIs disponible para enviar por Telegram');
      return;
    }

    // Mismos campos que las KPICards del Monitor de KPIs en el frontend (KPIMonitor.tsx), para
    // que el resumen de Telegram no quede desactualizado respecto a lo que ve el usuario en la app.
    const texto = [
      `*Resumen diario de KPIs* (Mes: ${resumen.anno_mes ?? '—'})`,
      '',
      `Ventas del mes: ${moneda(resumen.ventas_mes_monto)}`,
      `Cuota del mes: ${moneda(resumen.objetivo_monto_mes)}`,
      `% Logrado vs Cuota: ${porcentaje(resumen.logro_monto_porcentaje)}`,
      `Proyeccion de ventas: ${moneda(resumen.proyeccion_ventas_monto)}`,
      `Dropsize promedio: ${moneda(resumen.dropsize_promedio)}`,
      `Facturas del mes: ${resumen.facturas_mes}`,
      '',
      `Distribucion promedio: ${porcentaje(resumen.distribucion_promedio)}`,
      `Surtido promedio: ${porcentaje(resumen.surtido_promedio)}`,
      '',
      `Clientes activos: ${resumen.clientes_activos_mes} / Total: ${resumen.total_clientes}`,
      `Dias transcurridos: ${resumen.dias_transcurridos_mes} / ${resumen.dias_totales_mes}`,
    ];

    if (resumen.anno_mes) {
      const vendedoresFoco = await PostgresqlService.query<
        Pick<VentasVendedorRow, 'vendedor' | 'nombre_vendedor' | 'retail' | 'alcance_porcentaje' | 'falta'>
      >(
        `SELECT vendedor, nombre_vendedor, retail, alcance_porcentaje, falta
         FROM mv_ventas_por_vendedor
         WHERE anno_mes = $1 AND cuota_monto > 0 AND alcance_porcentaje IS NOT NULL
         ORDER BY alcance_porcentaje ASC
         LIMIT ${LIMITE_FOCO}`,
        [resumen.anno_mes]
      );
      if (vendedoresFoco.rows.length > 0) {
        texto.push('', '*Vendedores con foco en ventas* (menor % logrado):');
        vendedoresFoco.rows.forEach((v, i) => {
          const nombre = v.nombre_vendedor ?? v.vendedor;
          texto.push(`${i + 1}. ${nombre} - ${v.retail}: ${porcentaje(v.alcance_porcentaje)} (falta ${moneda(v.falta)})`);
        });
      }

      const subcategoriasFoco = await PostgresqlService.query<
        Pick<DistribucionRetailRow, 'retail' | 'subcategoria' | 'logro_porcentaje' | 'restan'>
      >(
        `SELECT retail, subcategoria, logro_porcentaje, restan
         FROM mv_distribucion_por_retail
         WHERE anno_mes = $1 AND objetivo_clientes > 0 AND logro_porcentaje IS NOT NULL
         ORDER BY logro_porcentaje ASC
         LIMIT ${LIMITE_FOCO}`,
        [resumen.anno_mes]
      );
      if (subcategoriasFoco.rows.length > 0) {
        texto.push('', '*Subcategorias con foco en distribucion* (menor % de logro):');
        subcategoriasFoco.rows.forEach((s, i) => {
          texto.push(`${i + 1}. ${s.subcategoria} - ${s.retail}: ${porcentaje(s.logro_porcentaje)} (faltan ${s.restan} clientes)`);
        });
      }
    }

    await enviarMensaje(texto.join('\n'));
    logger.info('Resumen diario enviado por Telegram');
  },
};
