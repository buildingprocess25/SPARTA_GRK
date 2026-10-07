-- Additive-only migration for forward-only iSolar inverter temperature sampling.
-- This migration intentionally does not alter legacy tables or enable any scheduler.

CREATE TABLE "inverter_temp_sampling_run" (
    "id" TEXT NOT NULL,
    "scheduled_slot_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'running',
    "devices_expected" INTEGER NOT NULL DEFAULT 0,
    "expected_devices" JSONB NOT NULL DEFAULT '[]',
    "devices_ok" INTEGER NOT NULL DEFAULT 0,
    "devices_failed" INTEGER NOT NULL DEFAULT 0,
    "devices_filtered" INTEGER NOT NULL DEFAULT 0,
    "devices_duplicate" INTEGER NOT NULL DEFAULT 0,
    "chunks_total" INTEGER NOT NULL DEFAULT 0,
    "chunks_failed" INTEGER NOT NULL DEFAULT 0,
    "error_summary" TEXT,
    "chunk_details" JSONB NOT NULL DEFAULT '[]',
    "api_quota_used" INTEGER,
    "trigger" TEXT NOT NULL,
    "method_version" TEXT NOT NULL,

    CONSTRAINT "inverter_temp_sampling_run_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inverter_temp_sampling_run_status_check"
        CHECK ("status" IN ('running', 'success', 'partial', 'failed')),
    CONSTRAINT "inverter_temp_sampling_run_trigger_check"
        CHECK ("trigger" IN ('scheduler', 'manual')),
    CONSTRAINT "inverter_temp_sampling_run_scheduler_slot_check"
        CHECK (
            ("trigger" = 'scheduler' AND "scheduled_slot_at" IS NOT NULL) OR
            ("trigger" = 'manual' AND "scheduled_slot_at" IS NULL)
        ),
    CONSTRAINT "inverter_temp_sampling_run_counts_check"
        CHECK (
            "devices_expected" >= 0 AND "devices_ok" >= 0 AND
            "devices_failed" >= 0 AND "devices_filtered" >= 0 AND
            "devices_duplicate" >= 0 AND "chunks_total" >= 0 AND
            "chunks_failed" >= 0
        )
);

CREATE TABLE "inverter_temp_sample" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "device_sn" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "device_time" TIMESTAMPTZ(6),
    "device_time_raw" TEXT,
    "p4" DOUBLE PRECISION,
    "p24" DOUBLE PRECISION,
    "p4_raw" TEXT,
    "p24_raw" TEXT,
    "observation_key" TEXT NOT NULL,
    "quality_flags" JSONB NOT NULL DEFAULT '[]',
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method_version" TEXT NOT NULL,

    CONSTRAINT "inverter_temp_sample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inverter_temp_daily" (
    "id" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "date_wib" DATE NOT NULL,
    "method_version" TEXT NOT NULL,
    "avg_temp_c" DOUBLE PRECISION,
    "max_temp_c" DOUBLE PRECISION,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "inverters_covered" INTEGER NOT NULL DEFAULT 0,
    "inverters_registered" INTEGER NOT NULL DEFAULT 0,
    "coverage_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampling_coverage_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "production_coverage_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_inverter_spread_c" DOUBLE PRECISION,
    "has_spread_anomaly" BOOLEAN NOT NULL DEFAULT false,
    "quality_status" TEXT NOT NULL,
    "quality_reasons" JSONB NOT NULL DEFAULT '[]',
    "included_run_count" INTEGER NOT NULL DEFAULT 0,
    "expected_run_count" INTEGER NOT NULL DEFAULT 0,
    "valid_slot_count" INTEGER NOT NULL DEFAULT 0,
    "minimum_valid_slot_count" INTEGER NOT NULL,
    "stale_device_time_count" INTEGER NOT NULL DEFAULT 0,
    "stale_device_time_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inverter_temp_daily_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inverter_temp_daily_quality_status_check"
        CHECK ("quality_status" IN ('lengkap', 'sebagian', 'tidak lengkap')),
    CONSTRAINT "inverter_temp_daily_nonnegative_counts_check"
        CHECK (
            "sample_count" >= 0 AND "inverters_covered" >= 0 AND
            "inverters_registered" >= 0 AND "included_run_count" >= 0 AND
            "expected_run_count" >= 0 AND "valid_slot_count" >= 0 AND
            "minimum_valid_slot_count" >= 0 AND "stale_device_time_count" >= 0
        ),
    CONSTRAINT "inverter_temp_daily_percentage_range_check"
        CHECK (
            "coverage_pct" BETWEEN 0 AND 100 AND
            "sampling_coverage_pct" BETWEEN 0 AND 100 AND
            "production_coverage_pct" BETWEEN 0 AND 100 AND
            "stale_device_time_pct" BETWEEN 0 AND 100
        )
);

