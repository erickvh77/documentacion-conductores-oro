# PROJECT_BRIEF.md — Aplicación de digitalización documental para conductores

## 1. Rol esperado de Claude Code

Actúa como un desarrollador senior de IA y automatización profesional, especializado en:

- Aplicaciones web productivas.
- Automatización documental.
- Integración con Google Drive y Google Sheets.
- Procesamiento de imágenes tipo escáner profesional.
- Generación automática de PDF.
- Backend seguro, escalable y mantenible.
- Despliegue en servidor Linux, preferiblemente DigitalOcean.
- Buenas prácticas de arquitectura, seguridad, auditoría y mantenimiento.

Tu objetivo no es crear un demo, sino generar una aplicación lista para evolucionar a producción.

---

## 2. Contexto operativo

En la empresa de transporte, los conductores pasan por un punto estratégico para realizar una pausa activa y entregar documentación física del viaje.

Actualmente, un funcionario recibe la documentación, la escanea y organiza las imágenes manualmente en Google Drive con esta estructura:

```text
/Documentacion/
  /Mes/
    /Dia/
      /Manifiesto/
        fotos guardadas con referencia a la placa
```

Además, se llena un Google Sheet indicando qué documentos fueron entregados.

La aplicación debe reemplazar o mejorar este proceso, permitiendo que el conductor o funcionario registre la información desde un celular y capture las fotos directamente desde la app.

---

## 3. Objetivo general

Crear una aplicación web responsive, usable desde celular, que permita:

1. Registrar datos básicos del viaje como nombre conductor,placa del vehiculo, numero de manifiesto, nombre del cliente(Lista desplegable con los nombres de los clientes). y tambien permitir seleccionar de una lista desplegable el nombre de la agencia (Armenia, Buga, Bugalagrande, Buenaventura, Pereira, Bogotá, Cartagena)
2. Seleccionar qué documentos fueron entregados.
3. Exigir fotografía cuando un documento sea marcado como entregado.
4. Procesar las imágenes para que parezcan escaneos profesionales.
5. Generar un único PDF por cada registro con todas las fotos tomadas.
6. Guardar las fotos y el PDF en Google Drive usando una estructura ordenada por mes, día y manifiesto.
7. Registrar el resultado en Google Sheets.
8. Permitir despliegue productivo en DigitalOcean o servidor similar.

---

## 4. Flujo funcional principal

### 4.1 Inicio del registro

La aplicación se usará desde un celular ubicado en el punto estratégico.

El usuario debe ingresar:
- Nombre conductor
- Placa del vehículo.
- Número de manifiesto.
- Nombre de cliente
- Nombre de agencia

Luego presiona el botón **Siguiente**.

---

### 4.2 Selección de documentación

Después de ingresar los datos principales, la app debe mostrar una lista de documentos con opción **Sí / No**.

Documentos principales:

1. Liquidación.
2. Cumplido.
3. Remesa.
4. Salida de puerto.
5. Devolución de contenedor vacío.
6. Otros.

También pueden existir documentos adicionales como:

- Remisión.
- Facturas de bodega.

---

### 4.3 Regla de captura de foto

Para cada documento:

- Si el usuario selecciona **Sí**, la aplicación debe exigir tomar o subir una fotografía.
- Si el usuario selecciona **No**, no debe pedir fotografía.

La foto debe procesarse como escáner profesional, aplicando mejoras como:

- Recorte automático o asistido.
- Corrección de perspectiva, si es posible.
- Conversión a escala de grises o alto contraste.
- Mejora de nitidez.
- Compresión controlada.
- Orientación correcta.
- Validación mínima de calidad.

---

### 4.4 Caso especial: devolución de contenedor vacío

El documento **Devolución de contenedor vacío** tiene una regla especial:

- Si se selecciona **Sí**, debe exigir:
  - Foto del tiquete o soporte.
  - Número de contenedor.
  - Numero de manifiesto asociado.

Este caso no necesariamente está atado al manifiesto, sino al número de contenedor entregado en puerto.

Aun así, debe quedar relacionado con el registro general del conductor, placa, cliente, fecha y manifiesto si fue ingresado.

---

### 4.5 Campo Otros

El campo **Otros** debe funcionar igual que los documentos principales:

- Si se selecciona **Sí**, debe exigir:
  - Descripción del documento.
  - Foto del documento.

- Si se selecciona **No**, no pide nada adicional.

---

## 5. Generación de PDF

Por cada registro realizado, la aplicación debe:

1. Tomar todas las fotos cargadas durante ese registro.
2. Convertirlas en imágenes tipo escáner profesional.
3. Crear un solo archivo PDF con todas las imágenes.
4. Nombrar el PDF con una convención clara.

Ejemplo de nombre de archivo:

```text
2026-05-09_PLACA123_MANIFIESTO456_CLIENTE.pdf
```

