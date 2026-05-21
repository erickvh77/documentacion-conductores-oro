# CHANGE_REQUEST_V2.md

## Objetivo

Realizar ajustes funcionales y estructurales en la aplicación de digitalización documental para mejorar:

1. La trazabilidad documental por agencia.
2. La automatización del llenado de información del viaje.
3. La integración dinámica con Google Sheets.
4. La estructura de almacenamiento y auditoría.

---

# 1. Ajuste funcional por documento

## Requerimiento nuevo

Actualmente, cuando el usuario selecciona **SI** para un documento, el sistema únicamente exige subir una fotografía.

Ahora el sistema debe permitir además:

* Seleccionar la agencia que está cargando el documento.
* Registrar automáticamente la fecha y hora de carga del documento.
* Guardar esta información tanto en base de datos como en Google Sheets.

---

## Flujo esperado

Para cada documento:

### Caso SI

Si el usuario selecciona:

```text
SI
```

La aplicación debe mostrar obligatoriamente:

1. Captura o carga de fotografía.
2. Lista desplegable de agencias.
3. Fecha automática de carga.

---

## Lista de agencias

La agencia debe seleccionarse desde un componente tipo dropdown/select asi como ya lo tienes

## Fecha de carga

La fecha debe generarse automáticamente cuando la imagen es cargada correctamente.

Formato recomendado:

```text
YYYY-MM-DD HH:mm:ss
```

Ejemplo:

```text
2026-05-11 14:32:10
```

---

# 2. Cambios en Google Sheets

## Estructura actual

Actualmente se registra:

```text
liquidacion_entregada
liquidacion_url_foto
```

---

## Nueva estructura requerida

Para cada documento debe quedar:

```text
liquidacion_entregada
liquidacion_url_foto
agencia_liquidacion
fecha_liquidacion
```

---

## Aplicar la misma estructura a TODOS los documentos

Ejemplo completo:

```text
cumplido_entregado
cumplido_url_foto
agencia_cumplido
fecha_cumplido

remesa_entregada
remesa_url_foto
agencia_remesa
fecha_remesa

salida_puerto_entregada
salida_puerto_url_foto
agencia_salida_puerto
fecha_salida_puerto

devolucion_contenedor_vacio_entregada
devolucion_contenedor_vacio_url_foto
agencia_devolucion_contenedor
fecha_devolucion_contenedor

otros_entregado
otros_url_foto
agencia_otros
fecha_otros
```

---

# 3. Ajuste del flujo principal de búsqueda

## Cambio importante

Actualmente el sistema solicita:

* Placa.
* Manifiesto.
* Cliente.

Esto debe cambiar completamente.

---

# Nuevo comportamiento requerido

El único criterio de búsqueda inicial será:

```text
Número de manifiesto
```

---

# 4. Integración con Google Sheet de VIAJES

## Nuevo Google Sheet

Existirá un Google Sheet llamado:

```text
VIAJES
```

Este archivo contendrá información operativa de los viajes.

---

## Estructura del archivo VIAJES

Columnas:

```text
MANIFIESTO
NOMBRE CLIENTE
PLACA VEHICULO
NOMBRE_CONDUCTOR
```

Ejemplo:

```text
MANIFIESTO | NOMBRE CLIENTE | PLACA VEHICULO | NOMBRE_CONDUCTOR

458721 | Alpina | ABC123 | Juan Perez
458722 | Bavaria | XYZ987 | Carlos Gomez
```

---

# 5. Nuevo flujo funcional

## Paso 1

El usuario ingresa únicamente:

```text
Número de manifiesto
```

---

## Paso 2

La aplicación debe consultar automáticamente el Google Sheet:

```text
VIAJES
```

---

## Paso 3

Si el manifiesto existe:

La aplicación debe traer automáticamente:

* NOMBRE CLIENTE
* PLACA VEHICULO
* NOMBRE_CONDUCTOR

