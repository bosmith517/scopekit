-- DEVELOPMENT ONLY - Disable RLS for testing
-- WARNING: This removes all security - only use for local development!

-- Disable RLS on all tables
ALTER TABLE site_visits DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_visit_media DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_visit_markers DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_visit_transcripts DISABLE ROW LEVEL SECURITY;
ALTER TABLE estimates DISABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE visit_consents DISABLE ROW LEVEL SECURITY;
ALTER TABLE visit_sync_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs_dlq DISABLE ROW LEVEL SECURITY;

-- Grant all permissions to anon and authenticated roles
GRANT ALL ON site_visits TO anon, authenticated;
GRANT ALL ON site_visit_media TO anon, authenticated;
GRANT ALL ON site_visit_markers TO anon, authenticated;
GRANT ALL ON site_visit_transcripts TO anon, authenticated;
GRANT ALL ON estimates TO anon, authenticated;
GRANT ALL ON estimate_lines TO anon, authenticated;
GRANT ALL ON visit_consents TO anon, authenticated;
GRANT ALL ON visit_sync_events TO anon, authenticated;
GRANT ALL ON ai_jobs TO anon, authenticated;
GRANT ALL ON ai_jobs_dlq TO anon, authenticated;

-- Grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Verify tables exist and show their RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'site_visits', 
    'site_visit_media', 
    'estimates', 
    'visit_consents',
    'visit_sync_events'
  );

-- Show current user and roles
SELECT current_user, current_role;