-- CreateEnum
CREATE TYPE "EstadoRegistro" AS ENUM ('BORRADOR', 'VALIDADO', 'PROCESANDO', 'SUBIDO_A_DRIVE', 'REGISTRADO_EN_SHEETS', 'COMPLETADO', 'ERROR');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('LIQUIDACION', 'CUMPLIDO', 'REMESA', 'SALIDA_PUERTO', 'CONTENEDOR_VACIO', 'OTROS');

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "nit" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_records" (
    "id" TEXT NOT NULL,
    "nombre_conductor" VARCHAR(150) NOT NULL,
    "placa" VARCHAR(20) NOT NULL,
    "manifiesto" VARCHAR(50),
    "agencia" VARCHAR(100) NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "numero_contenedor" VARCHAR(50),
    "manifiesto_contenedor" VARCHAR(50),
    "pdf_url" TEXT,
    "pdf_drive_id" VARCHAR(100),
    "drive_folder_id" VARCHAR(100),
    "drive_folder_url" TEXT,
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'BORRADOR',
    "error_detalle" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_items" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "tipo_documento" "TipoDocumento" NOT NULL,
    "entregado" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" TEXT,
    "original_image_url" TEXT,
    "original_drive_id" VARCHAR(100),
    "processed_image_url" TEXT,
    "processed_drive_id" VARCHAR(100),
    "temp_original_path" TEXT,
    "temp_processed_path" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "agencia" VARCHAR(100),
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" TEXT,
    "record_id" TEXT,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drive_folder_cache" (
    "id" TEXT NOT NULL,
    "folder_path" TEXT NOT NULL,
    "drive_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drive_folder_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_nit_key" ON "clients"("nit");

-- CreateIndex
CREATE INDEX "document_records_placa_idx" ON "document_records"("placa");

-- CreateIndex
CREATE INDEX "document_records_manifiesto_idx" ON "document_records"("manifiesto");

-- CreateIndex
CREATE INDEX "document_records_estado_idx" ON "document_records"("estado");

-- CreateIndex
CREATE INDEX "document_records_created_at_idx" ON "document_records"("created_at");

-- CreateIndex
CREATE INDEX "document_items_record_id_idx" ON "document_items"("record_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_items_record_id_tipo_documento_key" ON "document_items"("record_id", "tipo_documento");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_record_id_idx" ON "audit_logs"("record_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "drive_folder_cache_folder_path_key" ON "drive_folder_cache"("folder_path");

-- CreateIndex
CREATE INDEX "drive_folder_cache_folder_path_idx" ON "drive_folder_cache"("folder_path");

-- AddForeignKey
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "document_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "document_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
