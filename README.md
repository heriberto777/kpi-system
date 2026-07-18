# Sistema ETL de KPIs de Ventas y Distribución — Inversiones Catelli

Aplicación full-stack que automatiza la extracción diaria de datos del ERP (MSSQL), los transforma
y carga en una base de datos analítica (PostgreSQL), calcula KPIs de **Distribución** y **Surtido**
de productos por cliente, vendedor y cluster, y los expone mediante un dashboard React y una API REST.

Basado en `docs/ESPECIFICACION_TECNICA_ETL_KPI_VENTAS.md` y `docs/PROMPT_HERMES_SISTEMA_ETL_KPI.md`,
con correcciones y ajustes posteriores verificados contra el ERP real (ver `docs/*_NUEVO.md` y
`docs/CORRECCIONES_*`, `docs/QUERIES_DEFINITIVAS_*`, `docs/INTEGRACION_TABLA_DBVENDEDOR_*`).

## Arquitectura

```
MSSQL (ERP, solo lectura)
        │  extracción (mssql.service.ts)
        ▼
Node.js + Express + TypeScript (backend/)
  ├─ Cron jobs (23:00 → 00:00): sincroniza clientes, articulos, ventas,
  │  calcula KPIs y refresca vistas materializadas
  ├─ API REST (JWT): /api/auth, /api/etl, /api/kpi
        │  UPSERT (staging → dimensiones → hechos)
        ▼
PostgreSQL (Analytics)
  ├─ staging (stg_*)            se trunca en cada sincronización
  ├─ dimensiones (dim_*)        datos limpios y desnormalizados
  ├─ hechos (fact_ventas)
  └─ vistas materializadas (mv_*) KPIs precalculados
        │
        ▼
React + TypeScript + Tailwind (frontend/) — Dashboard / KPIs / Logs / Settings
```

## Estructura del repositorio

```
kpi/
├── backend/     API REST + ETL + Cron Jobs (Node.js/Express/TypeScript)
├── frontend/    Dashboard (React/TypeScript/Tailwind, Vite)
├── docs/        Especificación técnica original
├── docker-compose.yml
└── README.md
```

## Requisitos

- Node.js 18+
- PostgreSQL 15 (o Docker)
- Acceso de solo lectura a la instancia MSSQL del ERP
- npm 9+

## Instalación (modo local)

### 1. Base de datos PostgreSQL

Con Docker (recomendado para desarrollo):

```bash
docker compose up -d postgres adminer
```

O usa una instancia PostgreSQL 15 existente y crea la base `kpi_analytics`.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edita .env con las credenciales de MSSQL y PostgreSQL

# Genera el hash de la contraseña del usuario admin y pégalo en ADMIN_PASSWORD_HASH
npm run hash-password -- "tu-contraseña-segura"

# Ejecuta las migraciones (crea tablas, indices, vistas materializadas y seeds)
npm run migrate

npm run dev
```

El backend queda disponible en `http://localhost:5000`. Verifica con `GET /api/health`.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:5000/api

npm run dev
```

El dashboard queda disponible en `http://localhost:3000`.

### 4. Iniciar sesión

Usuario: el valor de `ADMIN_USER` en `backend/.env` (por defecto `admin`).
Contraseña: la que usaste al generar `ADMIN_PASSWORD_HASH`.

## Instalación con Docker Compose (stack completo)

```bash
cp .env.example .env
# Completa JWT_SECRET, ADMIN_PASSWORD_HASH (usa: docker compose run --rm backend npm run hash-password -- "clave")
# y las credenciales MSSQL

docker compose up -d --build
docker compose exec backend npm run migrate
```

Servicios expuestos:

| Servicio  | URL                          |
|-----------|-------------------------------|
| Frontend  | http://localhost:3000         |
| Backend   | http://localhost:5000/api     |
| Adminer   | http://localhost:8080         |
| PostgreSQL| localhost:5432                |

## Modelo de datos (PostgreSQL)

