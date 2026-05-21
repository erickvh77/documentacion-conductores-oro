# Arquitectura del sistema

## Visión general

Aplicación web **full-stack** en un solo proyecto Next.js, desplegada como contenedor Docker único junto a PostgreSQL.

```
┌─────────────────────────────────────────────────────────────┐
│                   Celular del funcionario                   │
│              (Chrome / Safari / cualquier browser)          │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│                    Nginx (reverse proxy)                    │
│                   SSL via Let's Encrypt                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (interno)
┌──────────────────────────▼──────────────────────────────────┐
│              Next.js 16 App Router (puerto 3000)            │
│                                                             │
│  ┌─────────────────────┐   ┌───────────────────────────┐   │
│  │   React (frontend)  │   │  API Routes (backend)     │   │
│  │                     │   │                           │   │
│  │  FormProvider       │   │  POST /api/upload         │   │
│  │  StepOne            │   │  POST /api/records        │   │
│  │  StepTwo            │   │  GET  /api/clients        │   │
│  │  StepThree          │   │  GET  /api/records/[id]   │   │
│  │  PhotoCapture       │   │  POST /api/records/retry  │   │
│  └─────────────────────┘   │  GET  /api/health         │   │
│                             └───────────┬───────────────┘   │
└─────────────────────────────────────────┼───────────────────┘
                                          │
              ┌───────────────────────────┼───────────────────┐
              │                           │                   │
              ▼                           ▼                   ▼
   ┌──────────────────┐      ┌────────────────────┐  ┌──────────────┐
   │  PostgreSQL 16   │      │  Google Drive API  │  │ Google       │
   │  (contenedor)    │      │  (Service Account) │  │ Sheets API   │
   └──────────────────┘      └────────────────────┘  └──────────────┘
```

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js App Router | 16.x |
| Lenguaje | TypeScript | 5.x |
| Estilos | Tailwind CSS | 4.x |
| Formularios | React Hook Form + Zod | 7.x / 4.x |
| ORM | Prisma (prisma-client-js) | 7.x |
| Driver BD | pg + @prisma/adapter-pg | — |
| Base de datos | PostgreSQL | 16 |
| Imágenes | Sharp | 0.34.x |
| PDF | pdf-lib | 1.17.x |
| Google APIs | googleapis | 171.x |
| Contenedores | Docker + Docker Compose | — |
| Proxy / SSL | Nginx + Certbot | — |

---

## Flujo técnico completo

### 1. Captura de foto (paso 2 del formulario)

```
Usuario toma foto con la cámara del celular
  ↓
<input type="file" capture="environment"> (nativo del browser)
  ↓
FormContext.uploadPhoto(tipoDocumento, file)
  ↓
POST /api/upload
  ├── Validar MIME type + tamaño (max 15 MB)
  ├── processImageToScanner(buffer)
  │     ├── rotate()          ← corrige EXIF
  │     ├── resize(2000×2800) ← limita tamaño
  │     ├── grayscale()       ← escala de grises
  │     ├── normalise()       ← contraste automático
  │     ├── linear(1.3, -40)  ← más contraste
  │     ├── sharpen(1.5)      ← nitidez
  │     └── jpeg(82%)         ← compresión
  ├── fs.writeFile(tmpDir/uuid_original.jpg)
  ├── fs.writeFile(tmpDir/uuid_processed.jpg)
  ├── Generar thumbnail base64 (480px, 70%)
  └── Retornar { uploadId, thumbnailDataUrl, tempOriginalPath, tempProcessedPath }
  ↓
Frontend muestra thumbnail inmediatamente
```

### 2. Envío del registro (paso 3 del formulario)

```
Usuario confirma en Paso 3
  ↓
POST /api/records (payload JSON con metadatos + rutas temporales)
  ↓
Validación Zod (backend)
  ↓
Transacción Prisma:
  ├── INSERT document_records (estado=PROCESANDO)
  ├── INSERT document_items[] (uno por tipo de documento)
  └── INSERT audit_logs (CREATE_RECORD)
  ↓
processRecord(recordId)
  ├── ensureRecordFolderStructure()
  │     └── Drive: /Mes/Día/MANIFIESTO_xxx/ + fotos_originales/ + fotos_procesadas/
  │           (con caché de folder IDs en tabla drive_folder_cache)
  ├── Para cada item entregado:
  │     ├── fs.readFile(tempOriginalPath)
  │     ├── fs.readFile(tempProcessedPath)
  │     ├── uploadFile(original → fotos_originales/)
  │     ├── uploadFile(processed → fotos_procesadas/)
  │     └── UPDATE document_items con URLs Drive
  ├── generateRecordPdf(processedBuffers, metadata)
  │     └── pdf-lib: una página A4 por documento, encabezado con datos del viaje
  ├── uploadFile(pdfBuffer → MANIFIESTO_xxx/)
  ├── UPDATE document_records (pdfUrl, driveFolderId, estado=SUBIDO_A_DRIVE)
  ├── appendSheetRow(22 columnas → hoja "Registros")
  ├── UPDATE document_records (estado=COMPLETADO)
  └── fs.unlink(todos los archivos temporales)
  ↓
Respuesta: { success: true, recordId, pdfUrl }
  ↓
Frontend muestra pantalla de éxito con link al PDF
```

