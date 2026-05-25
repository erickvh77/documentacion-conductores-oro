/**
 * Processor de registros — pipeline completo post-captura.
 *
 * Pasos (registro nuevo):
 *  1. Leer imágenes temporales del disco
 *  2. Crear estructura de carpetas en Google Drive
 *  3. Subir imágenes originales y procesadas a Drive
 *  4. Generar PDF con pdf-lib (cabecera incluye agencia y fecha por doc)
 *  5. Subir PDF a Drive
 *  6. Actualizar URLs en PostgreSQL
 *  7. Registrar fila en Google Sheets (guarda el índice de fila)
 *  8. Marcar estado = COMPLETADO
 *  9. Limpiar archivos temporales
 *
 * Pasos (agregar documentos a registro existente):
 *  1. Subir nuevas imágenes a la carpeta Drive existente
 *  2. Regenerar PDF completo (descargando fotos antiguas de Drive)
 *  3. Actualizar URLs en PostgreSQL
 *  4. Actualizar (no duplicar) la fila en Google Sheets
 *  5. Marcar estado = COMPLETADO
 *  6. Limpiar archivos temporales
 */

import fs from "fs/promises";
import { prisma } from "@/lib/db/prisma";
import { uploadFile, ensureRecordFolderStructure, downloadFile, deleteFile } from "@/lib/google/drive";
import { appendSheetRow, updateSheetRow, findSheetRowByManifiesto, type SheetRowData } from "@/lib/google/sheets";
import { generateRecordPdf, buildPdfFileName } from "@/lib/pdf/generator";
import { logger } from "@/lib/logger";
import type { TipoDocumento } from "@/lib/validation/schemas";

// ─── Tipos internos ───────────────────────────────────────────────────────────

/** Foto almacenada en el campo JSON `photos` de un DocumentItem. */
interface PhotoJson {
  tempOriginalPath?: string | null;
  tempProcessedPath?: string | null;
  originalDriveId?: string | null;
  originalImageUrl?: string | null;
  processedDriveId?: string | null;
  processedImageUrl?: string | null;
  uploadedAt?: string | null;
}

interface ProcessedItem {
  id: string;
  tipoDocumento: TipoDocumento | string;  // string para compat. con CUMPLIDO legacy
  entregado: boolean;
  descripcion: string | null;
  // Primer foto (campos individuales — backward compat)
  tempOriginalPath: string | null;
  tempProcessedPath: string | null;
  originalDriveId: string | null;
  processedDriveId: string | null;
  agencyName: string | null;
  uploadedAt: Date | null;
  // Todas las fotos (campo JSON — nuevo formato multi-foto)
  photos: PhotoJson[] | null;
  sortOrder: number;
}

interface RecordWithRelations {
  id: string;
  placa: string;
  manifiesto: string | null;
  agencia: string | null;
  nombreConductor: string;
  numeroContenedor: string | null;
  createdAt: Date;
  pdfUrl: string | null;
  pdfDriveId: string | null;
  sheetsRowIndex: number | null;
  cliente: { nombre: string };
  items: ProcessedItem[];
}

// ─── Chequeo de credenciales Google ──────────────────────────────────────────

function hasGoogleConfig(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
    process.env.GOOGLE_PRIVATE_KEY?.trim() &&
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim() &&
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()
  );
}

// ─── Helper: formatear fecha de carga ────────────────────────────────────────

