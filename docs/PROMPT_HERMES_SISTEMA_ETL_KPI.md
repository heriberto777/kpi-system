# PROMPT PARA HERMES: SISTEMA ETL DE KPIs DE VENTAS Y DISTRIBUCIÓN

## 🎯 INSTRUCCIÓN PRINCIPAL

Construir una **aplicación full-stack profesional** que automatice la extracción de datos desde un ERP en MSSQL, los cargue en PostgreSQL y exponga KPIs de Ventas/Distribución/Surtido a través de un Dashboard React y APIs REST.

**Stack:** Node.js 18+ (TypeScript), Express, React 18+ (TypeScript), PostgreSQL 15, MSSQL Driver, Tailwind CSS

---

## 📋 REQUERIMIENTOS GENERALES

### Obligatorios:
1. ✅ Tipado fuerte con TypeScript en frontend y backend
2. ✅ Estructura de carpetas profesional y escalable
3. ✅ Separación clara de responsabilidades (Controllers, Services, Repositories)
4. ✅ Manejo robusto de errores con logging detallado
5. ✅ Autenticación JWT simple (usuario/contraseña)
6. ✅ Base de datos PostgreSQL con tablas dimensionales y hechos
7. ✅ Vistas materializadas para KPIs (performance)
8. ✅ Componentes React reutilizables con Atomic Design
9. ✅ Estado global con React Context
10. ✅ Responsive design con Tailwind CSS

### Nota sobre Migración de Datos:
- Los datos de FACTURA, FACTURA_LINEAS y ARTICULO ya existen en MSSQL
- NO necesitas generar datos de prueba
- El script ETL extraerá datos reales del ERP

---

## 🗄️ BASE DE DATOS POSTGRESQL

### Crear 5 tipos de tablas (en orden):

#### 1. CONTROL ETL
```sql
sync_logs (id_sync, tipo_tabla, fecha_inicio, fecha_fin, estado, registros_procesados, etc)
sync_metadata (nombre_tabla, ultima_sincronizacion, estado)
```

#### 2. STAGING (Temporales - se truncan cada sincronización)
```sql
stg_clientes
stg_articulos
stg_facturas
stg_factura_lineas
```

#### 3. DIMENSIONES (Datos limpios)
```sql
dim_tiempo (id_fecha, ano, mes, dia, trimestre, semana)
dim_clientes (id_cliente, codigo_cliente, nombre, categoria_cliente, retail, u_cluster, vendedor, estado)
dim_articulos (id_articulo, codigo_articulo, descripcion, clasificacion_1, clasificacion_2, u_surtido_n)
dim_surtido_obligatorio (id_surtido, u_cluster, u_surtido_n, cantidad_articulos, es_obligatorio)
dim_criterios_distribucion (retail, minimo_compras, periodo_dias)
```

#### 4. HECHOS (Transacciones)
```sql
fact_ventas (id_venta, id_factura, id_cliente, id_articulo, id_fecha, cantidad, monto, + campos desnormalizados)
```

#### 5. VISTAS MATERIALIZADAS (KPIs Precalculados)
```sql
mv_distribucion_por_retail
mv_distribucion_por_cluster
mv_distribucion_por_vendedor
mv_surtido_por_cliente
mv_clientes_no_visitados
mv_resumen_kpi_general
```

### Datos Iniciales Requeridos:

**dim_tiempo:** Generar calendario 2024-2027

**dim_surtido_obligatorio:**
```
BRONZE: u_surtido_n 1-17 (obligatorio)
SILVER: u_surtido_n 1-21 (obligatorio)
GOLD: u_surtido_n 1-11 (obligatorio)
```

**dim_criterios_distribucion:**
```
COLMADO: minimo_compras = 3, periodo_dias = 30
AUTOSERVICIO: minimo_compras = 6, periodo_dias = 30
MAYORISTA: minimo_compras = 6, periodo_dias = 30
OTROS: minimo_compras = 1, periodo_dias = 30
```

---

## 🔄 BACKEND (Node.js + Express + TypeScript)

