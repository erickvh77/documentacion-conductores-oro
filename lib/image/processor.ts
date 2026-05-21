/**
 * Pipeline de procesamiento de imágenes con Sharp.
 * Convierte fotos de celular en imágenes estilo escáner profesional.
 */

import sharp from "sharp";
import { logger } from "@/lib/logger";

export const IMAGE_CONSTRAINTS = {
  maxInputBytes: 15 * 1024 * 1024,   // 15 MB input
  minOutputBytes: 10 * 1024,          // 10 KB mínimo (imagen no vacía)
  minWidth: 400,
  minHeight: 400,
  maxWidth: 2000,
  maxHeight: 2800,
  jpegQuality: 82,
};

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Aplica el pipeline completo: orientación → escala de grises → contraste → nitidez → compresión.
 */
export async function processImageToScanner(inputBuffer: Buffer): Promise<ProcessedImage> {
  if (inputBuffer.byteLength > IMAGE_CONSTRAINTS.maxInputBytes) {
    throw new Error(
      `La imagen supera el tamaño máximo permitido de ${IMAGE_CONSTRAINTS.maxInputBytes / 1024 / 1024} MB`
    );
  }

  const pipeline = sharp(inputBuffer)
    // 1. Corregir rotación según EXIF (crítico en fotos de celular)
    .rotate()
    // 2. Limitar dimensiones sin distorsionar
    .resize({
      width: IMAGE_CONSTRAINTS.maxWidth,
      height: IMAGE_CONSTRAINTS.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    // 3. Escala de grises
    .grayscale()
    // 4. Normalizar histograma (mejora contraste automático)
    .normalise()
    // 5. Curva lineal: más contraste y blancos más blancos
    .linear(1.3, -40)
    // 6. Nitidez
    .sharpen({ sigma: 1.5 })
    // 7. Comprimir como JPEG de alta calidad
    .jpeg({ quality: IMAGE_CONSTRAINTS.jpegQuality, mozjpeg: true });

  const { data: buffer, info } = await pipeline.toBuffer({ resolveWithObject: true });

  // Validar calidad mínima
  if (buffer.byteLength < IMAGE_CONSTRAINTS.minOutputBytes) {
    throw new Error("La imagen procesada está en blanco o es demasiado pequeña");
  }
  if (info.width < IMAGE_CONSTRAINTS.minWidth || info.height < IMAGE_CONSTRAINTS.minHeight) {
    throw new Error(
      `La imagen es demasiado pequeña (${info.width}×${info.height}px). Mínimo: ${IMAGE_CONSTRAINTS.minWidth}×${IMAGE_CONSTRAINTS.minHeight}px`
    );
  }

  logger.debug("Imagen procesada", {
    inputBytes: inputBuffer.byteLength,
    outputBytes: buffer.byteLength,
    width: info.width,
    height: info.height,
  });

  return {
    buffer,
    width: info.width,
    height: info.height,
    sizeBytes: buffer.byteLength,
  };
}

/**
 * Extrae metadatos básicos de una imagen sin procesarla.
 */
export async function getImageMetadata(buffer: Buffer) {
  return sharp(buffer).metadata();
}
