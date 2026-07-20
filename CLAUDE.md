# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ETL + KPI dashboard for "Inversiones Catelli". Reads sales/client/vendor data read-only from an
MSSQL ERP (`CATELLI` schema + `dbo.cuota`/`dbo.distribuccion`/`dbo.universo_cliente`), transforms and
loads it into a PostgreSQL analytics database, precomputes Distribución/Surtido/Ventas-por-vendedor
KPIs into materialized views, and serves them via a REST API + React dashboard.

```
MSSQL (ERP, read-only)
    │  mssql.service.ts (backend/src/services)
    ▼
staging (stg_*, truncated+reloaded every sync) → dimensions (dim_*) → facts (fact_ventas)
    │
    ▼
materialized views (mv_*) — precalculated KPIs, refreshed by cron
    │
    ▼
Express REST API (JWT) ← React/Vite dashboard
```

Full data model, business formulas (Distribución/Surtido/Cluster), and cron schedule are documented
in `README.md` — read it before making ETL or KPI-formula changes; this file only covers what the
README doesn't (things spread across multiple files, or established but undocumented conventions).

## Commands

### Backend (`backend/`)

```bash
npm run dev                # nodemon + ts-node, watches src/
npm run build               # tsc -p tsconfig.json → dist/
npm start                   # node dist/index.js (run build first)
npm run migrate              # ts-node, runs all migrations (dev)
npm run migrate:docker       # node dist/scripts/migrate.js (prod/container, run build first)
npm run hash-password -- "clave"   # bcrypt hash for ADMIN_PASSWORD_HASH

npm test                     # unit tests (jest.config.js) — pure ETL transform functions only
npm run test:watch
npm run test:integration     # jest.integration.config.js — full ETL pipeline vs real Postgres

# single test file
npx jest src/utils/transformers.test.ts
npx jest --config jest.integration.config.js src/services/etl.service.integration.test.ts

# single test by name
npx jest -t "agrega (SUM) lineas duplicadas"
npx jest --config jest.integration.config.js -t "mv_ventas_por_vendedor"

npx tsc --noEmit              # typecheck without emitting (fast pre-commit check)
```

No linter is configured in this repo (no ESLint/Prettier config, no lint script).

### Frontend (`frontend/`)

```bash
npm run dev        # vite dev server, http://localhost:3000
npm run build       # tsc -b && vite build
npm run preview     # serve the production build locally
```

No test suite exists for the frontend.

### Local stack (dev)

```bash
docker compose up -d postgres adminer   # Postgres 15 + Adminer only
cd backend && npm run migrate           # creates schema/views against it
```

`docker-compose.yml` (root) is the **dev** stack (bundles a local Postgres). `docker-compose.prod.yml`
is a **separate, unrelated** file for production (no local Postgres — connects to an external
`POSTGRES_HOST`; frontend served via nginx reverse-proxying `/api/`, see `frontend/Dockerfile.prod` +
`frontend/nginx.conf`). Don't conflate the two — they intentionally diverge in architecture (prod
splits `build-and-push` in GitHub's cloud runners from `deploy`, which runs on a **self-hosted
runner installed on the production app server itself** (`runs-on: self-hosted` in
`.github/workflows/deploy.yml`), because the prod server has a private IP unreachable by GitHub's
cloud runners — there is no SSH step in the deploy job).

## Integration tests: how they work

`etl.service.integration.test.ts` mocks `MssqlService` (`jest.mock('./mssql.service')`) but runs the
**entire rest of the pipeline for real** against an isolated Postgres database
(`kpi_analytics_test`, created automatically by `src/test/globalSetup.integration.js`, which also
runs every file in `src/migrations/` against it — never touches the dev/prod database). A `beforeAll`
seeds fixed fixtures (`CLIENTES`, `FACTURAS`, `CUOTA`, etc. near the top of the file), runs
`ETLService.syncClientes/syncArticulos/syncVentas/calcularKpis` once, and most `it()` blocks just
assert against the resulting materialized views. Tests that need a *different* database state
(e.g. simulating a second out-of-sync ETL run) insert/mutate rows directly with `pgPool.query(...)`
and call `REFRESH MATERIALIZED VIEW ...` inline, then clean up after themselves at the end of that
same `it()` — they do not get their own fixture set.

When adding a materialized-view formula change, add or adjust an assertion in this file; the numeric
expectations in the file (e.g. "venta_bruta = 970") are hand-derived from the fixtures in comments —
match that style rather than asserting opaque numbers.

## Migrations (`backend/src/migrations/*.sql`)

