# Backend — ETL + API REST de KPIs

Node.js + Express + TypeScript. Ver la documentación completa en el [README raíz](../README.md).

## Comandos

```bash
npm install
cp .env.example .env
npm run hash-password -- "clave-admin"   # genera ADMIN_PASSWORD_HASH
npm run migrate                          # crea tablas, indices, vistas y seeds
npm run dev                              # desarrollo (nodemon + ts-node)
npm run build && npm start               # producción
npm test                                 # jest (unitarios)
npm run test:integration                 # jest contra PostgreSQL real (ver abajo)
```

### Pruebas de integración ETL

`npm run test:integration` ejercita el pipeline completo (staging → upsert → vistas
materializadas) contra una base PostgreSQL **real y aislada** (`kpi_analytics_test` por
defecto, nunca `kpi_analytics`). El ERP MSSQL se mockea (`MssqlService`) con datos fijos.

Requiere un PostgreSQL alcanzable (usa las mismas `POSTGRES_HOST/PORT/USER/PASSWORD` que
`.env`, o corre `docker compose up -d postgres` desde la raíz). La base de pruebas se crea y
migra automáticamente (`globalSetup`); nunca toca la base de datos de producción/demo.

## Estructura

```
src/
├── config/       database.ts, cron.ts, env.ts, logger.ts
├── controllers/  auth, etl, kpi, sync
├── services/     mssql, postgresql, etl, auth, telegram, kpi
├── jobs/         5 cron jobs (sync-*, calcular-kpis, refresh-materialize, telegram-resumen)
├── middleware/   auth, errorHandler, logging
├── utils/        logger, validators, transformers, AppError, asyncHandler
├── types/        tipos compartidos (cliente, etl, kpi)
├── routes/       auth, etl, kpi
├── migrations/   001-008 (staging, dimensiones, hechos, vistas, indices, seeds + incrementales)
├── scripts/      migrate.ts, hash-password.ts
└── index.ts      entry point
```