Si incluye devolución de contenedor vacío:

```text
2026-05-09_PLACA123_CONTENEDOR_ABCD1234567.pdf
```

El PDF debe contener las imágenes en orden lógico:

1. Liquidación.
2. Cumplido.
3. Remesa.
4. Salida de puerto.
5. Devolución de contenedor vacío.
6. Otros.

---

## 6. Organización en Google Drive

La aplicación debe crear automáticamente carpetas si no existen.

Estructura requerida:

```text
/Documentacion/
  /2026-05 Mayo/
    /2026-05-09/
      /MANIFIESTO_456/
        /fotos_originales/
        /fotos_procesadas/
        2026-05-09_PLACA123_MANIFIESTO456_CLIENTE.pdf
```

Para documentos de contenedor vacío, considerar una subestructura adicional:

```text
/Documentacion/
  /2026-05 Mayo/
    /2026-05-09/
      /Contenedores/
        /CONTENEDOR_ABCD1234567/
          fotos_originales/
          fotos_procesadas/
          2026-05-09_PLACA123_CONTENEDOR_ABCD1234567.pdf
```

La aplicación debe permitir configurar el ID de carpeta raíz de Google Drive mediante variable de entorno.

---

## 7. Registro en Google Sheets

Cada registro debe quedar guardado en Google Sheets.

Columnas sugeridas:

```text
fecha_hora
placa
manifiesto
cliente
numero_contenedor
liquidacion_entregada
liquidacion_url_foto
cumplido_entregado
cumplido_url_foto
remesa_entregada
remesa_url_foto
salida_puerto_entregada
salida_puerto_url_foto
devolucion_contenedor_vacio_entregada
devolucion_contenedor_vacio_url_foto
otros_entregado
otros_descripcion
otros_url_foto
pdf_url
agencia_registro
estado_registro
observaciones
```

El sistema debe guardar:

- Sí / No por cada documento.
- URL de cada imagen en Drive.
- URL del PDF final.
- Fecha y hora del registro.
- Agencia que hizo el registro.

---

## 8. Usuarios y seguridad

La aplicación debe estar preparada para producción.

Debe incluir:

- No debe existir login, la vista principal debe de mostrar de una vez los campos input para empezar con el registro de las fotos.
- No guardar credenciales sensibles en el código.
- Validación de datos de entrada.
- Registro de auditoría.
- Manejo seguro de archivos.
- Límite de tamaño de imágenes.
- Control de errores.

---

## 9. Arquitectura sugerida

Crear una aplicación full stack con una arquitectura limpia.

### Opción recomendada

Frontend y backend en un solo proyecto usando:

- Next.js.
- TypeScript.
- Tailwind CSS.
- API Routes o backend separado.
- PostgreSQL como base de datos.
- Prisma ORM.
- Google Drive API.
- Google Sheets API.
- Librerías de procesamiento de imágenes.
- Librería para generación de PDF.

### Alternativa válida

Backend:

- Node.js con Express o NestJS.
- TypeScript.
- PostgreSQL.
- Prisma.

Frontend:

- React.
- Tailwind CSS.
- PWA responsive para celular.

---

## 10. Base de datos sugerida

Crear una base de datos PostgreSQL con tablas como:


### document_records

```text
id
placa
nombre_conductor
manifiesto
cliente
numero_contenedor
pdf_url
drive_folder_url
estado
created_by
created_at
updated_at
```

### document_items

```text
id
record_id
document_type
is_delivered
description
original_image_url
processed_image_url
created_at
```

### audit_logs

```text
id
agencia_name
action
entity_type
entity_id
metadata
created_at
```

---

## 11. Validaciones principales

La aplicación debe validar:

- La placa es obligatoria.
- El cliente es obligatorio.
- Nombre conductor obligatorio
- El manifiesto es obligatorio, excepto si el flujo es exclusivamente por contenedor.
- Nombre agencia obligatoria.
- Si un documento está marcado como Sí, la foto es obligatoria.
- Si devolución de contenedor vacío está marcado como Sí, el número de contenedor es obligatorio.
- Si Otros está marcado como Sí, la descripción y la foto son obligatorias.
- No permitir finalizar el registro si faltan fotos requeridas.
- Confirmar antes de enviar.
- Mostrar resumen antes de guardar.

---

## 12. Experiencia de usuario móvil

La aplicación debe estar optimizada para celular.

Características esperadas:

- Interfaz simple y grande para uso operativo.
- Botones claros Sí / No.
- Captura de cámara directa.
- Vista previa de la foto.
- Opción para repetir foto.
- Barra de progreso.
- Pantalla final con confirmación.
- Mensajes claros de error.
- Indicador de carga durante subida de archivos y generación del PDF.
- Diseño responsive.
- Posibilidad futura de PWA.

---

