// Script de diagnóstico — prueba conexión directa con pg (sin Prisma)
// Ejecutar: node test-db.mjs

import { readFileSync } from "fs";
import { resolve } from "path";

// Cargar .env manualmente
const envPath = resolve(process.cwd(), ".env");
const envLines = readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  process.env[key] = val; // siempre sobreescribir con valores del .env
}

const url = process.env.DATABASE_URL;
console.log("DATABASE_URL cargada:", url ? url.replace(/:([^:@]+)@/, ":***@") : "UNDEFINED");

// Probar con pg puro
const { default: pg } = await import("pg");
const { Pool } = pg;

// Test 1: con la URL del .env
console.log("\n[Test 1] Conectando con DATABASE_URL...");
try {
  const pool1 = new Pool({ connectionString: url });
  const client1 = await pool1.connect();
  const res1 = await client1.query("SELECT current_user, current_database()");
  console.log("✅ Conexión exitosa:", res1.rows[0]);
  client1.release();
  await pool1.end();
} catch (err) {
  console.error("❌ Falló con DATABASE_URL:", err.message);
}

// Test 2: con parámetros explícitos (sin ?schema=public)
console.log("\n[Test 2] Conectando con parámetros explícitos...");
try {
  const pool2 = new Pool({
    host: "localhost",
    port: 5432,
    database: "conductores_db",
    user: "postgres",
    password: "postgres",
  });
  const client2 = await pool2.connect();
  const res2 = await client2.query("SELECT current_user, current_database()");
  console.log("✅ Conexión exitosa:", res2.rows[0]);
  client2.release();
  await pool2.end();
} catch (err) {
  console.error("❌ Falló con parámetros explícitos:", err.message);
}

// Test 3: con 127.0.0.1 explícito
console.log("\n[Test 3] Conectando con 127.0.0.1...");
try {
  const pool3 = new Pool({
    host: "127.0.0.1",
    port: 5432,
    database: "conductores_db",
    user: "postgres",
    password: "postgres",
  });
  const client3 = await pool3.connect();
  const res3 = await client3.query("SELECT current_user, current_database()");
  console.log("✅ Conexión exitosa:", res3.rows[0]);
  client3.release();
  await pool3.end();
} catch (err) {
  console.error("❌ Falló con 127.0.0.1:", err.message);
}
