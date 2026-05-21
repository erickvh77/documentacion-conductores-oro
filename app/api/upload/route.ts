import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import sharp from "sharp";
import { processImageToScanner } from "@/lib/image/processor";
import { ensureTempDir, getTempFilePath } from "@/lib/upload/tempStorage";
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from "@/lib/validation/schemas";
import { logger } from "@/lib/logger";

// En App Router (Next.js 13+) no se necesita bodyParser: false.
// Next.js maneja formData() nativo en Route Handlers.

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
    }

    // Validar tipo MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      return NextResponse.json(
        { error: `Tipo de archivo no permitido. Permitidos: JPEG, PNG, HEIC, WEBP` },
        { status: 400 }
      );
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `La imagen supera el límite de ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB` },
        { status: 400 }
      );
    }

    const originalBuffer = Buffer.from(await file.arrayBuffer());

    // Procesar con Sharp (efecto escáner)
    const processed = await processImageToScanner(originalBuffer);

    // Guardar ambos archivos en tmp
    const uploadId = crypto.randomUUID();
    await ensureTempDir();

    const originalPath = getTempFilePath(uploadId, "original");
    const processedPath = getTempFilePath(uploadId, "processed");

    await fs.writeFile(originalPath, originalBuffer);
    await fs.writeFile(processedPath, processed.buffer);

    // Thumbnail pequeño para preview en la UI (max 480px, calidad 70)
    const thumbnailBuffer = await sharp(processed.buffer)
      .resize({ width: 480, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    const thumbnailDataUrl = `data:image/jpeg;base64,${thumbnailBuffer.toString("base64")}`;

    logger.info("Imagen subida y procesada", {
      uploadId,
      originalSize: originalBuffer.byteLength,
      processedSize: processed.buffer.byteLength,
      thumbnailSize: thumbnailBuffer.byteLength,
    });

    return NextResponse.json({
      uploadId,
      thumbnailDataUrl,
      tempOriginalPath: originalPath,
      tempProcessedPath: processedPath,
      width: processed.width,
      height: processed.height,
    });
  } catch (error) {
    logger.error("Error procesando imagen", { error: String(error) });
    const message =
      error instanceof Error ? error.message : "Error inesperado al procesar la imagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
