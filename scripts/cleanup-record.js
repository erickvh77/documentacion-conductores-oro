/**
 * cleanup-record.js
 *
 * Elimina completamente un registro de viaje de la base de datos,
 * limpia la caché de carpetas Drive y muestra qué borrar manualmente
 * en Google Drive y Google Sheets.
 *
 * USO:
 *   node scripts/cleanup-record.js <manifiesto>                        ← solo muestra info
 *   node scripts/cleanup-record.js <manifiesto> --borrar               ← borra TODOS de la BD
 *   node scripts/cleanup-record.js <manifiesto> --borrar --id <uuid>   ← borra solo ese ID
 *
 * EJEMPLOS:
 *   node scripts/cleanup-record.js 9853451
 *   node scripts/cleanup-record.js 9853451 --borrar
 *   node scripts/cleanup-record.js 9853809 --borrar --id abc123-def456
 */

require("dotenv").config();
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../app/generated/prisma");

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL no está configurado en el .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const manifiesto = process.argv[2];
  const confirmar = process.argv.includes("--borrar");

  // Soporte para --id <uuid> para borrar solo un registro específico
  const idFlagIdx = process.argv.indexOf("--id");
  const targetId = idFlagIdx !== -1 ? process.argv[idFlagIdx + 1] : null;

  if (!manifiesto) {
    console.error("❌  Uso: node scripts/cleanup-record.js <manifiesto> [--borrar] [--id <uuid>]");
    process.exit(1);
  }

  if (targetId && !confirmar) {
    console.error("❌  El flag --id solo tiene efecto junto con --borrar.");
    process.exit(1);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Buscando manifiesto: ${manifiesto}`);
  if (targetId) console.log(`  Filtro de ID:        ${targetId}`);
  console.log(`${"=".repeat(60)}\n`);

  // Buscar TODOS los registros con ese manifiesto (puede haber duplicados)
  const records = await prisma.documentRecord.findMany({
    where: { manifiesto: { equals: manifiesto.trim() } },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      cliente: { select: { nombre: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (records.length === 0) {
    console.log("❌  No se encontró ningún registro con ese manifiesto.");
    await prisma.$disconnect();
    return;
  }

  console.log(`📋  Registros encontrados: ${records.length}\n`);

  for (const r of records) {
    const marker = targetId ? (r.id === targetId ? "◀ ESTE SE BORRARÁ" : "  (se conserva)") : "";
    console.log(`  ┌─ ID:           ${r.id} ${marker}`);
    console.log(`  │  Placa:        ${r.placa}`);
    console.log(`  │  Conductor:    ${r.nombreConductor}`);
    console.log(`  │  Cliente:      ${r.cliente?.nombre ?? "—"}`);
    console.log(`  │  Estado:       ${r.estado}`);
    console.log(`  │  Creado:       ${r.createdAt.toISOString()}`);
    console.log(`  │  Sheets fila:  ${r.sheetsRowIndex ?? "(no guardado)"}`);
    console.log(`  │  PDF Drive ID: ${r.pdfDriveId ?? "(ninguno)"}`);
    console.log(`  │  PDF URL:      ${r.pdfUrl ?? "(ninguna)"}`);
    console.log(`  │  Carpeta ID:   ${r.driveFolderId ?? "(ninguna)"}`);
    if (r.driveFolderId) {
      console.log(`  │  Carpeta URL:  https://drive.google.com/drive/folders/${r.driveFolderId}`);
    }
    console.log(`  │  Items (${r.items.length}):`);
    for (const item of r.items) {
      const estado = item.entregado ? "✅ ENTREGADO" : "❌ no entregado";
      console.log(`  │    - ${item.tipoDocumento.padEnd(20)} ${estado}`);
    }
    console.log(`  └${"─".repeat(56)}`);
    console.log("");
  }

  // Determinar qué registros se van a borrar
  const recordsToDelete = targetId
    ? records.filter((r) => r.id === targetId)
    : records;

  if (targetId && recordsToDelete.length === 0) {
    console.log(`❌  No se encontró un registro con ID "${targetId}" para el manifiesto ${manifiesto}.`);
    await prisma.$disconnect();
    return;
  }

  // ── Acciones manuales requeridas ────────────────────────────────────────
  console.log(`${"─".repeat(60)}`);
  console.log("📌  ACCIONES MANUALES EN GOOGLE DRIVE:");
  for (const r of recordsToDelete) {
    if (r.pdfDriveId) {
      console.log(`   Eliminar PDF (Drive ID: ${r.pdfDriveId}):`);
      console.log(`   → ${r.pdfUrl ?? `https://drive.google.com/file/d/${r.pdfDriveId}/view`}`);
    }
    if (!targetId && r.driveFolderId) {
      console.log(`   Eliminar carpeta MANIFIESTO_${manifiesto}:`);
      console.log(`   → https://drive.google.com/drive/folders/${r.driveFolderId}`);
    }
    if (!r.pdfDriveId && !r.driveFolderId) {
      console.log(`   No hay archivos Drive registrados para este viaje.`);
    }
  }

  console.log("");
  console.log("📌  ACCIONES MANUALES EN GOOGLE SHEETS (tab Registros):");
  if (targetId) {
    console.log(`   Solo se borra el registro duplicado de la BD.`);
    console.log(`   La fila del sheet será actualizada correctamente`);
    console.log(`   la próxima vez que completes el viaje en la app.`);
  } else {
    for (const r of recordsToDelete) {
      if (r.sheetsRowIndex) {
        console.log(`   Eliminar FILA ${r.sheetsRowIndex} del tab Registros`);
        console.log(`   (Busca el manifiesto ${manifiesto} en la columna C)`);
      } else {
        console.log(`   Fila no registrada en BD — busca manualmente el manifiesto ${manifiesto}`);
        console.log(`   en la columna C del tab Registros y elimina esa fila.`);
      }
    }
  }
  console.log(`${"─".repeat(60)}`);
  console.log("");

  if (!confirmar) {
    console.log("⚠️   MODO SOLO LECTURA — no se borró nada.");
    console.log(`     Para eliminar todos los registros de la BD:`);
    console.log(`       node scripts/cleanup-record.js ${manifiesto} --borrar`);
    if (records.length > 1) {
      console.log(`     Para eliminar solo un registro específico (más seguro):`);
      console.log(`       node scripts/cleanup-record.js ${manifiesto} --borrar --id <ID_DEL_REGISTRO>`);
    }
    console.log("");
    await prisma.$disconnect();
    return;
  }

  // ── Borrar de la BD ──────────────────────────────────────────────────────
  let totalItems = 0;
  let totalCache = 0;

  for (const r of recordsToDelete) {
    // 1. Limpiar caché de carpetas Drive solo si borramos todo (no cuando --id)
    if (!targetId) {
      const cacheDeleted = await prisma.driveFolderCache.deleteMany({
        where: {
          folderPath: { contains: `MANIFIESTO_${manifiesto}` },
        },
      });
      totalCache += cacheDeleted.count;
    }

    // 2. Borrar el registro (cascade elimina los document_items automáticamente)
    await prisma.documentRecord.delete({ where: { id: r.id } });
    totalItems += r.items.length;

    console.log(`🗑️   Registro ${r.id} eliminado (${r.items.length} items).`);
  }

  if (totalCache > 0) {
    console.log(`🗑️   Cache Drive eliminado: ${totalCache} entradas.`);
  }

  console.log("");
  if (targetId) {
    const remaining = records.filter((r) => r.id !== targetId);
    console.log("✅  REGISTRO DUPLICADO ELIMINADO.");
    if (remaining.length > 0) {
      console.log(`    Queda el registro original: ${remaining[0].id}`);
      console.log("    Ahora puedes completar el viaje en la app normalmente.");
    }
  } else {
    console.log("✅  LIMPIEZA DE BD COMPLETADA.");
    console.log("    Ahora realiza las acciones manuales indicadas arriba");
    console.log("    y luego vuelve a registrar el viaje desde cero.");
  }
  console.log("");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("\n❌  Error:", e.message ?? e);
  prisma.$disconnect();
  process.exit(1);
});