### Estructura de Carpetas (OBLIGATORIA)

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts              # Conexión MSSQL + PostgreSQL
│   │   ├── cron.ts                  # Configuración de cron jobs
│   │   ├── env.ts                   # Validación de variables
│   │   └── logger.ts                # Winston o Pino
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts       # Login/Logout
│   │   ├── etl.controller.ts        # Control de ETL
│   │   ├── kpi.controller.ts        # Consulta de KPIs
│   │   └── sync.controller.ts       # Estado de sincronización
│   │
│   ├── services/
│   │   ├── etl.service.ts           # Lógica de extracción/transformación
│   │   ├── mssql.service.ts         # Queries al ERP (MSSQL)
│   │   ├── postgresql.service.ts    # Queries analíticas (PostgreSQL)
│   │   ├── auth.service.ts          # Autenticación JWT
│   │   └── telegram.service.ts      # Envío de notificaciones (opcional)
│   │
│   ├── jobs/
│   │   ├── sync-clientes.job.ts     # Cron: Sincronizar clientes
│   │   ├── sync-articulos.job.ts    # Cron: Sincronizar artículos
│   │   ├── sync-ventas.job.ts       # Cron: Sincronizar ventas
│   │   ├── calcular-kpis.job.ts     # Cron: Calcular KPIs
│   │   └── refresh-materialize.job.ts # Cron: Refrescar vistas
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts       # Validar JWT
│   │   ├── errorHandler.ts          # Manejo global de errores
│   │   └── logging.middleware.ts    # Logging de requests
│   │
│   ├── utils/
│   │   ├── logger.ts                # Instancia logger
│   │   ├── validators.ts            # Validación de datos
│   │   └── transformers.ts          # Transformar MSSQL → PostgreSQL
│   │
│   ├── types/
│   │   ├── etl.types.ts
│   │   ├── kpi.types.ts
│   │   ├── cliente.types.ts
│   │   └── index.ts
│   │
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── etl.routes.ts
│   │   ├── kpi.routes.ts
│   │   └── index.ts
│   │
│   ├── migrations/
│   │   ├── 001_create_staging_tables.sql
│   │   ├── 002_create_dimensions.sql
│   │   ├── 003_create_facts.sql
│   │   ├── 004_create_materialized_views.sql
│   │   └── 005_create_indexes.sql
│   │
│   └── index.ts                     # Entry point
│
├── .env.example
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

### Endpoints REST (OBLIGATORIO)

**Autenticación:**
```
POST /api/auth/login
- Body: { usuario: string, contraseña: string }
- Response: { token: string, expira_en: number }
- Status: 200/401
```

**ETL Control:**
```
GET /api/etl/status
- Response: { 
    sincronizando: boolean, 
    ultima_sincronizacion: ISO8601,
    proxima_sincronizacion: ISO8601,
    procentaje_completitud: number (0-100),
    estado_detalles: { clientes, articulos, ventas, kpis }
  }
- Refresca cada 30 segundos en frontend

POST /api/etl/trigger-manual
- Fuerza sincronización inmediata
- Response: { mensaje: string, id_sync: number }

POST /api/etl/pause
- Pausa todos los cron jobs
- Response: { mensaje: string }

POST /api/etl/resume
- Reanuda todos los cron jobs
- Response: { mensaje: string }
```

**Logs:**
```
GET /api/etl/logs?limit=50&tipo=ventas&estado=completado
- Response: Array de sincronizaciones pasadas
- Paginado

GET /api/etl/logs/:id
- Response: Detalles completos de una sincronización
```

**KPIs:**
```
GET /api/kpi/distribucion?retail=COLMADO&periodo=30&sku=G21
- Response: Array con distribucion_porcentaje, resultado, objetivo, logro_porcentaje

GET /api/kpi/distribucion-por-cluster?cluster=BRONZE
- Response: Array con distribucion por cluster y subcategoria

GET /api/kpi/distribucion-por-vendedor?vendedor=Juan García
- Response: Array con distribucion del vendedor

GET /api/kpi/surtido?cluster=SILVER&limit=20
- Response: Array con surtido_porcentaje por cliente

GET /api/kpi/clientes-no-visitados?dias=15&retail=COLMADO
- Response: Array con clientes sin compra reciente

GET /api/kpi/resumen
- Response: { total_clientes, clientes_activos_mes, surtido_promedio, distribucion_promedio }
```

### Cron Jobs (node-cron)

```javascript
// Horarios automáticos cada día:
23:00 → syncClientes()
23:15 → syncArticulos()
23:30 → syncVentas()
23:45 → calcularKPIs()
00:00 → refreshMaterializedViews()
06:00 → enviarTelegramResumen() // opcional
```

### Manejo de Errores y Logs

```javascript
// Cada job debe registrar en sync_logs:
- tipo_tabla (clientes, articulos, ventas, kpis)
- fecha_inicio
- fecha_fin
- estado (iniciado, en_proceso, completado, error)
- registros_procesados
- registros_insertados
- registros_actualizados
- mensaje_error (si aplica)

// Logger debe usar Winston/Pino:
- Logs en consola (desarrollo)
- Logs en archivo (producción)
- Nivel: debug, info, warn, error
```

---

## 🎨 FRONTEND (React + TypeScript + Tailwind CSS)

### Estructura de Componentes (ATOMIC DESIGN - OBLIGATORIO)

