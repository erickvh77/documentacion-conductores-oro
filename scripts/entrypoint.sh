#!/bin/sh
# entrypoint.sh — Script de inicio del contenedor Docker
# Se ejecuta antes de arrancar el servidor Next.js.
# Aplica migraciones pendientes y arranca la app.

set -e

echo "=================================================="
echo " Documentación Conductores — Inicio del servidor"
echo "=================================================="

# Verificar que DATABASE_URL esté definida
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: La variable de entorno DATABASE_URL no está configurada."
  exit 1
fi

echo ""
echo "→ Aplicando migraciones de base de datos..."
npx prisma migrate deploy --schema=prisma/schema.prisma
echo "✓ Migraciones aplicadas."

echo ""
echo "→ Iniciando servidor Next.js..."
exec node server.js
