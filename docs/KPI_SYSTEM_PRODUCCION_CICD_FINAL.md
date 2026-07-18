# 🚀 KPI-SYSTEM: SETUP PRODUCCIÓN + CI/CD

**Patrón: core_app + ciguainv + catelliweb2 = kpi-system**

---

## 📁 ESTRUCTURA DEL PROYECTO

```
kpi-system/
├── backend/
│   ├── src/
│   ├── dist/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile  ← Para build backend
│
├── frontend/
│   ├── src/
│   ├── dist/
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile  ← Para build frontend
│   └── nginx.conf
│
├── .github/
│   └── workflows/
│       └── deploy.yml  ← CI/CD GitHub Actions
│
├── docker-compose.prod.yml  ← Stack producción (backend + frontend + postgres + redis)
├── .env.example
├── .env.production  ← NO COMMITEAR (en .gitignore)
└── .gitignore
```

---

## 📝 PASO 1: Dockerfile Backend

**`backend/Dockerfile`**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["node", "dist/index.js"]
```

---

## 🎨 PASO 2: Dockerfile Frontend

**`frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ============ Production stage ============
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

---

## 🔧 PASO 3: Nginx Config (Frontend)

**`frontend/nginx.conf`**

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Ruta API → Backend
    location /api/ {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA: Redirigir 404 a index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 🐳 PASO 4: docker-compose.prod.yml

**Ubicación: raíz del proyecto**

```yaml
name: kpi-system

services:
  # ============ DATABASE ============
  postgres:
    image: postgres:15-alpine
    container_name: kpi-postgres
    restart: unless-stopped
    env_file: .env
    environment:
      POSTGRES_DB: ${POSTGRES_DATABASE}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - kpi_internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ============ CACHE ============
  redis:
    image: redis:7-alpine
    container_name: kpi-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - kpi_internal
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ============ BACKEND ============
  backend:
    image: ghcr.io/heriberto777/kpi-system-backend:latest
    container_name: kpi-system-backend
    restart: unless-stopped
    env_file: .env
    environment:
      NODE_ENV: production
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      REDIS_HOST: redis
      REDIS_PORT: 6379
    expose:
      - "5000"
    networks:
      - kpi_internal
      - clinic_default
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ============ FRONTEND ============
  frontend:
    image: ghcr.io/heriberto777/kpi-system-frontend:latest
    container_name: kpi-system-frontend
    restart: unless-stopped
    ports:
      - "8290:80"
    networks:
      - kpi_internal
    depends_on:
      - backend
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  kpi_internal:
    driver: bridge
  clinic_default:
    external: true
```

---

## 🔐 PASO 5: .env.example

**Ubicación: raíz del proyecto**

```
# NODE
NODE_ENV=production
PORT=5000
JWT_SECRET=your-jwt-secret-key-change-in-production

# POSTGRESQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DATABASE=kpi_analytics
POSTGRES_USER=kpi_user
POSTGRES_PASSWORD=your-secure-password

# REDIS
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# MSSQL ERP (Conexión a base de datos existente)
MSSQL_SERVER=192.168.1.50
MSSQL_PORT=1433
MSSQL_DATABASE=exactus
MSSQL_USER=sa
MSSQL_PASSWORD=your-mssql-password

# LOGGING
LOG_LEVEL=info

# CRON JOBS
ENABLE_CRON_JOBS=true
```

---

## 🔄 PASO 6: GitHub Actions Workflow

**`.github/workflows/deploy.yml`**

```yaml
name: Build & Deploy kpi-system

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME_BACKEND: heriberto777/kpi-system-backend
  IMAGE_NAME_FRONTEND: heriberto777/kpi-system-frontend

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      # ============ BACKEND ============
      - name: Set up Docker Buildx (Backend)
        uses: docker/setup-buildx-action@v2

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push backend
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          file: ./backend/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_BACKEND }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_BACKEND }}:${{ github.sha }}

      # ============ FRONTEND ============
      - name: Build and push frontend
        uses: docker/build-push-action@v4
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_FRONTEND }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_FRONTEND }}:${{ github.sha }}

      # ============ DEPLOY ============
      - name: Deploy to production
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd ~/apps/kpi-system
            
            echo "🚀 Pulling latest images..."
            docker compose -f docker-compose.prod.yml pull
            
            echo "🔄 Restarting services..."
            docker compose -f docker-compose.prod.yml up -d --force-recreate
            
            echo "⏳ Waiting for services..."
            sleep 10
            
            echo "🏥 Health check..."
            curl -f http://localhost:5000/api/health || exit 1
            
            echo "✅ Deployment successful!"

      - name: Notify Slack (Success)
        if: success()
        uses: 8398a7/action-slack@v3
        with:
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
          text: |
            ✅ kpi-system deployed to production
            Commit: ${{ github.sha }}
            Author: ${{ github.actor }}

      - name: Notify Slack (Failure)
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
          text: |
            ❌ kpi-system deployment FAILED
            Commit: ${{ github.sha }}
            Check logs: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

---

## 📋 PASO 7: GitHub Secrets

**URL: `github.com/heriberto777/kpi-system > Settings > Secrets and variables > Actions`**

Agregar estos secrets:

```
PROD_HOST      = 10.0.10.132
PROD_USER      = heriberto777
PROD_SSH_KEY   = (tu clave privada SSH completa en base64)
SLACK_WEBHOOK  = (opcional para notificaciones)
```

**Para generar PROD_SSH_KEY en base64:**

```bash
# En Windows PowerShell (como administrador):
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("C:\Users\tu-usuario\.ssh\id_rsa")) | Set-Clipboard

