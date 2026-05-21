/**
 * Seed — datos iniciales de la base de datos
 * Ejecutar: npx prisma db seed
 *
 * Requiere Prisma 7 + @prisma/adapter-pg
 */

import { config } from "dotenv";
config({ override: true }); // fuerza .env sobre variables de entorno existentes
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Clientes de ejemplo ────────────────────────────────────────────────────
// Reemplaza o amplía esta lista con los clientes reales de la empresa.
const clientes = [
  { nit: "800123456-1", nombre: "Almacenes Éxito S.A." },
  { nit: "900234567-2", nombre: "Colombina S.A." },
  { nit: "860002153-1", nombre: "Bavaria S.A." },
  { nit: "890903938-8", nombre: "Postobón S.A." },
  { nit: "800058164-3", nombre: "Grupo Nutresa S.A." },
  { nit: "860034313-7", nombre: "Alpina Productos Alimenticios S.A." },
  { nit: "890903407-5", nombre: "Cementos Argos S.A." },
  { nit: "900041220-6", nombre: "Sodimac Colombia S.A." },
  { nit: "830114945-4", nombre: "Homecenter y Compañía S.C.A." },
  { nit: "800165316-9", nombre: "DHL Express Colombia Ltda." },
];

async function main() {
  console.log("🌱 Iniciando seed de la base de datos...\n");

  console.log("→ Insertando clientes...");
  for (const cliente of clientes) {
    const result = await prisma.client.upsert({
      where: { nit: cliente.nit },
      update: { nombre: cliente.nombre },
      create: {
        nit: cliente.nit,
        nombre: cliente.nombre,
        activo: true,
      },
    });
    console.log(`  ✓ ${result.nombre} (NIT: ${result.nit})`);
  }

  console.log("\n✅ Seed completado exitosamente.");
  console.log(`   ${clientes.length} clientes insertados/actualizados.`);
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
