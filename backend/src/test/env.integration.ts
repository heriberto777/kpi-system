// Se ejecuta ANTES de que cualquier archivo de test importe config/database.ts,
// para que el pool de PostgreSQL apunte a la base de pruebas aislada, nunca a la real.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD_HASH = '';
process.env.CRON_ENABLED = 'false';

process.env.POSTGRES_HOST = process.env.POSTGRES_HOST ?? 'localhost';
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT ?? '5432';
process.env.POSTGRES_USER = process.env.POSTGRES_USER ?? 'postgres';
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD ?? 'postgres';
// Base de datos DEDICADA para pruebas de integracion: nunca la misma que usa
// docker-compose para la demo/produccion (POSTGRES_DATABASE=kpi_analytics).
process.env.POSTGRES_DATABASE = process.env.TEST_POSTGRES_DATABASE ?? 'kpi_analytics_test';

// Las pruebas de integracion no requieren MSSQL real (se mockea MssqlService),
// pero env.ts no exige estas variables (son opcionales con default '').
