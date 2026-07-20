import https from 'https';
import { env } from '../config/env';
import logger from '../config/logger';
import { PostgresqlService } from './postgresql.service';
import { ResumenKpiRow } from '../types';

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
    ].join('\n');

    await enviarMensaje(texto);
    logger.info('Resumen diario enviado por Telegram');
  },
};
