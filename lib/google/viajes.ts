/**
 * Google Sheets — lectura del tab VIAJES.
 *
 * El tab VIAJES contiene la información operativa de los viajes activos.
 * Las columnas se detectan dinámicamente por encabezado (row 0), no por
 * posición fija, para ser resilientes ante columnas vacías o reordenadas.
 *
 * Columnas esperadas (en cualquier orden):
 *   MANIFIESTO
 *   NOMBRE CLIENTE  (o NOMBRE_CLIENTE)
 *   PLACA VEHICULO  (o PLACA)
 *   NOMBRE_CONDUCTOR (o CONDUCTOR)
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

// ─── Detección de columnas por encabezado ────────────────────────────────────

interface ColMap {
  manifiesto: number;
  clienteNombre: number;
  placa: number;
  conductor: number;
}

/**
 * Dado el row de encabezados, devuelve los índices de cada columna relevante.
 * La comparación ignora mayúsculas, espacios y guiones bajos.
 * Si una columna no se encuentra devuelve -1 (se notificará en el log).
 */
function buildColMap(headerRow: string[]): ColMap {
  const clean = (s: unknown) =>
    String(s ?? "")
      .toUpperCase()
      .replace(/[\s_]+/g, "_")
      .trim();

  const find = (keywords: string[]) =>
    headerRow.findIndex((h) => keywords.some((kw) => clean(h).includes(kw)));

  return {
    manifiesto:    find(["MANIFIESTO"]),
    // "NOMBRE CLIENTE" normaliza a "NOMBRE_CLIENTE"; orden es importante: busca
    // "NOMBRE_CLIENTE" antes que "CLIENTE" para no confundirse con "NOMBRE_CONDUCTOR"
    clienteNombre: find(["NOMBRE_CLIENTE", "CLIENTE"]),
    placa:         find(["PLACA"]),
    conductor:     find(["CONDUCTOR"]),
  };
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

  // Leemos A:G para cubrir cualquier disposición de columnas en el tab
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "VIAJES!A:G",
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
    if (rows.length < 2) return null;

    // Detectar columnas por encabezado (row 0)
    const cols = buildColMap(rows[0]);

    logger.debug("Mapa de columnas VIAJES", { cols, headers: rows[0] });

    // Verificar que encontramos las columnas mínimas
    if (cols.manifiesto < 0 || cols.clienteNombre < 0 || cols.placa < 0) {
      logger.warn("No se encontraron columnas esperadas en VIAJES tab", {
        cols,
        headers: rows[0],
      });
    }

    const colMani = cols.manifiesto >= 0 ? cols.manifiesto : 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rowManifiesto = norm(row[colMani]);
      if (rowManifiesto === target) {
        const get = (idx: number) =>
          idx >= 0 ? String(row[idx] ?? "").trim() : "";

        const result: ViajeInfo = {
          manifiesto:    get(colMani),
          clienteNombre: get(cols.clienteNombre),
          placa:         get(cols.placa).toUpperCase(),
          conductor:     get(cols.conductor),
        };

        logger.info("Viaje encontrado en VIAJES sheet", {
          manifiesto: result.manifiesto,
          placa: result.placa,
          conductor: result.conductor,
          clienteNombre: result.clienteNombre,
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
