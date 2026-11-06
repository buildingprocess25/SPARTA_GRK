-- CreateTable
CREATE TABLE "store_kwh_reading" (
    "reading_date" DATE NOT NULL,
    "year_month" TEXT NOT NULL,
    "store_code" TEXT NOT NULL,
    "meter_id" TEXT NOT NULL,
    "branch_code" TEXT NOT NULL,
    "meter_type" TEXT NOT NULL,
    "input_at" TIMESTAMPTZ(6),
    "reading_kwh" DOUBLE PRECISION NOT NULL,
    "previous_kwh" DOUBLE PRECISION NOT NULL,
    "raw_gap_kwh" DOUBLE PRECISION NOT NULL,
    "usage_kwh" DOUBLE PRECISION,
    "spread_days" INTEGER NOT NULL DEFAULT 1,
    "flag" TEXT NOT NULL DEFAULT 'OK',
    "batch_id" TEXT,

    CONSTRAINT "store_kwh_reading_pkey" PRIMARY KEY ("store_code","meter_id","reading_date")
);

-- CreateTable
CREATE TABLE "store_kwh_monthly" (
    "year_month" TEXT NOT NULL,
    "store_code" TEXT NOT NULL,
    "meter_id" TEXT NOT NULL,
    "store_name" TEXT NOT NULL,
    "branch_code" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "grid_region" TEXT NOT NULL,
    "grid_factor" DOUBLE PRECISION NOT NULL,
    "meter_type" TEXT NOT NULL,
    "ownership" TEXT,
    "in_scope" BOOLEAN NOT NULL DEFAULT true,
    "store_complete" BOOLEAN NOT NULL DEFAULT false,
    "measured_kwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimated_kwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emission_kg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "median_daily_kwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reported_days" INTEGER NOT NULL DEFAULT 0,
    "store_reported_days" INTEGER NOT NULL DEFAULT 0,
    "covered_days" INTEGER NOT NULL DEFAULT 0,
    "missing_days" INTEGER NOT NULL DEFAULT 0,
    "flagged_days" INTEGER NOT NULL DEFAULT 0,
    "low_usage" BOOLEAN NOT NULL DEFAULT false,
    "last_reading_kwh" DOUBLE PRECISION,
    "last_reading_date" DATE,
    "batch_id" TEXT,

    CONSTRAINT "store_kwh_monthly_pkey" PRIMARY KEY ("year_month","store_code","meter_id")
);

-- CreateTable
CREATE TABLE "store_kwh_branch_daily" (
    "reading_date" DATE NOT NULL,
    "year_month" TEXT NOT NULL,
    "day_index" INTEGER NOT NULL,
    "branch_code" TEXT NOT NULL,
    "meter_type" TEXT NOT NULL,
    "store_complete" BOOLEAN NOT NULL,
    "usage_kwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reported_meters" INTEGER NOT NULL DEFAULT 0,
    "zero_previous" INTEGER NOT NULL DEFAULT 0,
    "top_up" INTEGER NOT NULL DEFAULT 0,
    "decreased" INTEGER NOT NULL DEFAULT 0,
    "placeholder" INTEGER NOT NULL DEFAULT 0,
    "replaced" INTEGER NOT NULL DEFAULT 0,
    "low_usage_rows" INTEGER NOT NULL DEFAULT 0,
    "batch_id" TEXT,

    CONSTRAINT "store_kwh_branch_daily_pkey" PRIMARY KEY ("reading_date","branch_code","meter_type","store_complete")
);

-- CreateIndex
CREATE INDEX "store_kwh_reading_year_month_idx" ON "store_kwh_reading"("year_month");

-- CreateIndex
CREATE INDEX "store_kwh_reading_branch_code_reading_date_idx" ON "store_kwh_reading"("branch_code", "reading_date");

-- CreateIndex
CREATE INDEX "store_kwh_monthly_year_month_in_scope_idx" ON "store_kwh_monthly"("year_month", "in_scope");

-- CreateIndex
CREATE INDEX "store_kwh_monthly_year_month_branch_code_idx" ON "store_kwh_monthly"("year_month", "branch_code");

-- CreateIndex
CREATE INDEX "store_kwh_branch_daily_year_month_idx" ON "store_kwh_branch_daily"("year_month");
