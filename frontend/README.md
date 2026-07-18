# Frontend — Dashboard de KPIs

React 18 + TypeScript + Tailwind CSS (Vite). Ver la documentación completa en el [README raíz](../README.md).

## Comandos

```bash
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:5000/api
npm run dev              # http://localhost:3000
npm run build             # build de produccion en dist/
npm run preview           # sirve el build de produccion
```

## Estructura

```
src/
├── api/           client.ts (axios + interceptores JWT), auth/etl/kpi.api.ts
├── components/
│   ├── atomos/      Button, Badge, Spinner, Icon, ProgressBar, Input, Select, Card
│   ├── moleculas/   SyncStatus, KPICard, LogEntry, AlertBanner, DateRangePicker
│   ├── organismos/  ETLDashboard, KPIMonitor, SyncHistory, Settings
│   └── templates/   AdminLayout, DashboardTemplate
├── contexts/      AuthContext, ETLContext, KPIContext
├── hooks/         useAuth, useETLSync, useSyncStatus, useKPIData
├── pages/         Dashboard, KPIs, Logs, Settings, Login
└── App.tsx        Router + Providers + rutas privadas
```
