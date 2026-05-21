/**
 * Generador de PDF con pdf-lib.
 * Sin portada — solo imágenes procesadas en orden lógico.
 * Una página A4 por documento entregado.
 *
 * Cabecera de 2 líneas:
 *   Línea 1: Tipo de documento  |  PLACA  |  MANIFIESTO o CONTENEDOR  |  Fecha registro
 *   Línea 2: Agencia: XXX  |  Cargado: YYYY-MM-DD HH:mm:ss
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { TipoDocumento, LABELS_DOCUMENTO } from "@/lib/validation/schemas";
import { logger } from "@/lib/logger";

// Dimensiones A4 en puntos (1 pt = 1/72 in)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 20;
const HEADER_HEIGHT = 52; // más alto para dos líneas de texto

export interface PdfImageItem {
  tipoDocumento: TipoDocumento | string;  // string para compat. con CUMPLIDO legacy
  processedBuffer: Buffer;
  descripcion?: string;   // solo para OTROS
  agencyName?: string;    // agencia que cargó el documento
  uploadedAt?: string;    // ISO timestamp de carga (o fecha legible)
  /** Índice de esta foto dentro del documento (base 1). Undefined si solo hay una foto. */
  photoIndex?: number;
  /** Total de fotos del documento. Undefined si solo hay una foto. */
  totalPhotos?: number;
}

export interface PdfMetadata {
  fecha: string;         // "2026-05-09"
  placa: string;
  manifiesto?: string;
  cliente: string;
  agencia: string;       // agencia del registro (compat.)
  numeroContenedor?: string;
  conductor?: string;    // nombre del conductor
}

/**
 * Genera el PDF final de un registro.
 * Retorna el buffer listo para subir a Drive.
 */
export async function generateRecordPdf(
  items: PdfImageItem[],
  meta: PdfMetadata
): Promise<Buffer> {
  if (items.length === 0) {
    throw new Error("No hay imágenes para generar el PDF");
  }

  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const item of items) {
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    // ── Cabecera oscura ────────────────────────────────────────────────────
    page.drawRectangle({
      x: 0,
      y: A4_HEIGHT - HEADER_HEIGHT,
      width: A4_WIDTH,
      height: HEADER_HEIGHT,
      color: rgb(0.12, 0.12, 0.12),
    });

    // Línea 1: tipo de documento + placa + manifiesto/contenedor + fecha
    const line1 = buildHeaderLine1(item, meta);
    page.drawText(line1, {
      x: MARGIN,
      y: A4_HEIGHT - HEADER_HEIGHT + 32,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1),
      maxWidth: A4_WIDTH - MARGIN * 2,
    });

    // Línea 2: agencia + fecha de carga
    const line2 = buildHeaderLine2(item, meta);
    page.drawText(line2, {
      x: MARGIN,
      y: A4_HEIGHT - HEADER_HEIGHT + 12,
      size: 9,
      font: fontRegular,
      color: rgb(0.75, 0.75, 0.75),
      maxWidth: A4_WIDTH - MARGIN * 2,
    });

    // ── Imagen centrada ────────────────────────────────────────────────────
    const imageArea = {
      x: MARGIN,
      y: MARGIN,
      width: A4_WIDTH - MARGIN * 2,
      height: A4_HEIGHT - HEADER_HEIGHT - MARGIN * 2,
    };

    try {
      const image = await pdfDoc.embedJpg(item.processedBuffer);
      const { width: imgW, height: imgH } = image.scale(1);

      const scaleX = imageArea.width / imgW;
      const scaleY = imageArea.height / imgH;
      const scale = Math.min(scaleX, scaleY);

      const drawWidth = imgW * scale;
      const drawHeight = imgH * scale;

      const drawX = imageArea.x + (imageArea.width - drawWidth) / 2;
      const drawY = imageArea.y + (imageArea.height - drawHeight) / 2;

      page.drawImage(image, { x: drawX, y: drawY, width: drawWidth, height: drawHeight });
    } catch {
      // Si no puede embeber como JPEG, intentar como PNG
      try {
        const image = await pdfDoc.embedPng(item.processedBuffer);
        const { width: imgW, height: imgH } = image.scale(1);
        const scale = Math.min(
          (A4_WIDTH - MARGIN * 2) / imgW,
          (A4_HEIGHT - HEADER_HEIGHT - MARGIN * 2) / imgH
        );
        page.drawImage(image, {
          x: MARGIN,
          y: MARGIN,
          width: imgW * scale,
          height: imgH * scale,
        });
      } catch (pngErr) {
        logger.warn("No se pudo embeber imagen en PDF", {
          tipoDocumento: item.tipoDocumento,
          error: String(pngErr),
        });
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);

  logger.info("PDF generado", {
    pages: items.length,
    sizeBytes: buffer.byteLength,
    placa: meta.placa,
  });

  return buffer;
}

/**
 * Nombre del archivo PDF según convención del brief.
 */
export function buildPdfFileName(meta: PdfMetadata): string {
  const sanitize = (s: string) =>
    s.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_");

  if (meta.numeroContenedor) {
    return `${meta.fecha}_${sanitize(meta.placa)}_CONTENEDOR_${sanitize(meta.numeroContenedor)}.pdf`;
  }
  return `${meta.fecha}_${sanitize(meta.placa)}_${sanitize(meta.manifiesto ?? "SIN_MANIFIESTO")}_${sanitize(meta.cliente)}.pdf`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Línea 1: tipo, placa, manifiesto/contenedor, fecha del registro. */
function buildHeaderLine1(item: PdfImageItem, meta: PdfMetadata): string {
  const label = LABELS_DOCUMENTO[item.tipoDocumento] ?? item.tipoDocumento;
  const extra = item.descripcion ? ` — ${item.descripcion}` : "";
  // Indicador de foto múltiple: "(2/3)" cuando hay más de una
  const fotoNum =
    item.photoIndex && item.totalPhotos && item.totalPhotos > 1
      ? ` (${item.photoIndex}/${item.totalPhotos})`
      : "";
  const ref = meta.numeroContenedor
    ? `CONTENEDOR: ${meta.numeroContenedor}`
    : `MANIFIESTO: ${meta.manifiesto ?? "—"}`;
  return `${label}${fotoNum}${extra}  |  PLACA: ${meta.placa}  |  ${ref}  |  ${meta.fecha}`;
}

/** Línea 2: agencia que cargó el documento y timestamp de carga. */
function buildHeaderLine2(item: PdfImageItem, meta: PdfMetadata): string {
  const agencia = item.agencyName ?? meta.agencia ?? "—";
  const fechaCarga = item.uploadedAt
    ? formatUploadedAt(item.uploadedAt)
    : meta.fecha;
  return `Agencia: ${agencia}  |  Cargado: ${fechaCarga}`;
}

/** Convierte un ISO string a formato legible "YYYY-MM-DD HH:mm:ss". */
function formatUploadedAt(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    );
  } catch {
    return iso;
  }
}
