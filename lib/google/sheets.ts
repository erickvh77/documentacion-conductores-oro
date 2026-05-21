/**
 * Google Sheets API — registro operativo de cada viaje.
 *
 * Estructura de columnas (34 columnas, A–AH):
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
 * K  cumplido_entregado
 * L  cumplido_url_foto
 * M  agencia_cumplido
 * N  fecha_cumplido
 * O  remesa_entregada
 * P  remesa_url_foto
 * Q  agencia_remesa
 * R  fecha_remesa
 * S  salida_puerto_entregada
 * T  salida_puerto_url_foto
 * U  agencia_salida_puerto
 * V  fecha_salida_puerto
 * W  contenedor_vacio_entregado
 * X  contenedor_vacio_url_foto
 * Y  agencia_contenedor_vacio
 * Z  fecha_contenedor_vacio
 * AA otros_entregado
 * AB otros_descripcion
 * AC otros_url_foto
 * AD agencia_otros_entregados
 * AE fecha_otros_entregados
 * AF pdf_url
 * AG estado_registro
 * AH observaciones
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
  // Cumplido
  cumplidoEntregado: string;    // K
  cumplidoUrlFoto: string;      // L
  agenciaCumplido: string;      // M
  fechaCumplido: string;        // N
  // Remesa
  remesaEntregada: string;      // O
  remesaUrlFoto: string;        // P
  agenciaRemesa: string;        // Q
  fechaRemesa: string;          // R
  // Salida puerto
  salidaPuertoEntregada: string; // S
  salidaPuertoUrlFoto: string;   // T
  agenciaSalidaPuerto: string;   // U
  fechaSalidaPuerto: string;     // V
  // Contenedor vacío
  contenedorVacioEntregado: string; // W
  contenedorVacioUrlFoto: string;   // X
  agenciaContenedorVacio: string;   // Y
  fechaContenedorVacio: string;     // Z
  // Otros
  otrosEntregado: string;       // AA
  otrosDescripcion: string;     // AB
  otrosUrlFoto: string;         // AC
  agenciaOtros: string;         // AD
  fechaOtros: string;           // AE
  // Cierre
  pdfUrl: string;               // AF
  estadoRegistro: string;       // AG
  observaciones: string;        // AH
}

/** Construye el array de 34 valores en el orden exacto de los encabezados del sheet. */
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
    data.cumplidoEntregado,     // K
    data.cumplidoUrlFoto,       // L
    data.agenciaCumplido,       // M
    data.fechaCumplido,         // N
    data.remesaEntregada,       // O
    data.remesaUrlFoto,         // P
    data.agenciaRemesa,         // Q
    data.fechaRemesa,           // R
    data.salidaPuertoEntregada, // S
    data.salidaPuertoUrlFoto,   // T
    data.agenciaSalidaPuerto,   // U
    data.fechaSalidaPuerto,     // V
    data.contenedorVacioEntregado, // W
    data.contenedorVacioUrlFoto,   // X
    data.agenciaContenedorVacio,   // Y
    data.fechaContenedorVacio,     // Z
    data.otrosEntregado,        // AA
    data.otrosDescripcion,      // AB
    data.otrosUrlFoto,          // AC
    data.agenciaOtros,          // AD
    data.fechaOtros,            // AE
    data.pdfUrl,                // AF
    data.estadoRegistro,        // AG
    data.observaciones,         // AH
  ];
}

// ─── Buscar fila existente por placa + manifiesto ────────────────────────────
// B=placa (col 2), C=manifiesto (col 3) — posiciones sin cambio.
// Normaliza para manejar locale es-CO (puntos de miles).
export async function findSheetRowByManifiesto(
  placa: string,
  manifiesto: string
): Promise<number | null> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return null;

  const norm = (v: unknown) =>
    String(v ?? "")
      .replace(/[^0-9a-zA-Z]/g, "")
      .toUpperCase();

  const targetPlaca = norm(placa);
  const targetManifiesto = norm(manifiesto);

  const sheets = getSheets();
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Registros!B:C",
    });

    const rows = response.data.values ?? [];

    logger.debug("Buscando fila en Sheets", {
      targetPlaca,
      targetManifiesto,
      totalRows: rows.length,
    });

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const rowPlaca = norm(row[0]);
      const rowManifiesto = norm(row[1]);

      if (rowPlaca === targetPlaca && rowManifiesto === targetManifiesto) {
        const sheetRow = i + 1;
        logger.info("Fila encontrada en Sheets", { sheetRow, rowPlaca, rowManifiesto });
        return sheetRow;
      }
    }

    logger.info("Fila no encontrada en Sheets — se hará append", {
      targetPlaca,
      targetManifiesto,
      rowsSearched: rows.length - 1,
    });
  } catch (e) {
    logger.warn("Error buscando fila en Sheets", { placa, manifiesto, error: String(e) });
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
    range: "Registros!A:AH",
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
    range: `Registros!A${rowIndex}:AH${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [buildRow(data)] },
  });

  logger.info("Fila actualizada en Sheets", {
    placa: data.placa,
    manifiesto: data.manifiesto,
    rowIndex,
  });
}
