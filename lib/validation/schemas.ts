/**
 * Esquemas de validación Zod — compartidos entre frontend y backend.
 * Nunca confiar solo en la validación del cliente.
 */

import { z } from "zod";

// ─── Agencias disponibles ────────────────────────────────────────────────────
export const AGENCIAS = [
  "Armenia",
  "Buga",
  "Bugalagrande",
  "Buenaventura",
  "Pereira",
  "Bogotá",
  "Cartagena",
] as const;

export type Agencia = (typeof AGENCIAS)[number];

// ─── Tipos de documento activos ──────────────────────────────────────────────
// CUMPLIDO fue removido del flujo activo. Se conserva en LABELS_DOCUMENTO y
// SORT_ORDER para compatibilidad con registros existentes en la BD.
export const TIPOS_DOCUMENTO = [
  "LIQUIDACION",
  "REMESA",
  "SALIDA_PUERTO",
  "CONTENEDOR_VACIO",
  "OTROS",
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

// Sort order lógico para el PDF (incluye CUMPLIDO por compat. con registros existentes)
export const SORT_ORDER: Record<string, number> = {
  LIQUIDACION: 1,
  CUMPLIDO: 2,
  REMESA: 3,
  SALIDA_PUERTO: 4,
  CONTENEDOR_VACIO: 5,
  OTROS: 6,
};

// Etiquetas legibles — incluye CUMPLIDO para registros históricos en BD/PDF
export const LABELS_DOCUMENTO: Record<string, string> = {
  LIQUIDACION: "Liquidación",
  CUMPLIDO: "Cumplido",
  REMESA: "Remesa",
  SALIDA_PUERTO: "Salida de puerto",
  CONTENEDOR_VACIO: "Devolución de contenedor vacío",
  OTROS: "Otros",
};

// ─── Schema: Paso 1 — Datos del viaje (autocompletados desde VIAJES sheet) ───
// El usuario solo digita el manifiesto; el resto llega desde el Google Sheet VIAJES.
export const stepOneSchema = z.object({
  manifiesto: z
    .string()
    .min(1, "El número de manifiesto es obligatorio")
    .max(50),
  nombreConductor: z.string().min(3, "El nombre del conductor es obligatorio").max(150),
  placa: z.string().min(5, "La placa es obligatoria").max(20),
  clienteId: z.string().uuid("Cliente no válido"),
  clienteNombre: z.string().min(1, "El nombre del cliente es obligatorio").max(150),
});

export type StepOneData = z.infer<typeof stepOneSchema>;

// ─── Schema: foto individual dentro de un documento ──────────────────────────
export const photoUploadSchema = z.object({
  tempOriginalPath: z.string(),
  tempProcessedPath: z.string(),
  uploadedAt: z.string().optional(),
});

export type PhotoUploadData = z.infer<typeof photoUploadSchema>;

// ─── Schema: Item de documento ───────────────────────────────────────────────
export const documentItemSchema = z
  .object({
    tipoDocumento: z.enum(TIPOS_DOCUMENTO),
    entregado: z.boolean(),
    descripcion: z.string().max(500).optional(),
    // Fotos del documento (1 o más). El servidor asigna las rutas tras /api/upload.
    photos: z.array(photoUploadSchema).optional(),
    // Para CONTENEDOR_VACIO
    numeroContenedor: z.string().max(50).optional(),
    // Agencia que cargó el documento (obligatoria si entregado=true)
    agencyName: z.enum(AGENCIAS).optional(),
    // Timestamp de la primera foto (para Sheets / backward compat)
    uploadedAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.entregado) {
      // Al menos una foto obligatoria cuando el documento está marcado como entregado
      if (!data.photos || data.photos.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Al menos una foto es obligatoria cuando el documento está marcado como entregado",
          path: ["photos"],
        });
      }
      // Agencia obligatoria si está marcado como entregado
      if (!data.agencyName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe seleccionar la agencia para este documento",
          path: ["agencyName"],
        });
      }
      // Descripción obligatoria para OTROS
      if (data.tipoDocumento === "OTROS" && !data.descripcion?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La descripción es obligatoria para documentos tipo Otros",
          path: ["descripcion"],
        });
      }
    }
  });

export type DocumentItemData = z.infer<typeof documentItemSchema>;

// ─── Schema: Payload completo del registro (POST /api/records) ───────────────
// La agencia global ya no viene del formulario; se deriva de los ítems.
export const createRecordSchema = z
  .object({
    nombreConductor: z.string().min(3).max(150),
    placa: z.string().min(5).max(20),
    manifiesto: z.string().max(50).optional().or(z.literal("")),
    clienteId: z.string().uuid(),
    clienteNombre: z.string().min(1).max(150),
    // Número de contenedor (se extrae del item CONTENEDOR_VACIO cuando aplica)
    numeroContenedor: z.string().max(50).optional(),
    items: z.array(documentItemSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const tieneContenedor = data.items.find(
      (i) => i.tipoDocumento === "CONTENEDOR_VACIO" && i.entregado
    );
    // Manifiesto obligatorio salvo que el flujo sea exclusivamente de contenedor
    const soloContenedor =
      tieneContenedor &&
      data.items.filter((i) => i.tipoDocumento !== "CONTENEDOR_VACIO" && i.entregado).length === 0;

    if (!soloContenedor && !data.manifiesto?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El número de manifiesto es obligatorio",
        path: ["manifiesto"],
      });
    }
    // Número de contenedor obligatorio si CONTENEDOR_VACIO está en Sí
    if (tieneContenedor && !data.numeroContenedor?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El número de contenedor es obligatorio",
        path: ["numeroContenedor"],
      });
    }
  });

export type CreateRecordData = z.infer<typeof createRecordSchema>;

// ─── Schema: Completar registro con documentos faltantes (PATCH /api/records/[id]/complete) ──
export const completeRecordSchema = z.object({
  items: z.array(documentItemSchema).min(1, "Debe incluir al menos un documento"),
});

export type CompleteRecordData = z.infer<typeof completeRecordSchema>;

// ─── Schema: Upload de imagen (POST /api/upload) ─────────────────────────────
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/heic", "image/webp"];