Numbered, run in filename order (`001_...` .. `013_...` currently). **The runner keeps no record of
what's already applied** (`scripts/migrate.ts` just re-executes every `.sql` file every time) — every
migration must be idempotent (`CREATE TABLE IF NOT EXISTS`, `DROP ... CASCADE` + `CREATE` for views,
`ON CONFLICT` for seed inserts). This also means **migration order encodes real dependencies**: a
migration that references a table must be numbered after the migration that creates it (a real bug
this session: a view referencing `dim_subcategoria_config` was numbered before the migration that
created that table — worked in dev because the table already existed from a prior run, broke in CI
against a fresh database). If you rename/renumber a migration file, grep the whole `migrations/`
directory for stale references to its old filename in comments.

Materialized views live in `006_create_dia_no_laborable.sql` (the `fecha_referencia_ventas()` /
`dias_laborables_*()` SQL functions) and `008_create_materialized_views.sql` (everything else,
including `mv_ventas_por_vendedor`, the most complex one — see below).

## Vendedor identity resolution (the subtle part)

A recurring source of real bugs this session: "which vendedor does this cuota/sale belong to" is
**not** a single lookup. Three different identity spaces exist and get conflated easily:

- `dim_vendedor.codigo_vendedor` — the real ERP employee code (`CATELLI.VENDEDOR.VENDEDOR`).
- `dim_vendedor.al_vendedor` — resolves special delivery-route pseudo-codes (`MC1`/`MD1`/`WC1`/`WD1`,
  derived from `CATELLI.CLIENTE.U_SEMANA`) to the real employee who services that route. These
  pseudo-codes **never** appear as `CATELLI.VENDEDOR.VENDEDOR` rows, so joining only on
  `codigo_vendedor` silently drops any cuota/venta recorded under a route code.
- `fact_ventas.vendedor` — always the raw real employee code (from `dim_clientes.vendedor_asignado`
  = `C.VENDEDOR`), never a route pseudo-code, even for a sale to a client on a special route.
- `dim_cuota_vendedor.vendedor` (from `dbo.cuota`) — can be *either* a real code or a route
  pseudo-code, and isn't necessarily in the same retail as that vendor's "home" `dim_vendedor` row
  (a real vendor can have an off-territory sale/cuota in a retail where they have no `dim_vendedor`
  row at all).

`mv_ventas_por_vendedor` resolves cuota and ventas **independently** (`cuota_resuelta`/
`ventas_resuelta` CTEs, matching by code only — real code *or* `al_vendedor`, **without** requiring
retail to match), `FULL OUTER JOIN`s them, then folds any resulting zero-cuota "stray" row into the
vendor's highest-cuota row (`retail_principal` CTE) so a vendor doesn't appear as multiple near-empty
rows in the report. A cuota/sale code that resolves to no known vendor at all shows up as a synthetic
`"Sin vendedor asignado / Casa"` row rather than being silently dropped. Read the comments inline in
that view before changing it — this shape exists because every simpler version lost real money from
the report in a way that only showed up against production data, not the test fixtures.

## Backend layering

`routes/*.routes.ts` (express-validator validators + `authMiddleware`) → `controllers/*.controller.ts`
(thin, req/res only) → `services/*.service.ts` (business logic, exported as a plain object of
methods, e.g. `export const KpiService = { ... }` — not classes) → `pgPool`/`getMssqlPool()` from
`config/database.ts`. `PostgresqlService.query()` is a thin wrapper other services use instead of
importing `pgPool` directly.

`config/database.ts` registers global `pg` type parsers for OID 20 (bigint) and 1700
(numeric) so `COUNT(*)`/`ROUND(...)`/`NUMERIC` columns come back as JS `number`, not strings —
relevant if you ever see a raw query elsewhere returning stringified numbers, it means it bypassed
this pool.

Auth: single hardcoded admin user (`ADMIN_USER`/`ADMIN_PASSWORD_HASH` env vars, bcrypt), JWT bearer
token, `authMiddleware` guards every route under `/api/etl`, `/api/kpi`, `/api/config`. There is no
user table / multi-user support.

## Frontend structure

Atomic Design (`components/atomos|moleculas|organismos|templates`), React Context for global state
(`AuthContext`, `ETLContext`, `KPIContext`), custom hooks (`useAuth`, `useETLSync`, `useKPIData`,
`useSyncStatus`). Pages (`pages/`): `Dashboard`, `KPIs`, `Logs`, `Parametros`, `Settings`, `Login`.
`Parametros` is the admin UI for the business-editable config that feeds the KPI formulas (umbrales
de distribución, subcategorías activas, surtido obligatorio, días no laborables) — it's backed by
`/api/config/*`, a separate route group from `/api/kpi/*` (read-only KPI data) and `/api/etl/*`
(sync status/logs/manual trigger). After any edit under Parametros, the frontend calls
`configApi.refrescarVistas()` — materialized views do not auto-refresh on data change, only on the
`refresh_views` cron job or this explicit call.

Backend and frontend each keep their own parallel `types/` — not a shared/monorepo package. When you
add a field to a materialized view or API response, update both `backend/src/types/*.types.ts` and
`frontend/src/types/index.ts` by hand.
