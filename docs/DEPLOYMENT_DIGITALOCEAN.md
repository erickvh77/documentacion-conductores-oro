# Guía de despliegue en DigitalOcean

Esta guía cubre el despliegue completo de la aplicación en un **Droplet de DigitalOcean** usando Docker Compose + Nginx + SSL.

---

## Requisitos previos

- Cuenta en DigitalOcean
- Dominio propio (para SSL con Let's Encrypt)
- Credenciales de Google Cloud configuradas (ver `docs/GOOGLE_SETUP.md`)
- Repositorio en GitHub/GitLab (recomendado para CI/CD futuro)

---

## Parte 1 — Crear el Droplet

### 1.1 Especificaciones recomendadas

| Recurso | Mínimo | Recomendado |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 2 GB | 4 GB |
| Disco | 50 GB SSD | 80 GB SSD |
| Sistema | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| Precio | ~$12/mes | ~$24/mes |

### 1.2 Crear el Droplet

1. Ir a **Create** → **Droplets**
2. Elegir **Ubuntu 24.04 LTS**
3. Plan: **Basic** → **Regular SSD** → 2 vCPU / 4 GB RAM
4. Región: la más cercana a Colombia (Miami o Nueva York)
5. Autenticación: **SSH Keys** (agregar tu clave pública)
6. Nombre: `conductores-prod`
7. Hacer clic en **Create Droplet**

### 1.3 Apuntar el dominio al Droplet

En tu proveedor de DNS, crear un registro **A**:
```
Nombre:  conductores.tuempresa.com  (o @)
Tipo:    A
Valor:   IP_DEL_DROPLET
TTL:     3600
```

---

## Parte 2 — Configurar el servidor

### 2.1 Conectarse al Droplet

```bash
ssh root@IP_DEL_DROPLET
```

### 2.2 Actualizar el sistema

```bash
apt update && apt upgrade -y
```

### 2.3 Instalar Docker y Docker Compose

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Agregar usuario al grupo docker (opcional, para no usar sudo)
usermod -aG docker $USER

# Verificar instalación
docker --version
docker compose version
```

### 2.4 Instalar Nginx y Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
```

---

## Parte 3 — Desplegar la aplicación

### 3.1 Clonar el repositorio

```bash
cd /opt
git clone https://github.com/TU_USUARIO/documentacion-conductores-app.git
cd documentacion-conductores-app
```

### 3.2 Configurar las variables de entorno

```bash
cp .env.example .env
nano .env
```

Completar todos los valores:

```env
# Base de datos (usar contraseña segura)
DATABASE_URL="postgresql://postgres:TU_PASSWORD_SEGURA@postgres:5432/conductores_db"
POSTGRES_PASSWORD="TU_PASSWORD_SEGURA"

# Google Cloud
GOOGLE_SERVICE_ACCOUNT_EMAIL="tu-cuenta@proyecto.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_ROOT_FOLDER_ID="1ABC123XYZxxxxxxxxxxxxxxxxx"
GOOGLE_SHEETS_SPREADSHEET_ID="1DEF456ABCxxxxxxxxxxxxxxxxx"

# App
NODE_ENV="production"
APP_URL="https://conductores.tuempresa.com"
UPLOAD_TEMP_DIR="/tmp/conductores-uploads"
UPLOAD_TEMP_TTL_MINUTES="60"
```

> **Guardar con Ctrl+O, Enter, Ctrl+X**

### 3.3 Configurar Nginx

```bash
# Editar la configuración de Nginx
nano nginx/nginx.conf
```

Reemplazar `TU_DOMINIO.COM` con tu dominio real en las 4 apariciones:
```nginx
server_name conductores.tuempresa.com www.conductores.tuempresa.com;
```

```bash
# Copiar configuración a Nginx
cp nginx/nginx.conf /etc/nginx/nginx.conf

# Verificar sintaxis
nginx -t

# Reiniciar Nginx
systemctl restart nginx
```

### 3.4 Obtener certificado SSL (Let's Encrypt)

```bash
# Obtener certificado (solo HTTP por ahora, certbot modifica nginx.conf)
certbot --nginx -d conductores.tuempresa.com -d www.conductores.tuempresa.com

# Verificar renovación automática
certbot renew --dry-run
```

### 3.5 Generar la migración inicial (primera vez)

Antes de arrancar en producción, se deben crear los archivos de migración en desarrollo local:

```bash
# En tu máquina local, con Docker Compose de desarrollo corriendo:
docker compose up postgres -d
npm run db:migrate -- --name init

# Verificar que se creó la carpeta prisma/migrations/
# Subir los archivos de migración al repositorio
git add prisma/migrations/
git commit -m "Add initial database migration"
git push
```

En el servidor:
```bash
git pull
```

### 3.6 Arrancar la aplicación

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

El entrypoint del contenedor ejecuta automáticamente `prisma migrate deploy` antes de arrancar.

### 3.7 Ejecutar el seed de clientes (primera vez)

```bash
docker compose -f docker-compose.prod.yml exec app \
  npx tsx prisma/seed.ts
```

---

## Parte 4 — Verificar el despliegue

```bash
# Ver logs de todos los servicios
docker compose -f docker-compose.prod.yml logs -f

# Ver logs solo de la app
docker compose -f docker-compose.prod.yml logs -f app

# Verificar estado de los contenedores
docker compose -f docker-compose.prod.yml ps

# Health check
curl https://conductores.tuempresa.com/api/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "database": "connected",
  "latencyMs": 3
}
```

---

## Parte 5 — Actualizaciones

Para actualizar la aplicación:

```bash
cd /opt/documentacion-conductores-app

# Obtener cambios
git pull

# Reconstruir y reiniciar solo el contenedor app (sin downtime en postgres)
docker compose -f docker-compose.prod.yml up -d --build --no-deps app

# Ver logs para confirmar que arrancó correctamente
docker compose -f docker-compose.prod.yml logs -f app
```

---

## Parte 6 — Backups de la base de datos

### Backup manual

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres conductores_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Backup automático diario (cron)

```bash
# Abrir crontab
crontab -e

# Agregar backup diario a las 3:00 AM
0 3 * * * cd /opt/documentacion-conductores-app && \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres conductores_db > /backups/conductores_$(date +\%Y\%m\%d).sql
```

```bash
# Crear directorio de backups
mkdir -p /backups
```

---

## Parte 7 — Monitoreo básico

### Ver uso de recursos

```bash
# Recursos de contenedores en tiempo real
docker stats

# Espacio en disco
df -h
docker system df
```

### Limpiar imágenes antiguas (mensual)

```bash
docker image prune -a --filter "until=720h"
```

---

## Resolución de problemas comunes

| Problema | Diagnóstico | Solución |
|---|---|---|
| App no arranca | `docker compose logs app` | Verificar DATABASE_URL y variables de entorno |
| Error de migración | Ver logs del entrypoint | Verificar que `prisma/migrations/` existe y tiene archivos |
| Nginx 502 | `systemctl status nginx` | Verificar que el contenedor app está corriendo en puerto 3000 |
| SSL no renueva | `certbot renew` | Verificar que el dominio apunta al servidor |
| Drive error: no permission | Revisar logs de la app | Verificar que la carpeta está compartida con la Service Account |