y llenar automáticamente los campos de la aplicación.

---

# 6. Campos autocompletados

Los siguientes campos ya NO serán digitados manualmente:

```text
Cliente
Placa
Nombre conductor
```

Deben llegar desde el Google Sheet VIAJES.

---

# 7. Validaciones nuevas

## Si el manifiesto NO existe

Mostrar mensaje:

```text
No se encontró información para el manifiesto ingresado.
```

y no permitir continuar.

---

## Si el Google Sheet falla

Mostrar:

```text
No fue posible consultar la información del viaje.
Intente nuevamente.
```

---

# 8. Integración técnica esperada

## Google Sheets API

Implementar lectura del archivo:

```text
VIAJES
```

usando Google Sheets API.

---

## Flujo técnico sugerido

### Frontend

Cuando el usuario termine de escribir el manifiesto:

```text
onBlur
```

o

```text
debounce search
```

hacer llamada al backend:

```text
GET /api/viajes/:manifiesto
```

---

## Backend

El backend debe:

1. Consultar Google Sheets API.
2. Buscar el manifiesto.
3. Retornar:

```json
{
  "manifiesto": "458721",
  "cliente": "Alpina",
  "placa": "ABC123",
  "conductor": "Juan Perez"
}
```

---

# 9. Optimización recomendada

Para evitar demasiadas consultas a Google Sheets:

Implementar:

* Caché temporal.
* Memoria local.
* Redis futuro.
* Revalidación periódica.

---

# 10. Ajustes requeridos en base de datos

## Tabla document_items

Agregar:

```text
agency_name
uploaded_at
```

---

## Tabla document_records

Agregar:

```text
driver_name
```

---

# 11. Ajustes requeridos en frontend

## Formulario inicial

ANTES:

```text
Placa
Cliente
Manifiesto
```

AHORA:

```text
Número de manifiesto
```

y luego mostrar automáticamente:

```text
Cliente
Placa
Conductor
```

como campos de solo lectura.

---

# 12. Ajustes requeridos en UI documental

Cuando un documento sea SI:

Mostrar:

```text
[ Capturar foto ]
[ Seleccionar agencia ]
```

---

# 13. Ajustes requeridos en PDF

El PDF final debe incluir:

* Tipo de documento.
* Agencia que cargó el documento.
* Fecha de carga del documento.

Ejemplo:

```text
Documento: Liquidación
Agencia: Buenaventura
Fecha carga: 2026-05-11 14:32
```

---

# 14. Ajustes requeridos en auditoría

Guardar:

* Agencia seleccionada.
* Usuario que cargó.
* Fecha exacta de carga.
* Nombre del conductor.
* Número de manifiesto consultado.

---

# 15. Entregables esperados

Actualizar:

1. Backend.
2. Frontend.
3. Prisma schema.
4. Migraciones.
5. Integración Google Sheets.
6. Validaciones.
7. PDF generator.
8. Google Sheets export.
9. Tipos TypeScript.
10. Formularios.
11. APIs.
12. Seeds si aplica.

---

# 16. Prompt sugerido para Claude Code

```text
Lee CHANGE_REQUEST_V2.md y realiza todos los ajustes solicitados en frontend, backend, Prisma, Google Sheets integration y generación de PDF.

IMPORTANTE:
- Mantén compatibilidad con la arquitectura actual.
- No rompas funcionalidades existentes.
- Genera migraciones Prisma nuevas.
- Ajusta tipos TypeScript.
- Ajusta validaciones frontend/backend.
- Actualiza endpoints necesarios.
- Implementa búsqueda automática de manifiesto desde Google Sheets VIAJES.
- Implementa selección de agencia por documento.
- Implementa fechas automáticas por documento.
- Actualiza exportación a Google Sheets.
- Actualiza generación de PDF.
- Actualiza auditoría.
- Mantén estructura limpia y escalable.
```
