/**
 * GET /api/viajes/:manifiesto
 *
 * Consulta el Google Sheet VIAJES buscando el manifiesto indicado.
 * Si lo encuentra, devuelve los datos del viaje (conductor, placa, cliente)
 * y busca el clienteId en la tabla clients (creándolo si no existe).
 *
 * Respuesta exitosa:
 *   { found: true, manifiesto, clienteNombre, clienteId, placa, conductor }
 *
 * No encontrado:
 *   { found: false, error: "No se encontró información..." }
 *
 * Error de conectividad:
 *   { found: false, error: "No fue posible consultar..." }  [status 503]
 */

import { NextRequest, NextResponse } from "next/server";
import { searchViajeByManifiesto } from "@/lib/google/viajes";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ manifiesto: string }> }
) {
  const { manifiesto } = await params;

  if (!manifiesto || manifiesto.trim().length < 1) {
    return NextResponse.json(
      { found: false, error: "Número de manifiesto inválido" },
      { status: 400 }
    );
  }

  try {
    const viaje = await searchViajeByManifiesto(manifiesto.trim());

    if (!viaje) {
      return NextResponse.json({
        found: false,
        error: "No se encontró información para el manifiesto ingresado.",
      });
    }

    // ── Buscar o crear cliente en la tabla clients ──────────────────────────
    let cliente = await prisma.client.findFirst({
      where: { nombre: { equals: viaje.clienteNombre, mode: "insensitive" } },
    });

    if (!cliente) {
      // Auto-crear cliente para mantener integridad referencial
      cliente = await prisma.client.create({
        data: {
          nombre: viaje.clienteNombre,
          nit: `VIAJES-${Date.now()}`, // NIT provisional; debe editarse en administración
          activo: true,
        },
      });
      logger.info("Cliente creado automáticamente desde VIAJES", {
        nombre: viaje.clienteNombre,
        id: cliente.id,
      });
    }

    return NextResponse.json({
      found: true,
      manifiesto: viaje.manifiesto,
      clienteNombre: viaje.clienteNombre,
      clienteId: cliente.id,
      placa: viaje.placa,
      conductor: viaje.conductor,
    });
  } catch (e) {
    logger.error("Error en GET /api/viajes/[manifiesto]", {
      manifiesto,
      error: String(e),
    });
    return NextResponse.json(
      {
        found: false,
        error:
          "No fue posible consultar la información del viaje. Intente nuevamente.",
      },
      { status: 503 }
    );
  }
}