- **Staging** (`stg_*`): se truncan y recargan en cada sincronización (clientes, articulos,
  facturas, factura_lineas, universo_cliente, objetivos_distribucion, vendedor, clasificacion).
- **Dimensiones** (`dim_*`): datos limpios y desnormalizados.
  - `dim_clientes`: `retail` derivado de `categoria_cliente`, cluster normalizado.
  - `dim_articulos`: incluye `descripcion_subcategoria` (enriquecida desde `CATELLI.CLASIFICACION`).
  - `dim_vendedor`: cartera real de clientes por vendedor (`CATELLI.VENDEDOR`), clave
    `(codigo_vendedor, retail_asignado)` — un vendedor puede tener varias filas si su cartera
    está repartida entre retail (rutas especiales `U_SEMANA`).
  - `dim_clasificacion`: descripciones legibles de subcategorías (`CATELLI.CLASIFICACION`).
  - `dim_universo_cliente` / `dim_objetivos_distribucion`: universo y objetivos **oficiales del
    ERP** por retail/subcategoría y mes (`dbo.universo_cliente`, `dbo.distribuccion`).
  - `dim_surtido_obligatorio`, `dim_criterios_distribucion`: reglas de negocio para Surtido.
- **Hechos** (`fact_ventas`): una fila por (factura, artículo) — líneas duplicadas del ERP se
  agregan (`SUM`) antes de insertar, con campos desnormalizados (`retail`, `u_cluster`,
  `vendedor`, `clasificacion_2`, `u_surtido_n`) para consultas rápidas.
- **Vistas materializadas** (`mv_*`): KPIs precalculados, refrescados por el cron `refresh_views`.
  - `mv_distribucion_por_retail` / `mv_distribucion_por_vendedor`: fórmula oficial del ERP
    (universo/objetivo).
  - `mv_distribucion_por_cluster`: el ERP no da universo/objetivo por cluster, usa umbral de
    `dim_criterios_distribucion`.
  - `mv_surtido_por_cliente` / `mv_surtido_por_vendedor` / `mv_surtido_por_cluster`.
  - `mv_clientes_no_visitados`, `mv_resumen_kpi_general`.
  - Todas usan `fecha_referencia_ventas()` (= `MAX(id_fecha)` de `fact_ventas`, no `CURRENT_DATE`)
    como "hoy" para las ventanas de 30/15 días — funciona igual en producción (datos al día) que
    contra un servidor con datos históricos.

Las migraciones viven en `backend/src/migrations/` (001 a 008, numeradas en orden) y se ejecutan
con `npm run migrate`. El runner no lleva registro de "ya aplicadas": vuelve a ejecutar todos los
archivos en cada corrida, por lo que cada migración debe ser idempotente (`IF NOT EXISTS`,
`DROP ... CASCADE` + `CREATE`, `ON CONFLICT`).

### Lógica de negocio

- **RETAIL**: agrupación de `categoria_cliente` → COLMADO (A1-A3), AUTOSERVICIO (C1-C3),
  MAYORISTA (D1, D2, Q1, SUR), OTROS (resto).
- **CLUSTER**: BRONZE / SILVER / GOLD, según `U_CLUSTER` del ERP.
- **Ventana de compra para Distribución**: **mes calendario** del `anno_mes` correspondiente (del
  día 1 al último día del mes, acotado a `fecha_referencia_ventas()` cuando el mes es el más
  reciente/incompleto) — no "últimos 30 días desde hoy". `mv_distribucion_por_retail` y
  `mv_distribucion_por_vendedor` calculan **todos los meses** presentes en
  `dim_objetivos_distribucion`, filtrables vía `?mes=YYYY-MM` en la API (por defecto, el más
  reciente). `GET /api/kpi/meses-disponibles` lista los meses con datos.
- **Distribución por retail**:
  - `distribucion_porcentaje = resultado / universo` (universo oficial del mes, `dim_universo_cliente`)
  - `objetivo_porcentaje = objetivo_clientes / universo` (% del universo que el ERP espera que compre)
  - `logro_porcentaje = resultado / objetivo_clientes` (objetivo oficial, `dim_objetivos_distribucion`)
