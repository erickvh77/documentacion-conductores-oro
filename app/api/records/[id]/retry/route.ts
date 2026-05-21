/**
 * POST /api/records/[id]/retry
 *
 * Reintenta el pipeline (Drive + PDF + Sheets) para un registro en estado ERROR.
 * Útil cuando falla la conexión a Drive o Sheets sin perder los datos.
 *
 * Nota: Los archivos temporales deben seguir existiendo en disco.
 * Si ya fueron limpiados, el reintento fallará para las imágenes faltantes
 * pero aún podrá intentar el PDF si las imágenes ya fueron subidas a Drive.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { processRecord } from "@/lib/records/processor";
import { logger } from "@/lib/logger";

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordId } = await params;

  try {
    // Verificar que el registro existe y está en estado ERROR o PROCESANDO
    const record = await prisma.documentRecord.findUnique({
      where: { id: recordId },
      select: { id: true, estado: true, placa: true },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Registro no encontrado" },
        { status: 404 }
      );
    }

    if (!["ERROR", "PROCESANDO", "SUBIDO_A_DRIVE"].includes(record.estado)) {
      return NextResponse.json(
        {
          error: `No se puede reintentar un registro en estado "${record.estado}"`,
          estado: record.estado,
        },
        { status: 409 }
      );
    }

    // Resetear estado a PROCESANDO antes de reintentar
    await prisma.documentRecord.update({
      where: { id: recordId },
      data: { estado: "PROCESANDO", errorDetalle: null },
    });

    logger.info("Reintentando procesamiento de registro", {
      recordId,
      estadoAnterior: record.estado,
    });

    const pdfUrl = await processRecord(recordId);

    return NextResponse.json({
      success: true,
      recordId,
      pdfUrl,
      message: "Registro reprocesado exitosamente",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("Error en retry de registro", { recordId, error: errorMsg });

    return NextResponse.json(
      { error: "Error al reprocesar el registro", detail: errorMsg },
      { status: 500 }
    );
  }
}
