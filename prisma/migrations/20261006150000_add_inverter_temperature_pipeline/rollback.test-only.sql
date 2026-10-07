-- TEST DATABASE ONLY. Never run this script against production or staging.
-- Required session opt-in:
--   SET app.allow_inverter_temp_test_rollback = 'true';

DO $$
DECLARE
    db_name TEXT := current_database();
    rollback_allowed TEXT := current_setting('app.allow_inverter_temp_test_rollback', true);
BEGIN
    IF db_name !~* '(test|testing)' THEN
        RAISE EXCEPTION 'Refusing rollback: database name % is not recognizably a test database', db_name;
    END IF;

    IF rollback_allowed IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Refusing rollback: set app.allow_inverter_temp_test_rollback=true in this session';
    END IF;
END
$$;

DROP TABLE IF EXISTS "inverter_temp_export_audit";
DROP TABLE IF EXISTS "inverter_temp_aggregation_run";
DROP TABLE IF EXISTS "inverter_temp_daily";
DROP TABLE IF EXISTS "inverter_temp_sample";
DROP TABLE IF EXISTS "inverter_temp_sampling_run";
