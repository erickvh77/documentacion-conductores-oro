import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nit: true, nombre: true },
    });
    return NextResponse.json(clients);
  } catch (error) {
    logger.error("Error al obtener clientes", { error: String(error) });
    return NextResponse.json(
      { error: "Error al obtener la lista de clientes" },
      { status: 500 }
    );
  }
}
