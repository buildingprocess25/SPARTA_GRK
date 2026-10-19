-- CreateTable
CREATE TABLE "business_travel_entry" (
    "id" TEXT NOT NULL,
    "journal_code" TEXT NOT NULL,
    "accounting_date" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "kuu" TEXT NOT NULL,
    "kuu_source" TEXT,
    "account" TEXT NOT NULL,
    "cost_center" TEXT,
    "journal_type" TEXT,
    "description" TEXT NOT NULL,
    "amount_rupiah" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "route" TEXT,
    "leg_count" INTEGER NOT NULL DEFAULT 0,
    "distance_km" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_international" BOOLEAN NOT NULL DEFAULT false,
    "emission_kg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emission_ton" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emission_status" TEXT NOT NULL,
    "source_file" TEXT NOT NULL,
    "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "business_travel_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_travel_entry_journal_code_key" ON "business_travel_entry"("journal_code");

-- CreateIndex
CREATE INDEX "business_travel_entry_year_month_idx" ON "business_travel_entry"("year_month");

-- CreateIndex
CREATE INDEX "business_travel_entry_kuu_idx" ON "business_travel_entry"("kuu");
