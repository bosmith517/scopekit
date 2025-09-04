-- 025_feature_flag.sql
-- Feature flag helper function (depends on tenant_settings table)
-- Idempotent: safe to run multiple times

-- Feature flag helper
CREATE OR REPLACE FUNCTION app.feature_flag(flag_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (SELECT (feature_flags #>> string_to_array(flag_name, '.'))::boolean
     FROM tenant_settings 
     WHERE tenant_id = app.current_tenant_id()),
    false
  );
$$;