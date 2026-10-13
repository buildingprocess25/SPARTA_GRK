-- CreateTable
CREATE TABLE "store_master" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "ownership" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMPTZ(6),
    "last_sync_run_id" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "store_master_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "store_sync_run" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "added_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "reactivated_count" INTEGER NOT NULL DEFAULT 0,
    "deactivated_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,
    "triggered_by" TEXT,

    CONSTRAINT "store_sync_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_master_branch_idx" ON "store_master"("branch");

-- CreateIndex
CREATE INDEX "store_master_is_active_ownership_idx" ON "store_master"("is_active", "ownership");

-- CreateIndex
CREATE INDEX "store_sync_run_started_at_idx" ON "store_sync_run"("started_at");
