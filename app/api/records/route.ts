/**
 * POST /api/records
 *
 * Pipeline completo:
 *  1. Validar payload (Zod)
 *  2. Persistir en PostgreSQL (estado=PROCESANDO)
 *  3. Procesar imágenes + PDF + Drive + Sheets (processor.ts)
 *  4. Retornar { success, recordId, pdfUrl }
 *
 * Cambios v2:
 *  - Ya no se recibe agencia global; se deriva del primer ítem entregado
 *  - Cada item puede traer agencyName y uploadedAt
 *  - Se recibe clienteNombre además de clienteId
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createRecordSchema, SORT_ORDER } from "@/lib/validation/schemas";
import { processRecord } from "@/lib/records/processor";
import { logger } from "@/lib/logger";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let recordId: string | undefined;

  try {
    const body = await request.json();

    // ── 1. Validación Zod ───────────────────────────────────────────────────
    const parsed = createRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const data = parsed.data;
    const ip =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    // Derivar agencia del registro desde el primer ítem entregado con agencia
    const agenciaRegistro =
      data.items.find((i) => i.entregado && i.agencyName)?.agencyName ?? null;

    // ── 2. Persistir en BD (transacción) ───────────────────────────────────
    const record = await prisma.$transaction(async (tx: any) => {
      const newRecord = await tx.documentRecord.create({
        data: {
          nombreConductor: data.nombreConductor,
          placa: data.placa.toUpperCase().trim(),
          manifiesto: data.manifiesto?.trim() || null,
          agencia: agenciaRegistro,
          clienteId: data.clienteId,
          numeroContenedor: data.numeroContenedor?.trim() || null,
          manifiestoContenedor: data.manifiestoContenedor?.trim() || null,
          estado: "PROCESANDO",
        },
      });

      // Insertar todos los items (entregados y no entregados)
      const itemsData = data.items.map((item) => {
        const firstPhoto = item.photos?.[0];
        // Mapear photos al formato JSON que guardará el processor con Drive IDs
        const photosJson = item.photos?.length
          ? item.photos.map((p) => ({
              tempOriginalPath: p.tempOriginalPath,
              tempProcessedPath: p.tempProcessedPath,
              uploadedAt: p.uploadedAt ?? null,
            }))
          : null;

        return {
          recordId: newRecord.id,
          tipoDocumento: item.tipoDocumento,
          entregado: item.entregado,
          descripcion: item.descripcion || null,
          // Primer foto en campos individuales (backward compat)
          tempOriginalPath: firstPhoto?.tempOriginalPath || null,
          tempProcessedPath: firstPhoto?.tempProcessedPath || null,
          agencyName: item.agencyName || null,
          uploadedAt: (item.uploadedAt ?? firstPhoto?.uploadedAt)
            ? new Date((item.uploadedAt ?? firstPhoto!.uploadedAt)!)
            : null,
          photos: photosJson,
          sortOrder: SORT_ORDER[item.tipoDocumento] ?? 99,
        };
      });

      await tx.documentItem.createMany({ data: itemsData });

      // Audit log de creación
      await tx.auditLog.create({
        data: {
          agencia: agenciaRegistro,
          action: "CREATE_RECORD",
          entityType: "document_record",
          entityId: newRecord.id,
          recordId: newRecord.id,
          metadata: {
            placa: data.placa,
            manifiesto: data.manifiesto,
            conductor: data.nombreConductor,
            cliente: data.clienteNombre,
            itemsTotal: data.items.length,
            itemsEntregados: data.items.filter((i) => i.entregado).length,
            agenciasPorDoc: data.items
              .filter((i) => i.entregado && i.agencyName)
              .map((i) => ({ tipoDocumento: i.tipoDocumento, agencyName: i.agencyName })),
          },
          ipAddress: ip,
        },
      });

      return newRecord;
    });

    recordId = record.id as string;
    logger.info("Registro creado en BD", {
      recordId,
      placa: data.placa,
      agencia: agenciaRegistro,
    });

    // ── 3. Pipeline: Drive + PDF + Sheets ──────────────────────────────────
    const pdfUrl = await processRecord(recordId);

    // Audit log de completado
    await prisma.auditLog.create({
      data: {
        agencia: agenciaRegistro,
        action: "RECORD_COMPLETED",
        entityType: "document_record",
        entityId: recordId,
        recordId,
        metadata: { pdfUrl },
        ipAddress: ip,
      },
    });

    // ── 4. Respuesta al cliente ─────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      recordId,
      pdfUrl,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("Error en POST /api/records", { recordId, error: errorMsg });

    return NextResponse.json(
      {
        error: "Error al procesar el registro. Por favor reintente.",
        detail: process.env.NODE_ENV === "development" ? errorMsg : undefined,
      },
      { status: 500 }
    );
  }
}
