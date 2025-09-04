-- 030_indexes.sql
-- Performance indexes for ScopeKit tables
-- Idempotent: CREATE INDEX IF NOT EXISTS

-- Site visits indexes
CREATE INDEX IF NOT EXISTS idx_site_visits_tenant_status 
  ON site_visits(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_site_visits_created_by 
  ON site_visits(created_by);
CREATE INDEX IF NOT EXISTS idx_site_visits_created_at 
  ON site_visits(created_at DESC);

-- Media indexes
CREATE INDEX IF NOT EXISTS idx_visit_media_visit 
  ON site_visit_media(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_media_type 
  ON site_visit_media(media_type);
CREATE INDEX IF NOT EXISTS idx_visit_media_sequence 
  ON site_visit_media(visit_id, sequence);
CREATE UNIQUE INDEX IF NOT EXISTS idx_visit_media_hash 
  ON site_visit_media(hash) WHERE hash IS NOT NULL;

-- Transcript indexes
CREATE INDEX IF NOT EXISTS idx_transcripts_visit 
  ON site_visit_transcripts(visit_id);

-- AI Jobs indexes
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status 
  ON ai_jobs(status, created_at) WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS idx_ai_jobs_visit 
  ON ai_jobs(visit_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_priority 
  ON ai_jobs(priority DESC, created_at ASC) WHERE status = 'queued';

-- Estimates indexes  
CREATE INDEX IF NOT EXISTS idx_estimates_tenant 
  ON estimates(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estimates_visit 
  ON estimates(visit_id);

-- Estimate lines indexes
-- Note: UNIQUE constraint already exists on (estimate_id, line_number) in table definition

-- Sync events indexes
CREATE INDEX IF NOT EXISTS idx_sync_events_visit 
  ON visit_sync_events(visit_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_unsynced 
  ON visit_sync_events(synced_at) WHERE synced_at IS NULL;