---

## Modelo de datos

```
clients
  id, nit (unique), nombre, activo

document_records
  id, nombre_conductor, placa, manifiesto?, agencia, cliente_id → clients
  numero_contenedor?, manifiesto_contenedor?
  pdf_url?, pdf_drive_id?, drive_folder_id?, drive_folder_url?
  estado (BORRADOR|VALIDADO|PROCESANDO|SUBIDO_A_DRIVE|REGISTRADO_EN_SHEETS|COMPLETADO|ERROR)
  error_detalle?, created_at, updated_at

document_items
  id, record_id → document_records (CASCADE DELETE)
  tipo_documento (LIQUIDACION|CUMPLIDO|REMESA|SALIDA_PUERTO|CONTENEDOR_VACIO|OTROS)
  entregado, descripcion?
  original_image_url?, original_drive_id?
  processed_image_url?, processed_drive_id?
  temp_original_path?, temp_processed_path?
  sort_order, created_at

audit_logs
  id, agencia, action, entity_type, entity_id?, record_id → document_records
  metadata (JSONB), ip_address?, created_at

drive_folder_cache
  id, folder_path (unique), drive_id, created_at
```

---

## Gestión de errores y resiliencia

| Escenario | Comportamiento |
|---|---|
| Drive no disponible | `estado=ERROR` + `error_detalle` en BD. Datos no se pierden. |
| Archivo temporal no encontrado | Se omite esa imagen y continúa con las demás. |
| Sheets falla | Drive ya subido. Se puede reintentar manualmente con `/api/records/[id]/retry`. |
| Timeout de la request | `maxDuration=120s`. Para 6 documentos completos ~40-60 s. |
| Reinicio del servidor | Los temp files persisten en volumen Docker. Se pueden reprocesar. |
| Credenciales Google no configuradas | Se completa el registro en BD como `COMPLETADO (modo demo)`. |

---

## Optimizaciones de rendimiento

- **Caché de folder IDs de Drive** en tabla `drive_folder_cache`. Evita 3-4 llamadas API por registro en el mismo día/mes.
- **Upload anticipado foto-por-foto**: las imágenes se procesan al ser capturadas, no al enviar el formulario. El paso final es solo metadatos + subir a Drive.
- **Sharp en servidor**: el procesamiento de imágenes nunca ocurre en el browser. El celular solo envía el JPEG original.
- **Singleton de Prisma**: una sola instancia del pool de conexiones durante toda la vida del proceso.
- **Thumbnails reducidos**: el preview en pantalla es una imagen de 480px (no la procesada completa) para reducir el tamaño del JSON de respuesta.

---

## Estructura de carpetas del proyecto

```
/
├── app/
│   ├── api/
│   │   ├── clients/route.ts        ← GET lista de clientes
│   │   ├── health/route.ts         ← GET health check
│   │   ├── records/
│   │   │   ├── route.ts            ← POST crear registro + pipeline
│   │   │   └── [id]/
│   │   │       ├── route.ts        ← GET estado del registro
│   │   │       └── retry/route.ts  ← POST reintentar fallido
│   │   └── upload/route.ts         ← POST subir foto individual
│   ├── generated/prisma/           ← Cliente Prisma generado (no editar)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── form/
│   │   ├── DocumentItemRow.tsx
│   │   ├── FormShell.tsx
│   │   ├── StepOne.tsx
│   │   ├── StepThree.tsx
│   │   └── StepTwo.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Select.tsx
│   ├── PhotoCapture.tsx
│   └── ProgressBar.tsx
├── lib/
│   ├── context/FormContext.tsx     ← Estado global formulario multi-paso
│   ├── db/prisma.ts                ← Singleton Prisma + driver adapter pg
│   ├── google/
│   │   ├── auth.ts                 ← GoogleAuth (Service Account)
│   │   ├── drive.ts                ← Carpetas + upload + caché
│   │   └── sheets.ts               ← appendSheetRow
│   ├── image/processor.ts          ← Pipeline Sharp (efecto escáner)
│   ├── pdf/generator.ts            ← generateRecordPdf + buildPdfFileName
│   ├── records/processor.ts        ← Orquestador del pipeline completo
│   ├── upload/tempStorage.ts       ← Gestión de /tmp
│   ├── validation/schemas.ts       ← Zod: validaciones compartidas
│   └── logger.ts                   ← Logger JSON estructurado
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── docs/
│   ├── ARCHITECTURE.md             ← Este archivo
│   ├── GOOGLE_SETUP.md
│   └── DEPLOYMENT_DIGITALOCEAN.md
├── nginx/nginx.conf
├── scripts/entrypoint.sh
├── Dockerfile
├── docker-compose.yml              ← Desarrollo local
├── docker-compose.prod.yml         ← Producción (con Nginx + Certbot)
└── .env.example
```
