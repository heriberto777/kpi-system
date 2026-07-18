# Despliegue a producción (prod-app + prod-db)

Este documento cubre los pasos **manuales, únicos** que hay que hacer en la infraestructura
antes de que el pipeline de CI/CD (`.github/workflows/deploy.yml`) pueda desplegar solo en cada
push a `main`. El pipeline en sí no requiere pasos manuales una vez configurado esto.

Resumen de la arquitectura: GitHub Actions construye las imágenes de backend y frontend, las
publica en GHCR, y por SSH le dice a `prod-app` que las descargue y reinicie los contenedores.
`prod-app` corre backend+frontend (`docker-compose.prod.yml`); `prod-db` es un Postgres aparte al
que el backend se conecta por red, no lo levanta este stack.

## 1. Preparar prod-db

En el servidor de base de datos (o donde sea que viva el Postgres de producción):

```sql
CREATE DATABASE kpi_analytics;
CREATE USER kpi_user WITH ENCRYPTED PASSWORD 'una-contraseña-segura';
GRANT ALL PRIVILEGES ON DATABASE kpi_analytics TO kpi_user;
```

Confirmar que **prod-app tiene salida de red hacia prod-db en el puerto 5432** (firewall,
`pg_hba.conf` con la IP de prod-app permitida, `listen_addresses` no restringido a localhost).

## 2. Preparar prod-app

```bash
ssh <tu-usuario>@<ip-prod-app>

mkdir -p ~/apps/kpi-system
cd ~/apps/kpi-system

# El workflow copia docker-compose.prod.yml automáticamente en cada deploy (paso "scp"), pero
# hace falta una primera copia manual para el primer despliegue:
# (pegar aquí el contenido de docker-compose.prod.yml del repo, o copiarlo por scp una vez)

cp /ruta/donde/lo/hayas/copiado/docker-compose.prod.yml .

# Crear el .env real a partir de la plantilla (.env.production.example del repo), reemplazando
# TODOS los "CAMBIAR":
nano .env
```

Confirmar que Docker y el plugin `docker compose` (v2) están instalados:

```bash
docker --version
docker compose version
```

## 3. Crear el usuario/llave de deploy en prod-app

```bash
# Si no existe ya un usuario dedicado para deploys (recomendado, en vez de usar tu usuario personal):
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
sudo su - deploy

ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Esta es la llave PRIVADA que va a GitHub Secrets (PROD_SSH_KEY):
cat ~/.ssh/id_ed25519
```

Si en cambio vas a desplegar con tu usuario actual, simplemente genera una llave y agrégala a
`~/.ssh/authorized_keys` de ese usuario.

## 4. Configurar GitHub Secrets

En `github.com/<tu-org>/<tu-repo> → Settings → Secrets and variables → Actions`, agregar:

| Secret | Valor |
|---|---|
| `PROD_HOST` | IP o hostname de prod-app |
| `PROD_USER` | usuario SSH (`deploy` o el que uses) |
| `PROD_SSH_KEY` | contenido completo de la llave **privada** generada en el paso 3 |

`GITHUB_TOKEN` no hace falta agregarlo: GitHub Actions lo provee automáticamente y ya tiene
permiso de push a GHCR (`packages: write`, ya declarado en el workflow).

Si el repositorio es privado, además hay que darle a `prod-app` acceso para hacer `docker pull`
de GHCR (las imágenes de un repo privado no son públicas por defecto):

```bash
# En prod-app, como el usuario que corre docker compose:
echo <un-personal-access-token-con-scope-read:packages> | docker login ghcr.io -u <tu-usuario-github> --password-stdin
```

## 5. Dominio y HTTPS (Nginx Proxy Manager)

En tu instancia de NPM:

```
Hosts → Proxy Hosts → Add Proxy Host
Domain Names:         kpi.ciguadev.com
Forward Hostname/IP:  <ip-prod-app>
Forward Port:         8290   (o el valor de FRONTEND_PORT en el .env de prod-app)
Websockets Support:   activado
SSL Certificate:      Let's Encrypt, Force SSL activado
```

## 6. Confirmar direcciones reales antes del primer deploy

Dos valores en `.env.production.example` están marcados como placeholder — confirmar antes de
poner el sistema a sincronizar contra el ERP real:

- `MSSQL_SERVER` / `MSSQL_DATABASE` / `MSSQL_USER` / `MSSQL_PASSWORD`: la IP real del servidor
  CATELLI y que **prod-app** (no tu máquina local) tenga salida de red hacia ese puerto 1433.
- `POSTGRES_HOST`: la IP/hostname real de prod-db.

## 7. Primer deploy

```bash
git push origin main
```

El workflow corre tests → construye y publica las imágenes → copia `docker-compose.prod.yml` a
prod-app → hace `pull` + `up -d --force-recreate` → corre `npm run migrate:docker` dentro del
contenedor backend (crea/actualiza el esquema en prod-db, es idempotente) → valida
`GET /api/health` a través del proxy de nginx del frontend.

Verificar en prod-app:

```bash
cd ~/apps/kpi-system
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

## Comandos útiles

```bash
# Ver estado / logs
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend
docker compose -f docker-compose.prod.yml logs frontend

# Rollback a un commit anterior (usa el SHA como tag, el workflow etiqueta cada build con su SHA)
IMAGE_TAG=<sha-del-commit-anterior> docker compose -f docker-compose.prod.yml pull
IMAGE_TAG=<sha-del-commit-anterior> docker compose -f docker-compose.prod.yml up -d --force-recreate

# Backup manual de prod-db (ejecutar en el servidor donde vive prod-db, no en prod-app)
pg_dump -h localhost -U kpi_user kpi_analytics > backup-$(date +%Y%m%d).sql

# Refrescar vistas materializadas sin esperar al cron (requiere login de admin, ver /api/auth/login)
curl -X POST https://kpi.ciguadev.com/api/config/refrescar-vistas -H "Authorization: Bearer <token>"
```

## Qué NO cubre este pipeline (pendiente de decidir)

- **Backups automáticos de prod-db**: el comando de arriba es manual; conviene un cron en el
  servidor de prod-db, no en prod-app.
- **Rollback automático si el health check falla**: hoy el step solo falla el workflow y deja
  los contenedores nuevos corriendo (posiblemente rotos). Si esto importa, se puede agregar un
  paso que restaure la imagen anterior automáticamente.
- **Monitoreo/alertas** más allá del resumen diario de Telegram que ya tiene la app (ETL) — no
  hay alertas de infraestructura (CPU, disco, caída del contenedor) configuradas aquí.
