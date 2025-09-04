-- 040_rls.sql
-- Row Level Security policies for all tables
-- Idempotent: DROP POLICY IF EXISTS before CREATE

-- Enable RLS on all tables
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visit_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visit_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visit_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs_dlq ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;

-- Site visits policies
DROP POLICY IF EXISTS "Tenant isolation" ON site_visits;
CREATE POLICY "Tenant isolation" ON site_visits
  FOR ALL USING (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS "User can see own visits" ON site_visits;
CREATE POLICY "User can see own visits" ON site_visits
  FOR SELECT USING (created_by = auth.uid() OR tenant_id = app.current_tenant_id());

-- Media policies (inherit from visit)
DROP POLICY IF EXISTS "Media follows visit access" ON site_visit_media;
CREATE POLICY "Media follows visit access" ON site_visit_media
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM site_visits 
      WHERE site_visits.id = site_visit_media.visit_id
      AND site_visits.tenant_id = app.current_tenant_id()
    )
  );

-- Markers follow media access
DROP POLICY IF EXISTS "Markers follow media access" ON site_visit_markers;
CREATE POLICY "Markers follow media access" ON site_visit_markers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM site_visit_media m
      JOIN site_visits v ON v.id = m.visit_id
      WHERE m.id = site_visit_markers.media_id
      AND v.tenant_id = app.current_tenant_id()
    )
  );

-- Transcript policies
DROP POLICY IF EXISTS "Transcripts follow visit access" ON site_visit_transcripts;
CREATE POLICY "Transcripts follow visit access" ON site_visit_transcripts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM site_visits 
      WHERE site_visits.id = site_visit_transcripts.visit_id
      AND site_visits.tenant_id = app.current_tenant_id()
    )
  );

-- Sync events policies
DROP POLICY IF EXISTS "Sync events follow visit" ON visit_sync_events;
CREATE POLICY "Sync events follow visit" ON visit_sync_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM site_visits 
      WHERE site_visits.id = visit_sync_events.visit_id
      AND site_visits.tenant_id = app.current_tenant_id()
    )
  );

-- Consent policies
DROP POLICY IF EXISTS "Consent follows visit access" ON visit_consents;
CREATE POLICY "Consent follows visit access" ON visit_consents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM site_visits 
      WHERE site_visits.id = visit_consents.visit_id
      AND site_visits.tenant_id = app.current_tenant_id()
    )
  );

-- AI Jobs policies
DROP POLICY IF EXISTS "Tenant can see own jobs" ON ai_jobs;
CREATE POLICY "Tenant can see own jobs" ON ai_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM site_visits 
      WHERE site_visits.id = ai_jobs.visit_id
      AND site_visits.tenant_id = app.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS "Service account full access" ON ai_jobs;
CREATE POLICY "Service account full access" ON ai_jobs
  FOR ALL 
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- DLQ policies (admin only)
DROP POLICY IF EXISTS "Admin only DLQ access" ON ai_jobs_dlq;
CREATE POLICY "Admin only DLQ access" ON ai_jobs_dlq
  FOR ALL USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

-- Estimates policies
DROP POLICY IF EXISTS "Tenant isolation" ON estimates;
CREATE POLICY "Tenant isolation" ON estimates
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Estimate lines (inherit from estimate)
DROP POLICY IF EXISTS "Lines follow estimate access" ON estimate_lines;
CREATE POLICY "Lines follow estimate access" ON estimate_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM estimates 
      WHERE estimates.id = estimate_lines.estimate_id
      AND estimates.tenant_id = app.current_tenant_id()
    )
  );

-- Tenant settings policies
DROP POLICY IF EXISTS "Tenant can manage own settings" ON tenant_settings;
CREATE POLICY "Tenant can manage own settings" ON tenant_settings
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Share tokens policies
DROP POLICY IF EXISTS "Tenant can manage own tokens" ON share_tokens;
CREATE POLICY "Tenant can manage own tokens" ON share_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM estimates e
      WHERE e.id = share_tokens.estimate_id
      AND e.tenant_id = app.current_tenant_id()
    )
  );

-- Public read for valid tokens
DROP POLICY IF EXISTS "Public can read valid tokens" ON share_tokens;
CREATE POLICY "Public can read valid tokens" ON share_tokens
  FOR SELECT USING (
    expires_at > NOW() AND view_count < max_views
  );