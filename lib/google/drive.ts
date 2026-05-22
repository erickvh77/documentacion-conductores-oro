/**
 * Google Drive API — operaciones de la app.
 * Usa GoogleAuth + caché de folder IDs en PostgreSQL.
 *
 * NOTA sobre Service Accounts y cuota de almacenamiento:
 * Los Service Accounts no tienen cuota propia. Para que los archivos
 * se almacenen correctamente existen dos opciones:
 *
 * Opción A (recomendada — Google Workspace):
 *   Usar una Unidad Compartida (Shared Drive). El SA debe ser miembro
 *   con rol "Content Manager". Activar supportsAllDrives: true (ya incluido).
 *
 * Opción B (Gmail personal o Workspace):
 *   Configurar GOOGLE_OWNER_EMAIL con el email del dueño de la carpeta raíz.
 *   El SA transfiere la propiedad de cada archivo/carpeta al dueño inmediatamente
 *   después de crearlos. Requiere que la carpeta raíz esté compartida con el SA.
 */

import { google } from "googleapis";
import { Readable } from "stream";
import { getGoogleAuth } from "./auth";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

const MIME_FOLDER = "application/vnd.google-apps.folder";

function getDrive() {
  return google.drive({ version: "v3", auth: getGoogleAuth() });
}

// ─── Transferir propiedad al dueño configurado (Opción B) ────────────────────
async function transferOwnershipIfConfigured(
  drive: ReturnType<typeof getDrive>,
  fileId: string
): Promise<void> {
  const ownerEmail = process.env.GOOGLE_OWNER_EMAIL;
  if (!ownerEmail) return; // Opción A (Shared Drive) — no necesita transferencia

  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        type: "user",
        role: "owner",
        emailAddress: ownerEmail,
      },
      transferOwnership: true,
      supportsAllDrives: true,
    });
  } catch (err) {
    // No lanzar error — algunos dominios Workspace bloquean transferencias entre dominios
    logger.warn("No se pudo transferir propiedad del archivo", { fileId, ownerEmail, err });
  }
}

// ─── Buscar carpeta por nombre dentro de un padre ────────────────────────────
async function findFolder(name: string, parentId: string): Promise<string | null> {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='${MIME_FOLDER}' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
    corpora: "allDrives",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

// ─── Crear carpeta ────────────────────────────────────────────────────────────
async function createFolder(name: string, parentId: string): Promise<string> {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: MIME_FOLDER,
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = res.data.id;
  if (!id) throw new Error(`No se pudo crear la carpeta: ${name}`);

  await transferOwnershipIfConfigured(drive, id);

  return id;
}

// ─── Buscar o crear carpeta (con caché en BD) ─────────────────────────────────
export async function findOrCreateFolder(
  name: string,
  parentId: string,
  cacheKey?: string
): Promise<string> {
  const key = cacheKey ?? `${parentId}/${name}`;

  const cached = await prisma.driveFolderCache.findUnique({
    where: { folderPath: key },
  });
  if (cached) {
    logger.debug("Drive folder from cache", { key, driveId: cached.driveId });
    return cached.driveId;
  }

  let folderId = await findFolder(name, parentId);
  if (!folderId) {
    folderId = await createFolder(name, parentId);
    logger.info("Drive folder created", { name, parentId, folderId });
  }

  await prisma.driveFolderCache.upsert({
    where: { folderPath: key },
    update: { driveId: folderId },
    create: { folderPath: key, driveId: folderId },
  });

  return folderId;
}

// ─── Eliminar archivo de Drive ───────────────────────────────────────────────
export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

// ─── Descargar archivo de Drive como Buffer ───────────────────────────────────
export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  const data = res.data as unknown;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data as ArrayBuffer);
}

// ─── URL pública de un archivo Drive ─────────────────────────────────────────
export function getDriveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function getDriveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

// ─── Subir archivo a Drive ────────────────────────────────────────────────────
export async function uploadFile(options: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  parentId: string;
}): Promise<{ id: string; url: string }> {
  const drive = getDrive();
  const stream = Readable.from(options.buffer);

  const res = await drive.files.create({
    requestBody: {
      name: options.fileName,
      parents: [options.parentId],
    },
    media: {
      mimeType: options.mimeType,
      body: stream,
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const id = res.data.id;
  if (!id) throw new Error(`Error al subir archivo: ${options.fileName}`);

  // Transferir propiedad si está configurado GOOGLE_OWNER_EMAIL (Opción B)
  await transferOwnershipIfConfigured(drive, id);

  // Permitir acceso con link (solo para My Drive — en Shared Drive el link ya funciona)
  try {
    await drive.permissions.create({
      fileId: id,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });
  } catch {
    logger.warn("No se pudo crear permiso público para el archivo", { id });
  }

  const url = getDriveFileUrl(id);
  logger.info("Archivo subido a Drive", { fileName: options.fileName, id });
  return { id, url };
}

// ─── Crear estructura de carpetas para un registro ────────────────────────────
//
// Estructura en Drive:
//   {ROOT}/
//     Documentacion/
//       {YYYY-MM Mes}/                 ej. "2026-05 Mayo"
//         MANIFIESTO_{num}/
//           fotos_originales/
//           fotos_procesadas/
//           {fecha}_{PLACA}_{MANIFIESTO}_{CLIENTE}.pdf
//
export async function ensureRecordFolderStructure(options: {
  fecha: Date;
  manifiesto?: string;
}): Promise<{
  manifestoFolderId: string;
  originalesFolderId: string;
  procesadasFolderId: string;
  manifestoFolderUrl: string;
}> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID no está configurado");

  const fecha = options.fecha;
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const monthName = fecha.toLocaleDateString("es-CO", { month: "long" });
  const mesKey = `${year}-${month} ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;

  // Nivel 1: /Documentacion/
  const docFolderId = await findOrCreateFolder(
    "Documentacion",
    rootId,
    "root/Documentacion"
  );

  // Nivel 2: /Documentacion/{YYYY-MM Mes}/
  const mesFolderId = await findOrCreateFolder(
    mesKey,
    docFolderId,
    `root/Documentacion/${mesKey}`
  );

  // Nivel 3: /MANIFIESTO_{num}/ — directamente bajo el mes
  const folderName = `MANIFIESTO_${options.manifiesto}`;

  const manifestoFolderId = await findOrCreateFolder(
    folderName,
    mesFolderId,
    `root/Documentacion/${mesKey}/${folderName}`
  );

  // Nivel 4: subcarpetas de fotos
  const cacheBase = `root/Documentacion/${mesKey}/${folderName}`;
  const originalesFolderId = await findOrCreateFolder(
    "fotos_originales",
    manifestoFolderId,
    `${cacheBase}/fotos_originales`
  );
  const procesadasFolderId = await findOrCreateFolder(
    "fotos_procesadas",
    manifestoFolderId,
    `${cacheBase}/fotos_procesadas`
  );

  return {
    manifestoFolderId,
    originalesFolderId,
    procesadasFolderId,
    manifestoFolderUrl: getDriveFolderUrl(manifestoFolderId),
  };
}
