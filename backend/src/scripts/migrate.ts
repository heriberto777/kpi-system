import fs from 'fs';
import path from 'path';
import { pgPool } from '../config/database';
import logger from '../config/logger';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function runMigrations(): Promise<void> {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  logger.info(`Encontradas ${files.length} migraciones en ${MIGRATIONS_DIR}`);

  const client = await pgPool.connect();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      logger.info(`Ejecutando migracion: ${file}`);
      await client.query(sql);
      logger.info(`Migracion completada: ${file}`);
    }
    logger.info('Todas las migraciones se ejecutaron correctamente.');
  } catch (error) {
    logger.error('Error ejecutando migraciones', { error });
    throw error;
  } finally {
    client.release();
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
