import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Variable de entorno requerida faltante: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '5000'), 10),

  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: parseInt(optional('JWT_EXPIRES_IN', '3600'), 10),

  adminUser: optional('ADMIN_USER', 'admin'),
  adminPasswordHash: optional('ADMIN_PASSWORD_HASH', ''),

  mssql: {
    server: optional('MSSQL_SERVER', ''),
    port: parseInt(optional('MSSQL_PORT', '1433'), 10),
    database: optional('MSSQL_DATABASE', ''),
    user: optional('MSSQL_USER', ''),
    password: optional('MSSQL_PASSWORD', ''),
    encrypt: optional('MSSQL_ENCRYPT', 'true') === 'true',
    trustServerCertificate: optional('MSSQL_TRUST_SERVER_CERTIFICATE', 'false') === 'true',
    // Ventana fija de fechas para sincronizar ventas (YYYY-MM-DD). Si cualquiera de las dos
    // esta vacia, se usa el comportamiento por defecto: "ultimos 60 dias desde hoy".
    // Util para pruebas contra un servidor con datos historicos (p.ej. un replica desactualizado).
    syncFechaDesde: optional('MSSQL_SYNC_FECHA_DESDE', ''),
    syncFechaHasta: optional('MSSQL_SYNC_FECHA_HASTA', ''),
  },

  postgres: {
    host: optional('POSTGRES_HOST', 'localhost'),
    port: parseInt(optional('POSTGRES_PORT', '5432'), 10),
    database: optional('POSTGRES_DATABASE', 'kpi_analytics'),
    user: optional('POSTGRES_USER', 'postgres'),
    password: optional('POSTGRES_PASSWORD', ''),
  },

  logLevel: optional('LOG_LEVEL', 'info'),
  logFormat: optional('LOG_FORMAT', 'json'),

  cronEnabled: optional('CRON_ENABLED', 'true') === 'true',

  telegram: {
    botToken: optional('TELEGRAM_BOT_TOKEN', ''),
    chatId: optional('TELEGRAM_CHAT_ID', ''),
  },

  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:3000'),
};

export const isProduction = env.nodeEnv === 'production';
