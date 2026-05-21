#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# server-setup.sh — Configuración inicial del Droplet de Digital Ocean
#
# Ejecutar UNA SOLA VEZ como root o con sudo en el servidor recién creado:
#   bash server-setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

APP_DIR="/var/www/conductores-app"
APP_USER="www-data"
REPO_URL="https://github.com/TU_USUARIO/TU_REPOSITORIO.git"  # ← cambiar

echo "======================================================"
echo "  Configuración inicial — Conductores App"
echo "======================================================"

# ── 1. Sistema ────────────────────────────────────────────────────────────────
echo "[1/8] Actualizando sistema..."
apt-get update -y && apt-get upgrade -y

# ── 2. Node.js 20 ─────────────────────────────────────────────────────────────
echo "[2/8] Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ── 3. PM2 (gestor de procesos) ───────────────────────────────────────────────
echo "[3/8] Instalando PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root

# ── 4. Nginx ──────────────────────────────────────────────────────────────────
echo "[4/8] Instalando Nginx..."
apt-get install -y nginx
systemctl enable nginx

# ── 5. Certbot (SSL) ──────────────────────────────────────────────────────────
echo "[5/8] Instalando Certbot para SSL..."
apt-get install -y certbot python3-certbot-nginx

# ── 6. Clonar el repositorio ──────────────────────────────────────────────────
echo "[6/8] Clonando repositorio..."
mkdir -p "$APP_DIR"
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"

# ── 7. Variables de entorno ───────────────────────────────────────────────────
echo "[7/8] Configurando variables de entorno..."
echo ""
echo "  >>> ACCIÓN REQUERIDA: crea el archivo .env en $APP_DIR"
echo "  Copia .env.example y rellena los valores reales:"
echo "      cp $APP_DIR/.env.example $APP_DIR/.env"
echo "      nano $APP_DIR/.env"
echo ""
echo "  Presiona ENTER cuando hayas creado el .env..."
read -r

# ── 8. Build inicial ──────────────────────────────────────────────────────────
echo "[8/8] Primer build..."
cd "$APP_DIR"
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

# Crear directorio de uploads temporales
mkdir -p /tmp/conductores-uploads
chmod 777 /tmp/conductores-uploads

# Iniciar con PM2
pm2 start npm --name "conductores-app" -- start
pm2 save

echo ""
echo "======================================================"
echo "  App corriendo en puerto 3000"
echo "  Configura Nginx con: bash $APP_DIR/scripts/nginx-setup.sh"
echo "======================================================"