# O en Linux/Mac:
cat ~/.ssh/id_rsa | base64 | pbcopy
```

---

## 🖥️ PASO 8: Preparar en prod-app (10.0.10.132)

```bash
# SSH a prod-app
ssh heriberto777@10.0.10.132

# Crear directorio
mkdir -p ~/apps/kpi-system
cd ~/apps/kpi-system

# Copiar docker-compose.prod.yml
# (descargarlo desde GitHub o cpiarlo manualmente)

# Crear .env con valores reales
nano .env

# Contenido .env (reemplazar VALUES):
```

**`~/.env` en prod-app:**

```
# NODE
NODE_ENV=production
PORT=5000
JWT_SECRET=your-jwt-secret-key-CHANGE-THIS

# POSTGRESQL
POSTGRES_DATABASE=kpi_analytics
POSTGRES_USER=kpi_user
POSTGRES_PASSWORD=your-secure-password-CHANGE-THIS

# REDIS
REDIS_PASSWORD=your-redis-password-CHANGE-THIS

# MSSQL ERP
MSSQL_SERVER=192.168.1.50
MSSQL_PORT=1433
MSSQL_DATABASE=exactus
MSSQL_USER=sa
MSSQL_PASSWORD=your-mssql-password-CHANGE-THIS

# LOGGING
LOG_LEVEL=info
ENABLE_CRON_JOBS=true
```

---

## 🔐 PASO 9: Configurar SSH en prod-app para GitHub Actions

```bash
# En prod-app, crear usuario deploy (si no existe)
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy

# Como deploy, generar SSH key (si no existe)
sudo su - deploy
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""

# Ver la clave pública
cat ~/.ssh/id_rsa.pub
```

**Agregar clave pública a GitHub (deploy key):**

```
GitHub Repo Settings > Deploy keys > Add deploy key
- Title: prod-app
- Key: (contenido de ~/.ssh/id_rsa.pub)
- Allow write access: ✓
```

---

## 🌐 PASO 10: NPM - Crear Proxy Host

**En NPM (10.0.10.134):**

```
Hosts → Proxy Hosts → Add Proxy Host

Domain Names:        kpi.ciguadev.com
Forward Hostname/IP: 10.0.10.132
Forward Port:        8290
Cache Assets:        ✓
Block Common Exploits: ✓
Websockets Support:  ✓

SSL Certificate:     Let's Encrypt (Wildcard) ✓
Force SSL:           ✓
```

---

## ✅ PASO 11: Verificar Todo

```bash
# En tu PC, push a GitHub
cd D:\proyectos\app\kpi-system
git add .
git commit -m "feat: setup producción kpi-system"
git push origin main

# GitHub Actions ejecutará automáticamente:
# 1. Build backend
# 2. Build frontend
# 3. Push a ghcr.io
# 4. Deploy a prod-app
# 5. Restart containers

# Verificar en prod-app
ssh heriberto777@10.0.10.132
cd ~/apps/kpi-system
docker compose ps
docker compose logs -f

# Acceder
https://kpi.ciguadev.com
```

---

## 🚀 COMANDOS ÚTILES EN PROD

```bash
# SSH a prod-app
ssh heriberto777@10.0.10.132
cd ~/apps/kpi-system

# Ver estado
docker compose ps
docker compose logs backend
docker compose logs frontend

# Detener
docker compose down

# Reiniciar
docker compose restart

# Ver volúmenes
docker volume ls
docker volume inspect kpi-system_postgres_data

# Backup BD
docker compose exec postgres pg_dump -U kpi_user kpi_analytics > backup-$(date +%Y%m%d).sql
```

---

## 📋 CHECKLIST FINAL

- [ ] Backend + Frontend + docker-compose.prod.yml en GitHub
- [ ] .env.example agregado
- [ ] Dockerfile.backend + Dockerfile.frontend listos
- [ ] .github/workflows/deploy.yml creado
- [ ] Secrets en GitHub configurados
- [ ] prod-app SSH key configurada
- [ ] Directorio ~/apps/kpi-system creado en prod-app
- [ ] .env con valores reales en prod-app
- [ ] NPM proxy host kpi.ciguadev.com creado
- [ ] Primer push a main triggerea deploy automático ✅

---

**Listo. Patrón: core_app + ciguainv + catelliweb2 = kpi-system.** 🎯