function formatItemDate(uploadedAt: Date | null | undefined): string {
  if (!uploadedAt) return "";
  const d = new Date(uploadedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

// ─── Helper: obtener la lista de fotos de un item ────────────────────────────
// Soporta tanto el nuevo formato (campo `photos` JSON) como el legado
// (campos individuales tempOriginalPath / processedDriveId).

function getItemPhotos(item: ProcessedItem): PhotoJson[] {
  // Nuevo formato: campo JSON photos con todas las fotos
  if (Array.isArray(item.photos) && item.photos.length > 0) {
    return item.photos as PhotoJson[];
  }
  // Formato legado: campos individuales → wrappear como un solo elemento
  if (item.tempOriginalPath || item.tempProcessedPath || item.processedDriveId) {
    return [{
      tempOriginalPath: item.tempOriginalPath,
      tempProcessedPath: item.tempProcessedPath,
      processedDriveId: item.processedDriveId,
      originalDriveId: item.originalDriveId,
      uploadedAt: item.uploadedAt?.toISOString() ?? null,
    }];
  }
  return [];
}

// ─── Helper: construir fila para Google Sheets ────────────────────────────────

function buildSheetRow(record: RecordWithRelations, pdfUrl: string): SheetRowData {
  const getItem = (tipo: string) =>
    (record.items as unknown as ProcessedItem[]).find((i) => i.tipoDocumento === tipo);

  const itemSiNo = (tipo: string): string => {
    const item = getItem(tipo);
    if (!item) return "No";
    return item.entregado ? "Sí" : "No";
  };

  const itemUrl = (tipo: string): string =>
    (getItem(tipo) as any)?.processedImageUrl ?? "";

  const itemAgency = (tipo: string): string =>
    getItem(tipo)?.agencyName ?? "";

  const itemDate = (tipo: string): string =>
    formatItemDate(getItem(tipo)?.uploadedAt);

  const otrosItem = getItem("OTROS") as any;

  const fechaHora = new Date(record.createdAt).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Derivar agencia del registro desde el primer ítem entregado con agencia
  const agenciaRegistro =
    record.agencia ??
    (record.items as unknown as ProcessedItem[]).find((i) => i.entregado && i.agencyName)?.agencyName ??
    "";

  return {
    // A–V
    fechaHora,
    placa: record.placa,
    manifiesto: record.manifiesto ?? "",
    cliente: (record.cliente as any)?.nombre ?? "",
    agencia: agenciaRegistro,
    numeroContenedor: record.numeroContenedor ?? "",
    liquidacionEntregada: itemSiNo("LIQUIDACION"),
    liquidacionUrlFoto: itemUrl("LIQUIDACION"),
    agenciaLiquidacion: itemAgency("LIQUIDACION"),
    fechaLiquidacion: itemDate("LIQUIDACION"),
    remesaEntregada: itemSiNo("REMESA"),
    remesaUrlFoto: itemUrl("REMESA"),
    agenciaRemesa: itemAgency("REMESA"),
    fechaRemesa: itemDate("REMESA"),
    salidaPuertoEntregada: itemSiNo("SALIDA_PUERTO"),
    salidaPuertoUrlFoto: itemUrl("SALIDA_PUERTO"),
    agenciaSalidaPuerto: itemAgency("SALIDA_PUERTO"),
    fechaSalidaPuerto: itemDate("SALIDA_PUERTO"),
    contenedorVacioEntregado: itemSiNo("CONTENEDOR_VACIO"),
    contenedorVacioUrlFoto: itemUrl("CONTENEDOR_VACIO"),
    agenciaContenedorVacio: itemAgency("CONTENEDOR_VACIO"),
    fechaContenedorVacio: itemDate("CONTENEDOR_VACIO"),
    otrosEntregado: itemSiNo("OTROS"),
    otrosDescripcion: otrosItem?.descripcion ?? "",
    otrosUrlFoto: itemUrl("OTROS"),
    agenciaOtros: itemAgency("OTROS"),
    fechaOtros: itemDate("OTROS"),
    pdfUrl,
    estadoRegistro: "COMPLETADO",
    observaciones: "",
  };
}

// ─── Helper: actualizar o insertar fila en Sheets ────────────────────────────

async function syncSheetRow(
  recordId: string,
  record: RecordWithRelations,
  pdfUrl: string
): Promise<void> {
  const sheetRow = buildSheetRow(record, pdfUrl);

  // Intentar usar el índice guardado en BD primero
  let rowIndex = record.sheetsRowIndex;

  // Si no tenemos el índice, buscar en la hoja por placa+manifiesto (registros anteriores al feature)
  if ((!rowIndex || rowIndex < 2) && record.manifiesto) {
    rowIndex = await findSheetRowByManifiesto(record.placa, record.manifiesto);
    if (rowIndex) {
      logger.info("Fila encontrada en Sheets por búsqueda", { recordId, rowIndex });
    }
  }

  if (rowIndex && rowIndex >= 2) {
    await updateSheetRow(rowIndex, sheetRow);
    // Guardar índice en BD para evitar búsquedas futuras
    if (!record.sheetsRowIndex) {
      await prisma.documentRecord.update({
        where: { id: recordId },
        data: { sheetsRowIndex: rowIndex },
      });
    }
  } else {
    const newRowIndex = await appendSheetRow(sheetRow);
    if (newRowIndex > 0) {
      await prisma.documentRecord.update({
        where: { id: recordId },
        data: { sheetsRowIndex: newRowIndex },
      });
    }
  }
}

// ─── Pipeline: registro nuevo ─────────────────────────────────────────────────

export async function processRecord(recordId: string): Promise<string | null> {
  logger.info("Iniciando procesamiento de registro", { recordId });

  const record = await prisma.documentRecord.findUnique({
    where: { id: recordId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      cliente: { select: { nombre: true } },
    },
  });

  if (!record) throw new Error(`Registro ${recordId} no encontrado`);

  const deliveredItems = (record.items as unknown as ProcessedItem[]).filter(
    (i) => i.entregado && i.tempProcessedPath
  );

  if (!hasGoogleConfig()) {
    logger.warn("Google APIs no configuradas — registro guardado solo en BD (modo demo)", { recordId });
    await prisma.documentRecord.update({
      where: { id: recordId },
      data: {
        estado: "COMPLETADO",
        errorDetalle:
          "Google APIs no configuradas. Configure las variables de entorno para activar Drive y Sheets.",
      },
    });
    return null;
  }

  try {
    // ── 1. Estructura de carpetas en Drive ──────────────────────────────────
    const folderStructure = await ensureRecordFolderStructure({
      fecha: record.createdAt,
      manifiesto: record.manifiesto ?? undefined,
    });

    logger.info("Carpetas Drive listas", { recordId, manifestoFolderId: folderStructure.manifestoFolderId });

    // ── 2. Subir imágenes a Drive (soporta múltiples fotos por ítem) ──────────
    const fecha = record.createdAt.toISOString().slice(0, 10);

    for (const item of deliveredItems) {
      const itemPhotos = getItemPhotos(item);
      if (itemPhotos.length === 0) continue;

      const uploadedPhotos: PhotoJson[] = [];

      for (let i = 0; i < itemPhotos.length; i++) {
        const photo = itemPhotos[i];
        if (!photo.tempOriginalPath || !photo.tempProcessedPath) continue;

        let originalBuffer: Buffer;
        let processedBuffer: Buffer;
        try {
          [originalBuffer, processedBuffer] = await Promise.all([
            fs.readFile(photo.tempOriginalPath),
            fs.readFile(photo.tempProcessedPath),
          ]);
        } catch (readErr) {
          logger.error("No se pudo leer el archivo temporal", {
            recordId, itemId: item.id, photoIndex: i, error: String(readErr),
          });
          continue;
        }

        // Sufijo numérico solo cuando hay más de una foto
        const suffix = itemPhotos.length > 1 ? `_${String(i + 1).padStart(2, "0")}` : "";
        const baseName = `${fecha}_${record.placa}_${item.tipoDocumento}${suffix}`;

        const [origUpload, procUpload] = await Promise.all([
          uploadFile({ buffer: originalBuffer, fileName: `${baseName}_original.jpg`, mimeType: "image/jpeg", parentId: folderStructure.originalesFolderId }),
          uploadFile({ buffer: processedBuffer, fileName: `${baseName}_procesado.jpg`, mimeType: "image/jpeg", parentId: folderStructure.procesadasFolderId }),
        ]);

        uploadedPhotos.push({
          originalDriveId: origUpload.id,
          originalImageUrl: origUpload.url,
          processedDriveId: procUpload.id,
          processedImageUrl: procUpload.url,
          uploadedAt: photo.uploadedAt ?? null,
        });
      }

      if (uploadedPhotos.length === 0) continue;

      // Primer foto en campos individuales (backward compat) + todas en photos JSON
      await prisma.documentItem.update({
        where: { id: item.id },
        data: {
          originalImageUrl: uploadedPhotos[0].originalImageUrl,
          originalDriveId: uploadedPhotos[0].originalDriveId,
          processedImageUrl: uploadedPhotos[0].processedImageUrl,
          processedDriveId: uploadedPhotos[0].processedDriveId,
          photos: uploadedPhotos as any,
          tempOriginalPath: null,
          tempProcessedPath: null,
        },
      });

      logger.info("Imágenes subidas a Drive", {
        recordId, tipoDocumento: item.tipoDocumento, count: uploadedPhotos.length,
      });
    }

    // ── 3. Generar PDF ──────────────────────────────────────────────────────
    let pdfUrl: string | null = null;
    let pdfDriveId: string | null = null;

    if (deliveredItems.length > 0) {
      // Para el PDF leemos desde las rutas temporales (aún existen en este punto del pipeline)
      const pdfItems: import("@/lib/pdf/generator").PdfImageItem[] = [];

      for (const item of deliveredItems) {
        const itemPhotos = getItemPhotos(item);
        const buffers: { buf: Buffer; uploadedAt?: string | null }[] = [];

        for (const photo of itemPhotos) {
          if (!photo.tempProcessedPath) continue;
          try {
            const buf = await fs.readFile(photo.tempProcessedPath);
            buffers.push({ buf, uploadedAt: photo.uploadedAt });
          } catch {
            logger.warn("Imagen temporal no disponible para PDF", {
              recordId, tipoDocumento: item.tipoDocumento,
            });
          }
        }

        buffers.forEach(({ buf, uploadedAt }, idx) => {
          pdfItems.push({
            tipoDocumento: item.tipoDocumento as TipoDocumento,
            processedBuffer: buf,
            descripcion: item.descripcion ?? undefined,
            agencyName: item.agencyName ?? undefined,
            uploadedAt: uploadedAt ?? item.uploadedAt?.toISOString() ?? undefined,
            photoIndex: buffers.length > 1 ? idx + 1 : undefined,
            totalPhotos: buffers.length > 1 ? buffers.length : undefined,
          });
        });
      }

      if (pdfItems.length > 0) {
        const meta = {
          fecha: record.createdAt.toISOString().slice(0, 10),
          placa: record.placa,
          manifiesto: record.manifiesto ?? undefined,
          cliente: (record as any).cliente.nombre,
          agencia: record.agencia ?? "",
          numeroContenedor: record.numeroContenedor ?? undefined,
          conductor: record.nombreConductor,
        };

        const pdfBuffer = await generateRecordPdf(pdfItems, meta);
        const pdfFileName = buildPdfFileName(meta);

        const pdfUpload = await uploadFile({ buffer: pdfBuffer, fileName: pdfFileName, mimeType: "application/pdf", parentId: folderStructure.manifestoFolderId });
        pdfUrl = pdfUpload.url;
        pdfDriveId = pdfUpload.id;

        logger.info("PDF generado y subido a Drive", { recordId, pdfUrl });
      }
    }

    // ── 4. Actualizar record ────────────────────────────────────────────────
    await prisma.documentRecord.update({
      where: { id: recordId },
      data: {
        pdfUrl,
        pdfDriveId,
        driveFolderId: folderStructure.manifestoFolderId,
        driveFolderUrl: folderStructure.manifestoFolderUrl,
        estado: "SUBIDO_A_DRIVE",
      },
    });

    // ── 5. Append/Update en Google Sheets ──────────────────────────────────
    const updatedRecord = await prisma.documentRecord.findUnique({
      where: { id: recordId },
      include: { items: { orderBy: { sortOrder: "asc" } }, cliente: { select: { nombre: true } } },
    });

    if (updatedRecord) {
      await syncSheetRow(recordId, updatedRecord as unknown as RecordWithRelations, pdfUrl ?? "");
      logger.info("Registro añadido a Google Sheets", { recordId });
    }

    // ── 6. Marcar COMPLETADO ────────────────────────────────────────────────
    await prisma.documentRecord.update({
      where: { id: recordId },
      data: { estado: "COMPLETADO" },
    });

    logger.info("Registro procesado exitosamente", { recordId, pdfUrl });

    // ── 7. Limpiar archivos temporales ──────────────────────────────────────
    for (const item of deliveredItems) {
      await Promise.all([
        item.tempOriginalPath ? fs.unlink(item.tempOriginalPath).catch(() => {}) : Promise.resolve(),
        item.tempProcessedPath ? fs.unlink(item.tempProcessedPath).catch(() => {}) : Promise.resolve(),
      ]);
    }

    return pdfUrl;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("Error en pipeline de procesamiento", { recordId, error: errorMsg });

    await prisma.documentRecord.update({
      where: { id: recordId },
      data: { estado: "ERROR", errorDetalle: errorMsg },
    });

    throw error;
  }
}

// ─── Pipeline: agregar documentos a registro existente ───────────────────────

export async function processAddDocuments(recordId: string): Promise<string | null> {
  logger.info("Iniciando agregado de documentos a registro existente", { recordId });

  const record = await prisma.documentRecord.findUnique({
    where: { id: recordId },
    include: { items: { orderBy: { sortOrder: "asc" } }, cliente: { select: { nombre: true } } },
  });

  if (!record) throw new Error(`Registro ${recordId} no encontrado`);

  if (!hasGoogleConfig()) {
    await prisma.documentRecord.update({ where: { id: recordId }, data: { estado: "COMPLETADO" } });
    return record.pdfUrl;
  }

  // Items nuevos: entregados y tienen al menos una foto con ruta temporal
  const newItems = (record.items as unknown as ProcessedItem[]).filter(
    (i) => i.entregado && getItemPhotos(i).some((p) => p.tempOriginalPath || p.tempProcessedPath)
  );

  if (newItems.length === 0) {
    logger.warn("processAddDocuments: no hay items nuevos que procesar", { recordId });
    await prisma.documentRecord.update({ where: { id: recordId }, data: { estado: "COMPLETADO" } });
    return record.pdfUrl;
  }

  try {
    // ── 1. Carpetas Drive (existentes, desde caché) ─────────────────────────
    const folderStructure = await ensureRecordFolderStructure({
      fecha: record.createdAt,
      manifiesto: record.manifiesto ?? undefined,
    });

    // ── 2. Subir nuevas imágenes a Drive (multi-foto) ──────────────────────
    const fechaAdd = record.createdAt.toISOString().slice(0, 10);

    for (const item of newItems) {
      const itemPhotos = getItemPhotos(item);
      const pendingPhotos = itemPhotos.filter((p) => p.tempOriginalPath || p.tempProcessedPath);
      if (pendingPhotos.length === 0) continue;

      const uploadedPhotos: PhotoJson[] = [];

      for (let i = 0; i < pendingPhotos.length; i++) {
        const photo = pendingPhotos[i];
        if (!photo.tempOriginalPath || !photo.tempProcessedPath) continue;

        let originalBuffer: Buffer;
        let processedBuffer: Buffer;
        try {
          [originalBuffer, processedBuffer] = await Promise.all([
            fs.readFile(photo.tempOriginalPath),
            fs.readFile(photo.tempProcessedPath),
          ]);
        } catch (readErr) {
          logger.error("No se pudo leer archivo temporal", { recordId, itemId: item.id, photoIndex: i, error: String(readErr) });
          continue;
        }

        const suffix = pendingPhotos.length > 1 ? `_${String(i + 1).padStart(2, "0")}` : "";
        const baseName = `${fechaAdd}_${record.placa}_${item.tipoDocumento}${suffix}`;

        const [origUpload, procUpload] = await Promise.all([
          uploadFile({ buffer: originalBuffer, fileName: `${baseName}_original.jpg`, mimeType: "image/jpeg", parentId: folderStructure.originalesFolderId }),
          uploadFile({ buffer: processedBuffer, fileName: `${baseName}_procesado.jpg`, mimeType: "image/jpeg", parentId: folderStructure.procesadasFolderId }),
        ]);

        uploadedPhotos.push({
          originalDriveId: origUpload.id,
          originalImageUrl: origUpload.url,
          processedDriveId: procUpload.id,
          processedImageUrl: procUpload.url,
          uploadedAt: photo.uploadedAt ?? null,
        });
      }

      if (uploadedPhotos.length === 0) continue;

      await prisma.documentItem.update({
        where: { id: item.id },
        data: {
          originalImageUrl: uploadedPhotos[0].originalImageUrl,
          originalDriveId: uploadedPhotos[0].originalDriveId,
          processedImageUrl: uploadedPhotos[0].processedImageUrl,
          processedDriveId: uploadedPhotos[0].processedDriveId,
          photos: uploadedPhotos as any,
          tempOriginalPath: null,
          tempProcessedPath: null,
        },
      });

      logger.info("Nueva(s) imagen(es) subida(s) a Drive", {
        recordId, tipoDocumento: item.tipoDocumento, count: uploadedPhotos.length,
      });
    }

    // ── 3. Regenerar PDF con TODOS los docs entregados ──────────────────────
    const reloadedRecord = await prisma.documentRecord.findUnique({
      where: { id: recordId },
      include: { items: { orderBy: { sortOrder: "asc" } }, cliente: { select: { nombre: true } } },
    });

    const allDelivered = (reloadedRecord!.items as unknown as ProcessedItem[]).filter((i) => i.entregado);

    // Construir pdfItems con soporte multi-foto: una entrada por foto
    const pdfItems: import("@/lib/pdf/generator").PdfImageItem[] = [];

    for (const item of allDelivered) {
      const photos = getItemPhotos(item);
      const buffers: { buf: Buffer; uploadedAt?: string | null }[] = [];

      for (const photo of photos) {
        // Intentar desde archivo temporal (fotos recién subidas, aún en disco)
        if (photo.tempProcessedPath) {
          try {
            const buf = await fs.readFile(photo.tempProcessedPath);
            buffers.push({ buf, uploadedAt: photo.uploadedAt });
            continue;
          } catch {}
        }
        // Descargar desde Drive (fotos ya procesadas)
        if (photo.processedDriveId) {
          try {
            const buf = await downloadFile(photo.processedDriveId);
            buffers.push({ buf, uploadedAt: photo.uploadedAt });
          } catch (e) {
            logger.warn("No se pudo descargar imagen de Drive para PDF", { itemId: item.id, error: String(e) });
          }
        }
      }

      buffers.forEach(({ buf, uploadedAt }, idx) => {
        pdfItems.push({
          tipoDocumento: item.tipoDocumento as TipoDocumento,
          processedBuffer: buf,
          descripcion: item.descripcion ?? undefined,
          agencyName: item.agencyName ?? undefined,
          uploadedAt: uploadedAt ?? item.uploadedAt?.toISOString() ?? undefined,
          photoIndex: buffers.length > 1 ? idx + 1 : undefined,
          totalPhotos: buffers.length > 1 ? buffers.length : undefined,
        });
      });
    }

    let pdfUrl: string | null = record.pdfUrl;
    let pdfDriveId: string | null = record.pdfDriveId;

    if (pdfItems.length > 0) {
      const meta = {
        fecha: record.createdAt.toISOString().slice(0, 10),
        placa: record.placa,
        manifiesto: record.manifiesto ?? undefined,
        cliente: (record as any).cliente.nombre,
        agencia: record.agencia ?? "",
        numeroContenedor: record.numeroContenedor ?? undefined,
        conductor: record.nombreConductor,
      };

      const pdfBuffer = await generateRecordPdf(pdfItems, meta);

      // Eliminar PDF anterior antes de subir el nuevo
      if (record.pdfDriveId) {
        try {
          await deleteFile(record.pdfDriveId);
          logger.info("PDF anterior eliminado de Drive", { recordId, oldPdfDriveId: record.pdfDriveId });
        } catch (e) {
          logger.warn("No se pudo eliminar el PDF anterior", { recordId, error: String(e) });
        }
      }

      const pdfUpload = await uploadFile({
        buffer: pdfBuffer,
        fileName: buildPdfFileName(meta),
        mimeType: "application/pdf",
        parentId: folderStructure.manifestoFolderId,
      });
      pdfUrl = pdfUpload.url;
      pdfDriveId = pdfUpload.id;

      logger.info("PDF actualizado en Drive", { recordId, pdfUrl });
    }

    // ── 4. Actualizar record con nuevo PDF ──────────────────────────────────
    await prisma.documentRecord.update({
      where: { id: recordId },
      data: { pdfUrl, pdfDriveId, estado: "SUBIDO_A_DRIVE" },
    });

    // ── 5. Actualizar fila en Google Sheets ─────────────────────────────────
    const finalRecord = await prisma.documentRecord.findUnique({
      where: { id: recordId },
      include: { items: { orderBy: { sortOrder: "asc" } }, cliente: { select: { nombre: true } } },
    });

    if (finalRecord) {
      await syncSheetRow(recordId, finalRecord as unknown as RecordWithRelations, pdfUrl ?? "");
      logger.info("Fila de Sheets actualizada", { recordId });
    }

    // ── 6. Marcar COMPLETADO ────────────────────────────────────────────────
    await prisma.documentRecord.update({ where: { id: recordId }, data: { estado: "COMPLETADO" } });

    logger.info("Documentos adicionales procesados exitosamente", { recordId, pdfUrl });

    // ── 7. Limpiar archivos temporales de items nuevos ──────────────────────
    for (const item of newItems) {
      // Eliminar todos los archivos temporales (tanto el primero como los adicionales)
      const photosToClean = getItemPhotos(item);
      for (const photo of photosToClean) {
        await Promise.all([
          photo.tempOriginalPath ? fs.unlink(photo.tempOriginalPath).catch(() => {}) : Promise.resolve(),
          photo.tempProcessedPath ? fs.unlink(photo.tempProcessedPath).catch(() => {}) : Promise.resolve(),
        ]);
      }
      // Las rutas temporales ya fueron borradas del campo photos durante el update de Drive
    }

    return pdfUrl;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("Error en processAddDocuments", { recordId, error: errorMsg });
    await prisma.documentRecord.update({ where: { id: recordId }, data: { estado: "ERROR", errorDetalle: errorMsg } });
    throw error;
  }
}
