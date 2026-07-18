// Global setup de Jest (JS plano, sin ts-jest) para las pruebas de integracion:
// 1. Crea la base de datos de pruebas si no existe (kpi_analytics_test por defecto).
// 2. Ejecuta todas las migraciones contra ella.
// Nunca toca la base de datos real (kpi_analytics) usada por docker-compose.
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const HOST = process.env.POSTGRES_HOST || 'localhost';
const PORT = Number(process.env.POSTGRES_PORT || 5432);
const USER = process.env.POSTGRES_USER || 'postgres';
const PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
const TEST_DB = process.env.TEST_POSTGRES_DATABASE || 'kpi_analytics_test';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

module.exports = async function globalSetup() {
  const maintenanceClient = new Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
  await maintenanceClient.connect();
  try {
    const exists = await maintenanceClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB]);
    if (exists.rowCount === 0) {
      // No se puede parametrizar el nombre de la base en CREATE DATABASE; TEST_DB viene
      // de una variable de entorno controlada, no de input de usuario.
      await maintenanceClient.query(`CREATE DATABASE "${TEST_DB}"`);
    }
  } finally {
    await maintenanceClient.end();
  }

  const testClient = new Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: TEST_DB });
  await testClient.connect();
  try {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      await testClient.query(sql);
    }
  } finally {
    await testClient.end();
  }
};
