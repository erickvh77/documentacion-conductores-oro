# Guía de configuración de Google Cloud

Esta guía explica paso a paso cómo crear las credenciales necesarias para que la aplicación pueda subir archivos a **Google Drive** y registrar filas en **Google Sheets**.

---

## Resumen del flujo

```
Google Cloud Project
  └── Service Account (cuenta de servicio)
        ├── Credenciales JSON (email + clave privada)
        ├── Acceso compartido a la carpeta de Drive
        └── Acceso compartido al Spreadsheet de Sheets
```

La aplicación **nunca** usa credenciales de usuario. Todo se hace a través de una cuenta de servicio con permisos mínimos.

---

## Paso 1 — Crear un proyecto en Google Cloud

1. Ir a [https://console.cloud.google.com](https://console.cloud.google.com)
2. Hacer clic en **Seleccionar proyecto** → **Nuevo proyecto**
3. Nombre sugerido: `documentacion-conductores`
4. Hacer clic en **Crear**
5. Asegurarse de que el nuevo proyecto esté seleccionado en el menú superior

---

## Paso 2 — Habilitar las APIs necesarias

1. En el menú lateral ir a **APIs y servicios** → **Biblioteca**
2. Buscar y habilitar:
   - **Google Drive API** → botón **Habilitar**
   - **Google Sheets API** → botón **Habilitar**

---

## Paso 3 — Crear la cuenta de servicio

1. Ir a **APIs y servicios** → **Credenciales**
2. Hacer clic en **Crear credenciales** → **Cuenta de servicio**
3. Completar:
   - **Nombre**: `conductores-app`
   - **ID de cuenta**: se genera automáticamente
   - **Descripción**: `Cuenta de servicio para la app de documentación de conductores`
4. Hacer clic en **Crear y continuar**
5. En **Conceder acceso**, no es necesario agregar roles de proyecto
6. Hacer clic en **Listo**

---

## Paso 4 — Generar la clave privada (JSON)

1. En la lista de cuentas de servicio, hacer clic en la recién creada
2. Ir a la pestaña **Claves**
3. Hacer clic en **Agregar clave** → **Crear nueva clave**
4. Seleccionar formato **JSON** → **Crear**
5. Se descarga automáticamente un archivo `.json` con este formato:

```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "conductores-app@proyecto.iam.gserviceaccount.com",
  "client_id": "...",
  ...
}
```

6. **Guardar este archivo de forma segura**. Nunca subirlo a Git.

---

## Paso 5 — Configurar Google Drive

### 5.1 Crear la carpeta raíz de documentos

1. Ir a [Google Drive](https://drive.google.com)
2. Crear una carpeta llamada `Documentacion` (o el nombre que prefiera)
3. Abrir la carpeta y copiar el **ID** de la URL:
   ```
   https://drive.google.com/drive/folders/1ABC123XYZxxxxxxxxxxxxxxxxx
                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                            Este es el FOLDER_ID
   ```

### 5.2 Compartir la carpeta con la cuenta de servicio

1. Hacer clic derecho sobre la carpeta → **Compartir**
2. En el campo de correo, pegar el `client_email` del JSON descargado:
   ```
   conductores-app@proyecto.iam.gserviceaccount.com
   ```
3. Asignar rol **Editor**
4. Desmarcar "Notificar a las personas"
5. Hacer clic en **Compartir**

---

## Paso 6 — Configurar Google Sheets

### 6.1 Crear el spreadsheet de registros

1. Ir a [Google Sheets](https://sheets.google.com)
2. Crear un nuevo spreadsheet
3. Renombrar la primera hoja como `Registros` (exactamente así, con R mayúscula)
4. Agregar los encabezados en la **fila 1** en este orden exacto:

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S | T | U | V |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fecha_hora | placa | manifiesto | cliente | agencia | numero_contenedor | liquidacion_entregada | liquidacion_url_foto | cumplido_entregado | cumplido_url_foto | remesa_entregada | remesa_url_foto | salida_puerto_entregada | salida_puerto_url_foto | contenedor_vacio_entregado | contenedor_vacio_url_foto | otros_entregado | otros_descripcion | otros_url_foto | pdf_url | estado_registro | observaciones |

5. Copiar el **ID** del spreadsheet desde la URL:
   ```
   https://docs.google.com/spreadsheets/d/1DEF456ABCxxxxxxxxxxxxxxxxx/edit
                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                          Este es el SPREADSHEET_ID
   ```

### 6.2 Compartir el spreadsheet con la cuenta de servicio

1. Botón **Compartir** en la esquina superior derecha
2. Pegar el `client_email` de la cuenta de servicio
3. Asignar rol **Editor**
4. Hacer clic en **Compartir**

---

## Paso 7 — Configurar las variables de entorno

Con los datos obtenidos, completar el archivo `.env`:

```env
# Email de la cuenta de servicio (campo "client_email" del JSON)
GOOGLE_SERVICE_ACCOUNT_EMAIL="conductores-app@proyecto.iam.gserviceaccount.com"

# Clave privada (campo "private_key" del JSON)
# Copiar exactamente incluyendo los -----BEGIN/END PRIVATE KEY-----
# Reemplazar cada salto de línea real por \n
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"

# ID de la carpeta raíz de Drive
GOOGLE_DRIVE_ROOT_FOLDER_ID="1ABC123XYZxxxxxxxxxxxxxxxxx"

# ID del spreadsheet de Sheets
GOOGLE_SHEETS_SPREADSHEET_ID="1DEF456ABCxxxxxxxxxxxxxxxxx"
```

> **Nota sobre la clave privada en .env:**
> En el archivo JSON la clave tiene saltos de línea reales (`\n` literales).
> En el `.env` deben quedar como `\n` (barra + n), no como saltos de línea reales.
> Si copias directamente el valor entre comillas del JSON, reemplaza cada salto de línea por `\n`.

---

## Verificación rápida

Una vez configurado, arrancar la app y hacer un registro de prueba.

Verificar que:
- [ ] Aparece una carpeta nueva en Drive con la estructura `Mes/Día/MANIFIESTO_xxx/`
- [ ] Las imágenes están en `fotos_originales/` y `fotos_procesadas/`
- [ ] El PDF está en la carpeta del manifiesto
- [ ] Aparece una fila nueva en el Spreadsheet

---

## Solución de problemas comunes

| Error | Causa probable | Solución |
|---|---|---|
| `The caller does not have permission` | La carpeta/sheet no está compartida con la cuenta de servicio | Verificar paso 5.2 y 6.2 |
| `invalid_grant` | La clave privada tiene formato incorrecto | Verificar que los `\n` son correctos en el .env |
| `File not found` | El FOLDER_ID o SPREADSHEET_ID es incorrecto | Copiar el ID exactamente de la URL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL not set` | La variable de entorno no está cargada | Verificar que el archivo .env existe y tiene el valor |
