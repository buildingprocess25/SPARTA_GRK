-- Migration: Add composite indexes for PLTS performance optimization
-- Table: monthly_yield_observation
CREATE INDEX IF NOT EXISTS "monthly_yield_observation_year_month_measurement_type_idx" 
ON "monthly_yield_observation"("year_month", "measurement_type");

CREATE INDEX IF NOT EXISTS "monthly_yield_observation_year_month_ps_id_idx" 
ON "monthly_yield_observation"("year_month", "ps_id");

-- Table: climate_monthly
CREATE INDEX IF NOT EXISTS "climate_monthly_year_month_ps_id_idx" 
ON "climate_monthly"("year_month", "ps_id");

-- Table: load_monthly
CREATE INDEX IF NOT EXISTS "load_monthly_year_month_ps_id_idx" 
ON "load_monthly"("year_month", "ps_id");