- **Distribución por vendedor**: la "cuota" de un vendedor se prorratea según su cartera real
  (`dim_vendedor.cantidad_cliente`, no un conteo genérico de `dim_clientes`):
  - `cuota = cantidad_cliente_del_vendedor × objetivo_porcentaje` (del retail)
  - `logro_porcentaje = resultado / cuota` — comparable entre vendedores de distinto tamaño de cartera
  - `distribucion_porcentaje = resultado / cantidad_cliente_del_vendedor` (contra su propia cartera)
  - `obj2` (objetivo completo del retail, sin prorratear) se conserva solo como referencia.
- **Distribución por cluster**: el ERP no expone universo/objetivo a ese nivel; usa el umbral
  mínimo de compras en 30 días de `dim_criterios_distribucion` (Colmado ≥3, Autoservicio/Mayorista ≥6).
  No usa mes calendario ni es filtrable por mes.
- **Surtido**: % de grupos de surtido obligatorio (`U_SURTIDO_N`) comprados en los últimos 30 días
  respecto a los obligatorios del cluster (Bronze 1-17, Silver 1-21, Gold 1-11) — solo cuenta grupos
  que son obligatorios para ese cluster (comprar un grupo no-obligatorio no debe inflar el % por
  encima de 100%). Por vendedor, el denominador de clientes es el conteo real de `dim_clientes`
  para ese vendedor+cluster (no `dim_vendedor.cantidad_cliente`, que es por retail, no por cluster).
- **Clientes no visitados**: sin factura registrada en los últimos 15 días.

## Cron Jobs

| Hora  | Job                | Descripción                              |
|-------|--------------------|--------------------------------------------|
| 23:00 | `sync_clientes`     | `CLIENTES` + `VENDEDOR` (cartera real por vendedor) |
| 23:15 | `sync_articulos`    | `ARTICULO` (con descripción de subcategoría) + `CLASIFICACION` |
| 23:30 | `sync_ventas`       | `FACTURA` + `FACTURA_LINEAS` (ventana configurable, ver abajo) + `dbo.distribuccion` (objetivos) |
| 23:45 | `calcular_kpis`     | `dbo.universo_cliente` (universo oficial) + validación del ciclo |
| 00:00 | `refresh_views`     | Refresca las 9 vistas materializadas       |
| 06:00 | `telegram_resumen`  | Envía un resumen diario por Telegram (opcional, deshabilitado por defecto) |

Los horarios y el estado (habilitado/deshabilitado) se guardan en la tabla `cron_settings` y pueden
editarse en tiempo de ejecución desde **Settings** en el dashboard o vía `PUT /api/etl/jobs/:name`.
Todos los jobs son **idempotentes** (usan `UPSERT`), por lo que pueden reintentarse sin duplicar datos.

> Nota: los documentos de ajuste (`docs/AJUSTES_FINALES_KPI_VENDEDOR_CLASIFICACION_NUEVO.md`)
> proponían jobs separados para `sync-vendedor` (22:55) y `sync-clasificacion` (23:10). Se
> fusionaron en `sync_clientes` y `sync_articulos` respectivamente porque no tienen dependencias
> de horario reales entre sí, evitando agregar más jobs/estado a la API sin necesidad.

### Ventana de fechas para ventas (`MSSQL_SYNC_FECHA_DESDE`/`HASTA`)

Por defecto, `sync_ventas` trae los **últimos 60 días** desde hoy. Si el servidor MSSQL apunta a
una réplica con datos históricos (no en tiempo real), fija `MSSQL_SYNC_FECHA_DESDE` y
`MSSQL_SYNC_FECHA_HASTA` (`YYYY-MM-DD`) en `.env` para sincronizar un rango fijo en vez de
"últimos 60 días desde ahora". El universo/objetivos (`dbo.universo_cliente`/`dbo.distribuccion`)
usan el mismo rango, convertido a `YYYY-MM`.

