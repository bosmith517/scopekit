-- Check current role and permissions
SELECT current_user, current_role, current_setting('request.jwt.claims', true) as jwt_claims;

-- Check if anon role has proper permissions
SELECT 
    tablename,
    privilege_type,
    grantee
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
    AND tablename IN ('site_visits', 'estimates', 'site_visit_media')
    AND grantee IN ('anon', 'authenticated')
ORDER BY tablename, grantee, privilege_type;

-- Check if the anon role exists and is configured correctly
SELECT 
    rolname,
    rolsuper,
    rolinherit,
    rolcreaterole,
    rolcreatedb,
    rolcanlogin
FROM pg_roles 
WHERE rolname IN ('anon', 'authenticated', 'service_role');

-- Ensure anon role has proper schema permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Also check if the tables are exposed in the API
-- In Supabase, tables need to be in the exposed schemas
SELECT 
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN ('site_visits', 'estimates', 'site_visit_media', 'visit_consents', 'visit_sync_events');

-- Check PostgREST configuration
-- This shows which schemas are exposed to the API
SHOW "pgrst.db_schemas";