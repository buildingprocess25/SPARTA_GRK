-- Monthly Plant PR from iSolarCloud (point p83023, monthly query type).
CREATE TABLE "plant_pr_monthly" (
    "year_month" TEXT NOT NULL,
    "ps_id" INTEGER NOT NULL,
    "pr_percent" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ISOLAR_API',
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plant_pr_monthly_pkey" PRIMARY KEY ("year_month","ps_id")
);

CREATE INDEX "plant_pr_monthly_ps_id_idx" ON "plant_pr_monthly"("ps_id");
