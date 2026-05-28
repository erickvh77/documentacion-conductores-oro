/**
 * Google Sheets API — registro operativo de cada viaje.
 *
 * Estructura de columnas (30 columnas, A–AD):
 *
 * A  fecha_hora
 * B  placa
 * C  manifiesto
 * D  cliente
 * E  agencia
 * F  numero_contenedor
 * G  liquidacion_entregada
 * H  liquidacion_url_foto
 * I  agencia_liquidacion
 * J  fecha_liquidacion
 * K  remesa_entregada
 * L  remesa_url_foto
 * M  agencia_remesa
 * N  fecha_remesa
 * O  salida_puerto_entregada
 * P  salida_puerto_url_foto
 * Q  agencia_salida_puerto
 * R  fecha_salida_puerto
 * S  contenedor_vacio_entregado
 * T  contenedor_vacio_url_foto
 * U  agencia_contenedor_vacio
 * V  fecha_contenedor_vacio
 * W  otros_entregado
 * X  otros_descripcion
 * Y  otros_url_foto
 * Z  agencia_otros_entregados
 * AA fecha_otros_entregados
 * AB pdf_url
 * AC estado_registro
 * AD observaciones
 */

import { google } from "googleapis";
import { getGoogleAuth } from "./auth";
import { logger } from "@/lib/logger";

function getSheets() {
  return google.sheets({ version: "v4", auth: getGoogleAuth() });
}

// ─── Interfaz de fila ─────────────────────────────────────────────────────────

export interface SheetRowData {
  fechaHora: string;            // A
  placa: string;                // B
  manifiesto: string;           // C
  cliente: string;              // D
  agencia: string;              // E
  numeroContenedor: string;     // F
  // Liquidación
  liquidacionEntregada: string; // G
  liquidacionUrlFoto: string;   // H
  agenciaLiquidacion: string;   // I
  fechaLiquidacion: string;     // J
  // Remesa
  remesaEntregada: string;      // K
  remesaUrlFoto: string;        // L
  agenciaRemesa: string;        // M
  fechaRemesa: string;          // N
  // Salida puerto
  salidaPuertoEntregada: string; // O
  salidaPuertoUrlFoto: string;   // P
  agenciaSalidaPuerto: string;   // Q
  fechaSalidaPuerto: string;     // R
  // Contenedor vacío
  contenedorVacioEntregado: string; // S
  contenedorVacioUrlFoto: string;   // T
  agenciaContenedorVacio: string;   // U
  fechaContenedorVacio: string;     // V
  // Otros
  otrosEntregado: string;       // W
  otrosDescripcion: string;     // X
  otrosUrlFoto: string;         // Y
  agenciaOtros: string;         // Z
  fechaOtros: string;           // AA
  // Cierre
  pdfUrl: string;               // AB
  estadoRegistro: string;       // AC
  observaciones: string;        // AD
}

/** Construye el array de 30 valores en el orden exacto de los encabezados del sheet. */
function buildRow(data: SheetRowData): string[] {
  return [
    data.fechaHora,             // A
    data.placa,                 // B
    data.manifiesto,            // C
    data.cliente,               // D
    data.agencia,               // E
    data.numeroContenedor,      // F
    data.liquidacionEntregada,  // G
    data.liquidacionUrlFoto,    // H
    data.agenciaLiquidacion,    // I
    data.fechaLiquidacion,      // J
    data.remesaEntregada,       // K
    data.remesaUrlFoto,         // L
    data.agenciaRemesa,         // M
    data.fechaRemesa,           // N
    data.salidaPuertoEntregada, // O
    data.salidaPuertoUrlFoto,   // P
    data.agenciaSalidaPuerto,   // Q
    data.fechaSalidaPuerto,     // R
    data.contenedorVacioEntregado, // S
    data.contenedorVacioUrlFoto,   // T
    data.agenciaContenedorVacio,   // U
    data.fechaContenedorVacio,     // V
    data.otrosEntregado,        // W
    data.otrosDescripcion,      // X
    data.otrosUrlFoto,          // Y
    data.agenciaOtros,          // Z
    data.fechaOtros,            // AA
    data.pdfUrl,                // AB
    data.estadoRegistro,        // AC
    data.observaciones,         // AD
  ];
}

// ─── Buscar fila existente por número de manifiesto (columna C) ──────────────
// Busca solo por manifiesto para que el resultado sea correcto aunque el usuario
// haya reordenado, insertado o eliminado filas manualmente en el sheet.
export async function findSheetRowByManifiesto(
  manifiesto: string
): Promise<number | null> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return null;

  const norm = (v: unknown) =>
    String(v ?? "")
      .replace(/[^0-9a-zA-Z]/g, "")
      .toUpperCase();

  const targetManifiesto = norm(manifiesto);
  if (!targetManifiesto) return null;

  const sheets = getSheets();
  try {
    // Leer solo columna C (manifiesto) — mínimo de datos para la búsqueda
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Registros!C:C",
    });

    const rows = response.data.values ?? [];

    logger.debug("Buscando fila en Sheets por manifiesto", {
      targetManifiesto,
      totalRows: rows.length,
    });

    for (let i = 1; i < rows.length; i++) {
      const cell = rows[i]?.[0];
      if (!cell) continue;
      if (norm(cell) === targetManifiesto) {
        const sheetRow = i + 1; // i es 0-based; fila 1 = encabezado
        logger.info("Fila encontrada en Sheets", { sheetRow, manifiesto });
        return sheetRow;
      }
    }

    logger.info("Manifiesto no encontrado en Sheets — se hará append", {
      targetManifiesto,
      rowsSearched: rows.length - 1,
    });
  } catch (e) {
    logger.warn("Error buscando fila en Sheets", { manifiesto, error: String(e) });
  }
  return null;
}

// ─── Agregar fila nueva ───────────────────────────────────────────────────────
export async function appendSheetRow(data: SheetRowData): Promise<number> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID no está configurado");

  const sheets = getSheets();

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Registros!A:AD",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [buildRow(data)] },
  });

  const updatedRange = response.data.updates?.updatedRange ?? "";
  const match = updatedRange.match(/!(?:[A-Z]+)(\d+)/);
  const rowIndex = match ? parseInt(match[1], 10) : 0;

  logger.info("Fila registrada en Sheets", {
    placa: data.placa,
    manifiesto: data.manifiesto,
    rowIndex,
  });

  return rowIndex;
}

// ─── Actualizar fila existente por índice ─────────────────────────────────────
export async function updateSheetRow(rowIndex: number, data: SheetRowData): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID no está configurado");

  if (!rowIndex || rowIndex < 2) {
    logger.warn("updateSheetRow: índice inválido, haciendo append", { rowIndex });
    await appendSheetRow(data);
    return;
  }

  const sheets = getSheets();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Registros!A${rowIndex}:AD${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [buildRow(data)] },
  });

  logger.info("Fila actualizada en Sheets", {
    placa: data.placa,
    manifiesto: data.manifiesto,
    rowIndex,
  });
}
