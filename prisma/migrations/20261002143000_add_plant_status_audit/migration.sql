ALTER TABLE "plant_latest"
  ADD COLUMN "status_category" TEXT NOT NULL DEFAULT 'MONITORED',
  ADD COLUMN "status_reason" TEXT NOT NULL DEFAULT 'belum diklasifikasikan',
  ADD COLUMN "status_checked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "plant_latest_status_category_status_checked_at_idx"
  ON "plant_latest"("status_category", "status_checked_at");
