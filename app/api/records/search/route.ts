/**
 * GET /api/records/search?manifiesto=XXX[&placa=YYY]
 *
 * Busca si ya existe un registro para el manifiesto indicado.
 * El parámetro placa es opcional (en el nuevo flujo viene de VIAJES).
 *
 * Usado desde StepOne para detectar registros incompletos y permitir
 * agregar documentos faltantes sin duplicar el registro.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const manifiesto = searchParams.get("manifiesto")?.trim();
  const placa = searchParams.get("placa")?.trim().toUpperCase();

  if (!manifiesto || manifiesto.length < 4) {
    return NextResponse.json({ found: false });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    manifiesto: { equals: manifiesto, mode: "insensitive" },
    estado: { not: "ERROR" },
  };

  // Placa opcional: si viene, refina la búsqueda (evita ambigüedades)
  if (placa && placa.length >= 5) {
    where.placa = { equals: placa, mode: "insensitive" };
  }

  const record = await prisma.documentRecord.findFirst({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      cliente: { select: { nombre: true } },
    },
  });

  if (!record) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    record: {
      id: record.id,
      nombreConductor: record.nombreConductor,
      placa: record.placa,
      manifiesto: record.manifiesto,
      agencia: record.agencia,
      clienteId: record.clienteId,
      clienteNombre: (record.cliente as any).nombre,
      estado: record.estado,
      driveFolderUrl: record.driveFolderUrl,
      items: record.items.map((i: any) => ({
        tipoDocumento: i.tipoDocumento,
        entregado: i.entregado,
        descripcion: i.descripcion,
        processedImageUrl: (i as any).processedImageUrl ?? null,
        agencyName: (i as any).agencyName ?? null,
        uploadedAt: (i as any).uploadedAt
          ? new Date((i as any).uploadedAt).toISOString()
          : null,
      })),
    },
  });
}
