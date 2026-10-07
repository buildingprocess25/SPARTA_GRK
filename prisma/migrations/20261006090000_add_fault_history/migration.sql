-- CreateTable
CREATE TABLE IF NOT EXISTS "fault_history" (
    "fault_code" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "ps_key" TEXT,
    "fault_name" TEXT NOT NULL,
    "fault_type" INTEGER NOT NULL,
    "fault_level" INTEGER NOT NULL,
    "create_time" TIMESTAMPTZ,
    "over_time" TIMESTAMPTZ,
    "process_status" TEXT,
    "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fault_history_pkey" PRIMARY KEY ("fault_code")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "fault_history_ps_id_idx" ON "fault_history"("ps_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "fault_history_fault_type_idx" ON "fault_history"("fault_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "fault_history_create_time_idx" ON "fault_history"("create_time");
