-- Add auditable provenance for canonical monthly iSolar history.
ALTER TABLE "monthly_yield"
  ADD COLUMN "measurement_type" TEXT NOT NULL DEFAULT 'MONTHLY_YIELD',
  ADD COLUMN "source_file" TEXT,
  ADD COLUMN "source_row" INTEGER,
  ADD COLUMN "source_file_hash" TEXT,
  ADD COLUMN "import_batch_id" TEXT,
  ADD COLUMN "imported_at" TIMESTAMPTZ,
  ADD COLUMN "quality_status" TEXT,
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "import_batch"
  ADD COLUMN "file_hash" TEXT,
  ADD COLUMN "import_mode" TEXT;

CREATE INDEX "monthly_yield_import_batch_id_idx"
  ON "monthly_yield"("import_batch_id");

CREATE UNIQUE INDEX "import_batch_module_file_hash_key"
  ON "import_batch"("module", "file_hash");

ALTER TABLE "monthly_yield"
  ADD CONSTRAINT "monthly_yield_import_batch_id_fkey"
  FOREIGN KEY ("import_batch_id") REFERENCES "import_batch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
