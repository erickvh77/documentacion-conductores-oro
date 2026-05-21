-- Migración: columnas agregadas post-init
-- Generada manualmente para capturar cambios aplicados via SQL directo.

-- Columnas nuevas en document_items
ALTER TABLE "document_items"
  ADD COLUMN IF NOT EXISTS "agency_name"  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "uploaded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "photos"       JSONB;

-- Columnas nuevas en document_records
ALTER TABLE "document_records"
  ADD COLUMN IF NOT EXISTS "sheets_row_index" INTEGER,
  ADD COLUMN IF NOT EXISTS "drive_folder_id"  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "drive_folder_url" TEXT,
  ADD COLUMN IF NOT EXISTS "pdf_drive_id"     VARCHAR(100);

-- agencia pasa de NOT NULL a nullable
ALTER TABLE "document_records"
  ALTER COLUMN "agencia" DROP NOT NULL;
