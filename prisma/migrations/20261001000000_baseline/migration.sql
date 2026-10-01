-- CreateTable
CREATE TABLE "plant_latest" (
    "ps_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "capacity_kwp" DOUBLE PRECISION NOT NULL,
    "curr_power_kw" DOUBLE PRECISION,
    "today_energy_kwh" DOUBLE PRECISION,
    "total_energy_kwh" DOUBLE PRECISION,
    "ps_status" INTEGER NOT NULL DEFAULT 1,
    "ps_fault_status" INTEGER NOT NULL DEFAULT 3,
    "alarm_count" INTEGER NOT NULL DEFAULT 0,
    "fault_count" INTEGER NOT NULL DEFAULT 0,
    "equivalent_hour" DOUBLE PRECISION,
    "connect_type" INTEGER,
    "build_status" INTEGER,
    "valid_flag" INTEGER,
    "co2_reduce_kg" DOUBLE PRECISION,
    "co2_reduce_total_kg" DOUBLE PRECISION,
    "today_income" DOUBLE PRECISION,
    "vendor_update_time" TIMESTAMPTZ,
    "sync_id" TEXT NOT NULL,
    "raw" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plant_latest_pkey" PRIMARY KEY ("ps_id")
);

-- CreateTable
CREATE TABLE "sync_run" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plant_count" INTEGER NOT NULL DEFAULT 0,
    "http_calls" INTEGER NOT NULL DEFAULT 0,
    "error_code" TEXT,
    "error_message" TEXT,

    CONSTRAINT "sync_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_yield" (
    "date_wib" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "yield_kwh" DOUBLE PRECISION NOT NULL,
    "peak_power_kw" DOUBLE PRECISION,
    "capacity_kwp" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'api_live',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_yield_pkey" PRIMARY KEY ("date_wib","ps_id")
);

-- CreateTable
CREATE TABLE "monthly_yield" (
    "year_month" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "energy_kwh" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'api_history',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "monthly_yield_pkey" PRIMARY KEY ("year_month","ps_id")
);

-- CreateTable
CREATE TABLE "api_token" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "credentials_hash" TEXT NOT NULL,
    "login_blocked" BOOLEAN NOT NULL DEFAULT false,
    "block_reason" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "api_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_counter" (
    "kind" TEXT NOT NULL,
    "bucket_key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quota_counter_pkey" PRIMARY KEY ("kind","bucket_key")
);

-- CreateTable
CREATE TABLE "sync_lock" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "locked_until" TIMESTAMPTZ,
    "locked_by" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sync_lock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_pr_reference" (
    "id" SERIAL NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "pr_percent" DOUBLE PRECISION NOT NULL,
    "captured_at" TIMESTAMPTZ NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "portal_pr_reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device" (
    "id" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "ps_key" TEXT NOT NULL,
    "device_sn" TEXT NOT NULL,
    "device_model_code" TEXT,
    "device_name" TEXT,
    "dev_fault_status" INTEGER NOT NULL DEFAULT 3,
    "dev_status" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_pr" (
    "ps_id" INTEGER NOT NULL,
    "pr_percent" DOUBLE PRECISION NOT NULL,
    "point_id" TEXT NOT NULL,
    "vendor_time" TIMESTAMPTZ,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_pr_pkey" PRIMARY KEY ("ps_id")
);

-- CreateTable
CREATE TABLE "inverter_latest" (
    "device_sn" TEXT NOT NULL,
    "ps_key" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "temp" DOUBLE PRECISION,
    "power_kw" DOUBLE PRECISION,
    "yield_kwh" DOUBLE PRECISION,
    "dev_fault_status" INTEGER NOT NULL DEFAULT 3,
    "device_time" TIMESTAMPTZ,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inverter_latest_pkey" PRIMARY KEY ("device_sn")
);

-- CreateTable
CREATE TABLE "fault_active" (
    "fault_code" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "ps_key" TEXT,
    "fault_name" TEXT NOT NULL,
    "fault_type" INTEGER NOT NULL,
    "fault_level" INTEGER NOT NULL,
    "create_time" TIMESTAMPTZ,
    "process_status" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fault_active_pkey" PRIMARY KEY ("fault_code")
);

