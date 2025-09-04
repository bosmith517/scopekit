-- 010_helpers.sql
-- Helper functions for tenant isolation
-- Idempotent: safe to run multiple times

-- Create app schema if not exists
CREATE SCHEMA IF NOT EXISTS app;

-- Current tenant helper (uses JWT app_metadata)
CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.current_tenant_id', true)::uuid,
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );
$$;

-- Feature flag helper will be created after tenant_settings table
-- Moved to 025_feature_flag.sql to avoid dependency issues