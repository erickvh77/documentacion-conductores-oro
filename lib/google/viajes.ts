/**
 * Google Sheets — lectura del tab VIAJES.
 *
 * El tab VIAJES contiene la información operativa de los viajes activos:
 *   Col A: MANIFIESTO
 *   Col B: NOMBRE CLIENTE
 *   Col C: PLACA VEHICULO
 *   Col D: NOMBRE_CONDUCTOR
 *
 * Se usa un spreadsheet configurable (GOOGLE_SHEETS_VIAJES_SPREADSHEET_ID).
 * Si no está definido, cae sobre GOOGLE_SHEETS_SPREADSHEET_ID (mismo archivo).
 *
 * Caché en memoria: los datos se refrescan automáticamente cada
 * CACHE_TTL_MS ms. En producción con múltiples instancias se recomienda Redis,
 * pero para una instancia Node este mapa es suficiente.
 */

import { google } from "googleapis";
import { getGoogleAuth } from "./auth";
import { logger } from "@/lib/logger";

export interface ViajeInfo {
  manifiesto: string;
  clienteNombre: string;
  placa: string;
  conductor: string;
}

// ─── Caché en memoria ─────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

interface SheetCache {
  rows: string[][];
  expiry: number;
}

let sheetCache: SheetCache | null = null;

/** Invalida la caché manualmente (p.ej. desde un endpoint de administración). */
export function clearViajesCache(): void {
  sheetCache = null;
}

// ─── Normalización ────────────────────────────────────────────────────────────

/** Quita puntos, comas, espacios → comparación robusta ante locale es-CO. */
function norm(v: unknown): string {
  return String(v ?? "")
    .replace(/[^0-9a-zA-Z]/g, "")
    .toUpperCase();
}

// ─── Lectura del sheet con caché ──────────────────────────────────────────────

async function getViajesRows(): Promise<string[][]> {
  // Devolver caché vigente
  if (sheetCache && sheetCache.expiry > Date.now()) {
    return sheetCache.rows;
  }

  const spreadsheetId =
    process.env.GOOGLE_SHEETS_VIAJES_SPREADSHEET_ID ??
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error(
      "No hay un spreadsheet ID configurado para VIAJES. " +
        "Define GOOGLE_SHEETS_VIAJES_SPREADSHEET_ID o GOOGLE_SHEETS_SPREADSHEET_ID."
    );
  }

  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "VIAJES!A:D", // MANIFIESTO | NOMBRE CLIENTE | PLACA VEHICULO | NOMBRE_CONDUCTOR
  });

  const rows = (response.data.values ?? []) as string[][];

  sheetCache = {
    rows,
    expiry: Date.now() + CACHE_TTL_MS,
  };

  logger.debug("Caché VIAJES refrescada", { totalRows: rows.length });

  return rows;
}

// ─── Búsqueda pública ─────────────────────────────────────────────────────────

/**
 * Busca un viaje por número de manifiesto en el tab VIAJES.
 * Normaliza el manifiesto para comparación insensible a formato locale.
 *
 * @returns ViajeInfo si se encuentra; null si no existe o falla la consulta.
 */
export async function searchViajeByManifiesto(
  manifiesto: string
): Promise<ViajeInfo | null> {
  const target = norm(manifiesto);

  if (!target) return null;

  try {
    const rows = await getViajesRows();

    // rows[0] = cabecera → skip
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 4) continue;

      const rowManifiesto = norm(row[0]);
      if (rowManifiesto === target) {
        const result: ViajeInfo = {
          manifiesto: String(row[0] ?? "").trim(),
          clienteNombre: String(row[1] ?? "").trim(),
          placa: String(row[2] ?? "").trim().toUpperCase(),
          conductor: String(row[3] ?? "").trim(),
        };

        logger.info("Viaje encontrado en VIAJES sheet", {
          manifiesto: result.manifiesto,
          placa: result.placa,
          conductor: result.conductor,
        });

        return result;
      }
    }

    logger.info("Manifiesto no encontrado en VIAJES sheet", { target });
    return null;
  } catch (e) {
    logger.warn("Error consultando VIAJES sheet", {
      manifiesto,
      error: String(e),
    });
    throw e; // Re-lanzar para que el caller decida el mensaje al usuario
  }
}
