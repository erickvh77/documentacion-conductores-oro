/**
 * Utilidad para manejo de archivos temporales de uploads.
 * Funciona en desarrollo (Windows/Linux) y en el contenedor Docker.
 */

import path from "path";
import fs from "fs/promises";
import os from "os";

export function getTempDir(): string {
  return process.env.UPLOAD_TEMP_DIR ?? path.join(os.tmpdir(), "conductores-uploads");
}

export async function ensureTempDir(): Promise<string> {
  const dir = getTempDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function getTempFilePath(uploadId: string, type: "original" | "processed"): string {
  return path.join(getTempDir(), `${uploadId}_${type}.jpg`);
}

export async function readTempFile(uploadId: string, type: "original" | "processed"): Promise<Buffer> {
  const filePath = getTempFilePath(uploadId, type);
  return fs.readFile(filePath);
}

export async function cleanTempFiles(uploadId: string): Promise<void> {
  for (const type of ["original", "processed"] as const) {
    try {
      await fs.unlink(getTempFilePath(uploadId, type));
    } catch {
      // Silencioso si ya no existe
    }
  }
}

/** Elimina archivos más viejos que TTL_MINUTES */
export async function cleanStaleTempFiles(): Promise<void> {
  const ttlMinutes = Number(process.env.UPLOAD_TEMP_TTL_MINUTES ?? 60);
  const ttlMs = ttlMinutes * 60 * 1000;
  const dir = getTempDir();

  try {
    const files = await fs.readdir(dir);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      if (now - stat.mtimeMs > ttlMs) {
        await fs.unlink(filePath).catch(() => {});
      }
    }
  } catch {
    // El directorio puede no existir todavía
  }
}
