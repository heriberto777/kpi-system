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

export const TelegramService = {
  enviarMensaje,

  async enviarResumenDiario(): Promise<void> {
    const result = await PostgresqlService.query<ResumenKpiRow>('SELECT * FROM mv_resumen_kpi_general');
    const resumen = result.rows[0];
    if (!resumen) {
      logger.warn('No hay resumen de KPIs disponible para enviar por Telegram');
      return;
    }

    const texto = [
      '*Resumen diario de KPIs*',
      `Total clientes: ${resumen.total_clientes}`,
      `Clientes activos (30d): ${resumen.clientes_activos_mes}`,
      `Surtido promedio: ${resumen.surtido_promedio}%`,
      `Distribucion promedio: ${resumen.distribucion_promedio}%`,
    ].join('\n');

    await enviarMensaje(texto);
    logger.info('Resumen diario enviado por Telegram');
  },
};