## 13. Procesamiento de imágenes

Implementar una capa de procesamiento de imágenes que permita:

- Recibir imagen original.
- Optimizar tamaño.
- Corregir orientación.
- Mejorar contraste.
- Convertir a apariencia de escáner.
- Guardar imagen original y procesada.
- Usar la imagen procesada para el PDF.

Librerías sugeridas:

- sharp para procesamiento de imágenes en Node.js.
- pdf-lib o PDFKit para generación de PDF.
- multer, formidable o equivalente para carga de archivos.

---

## 14. Integración con Google Drive

La aplicación debe usar Google Drive API para:

- Crear carpetas.
- Buscar si una carpeta ya existe.
- Subir imágenes originales.
- Subir imágenes procesadas.
- Subir PDF final.
- Obtener URL de cada archivo.
- Guardar los IDs de archivos y carpetas.

La autenticación recomendada es con una cuenta de servicio de Google Cloud.

Las credenciales deben cargarse desde variables de entorno.

Variables sugeridas:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
GOOGLE_SHEETS_SPREADSHEET_ID=
DATABASE_URL=
NEXTAUTH_SECRET=
APP_URL=
```

---

## 15. Integración con Google Sheets

La aplicación debe usar Google Sheets API para:

- Insertar una fila por cada registro finalizado.
- Actualizar estado si ocurre un error.
- Guardar URLs de fotos y PDF.
- Mantener trazabilidad operativa.

---

## 16. Estados del registro

El sistema debe manejar estados como:

```text
BORRADOR
VALIDADO
PROCESANDO
SUBIDO_A_DRIVE
REGISTRADO_EN_SHEETS
COMPLETADO
ERROR
```

---

## 17. Manejo de errores

La aplicación debe:

- Mostrar errores claros al usuario.
- Guardar errores técnicos en logs.
- Permitir reintentar subida.
- No perder datos si falla la conexión.
- Evitar registros duplicados.
- Usar transacciones cuando aplique.
- Guardar estado parcial del proceso.

---

## 18. Requisitos de despliegue

Preparar el proyecto para desplegar en DigitalOcean.

Debe incluir:

- Dockerfile.
- docker-compose.yml.
- Variables de entorno.
- Configuración para PostgreSQL.
- Scripts de migración de base de datos.
- Instrucciones de despliegue.
- README.md técnico.
- Comandos para desarrollo local.
- Comandos para producción.

---

## 19. Entregables esperados de Claude Code

Genera el proyecto completo con:

1. Código fuente de frontend.
2. Código fuente de backend.
3. Modelo de base de datos.
4. Integración con Google Drive.
5. Integración con Google Sheets.
6. Procesamiento de imágenes.
7. Generación de PDF.
8. Autenticación y roles.
9. Validaciones.
10. Dockerfile.
11. docker-compose.yml.
12. README.md.
13. Archivo `.env.example`.
14. Guía de despliegue en DigitalOcean.
15. Guía de configuración de Google Cloud.
16. Tests básicos.
17. Estructura limpia y escalable.

---

## 20. Prompt maestro para Claude Code

Usa este prompt directamente en Claude Code:

```text
Quiero que construyas una aplicación web productiva, no un demo, para digitalizar y organizar documentación entregada por conductores en un punto estratégico de una empresa de transporte.

Actúa como desarrollador senior de IA y automatización profesional. Debes diseñar y construir una solución escalable, segura y mantenible, preparada para desplegarse en DigitalOcean.

Contexto:
Los conductores llegan a un punto estratégico para realizar pausa activa y entregar documentación física del viaje. Actualmente un funcionario recibe la documentación, la escanea, la organiza en Google Drive por mes, día y manifiesto, y registra en Google Sheets qué documentos fueron entregados.

Necesito reemplazar ese proceso con una aplicación web responsive para celular.

Flujo:
1. El usuario ingresa placa, manifiesto y cliente, nombre conductor, nombre agencia.
2. Presiona Siguiente.
3. La app muestra una lista de documentos con opción Sí / No:
   - Liquidación.
   - Cumplido.
   - Remesa.
   - Salida de puerto.
   - Devolución de contenedor vacío.
   - Otros.
4. Si un documento se marca como Sí, debe exigir foto.
5. Si se marca como No, no exige foto.
6. Para Devolución de contenedor vacío, si se marca Sí, debe exigir foto y número de contenedor.
7. Para Otros, si se marca Sí, debe exigir descripción y foto.
8. Las fotos deben procesarse para quedar como escáner profesional.
9. Todas las fotos tomadas en un registro deben convertirse en un solo PDF.
10. El PDF y las fotos deben guardarse en Google Drive.
11. El registro debe quedar guardado en Google Sheets con URLs de fotos y PDF.

