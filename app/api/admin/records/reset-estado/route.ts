/**
 * POST /api/admin/records/reset-estado
 *
 * Reinicia el estado de registros atascados en PROCESANDO o ERROR
 * para que puedan volver a completarse.
 *
 * Body: { recordIds: string[] }
 *   → Resetea exactamente esos IDs (máx. 50 a la vez)
 *
 * Protegido con ADMIN_SECRET (variable de entorno).
 * Uso: curl -X POST .../api/admin/records/reset-estado \
 *        -H "Authorization: Bearer <ADMIN_SECRET>" \
 *        -H "Content-Type: application/json" \
 *        -d '{"recordIds":["uuid1","uuid2"]}'
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  // ── Autenticación simple con secret ───────────────────────────────────────
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json({ error: "ADMIN_SECRET no configurado" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== adminSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // ── Leer IDs ──────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const recordIds = (body as any)?.recordIds;
  if (!Array.isArray(recordIds) || recordIds.length === 0 || recordIds.length > 50) {
    return NextResponse.json(
      { error: "recordIds debe ser un array de 1 a 50 IDs" },
      { status: 400 }
    );
  }

  // ── Resetear a COMPLETADO ─────────────────────────────────────────────────
  const result = await prisma.documentRecord.updateMany({
    where: {
      id: { in: recordIds },
      estado: { in: ["PROCESANDO", "ERROR"] },
    },
    data: { estado: "COMPLETADO", errorDetalle: null },
  });

  logger.info("Reset de estado de registros", {
    solicitados: recordIds.length,
    actualizados: result.count,
    ids: recordIds,
  });

  return NextResponse.json({
    ok: true,
    solicitados: recordIds.length,
    actualizados: result.count,
  });
}
