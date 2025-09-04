-- 001_extensions.sql
-- Enable required PostgreSQL extensions
-- Idempotent: safe to run multiple times

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Set database defaults
ALTER DATABASE postgres SET statement_timeout = '30s';