CREATE TABLE "inverter_temp_aggregation_run" (
    "id" TEXT NOT NULL,
    "target_date_wib" DATE NOT NULL,
    "method_version" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'running',
    "plants_expected" INTEGER NOT NULL DEFAULT 0,
    "plants_ok" INTEGER NOT NULL DEFAULT 0,
    "plants_failed" INTEGER NOT NULL DEFAULT 0,
    "error_summary" TEXT,
    "result_summary" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "inverter_temp_aggregation_run_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inverter_temp_aggregation_run_status_check"
        CHECK ("status" IN ('running', 'success', 'partial', 'failed')),
    CONSTRAINT "inverter_temp_aggregation_run_trigger_check"
        CHECK ("trigger" IN ('scheduler', 'manual')),
    CONSTRAINT "inverter_temp_aggregation_run_counts_check"
        CHECK ("plants_expected" >= 0 AND "plants_ok" >= 0 AND "plants_failed" >= 0)
);

CREATE TABLE "inverter_temp_export_audit" (
    "id" TEXT NOT NULL,
    "user_identifier" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "target_id" TEXT,
    "year" INTEGER NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "method_version" TEXT NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'running',
    "row_count" INTEGER,
    "file_name" TEXT,
    "error_summary" TEXT,

    CONSTRAINT "inverter_temp_export_audit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inverter_temp_export_audit_format_check"
        CHECK ("format" IN ('xlsx', 'csv_zip')),
    CONSTRAINT "inverter_temp_export_audit_status_check"
        CHECK ("status" IN ('running', 'success', 'failed')),
    CONSTRAINT "inverter_temp_export_audit_row_count_check"
        CHECK ("row_count" IS NULL OR "row_count" >= 0)
);

CREATE UNIQUE INDEX "inverter_temp_sampling_run_scheduled_slot_at_method_version_key"
    ON "inverter_temp_sampling_run"("scheduled_slot_at", "method_version");
CREATE INDEX "inverter_temp_sampling_run_started_at_idx"
    ON "inverter_temp_sampling_run"("started_at");
CREATE INDEX "inverter_temp_sampling_run_status_idx"
    ON "inverter_temp_sampling_run"("status");

-- Pooler-safe overlap guard: only one sampling run may be in running state.
CREATE UNIQUE INDEX "inverter_temp_sampling_run_one_running_key"
    ON "inverter_temp_sampling_run" ((1))
    WHERE "status" = 'running';

CREATE UNIQUE INDEX "inverter_temp_sample_device_sn_device_time_key"
    ON "inverter_temp_sample"("device_sn", "device_time");
CREATE UNIQUE INDEX "inverter_temp_sample_observation_key_key"
    ON "inverter_temp_sample"("observation_key");
CREATE INDEX "inverter_temp_sample_run_id_idx"
    ON "inverter_temp_sample"("run_id");
CREATE INDEX "inverter_temp_sample_ps_id_device_time_idx"
    ON "inverter_temp_sample"("ps_id", "device_time");
CREATE INDEX "inverter_temp_sample_device_sn_device_time_idx"
    ON "inverter_temp_sample"("device_sn", "device_time");

CREATE UNIQUE INDEX "inverter_temp_daily_ps_id_date_wib_method_version_key"
    ON "inverter_temp_daily"("ps_id", "date_wib", "method_version");
CREATE INDEX "inverter_temp_daily_date_wib_idx"
    ON "inverter_temp_daily"("date_wib");
CREATE INDEX "inverter_temp_daily_quality_status_idx"
    ON "inverter_temp_daily"("quality_status");

CREATE INDEX "inverter_temp_aggregation_run_started_at_idx"
    ON "inverter_temp_aggregation_run"("started_at");
CREATE INDEX "inverter_temp_aggregation_run_target_date_wib_idx"
    ON "inverter_temp_aggregation_run"("target_date_wib");
CREATE INDEX "inverter_temp_aggregation_run_status_idx"
    ON "inverter_temp_aggregation_run"("status");

CREATE INDEX "inverter_temp_export_audit_requested_at_idx"
    ON "inverter_temp_export_audit"("requested_at");
CREATE INDEX "inverter_temp_export_audit_user_identifier_idx"
    ON "inverter_temp_export_audit"("user_identifier");
CREATE INDEX "inverter_temp_export_audit_status_idx"
    ON "inverter_temp_export_audit"("status");

ALTER TABLE "inverter_temp_sample"
    ADD CONSTRAINT "inverter_temp_sample_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "inverter_temp_sampling_run"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
