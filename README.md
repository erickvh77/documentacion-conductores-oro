# Documentación Conductores — App de digitalización documental

Aplicación web responsive para registrar y digitalizar la documentación entregada por conductores en puntos estratégicos de una empresa de transporte.

Reemplaza el proceso manual de escaneo + organización en Google Drive + registro en Google Sheets.

---

## Características

- Formulario móvil de 3 pasos optimizado para celular
- Captura de fotos directamente desde la cámara del dispositivo
- Procesamiento de imágenes con efecto **escáner profesional** (Sharp)
- Generación automática de **PDF único por registro** (pdf-lib)
- Organización automática en **Google Drive** (`/Mes/Día/MANIFIESTO/`)
- Registro automático en **Google Sheets** (22 columnas)
- Base de datos PostgreSQL con trazabilidad completa
- Reintento automático de registros fallidos

---

## Prerrequisitos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 20.x |
| Docker Desktop | 24.x |
| npm | 10.x |

---

## Inicio rápido — Desarrollo local

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/TU_USUARIO/documentacion-conductores-app.git
cd documentacion-conductores-app
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con los valores correctos. Para desarrollo sin Google, dejar las variables de Google vacías (la app funciona en **modo demo**).

### 3. Levantar PostgreSQL con Docker

```bash
# Solo la base de datos
docker compose up postgres -d
```

### 4. Crear la migración inicial y el esquema

```bash
# Crear archivos de migración (primera vez)
npm run db:migrate -- --name init

# Generar cliente Prisma
npm run db:generate
```

### 5. Cargar datos iniciales (clientes de prueba)

```bash
npm run db:seed
```

### 6. Arrancar el servidor de desarrollo

```bash
npm run dev
```

Abrir **http://localhost:3000** en el navegador (o desde el celular en la misma red).

---

## Comandos de base de datos

```bash
# Crear nueva migración (desarrollo)
npm run db:migrate -- --name nombre_del_cambio

# Aplicar migraciones en producción
npm run db:migrate:prod

# Abrir Prisma Studio (interfaz visual de la BD)
npm run db:studio

# Recargar datos semilla
npm run db:seed

# Resetear la BD completa (¡borra todos los datos!)
npm run db:reset
```

---

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | ✅ | Conexión a PostgreSQL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ⚠️ | Email de la cuenta de servicio Google |
| `GOOGLE_PRIVATE_KEY` | ⚠️ | Clave privada de la cuenta de servicio |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | ⚠️ | ID de la carpeta raíz en Drive |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ⚠️ | ID del spreadsheet de registros |
| `NODE_ENV` | ✅ | `development` o `production` |
| `APP_URL` | ✅ | URL pública de la app |
| `UPLOAD_TEMP_DIR` | — | Directorio temporal para uploads (default: /tmp) |
| `UPLOAD_TEMP_TTL_MINUTES` | — | Tiempo de vida de archivos temporales (default: 60) |

> ⚠️ Variables opcionales en modo demo: la app funciona sin ellas pero no sube a Drive/Sheets.

---

## API Reference

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Health check — verifica conexión a BD |
| `GET` | `/api/clients` | Lista de clientes activos |
| `POST` | `/api/upload` | Subir y procesar foto individual |
| `POST` | `/api/records` | Crear registro completo (pipeline Drive + PDF + Sheets) |
| `GET` | `/api/records/[id]` | Estado de un registro |
| `POST` | `/api/records/[id]/retry` | Reintentar registro en estado ERROR |

---

## Documentación adicional

| Documento | Descripción |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura detallada y flujo técnico |
| [`docs/GOOGLE_SETUP.md`](docs/GOOGLE_SETUP.md) | Configurar Google Cloud (Drive + Sheets) |
| [`docs/DEPLOYMENT_DIGITALOCEAN.md`](docs/DEPLOYMENT_DIGITALOCEAN.md) | Despliegue en DigitalOcean |

---

## Despliegue con Docker (producción)

```bash
# Construir y arrancar todos los servicios (app + postgres + nginx + certbot)
docker compose -f docker-compose.prod.yml up -d --build

# Ver logs
docker compose -f docker-compose.prod.yml logs -f app

# Actualizar la app sin downtime en la BD
docker compose -f docker-compose.prod.yml up -d --build --no-deps app
```

El entrypoint del contenedor ejecuta `prisma migrate deploy` automáticamente antes de arrancar el servidor.

Ver la guía completa en [`docs/DEPLOYMENT_DIGITALOCEAN.md`](docs/DEPLOYMENT_DIGITALOCEAN.md).

---

## Estructura del proyecto

```
app/api/          → API Routes (backend)
app/generated/    → Cliente Prisma generado (no editar)
components/form/  → Formulario multi-paso (3 pasos)
components/ui/    → Componentes UI reutilizables
lib/context/      → Estado global del formulario (React Context)
lib/db/           → Singleton Prisma con driver adapter
lib/google/       → Drive API + Sheets API + autenticación
lib/image/        → Pipeline Sharp (efecto escáner)
lib/pdf/          → Generador PDF (pdf-lib)
lib/records/      → Orquestador del pipeline completo
lib/validation/   → Esquemas Zod compartidos
prisma/           → Schema + migraciones + seed
docs/             → Documentación técnica
scripts/          → Scripts de inicio del contenedor
```

---

## Licencia

Uso interno — empresa de transporte.