**Carpeta: src/components/atomos/**
- Button.tsx (variants: primary, danger, success, secondary)
- Badge.tsx (color: success, error, warning, info)
- Spinner.tsx (size: sm, md, lg)
- Icon.tsx (SVG icons)
- ProgressBar.tsx (porcentaje 0-100)
- Input.tsx (text, password, number)
- Select.tsx (dropdown)
- Card.tsx (container con border)

**Carpeta: src/components/moleculas/**
- SyncStatus.tsx (muestra: "Sincronizando... 65%" o "Última: hace 2 horas")
- KPICard.tsx (titulo, número, porcentaje, tendencia)
- LogEntry.tsx (fila de log con timestamp, tipo, estado)
- AlertBanner.tsx (success/error/warning con dismiss)
- DateRangePicker.tsx (selector de fechas)

**Carpeta: src/components/organismos/**
- ETLDashboard.tsx
  - Header con título + última sincronización
  - 4 botones: "Sincronizar Ahora", "Pausar", "Reanudar", "Refrescar"
  - Progreso por tabla (barra) 
  - Últimas 10 sincronizaciones en tabla
  
- KPIMonitor.tsx
  - 4 KPI Cards grandes: Surtido Prom., Distribución Prom., Clientes Activos, Última Actualiz.
  - Gráfico de línea: Surtido últimos 30 días
  - Gráfico de barras: Top 10 SKUs por Distribución
  - Tabla: Distribución por Retail
  
- SyncHistory.tsx
  - Tabla con historial completo
  - Filtros: tipo_tabla, estado, fecha_rango
  - Click en fila → ver logs detallados
  - Botón "Exportar a CSV"
  
- Settings.tsx
  - Editar horarios de cron jobs (input time)
  - Toggle: habilitar/deshabilitar cada job
  - Form: conexión MSSQL (servidor, usuario, contraseña) - NO guardar contraseña
  - Form: configuración Telegram webhook (opcional)

**Carpeta: src/components/templates/**
- AdminLayout.tsx (Header + Sidebar + Content)
- DashboardTemplate.tsx

### Páginas (src/pages/)

```
/dashboard           → ETLControlPanel (componente ETLDashboard)
/kpis               → KPIDashboard (componente KPIMonitor)
/logs               → SyncLogs (componente SyncHistory)
/settings           → Settings (componente Settings)
/login              → Login (simple form)
```

### Contexts (src/contexts/)

```typescript
// ETLContext.tsx
interface ETLContextType {
  isSyncing: boolean;
  lastSync: Date | null;
  nextSync: Date | null;
  syncProgress: number; // 0-100%
  progressDetails: {
    clientes: number,
    articulos: number,
    ventas: number,
    kpis: number
  };
  triggerManualSync: () => Promise<void>;
  pauseSync: () => Promise<void>;
  resumeSync: () => Promise<void>;
  loadStatus: () => Promise<void>;
}

// KPIContext.tsx
interface KPIContextType {
  distribucion: DistribucionData[];
  surtido: SurtidoData[];
  clientesNoVisitados: ClienteNoVisitadoData[];
  resumenGeneral: ResumenKPIData;
  isLoading: boolean;
  loadKPIs: () => Promise<void>;
  filterByRetail: (retail: string) => void;
  filterByCluster: (cluster: string) => void;
}
```

### Hooks Personalizados (src/hooks/)

```typescript
useETLSync()      // Maneja sincronización, triggering manual
useKPIData()      // Obtiene y cachea datos de KPIs
useSyncStatus()   // Polling cada 30 segundos del estado
useAuth()         // Login/logout/token
```

### Styles

- Usar **Tailwind CSS** únicamente
- Color scheme:
  - Primary: Blue (#2563EB)
  - Success: Green (#10B981)
  - Error: Red (#EF4444)
  - Warning: Amber (#F59E0B)
  - Neutral: Gray (#6B7280)
- Responsive: Mobile-first approach
- Font: System font stack

### APIs Integration (src/api/)

```typescript
etl.api.ts
  - getStatus()
  - triggerSync()
  - pauseSync()
  - resumeSync()
  - getLogs(filter)

kpi.api.ts
  - getDistribucion(filters)
  - getSurtido(filters)
  - getClientesNoVisitados(dias)
  - getResumen()

auth.api.ts
  - login(usuario, contraseña)
  - logout()
  - renovarToken()
```

### App.tsx

```typescript
- React Router setup
- Private routes (require JWT)
- Contexts providers (ETLContext, KPIContext, AuthContext)
- Global error boundary
```

---

## 🔧 CONFIGURACIÓN E INSTALACIÓN

### .env.example

```
# Backend
NODE_ENV=production
PORT=5000
JWT_SECRET=your-secret-key-here

# MSSQL ERP
MSSQL_SERVER=servidor.com
MSSQL_PORT=1433
MSSQL_DATABASE=exactus
MSSQL_USER=usuario
MSSQL_PASSWORD=contraseña
MSSQL_ENCRYPT=true

# PostgreSQL Analytics
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=kpi_analytics
POSTGRES_USER=postgres
POSTGRES_PASSWORD=contraseña

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Optional: Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: kpi_analytics
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  adminer:  # UI para ver PostgreSQL
    image: adminer
    ports:
      - "8080:8080"
    depends_on:
      - postgres

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/kpi_analytics
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## 📋 CHECKLIST DE ENTREGABLES

### Backend
- [ ] Estructura de carpetas completa
- [ ] Tipado TypeScript fuerte
- [ ] Conexión a MSSQL + PostgreSQL
- [ ] Todas las tablas PostgreSQL creadas (migrations)
- [ ] 10+ endpoints REST funcionando
- [ ] Autenticación JWT
- [ ] 5 cron jobs configurados (23:00, 23:15, 23:30, 23:45, 00:00)
- [ ] Logging detallado (winston/pino)
- [ ] Manejo robusto de errores
- [ ] Docker Compose funcional

### Frontend
- [ ] Componentes atómicos reutilizables
- [ ] Contexts globales (ETL, KPI)
- [ ] 4 páginas principales funcionando
- [ ] Responsive design (Tailwind CSS)
- [ ] Integración con APIs backend
- [ ] Autenticación JWT (login)
- [ ] Refresh automático de datos

### Documentación
- [ ] README.md (instalación, uso, arquitectura)
- [ ] Schema PostgreSQL documentado
- [ ] Descripción de cada endpoint
- [ ] Guía de configuración

### Testing
- [ ] Pruebas unitarias backend (jest)
- [ ] Pruebas de integración ETL

---

## ⚠️ NOTAS IMPORTANTES

1. **NO guardar contraseñas en .env.example** - Solo variables sin valor
2. **IDEMPOTENCIA:** Todos los jobs deben ser idempotentes (UPSERT, no INSERT puro)
3. **VALIDACIÓN:** Validar todos los datos del ERP antes de insertar en PostgreSQL
4. **PERFORMANCE:** Usar índices en PostgreSQL + vistas materializadas
5. **SEGURIDAD:** JWT con expiración, HTTPS en producción, validar inputs
6. **LOGGING:** Ser MUY detallado en logs para debugging
7. **MONITOREO:** Implementar health checks (/api/health)
8. **ESCALABILIDAD:** Diseño para millones de registros

---

## 📞 INFORMACIÓN TÉCNICA ADICIONAL

**Stack Versiones:**
- Node.js: 18+
- React: 18+
- TypeScript: 5+
- PostgreSQL: 15
- Express: 4.18+
- Tailwind CSS: 3+

**Dependencias Clave:**
- express
- pg (PostgreSQL)
- mssql (MSSQL)
- jsonwebtoken (JWT)
- node-cron (Cron jobs)
- winston (Logging)
- express-validator (Validation)
- dotenv

**Comandos:**

```bash
# Backend
npm install
npm run dev        # Desarrollo
npm run build      # Compilar TypeScript
npm start          # Producción

# Frontend
npm install
npm start          # Desarrollo
npm run build      # Build producción

# Docker
docker-compose up
```

---

## 🎯 FASE DE EJECUCIÓN

### Paso 1: Setup Inicial
```bash
# Crear repos
mkdir erp-kpi-system && cd erp-kpi-system
mkdir backend frontend
cd backend && npm init -y
cd ../frontend && npx create-react-app . --template typescript
```

### Paso 2: Backend
1. Instalar dependencias
2. Crear estructura de carpetas
3. Configurar conexiones MSSQL + PostgreSQL
4. Crear migrations SQL
5. Implementar servicios ETL
6. Crear endpoints REST
7. Configurar cron jobs
8. Implementar logging

### Paso 3: Frontend
1. Instalar Tailwind CSS
2. Crear componentes atómicos
3. Implementar Contexts
4. Crear páginas
5. Integrar con APIs
6. Testing responsive

### Paso 4: Testing & Deployment
1. Tests unitarios
2. Docker Compose
3. Documentación

---

## ✅ LISTO PARA COMENZAR

Tienes TODO documentado. El agente ahora tiene:
- Arquitectura clara
- Especificación técnica completa
- Endpoints exactos
- Estructura de carpetas
- Tipos TypeScript
- Queries SQL
- Cron jobs
- Componentes React

**¿Listo para que Hermes comience?** 🚀

