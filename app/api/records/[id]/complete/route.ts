/**
 * PATCH /api/records/[id]/complete
 *
 * Agrega documentos faltantes a un registro existente.
 * - Hace upsert de los items en BD (incluyendo agencyName y uploadedAt)
 * - Sube nuevas imágenes a la carpeta Drive ya existente
 * - Regenera el PDF con todos los documentos (anteriores + nuevos)
 * - Actualiza la fila existente en Google Sheets (no duplica)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { completeRecordSchema, SORT_ORDER } from "@/lib/validation/schemas";
import { processAddDocuments } from "@/lib/records/processor";
import { logger } from "@/lib/logger";

export const maxDuration = 120;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordId } = await params;

  // ── 1. Verificar que existe el registro ────────────────────────────────────
  const existingRecord = await prisma.documentRecord.findUnique({
    where: { id: recordId },
    include: { items: true },
  });

  if (!existingRecord) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  if (existingRecord.estado === "PROCESANDO") {
    return NextResponse.json(
      { error: "El registro está siendo procesado. Espere un momento e intente de nuevo." },
      { status: 409 }
    );
  }

  // ── 2. Validar payload ─────────────────────────────────────────────────────
  const body = await request.json();
  const parsed = completeRecordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { items } = parsed.data;
  const newDelivered = items.filter((i) => i.entregado && i.photos && i.photos.length > 0);

  if (newDelivered.length === 0) {
    return NextResponse.json(
      { error: "Debe incluir al menos un documento nuevo con foto" },
      { status: 422 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // ── 3. Upsert de items en BD ───────────────────────────────────────────────
  await prisma.$transaction(async (tx: any) => {
    for (const item of items) {
      const existing = existingRecord.items.find(
        (i: any) => i.tipoDocumento === item.tipoDocumento
      );

      if (existing) {
        // Solo actualizar si cambia a entregado (no sobreescribir los que ya están subidos)
        if (item.entregado && !(existing as any).processedDriveId) {
          const firstPhoto = item.photos?.[0];
          const photosJson = item.photos?.length
            ? item.photos.map((p) => ({
                tempOriginalPath: p.tempOriginalPath,
                tempProcessedPath: p.tempProcessedPath,
                uploadedAt: p.uploadedAt ?? null,
              }))
            : null;

          await tx.documentItem.update({
            where: { id: existing.id },
            data: {
              entregado: true,
              descripcion: item.descripcion || null,
              tempOriginalPath: firstPhoto?.tempOriginalPath || null,
              tempProcessedPath: firstPhoto?.tempProcessedPath || null,
              agencyName: item.agencyName || null,
              uploadedAt: (item.uploadedAt ?? firstPhoto?.uploadedAt)
                ? new Date((item.uploadedAt ?? firstPhoto!.uploadedAt)!)
                : null,
              photos: photosJson,
            },
          });
        }
      } else {
        // Crear item nuevo
        const firstPhoto = item.photos?.[0];
        const photosJson = item.photos?.length
          ? item.photos.map((p) => ({
              tempOriginalPath: p.tempOriginalPath,
              tempProcessedPath: p.tempProcessedPath,
              uploadedAt: p.uploadedAt ?? null,
            }))
          : null;

        await tx.documentItem.create({
          data: {
            recordId,
            tipoDocumento: item.tipoDocumento,
            entregado: item.entregado,
            descripcion: item.descripcion || null,
            tempOriginalPath: firstPhoto?.tempOriginalPath || null,
            tempProcessedPath: firstPhoto?.tempProcessedPath || null,
            agencyName: item.agencyName || null,
            uploadedAt: (item.uploadedAt ?? firstPhoto?.uploadedAt)
              ? new Date((item.uploadedAt ?? firstPhoto!.uploadedAt)!)
              : null,
            photos: photosJson,
            sortOrder: SORT_ORDER[item.tipoDocumento] ?? 99,
          },
        });
      }
    }

    // Marcar como PROCESANDO
    await tx.documentRecord.update({
      where: { id: recordId },
      data: { estado: "PROCESANDO", errorDetalle: null },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        agencia: existingRecord.agencia,
        action: "ADD_DOCUMENTS",
        entityType: "document_record",
        entityId: recordId,
        recordId,
        metadata: {
          itemsAgregados: newDelivered.map((i) => i.tipoDocumento),
          agenciasPorDoc: newDelivered
            .filter((i) => i.agencyName)
            .map((i) => ({ tipoDocumento: i.tipoDocumento, agencyName: i.agencyName })),
          conductor: existingRecord.nombreConductor,
          manifiesto: existingRecord.manifiesto,
        },
        ipAddress: ip,
      },
    });
  });

  logger.info("Items agregados al registro, iniciando pipeline", {
    recordId,
    nuevos: newDelivered.map((i) => i.tipoDocumento),
  });

  // ── 4. Pipeline Drive + PDF + Sheets ──────────────────────────────────────
  try {
    const pdfUrl = await processAddDocuments(recordId);

    return NextResponse.json({ success: true, recordId, pdfUrl });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("Error en PATCH /api/records/[id]/complete", { recordId, error: errorMsg });

    return NextResponse.json(
      {
        error: "Error al procesar los documentos. Por favor reintente.",
        detail: process.env.NODE_ENV === "development" ? errorMsg : undefined,
      },
      { status: 500 }
    );
  }
}
