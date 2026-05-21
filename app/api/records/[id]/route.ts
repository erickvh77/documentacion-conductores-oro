/**
 * GET /api/records/[id]
 * Retorna el estado actual de un registro.
 * Útil para polling desde el frontend si se implementa procesamiento async.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordId } = await params;

  const record = await prisma.documentRecord.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      placa: true,
      manifiesto: true,
      agencia: true,
      estado: true,
      pdfUrl: true,
      driveFolderUrl: true,
      errorDetalle: true,
      createdAt: true,
    },
  });

  if (!record) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  return NextResponse.json(record);
}