Estructura de Drive requerida:
/Documentacion/
  /Año-Mes/
    /Fecha/
      /MANIFIESTO_numero/
        /fotos_originales/
        /fotos_procesadas/
        archivo_pdf_final.pdf

Para contenedores:
/Documentacion/
  /Año-Mes/
    /Fecha/
      /Contenedores/
        /CONTENEDOR_numero/
          /fotos_originales/
          /fotos_procesadas/
          archivo_pdf_final.pdf

Requisitos técnicos:
- Usa Next.js con TypeScript.
- Usa Tailwind CSS.
- Usa PostgreSQL con Prisma.
- Integra Google Drive API.
- Integra Google Sheets API.
- Usa cuenta de servicio de Google Cloud.
- Usa variables de entorno.
- Usa sharp para procesamiento de imágenes.
- Usa pdf-lib o PDFKit para generar PDF.
- Prepara Dockerfile y docker-compose.yml.
- Incluye README.md.
- Incluye .env.example.
- Incluye guía de despliegue en DigitalOcean.
- Incluye guía de configuración de Google Cloud.
- Incluye validaciones de frontend y backend.
- Incluye manejo de errores y logs.
- Incluye estructura limpia por capas.

Validaciones:
- Placa obligatoria.
- Cliente obligatorio.
- Nombre conductor.
- Manifiesto obligatorio, excepto cuando el flujo sea solo de contenedor.
- Nombre agencia.
- Foto obligatoria cuando un documento esté en Sí.
- Número de contenedor obligatorio cuando devolución de contenedor vacío esté en Sí.
- Descripción y foto obligatorias cuando Otros esté en Sí.
- No permitir finalizar si faltan datos requeridos.
- Mostrar resumen antes de enviar.

Base de datos:
Crea tablas para document_records, document_items y audit_logs.

Google Sheets:
Cada registro debe insertar una fila con:
fecha_hora, placa, manifiesto, cliente, numero_contenedor, estado de cada documento, URL de cada foto, URL del PDF, agencia_registro, estado_registro y observaciones.

Objetivo:
Genera el proyecto completo listo para correr localmente y posteriormente desplegar en DigitalOcean. Antes de escribir código, propón la arquitectura, estructura de carpetas y plan de implementación. Después implementa paso a paso.
```

---

## 21. Forma recomendada de trabajar con Claude Code

Para mejores resultados, no pidas todo en una sola ejecución sin control.

Trabaja por fases:

### Fase 1 — Diseño técnico

Pídele a Claude Code:

```text
Lee PROJECT_BRIEF.md y propón la arquitectura final, estructura de carpetas, modelo de base de datos y flujo de usuario antes de generar código.
```

### Fase 2 — Base del proyecto

```text
Crea la base del proyecto Next.js con TypeScript, Tailwind, Prisma, PostgreSQL, autenticación y roles.
```

### Fase 3 — Formulario móvil

```text
Implementa el flujo móvil de registro: placa, manifiesto, cliente, selección Sí/No de documentos, captura de fotos, validaciones y resumen final.
```

### Fase 4 — Procesamiento documental

```text
Implementa procesamiento de imágenes tipo escáner profesional y generación de PDF único por registro.
```

### Fase 5 — Integraciones Google

```text
Implementa integración con Google Drive y Google Sheets usando cuenta de servicio y variables de entorno.
```

### Fase 6 — Producción

```text
Agrega Dockerfile, docker-compose.yml, README.md, .env.example, guía de despliegue en DigitalOcean y pruebas básicas.
```

---

## 22. Criterios de aceptación

La solución se considera correcta cuando:

- Puede registrar placa, manifiesto y cliente, nombre conductor, nombre agencia.
- Puede marcar documentos como Sí / No.
- La app exige foto cuando corresponde.
- La app exige número de contenedor cuando corresponde.
- La app exige descripción para Otros cuando corresponde.
- Las fotos quedan procesadas como escáner.
- Se genera un PDF único por registro.
- Se crean carpetas automáticamente en Google Drive.
- Se suben fotos originales, procesadas y PDF.
- Se registra una fila en Google Sheets.
- El sistema puede ejecutarse localmente con Docker.
- El sistema tiene instrucciones claras para desplegar en DigitalOcean.
- El código no contiene credenciales quemadas.
- El proyecto tiene estructura mantenible.

---

## 23. Recomendación final

La forma más eficaz de pasar esta información a Claude Code es crear este archivo como `PROJECT_BRIEF.md` dentro del repositorio y luego pedirle que lo lea antes de generar código.

También se recomienda crear archivos adicionales:

```text
/docs/ARCHITECTURE.md
/docs/GOOGLE_SETUP.md
/docs/DEPLOYMENT_DIGITALOCEAN.md
/docs/USER_FLOW.md
.env.example
```

Esto ayuda a que Claude Code trabaje de forma ordenada, documentada y orientada a producción.
