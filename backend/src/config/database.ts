import sql from 'mssql';
import { Pool, types as pgTypes } from 'pg';
import { env } from './env';
import logger from './logger';

// ============================================
// node-postgres devuelve BIGINT (OID 20, p.ej. COUNT(*)) y NUMERIC/DECIMAL
// (OID 1700, p.ej. ROUND(...) o columnas NUMERIC) como strings por defecto,
// para evitar perdida de precision. Nuestros valores (conteos de clientes,
// porcentajes) nunca se acercan a los limites de precision de un float64,
// asi que los parseamos a number para que el resto del backend/frontend
// pueda operar sobre ellos (sumas, .toFixed, etc.) sin sorpresas.
// ============================================
pgTypes.setTypeParser(20, (value) => parseInt(value, 10)); // int8 / bigint
pgTypes.setTypeParser(1700, (value) => parseFloat(value)); // numeric / decimal

// ============================================
// PostgreSQL (Analytics) - pool persistente
// ============================================
export const pgPool = new Pool({
  host: env.postgres.host,
  port: env.postgres.port,
  database: env.postgres.database,
  user: env.postgres.user,
  password: env.postgres.password,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pgPool.on('error', (err) => {
  logger.error('Error inesperado en el pool de PostgreSQL', { error: err.message });
});

export async function checkPostgresConnection(): Promise<boolean> {
  try {
    await pgPool.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('No se pudo conectar a PostgreSQL', { error });
    return false;
  }
}

// ============================================
// MSSQL (ERP - Produccion, solo lectura)
// ============================================
const mssqlConfig: sql.config = {
  server: env.mssql.server,
  port: env.mssql.port,
  database: env.mssql.database,
  user: env.mssql.user,
  password: env.mssql.password,
  options: {
    encrypt: env.mssql.encrypt,
    trustServerCertificate: env.mssql.trustServerCertificate,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  requestTimeout: 120000,
  connectionTimeout: 30000,
};

let mssqlPool: sql.ConnectionPool | null = null;

export async function getMssqlPool(): Promise<sql.ConnectionPool> {
  if (mssqlPool && mssqlPool.connected) {
    return mssqlPool;
  }
  mssqlPool = await new sql.ConnectionPool(mssqlConfig).connect();
  mssqlPool.on('error', (err) => {
    logger.error('Error inesperado en el pool de MSSQL', { error: err.message });
  });
  return mssqlPool;
}

export async function checkMssqlConnection(): Promise<boolean> {
  try {
    const pool = await getMssqlPool();
    await pool.request().query('SELECT 1 AS ok');
    return true;
  } catch (error) {
    logger.error('No se pudo conectar a MSSQL', { error });
    return false;
  }
}

export async function closeAllConnections(): Promise<void> {
  await pgPool.end();
  if (mssqlPool) {
    await mssqlPool.close();
  }
}
