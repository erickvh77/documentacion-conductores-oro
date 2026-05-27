/**
 * cleanup-record.js
 *
 * Elimina completamente un registro de viaje de la base de datos,
 * limpia la caché de carpetas Drive y muestra qué borrar manualmente
 * en Google Drive y Google Sheets.
 *
 * USO:
 *   node scripts/cleanup-record.js <manifiesto>            ← solo muestra info
 *   node scripts/cleanup-record.js <manifiesto> --borrar   ← borra de la BD
 *
 * EJEMPLOS:
 *   node scripts/cleanup-record.js 9853451
 *   node scripts/cleanup-record.js 9853451 --borrar
 */

require("dotenv").config();
const { PrismaClient } = require("./app/generated/prisma");

const prisma = new PrismaClient();

async function main() {
  const manifiesto = process.argv[2];
  const confirmar = process.argv[3] === "--borrar";

  if (!manifiesto) {
    console.error("❌  Uso: node scripts/cleanup-record.js <manifiesto> [--borrar]");
    process.exit(1);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Buscando manifiesto: ${manifiesto}`);
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
    console.log(`  ┌─ ID:           ${r.id}`);
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

  // ── Acciones manuales requeridas ────────────────────────────────────────
  console.log(`${"─".repeat(60)}`);
  console.log("📌  ACCIONES MANUALES EN GOOGLE DRIVE:");
  for (const r of records) {
    if (r.driveFolderId) {
      console.log(`   Eliminar carpeta MANIFIESTO_${manifiesto}:`);
      console.log(`   → https://drive.google.com/drive/folders/${r.driveFolderId}`);
    } else {
      console.log(`   No hay carpeta Drive registrada para este viaje.`);
    }
  }

  console.log("");
  console.log("📌  ACCIONES MANUALES EN GOOGLE SHEETS (tab Registros):");
  for (const r of records) {
    if (r.sheetsRowIndex) {
      console.log(`   Eliminar FILA ${r.sheetsRowIndex} del tab Registros`);
      console.log(`   (Busca el manifiesto ${manifiesto} en la columna C)`);
    } else {
      console.log(`   Fila no registrada en BD — busca manualmente el manifiesto ${manifiesto}`);
      console.log(`   en la columna C del tab Registros y elimina esa fila.`);
    }
  }
  console.log(`${"─".repeat(60)}`);
  console.log("");

  if (!confirmar) {
    console.log("⚠️   MODO SOLO LECTURA — no se borró nada.");
    console.log(`     Para eliminar de la BD, ejecuta con --borrar:`);
    console.log(`     node scripts/cleanup-record.js ${manifiesto} --borrar\n`);
    await prisma.$disconnect();
    return;
  }

  // ── Borrar de la BD ──────────────────────────────────────────────────────
  let totalItems = 0;
  let totalCache = 0;

  for (const r of records) {
    // 1. Limpiar caché de carpetas Drive relacionadas con este manifiesto
    const cacheDeleted = await prisma.driveFolderCache.deleteMany({
      where: {
        folderPath: { contains: `MANIFIESTO_${manifiesto}` },
      },
    });
    totalCache += cacheDeleted.count;

    // 2. Borrar el registro (cascade elimina los document_items automáticamente)
    await prisma.documentRecord.delete({ where: { id: r.id } });
    totalItems += r.items.length;

    console.log(`🗑️   Registro ${r.id} eliminado (${r.items.length} items).`);
  }

  if (totalCache > 0) {
    console.log(`🗑️   Cache Drive eliminado: ${totalCache} entradas.`);
  }

  console.log("");
  console.log("✅  LIMPIEZA DE BD COMPLETADA.");
  console.log("    Ahora realiza las acciones manuales indicadas arriba");
  console.log("    y luego vuelve a registrar el viaje desde cero.\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("\n❌  Error:", e.message ?? e);
  prisma.$disconnect();
  process.exit(1);
});