-- CreateTable
CREATE TABLE "plant_master" (
    "dc_id" TEXT NOT NULL,
    "canonical_name" TEXT NOT NULL,
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "sungrow_ps_ids" INTEGER[],
    "api_installed_kwp" DOUBLE PRECISION NOT NULL,
    "baseline_installed_kwp" DOUBLE PRECISION NOT NULL,
    "region" TEXT,
    "grid" TEXT,
    "is_multi_plant" BOOLEAN NOT NULL DEFAULT false,
    "parent_dc" TEXT,
    "facility_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plant_master_pkey" PRIMARY KEY ("dc_id")
);

-- CreateTable
CREATE TABLE "facility_master" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facility_type" TEXT NOT NULL,
    "branch_id" TEXT,
    "branch_name" TEXT,
    "region" TEXT,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT,
    "grid_region" TEXT,
    "grid_emission_factor" DOUBLE PRECISION,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "verification_status" TEXT NOT NULL DEFAULT 'VERIFIED',
    "source_master" TEXT NOT NULL DEFAULT 'MONITOR_PLTS_WORKBOOK',
    "source_ref" TEXT,
    "plant_id" TEXT,
    "meter_type" TEXT NOT NULL DEFAULT 'DEDICATED',
    "shared_meter_coverage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "facility_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "energy_measurement" (
    "id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "dc_id" TEXT NOT NULL,
    "plant_name_raw" TEXT NOT NULL,
    "yield_mwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchased_mwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feed_in_mwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "load_mwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_prod_mwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yield_kwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchased_kwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feed_in_kwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "load_kwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_prod_kwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avoided_co2_ton" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL DEFAULT 'PLN',
    "proof_ref" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'EXCEL_IMPORT',
    "batch_id" TEXT,
    "sheet_name" TEXT,
    "row_number" INTEGER,
    "qualityStatus" TEXT NOT NULL DEFAULT 'COMPLETE',
    "is_aggregate_row" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "energy_measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_activity" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "dc_id" TEXT NOT NULL,
    "facility_type" TEXT NOT NULL DEFAULT 'warehouse',
    "warehouse_sub" TEXT,
    "fuel_type" TEXT NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost_rupiah" DOUBLE PRECISION,
    "price_per_liter" DOUBLE PRECISION,
    "emission_factor" DOUBLE PRECISION NOT NULL,
    "emission_kg" DOUBLE PRECISION NOT NULL,
    "emission_ton" DOUBLE PRECISION NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'SCOPE_1',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validation_note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "batch_id" TEXT,
    "proof_ref" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fuel_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_activity" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "dc_id" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "activity_type" TEXT NOT NULL DEFAULT 'RECYCLE',
    "meter_start" DOUBLE PRECISION,
    "meter_end" DOUBLE PRECISION,
    "volume_m3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emission_factor" DOUBLE PRECISION NOT NULL DEFAULT 0.344,
    "emission_avoided_kg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emission_avoided_ton" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost_saved_rupiah" DOUBLE PRECISION,
    "rate_per_m3" DOUBLE PRECISION NOT NULL DEFAULT 8000,
    "qualityStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'EXCEL_IMPORT',
    "batch_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "water_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_factor_registry" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "factor_value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "location_or_grid" TEXT,
    "source_doc" TEXT NOT NULL,
    "valid_from" TEXT,
    "valid_to" TEXT,
    "version" TEXT NOT NULL DEFAULT '2026.1',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "conflict_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "emission_factor_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_target" (
    "id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PORTFOLIO',
    "dc_id" TEXT,
    "target_mwh" DOUBLE PRECISION NOT NULL,
    "target_kwh" DOUBLE PRECISION NOT NULL,
    "target_co2_ton" DOUBLE PRECISION NOT NULL,
    "target_coal_ton" DOUBLE PRECISION,
    "target_tree_count" INTEGER,
    "version" TEXT NOT NULL DEFAULT 'RKAP_2026_ORIGINAL',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "production_target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sheet_name" TEXT,
    "module" TEXT NOT NULL,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_snapshot_30m" (
    "id" TEXT NOT NULL,
    "slot_at" TIMESTAMPTZ NOT NULL,
    "slot_wib" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "dc_id" TEXT,
    "plant_name" TEXT NOT NULL,
    "capacity_kwp" DOUBLE PRECISION NOT NULL,
    "curr_power_kw" DOUBLE PRECISION,
    "today_energy_kwh" DOUBLE PRECISION,
    "total_energy_kwh" DOUBLE PRECISION,
    "equivalent_hour" DOUBLE PRECISION,
    "co2_reduce_kg" DOUBLE PRECISION,
    "ps_status" INTEGER NOT NULL DEFAULT 1,
    "ps_fault_status" INTEGER NOT NULL DEFAULT 3,
    "source_observed_at" TIMESTAMPTZ,
    "fetched_at" TIMESTAMPTZ NOT NULL,
    "saved_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_age_minutes" INTEGER,
    "quality_status" TEXT NOT NULL DEFAULT 'COMPLETE',
    "sync_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'api_live',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "plant_snapshot_30m_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snapshot_run_30m" (
    "id" TEXT NOT NULL,
    "slot_at" TIMESTAMPTZ NOT NULL,
    "slot_wib" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "total_plants" INTEGER NOT NULL DEFAULT 0,
    "captured_count" INTEGER NOT NULL DEFAULT 0,
    "stale_count" INTEGER NOT NULL DEFAULT 0,
    "missing_count" INTEGER NOT NULL DEFAULT 0,
    "total_power_kw" DOUBLE PRECISION,
    "total_today_energy_kwh" DOUBLE PRECISION,
    "trigger" TEXT NOT NULL DEFAULT 'cron',
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "snapshot_run_30m_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_pr_reference_ps_id_key" ON "portal_pr_reference"("ps_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_device_sn_key" ON "device"("device_sn");

-- CreateIndex
CREATE UNIQUE INDEX "facility_master_code_key" ON "facility_master"("code");

-- CreateIndex
CREATE INDEX "facility_master_facility_type_idx" ON "facility_master"("facility_type");

-- CreateIndex
CREATE INDEX "facility_master_branch_id_idx" ON "facility_master"("branch_id");

-- CreateIndex
CREATE INDEX "facility_master_verification_status_idx" ON "facility_master"("verification_status");

-- CreateIndex
CREATE INDEX "energy_measurement_year_month_idx" ON "energy_measurement"("year_month");

-- CreateIndex
CREATE INDEX "energy_measurement_dc_id_idx" ON "energy_measurement"("dc_id");

-- CreateIndex
CREATE UNIQUE INDEX "energy_measurement_year_month_dc_id_source_category_proof_r_key" ON "energy_measurement"("year_month", "dc_id", "source", "category", "proof_ref");

-- CreateIndex
CREATE INDEX "fuel_activity_year_month_idx" ON "fuel_activity"("year_month");

-- CreateIndex
CREATE INDEX "fuel_activity_dc_id_idx" ON "fuel_activity"("dc_id");

-- CreateIndex
CREATE INDEX "water_activity_year_month_idx" ON "water_activity"("year_month");

-- CreateIndex
CREATE INDEX "water_activity_dc_id_idx" ON "water_activity"("dc_id");

-- CreateIndex
CREATE UNIQUE INDEX "water_activity_year_month_dc_id_activity_type_key" ON "water_activity"("year_month", "dc_id", "activity_type");

-- CreateIndex
CREATE UNIQUE INDEX "emission_factor_registry_code_key" ON "emission_factor_registry"("code");

-- CreateIndex
CREATE UNIQUE INDEX "production_target_year_month_scope_version_key" ON "production_target"("year_month", "scope", "version");

-- CreateIndex
CREATE INDEX "plant_snapshot_30m_slot_at_idx" ON "plant_snapshot_30m"("slot_at");

-- CreateIndex
CREATE INDEX "plant_snapshot_30m_slot_wib_idx" ON "plant_snapshot_30m"("slot_wib");

-- CreateIndex
CREATE INDEX "plant_snapshot_30m_ps_id_idx" ON "plant_snapshot_30m"("ps_id");

-- CreateIndex
CREATE UNIQUE INDEX "plant_snapshot_30m_ps_id_slot_at_key" ON "plant_snapshot_30m"("ps_id", "slot_at");

-- CreateIndex
CREATE UNIQUE INDEX "snapshot_run_30m_slot_at_key" ON "snapshot_run_30m"("slot_at");

-- CreateIndex
CREATE INDEX "snapshot_run_30m_slot_wib_idx" ON "snapshot_run_30m"("slot_wib");

-- AddForeignKey
ALTER TABLE "energy_measurement" ADD CONSTRAINT "energy_measurement_dc_id_fkey" FOREIGN KEY ("dc_id") REFERENCES "plant_master"("dc_id") ON DELETE RESTRICT ON UPDATE CASCADE;
