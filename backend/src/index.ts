import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env';
import logger from './config/logger';
import { checkMssqlConnection, checkPostgresConnection, closeAllConnections } from './config/database';
import { initCronJobs } from './config/cron';
import { requestLogger } from './middleware/logging.middleware';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start(): Promise<void> {
  logger.info(`Iniciando servidor en modo ${env.nodeEnv}...`);

  const postgresOk = await checkPostgresConnection();
  if (!postgresOk) {
    logger.error('No se pudo establecer conexion inicial con PostgreSQL. Verifique la configuracion.');
  }

  const mssqlOk = await checkMssqlConnection();
  if (!mssqlOk) {
    logger.warn('No se pudo establecer conexion inicial con MSSQL (ERP). Los cron jobs de ETL fallaran hasta que se restablezca.');
  }

  await initCronJobs();

  const server = app.listen(env.port, () => {
    logger.info(`Servidor escuchando en http://localhost:${env.port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Señal ${signal} recibida, cerrando servidor...`);
    server.close(async () => {
      await closeAllConnections();
      logger.info('Servidor cerrado correctamente.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
});

start().catch((error) => {
  logger.error('Error fatal al iniciar el servidor', { error });
  process.exit(1);
});

export default app;
