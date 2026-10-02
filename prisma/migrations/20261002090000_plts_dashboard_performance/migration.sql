CREATE TABLE "monthly_yield_observation" (
    "id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "energy_kwh" DOUBLE PRECISION NOT NULL,
    "measurement_type" TEXT NOT NULL DEFAULT 'MONTHLY_YIELD',
    "source" TEXT NOT NULL,
    "source_file" TEXT,
    "source_row" INTEGER,
    "source_file_hash" TEXT,
    "import_batch_id" TEXT,
    "quality_status" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "observed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "monthly_yield_observation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monthly_yield_observation_year_month_ps_id_measurement_type_source_key"
ON "monthly_yield_observation"("year_month", "ps_id", "measurement_type", "source");
CREATE INDEX "monthly_yield_observation_year_month_idx" ON "monthly_yield_observation"("year_month");
CREATE INDEX "monthly_yield_observation_import_batch_id_idx" ON "monthly_yield_observation"("import_batch_id");

CREATE TABLE "target_monthly" (
    "id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_ref" TEXT,
    "source_hash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "target_monthly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "target_monthly_year_month_metric_source_key" ON "target_monthly"("year_month", "metric", "source");
CREATE INDEX "target_monthly_year_month_idx" ON "target_monthly"("year_month");

CREATE TABLE "climate_monthly" (
    "id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "radiation_kwh_m2" DOUBLE PRECISION,
    "module_temp_c" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "source_ref" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "climate_monthly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "climate_monthly_year_month_ps_id_source_key" ON "climate_monthly"("year_month", "ps_id", "source");
CREATE INDEX "climate_monthly_year_month_idx" ON "climate_monthly"("year_month");

CREATE TABLE "load_monthly" (
    "id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "load_kwh" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "source_ref" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "load_monthly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "load_monthly_year_month_ps_id_source_key" ON "load_monthly"("year_month", "ps_id", "source");
CREATE INDEX "load_monthly_year_month_idx" ON "load_monthly"("year_month");