## API REST

Todas las rutas bajo `/api/etl` y `/api/kpi` requieren `Authorization: Bearer <token>`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Autenticación, devuelve JWT |
| GET  | `/api/health` | Health check (PostgreSQL + MSSQL) |
| GET  | `/api/etl/status` | Estado de sincronización en curso |
| POST | `/api/etl/trigger-manual` | Dispara sincronización completa manual |
| POST | `/api/etl/pause` / `/api/etl/resume` | Pausa/reanuda todos los cron jobs |
| GET  | `/api/etl/jobs` | Lista de cron jobs y sus horarios |
| PUT  | `/api/etl/jobs/:name` | Actualiza horario/habilitado de un job |
| GET  | `/api/etl/config` | Configuración segura (sin credenciales) |
| GET  | `/api/etl/logs` | Historial de sincronizaciones (filtrable) |
| GET  | `/api/etl/logs/:id` | Detalle de una sincronización |
| GET  | `/api/kpi/distribucion` | Distribución por retail/subcategoría (`?retail=&sku=&mes=YYYY-MM`) |
| GET  | `/api/kpi/distribucion-por-cluster` | Distribución por cluster (umbral de compras) |
| GET  | `/api/kpi/distribucion-por-vendedor` | Distribución por vendedor (`?vendedor=&retail=&mes=YYYY-MM`) |
| GET  | `/api/kpi/surtido` | Surtido por cliente |
| GET  | `/api/kpi/surtido-por-vendedor` | Surtido por vendedor (`?vendedor=`) |
| GET  | `/api/kpi/surtido-por-cluster` | Surtido promedio por cluster |
| GET  | `/api/kpi/clientes-no-visitados` | Clientes sin compra reciente |
| GET  | `/api/kpi/resumen` | Resumen general de KPIs (incluye `anno_mes` del cálculo actual) |
| GET  | `/api/kpi/vendedores` | Lista de vendedores activos (código + nombre) |
| GET  | `/api/kpi/meses-disponibles` | Meses (`YYYY-MM`) con objetivos cargados, para el selector |

## Frontend

Componentes organizados con **Atomic Design** (`atomos/`, `moleculas/`, `organismos/`,
`templates/`), estado global con **React Context** (`AuthContext`, `ETLContext`, `KPIContext`),
hooks personalizados (`useAuth`, `useETLSync`, `useSyncStatus`, `useKPIData`) y 4 páginas
principales: `/dashboard`, `/kpis`, `/logs`, `/settings` (más `/login`).

> Nota: se usó **Vite** en lugar de Create React App (deprecado) para el andamiaje de
> React + TypeScript; el resultado cumple los mismos requisitos (TS estricto, Tailwind,
> Atomic Design, Contexts, hooks, 4 páginas).

## Testing

```bash
cd backend
npm test                  # unitarios (funciones puras de transformación ETL)
npm run test:integration  # pipeline ETL completo contra PostgreSQL real (base aislada)
```

Las pruebas de integración (`etl.service.integration.test.ts`) ejercitan staging → upsert →
vistas materializadas contra una base PostgreSQL real y aislada (`kpi_analytics_test`, nunca la de
producción/demo), con el ERP MSSQL mockeado. Cubren específicamente las regresiones encontradas
durante el desarrollo: dedupe de líneas de factura duplicadas, dedupe de `dim_vendedor` cuando un
vendedor tiene cartera repartida en varios retail, y las fórmulas de distribución/surtido.

## Notas de seguridad

- Las contraseñas nunca se guardan en texto plano: el usuario admin se valida contra un hash
  bcrypt (`ADMIN_PASSWORD_HASH`), generado con `npm run hash-password -- "clave"`.
- Las credenciales de MSSQL/PostgreSQL/Telegram solo se configuran vía variables de entorno; el
  endpoint `/api/etl/config` únicamente expone metadatos no sensibles.
- Todas las rutas de negocio requieren JWT válido (`authMiddleware`).
