-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS "Allow anonymous read site_visits" ON site_visits;
DROP POLICY IF EXISTS "Allow anonymous insert site_visits" ON site_visits;
DROP POLICY IF EXISTS "Allow anonymous update site_visits" ON site_visits;
DROP POLICY IF EXISTS "Allow anonymous read site_visit_media" ON site_visit_media;
DROP POLICY IF EXISTS "Allow anonymous insert site_visit_media" ON site_visit_media;
DROP POLICY IF EXISTS "Allow anonymous update site_visit_media" ON site_visit_media;
DROP POLICY IF EXISTS "Allow anonymous read estimates" ON estimates;
DROP POLICY IF EXISTS "Allow anonymous insert estimates" ON estimates;
DROP POLICY IF EXISTS "Allow anonymous read visit_consents" ON visit_consents;
DROP POLICY IF EXISTS "Allow anonymous insert visit_consents" ON visit_consents;
DROP POLICY IF EXISTS "Allow anonymous read visit_sync_events" ON visit_sync_events;
DROP POLICY IF EXISTS "Allow anonymous insert visit_sync_events" ON visit_sync_events;

-- Enable RLS on all tables (safe to run multiple times)
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visit_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visit_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visit_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_sync_events ENABLE ROW LEVEL SECURITY;

-- For development/testing: Allow anonymous access (remove in production)
-- These policies allow read/write access without authentication

-- Site Visits policies
CREATE POLICY "Allow anonymous read site_visits" ON site_visits
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert site_visits" ON site_visits
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update site_visits" ON site_visits
  FOR UPDATE USING (true);

-- Site Visit Media policies
CREATE POLICY "Allow anonymous read site_visit_media" ON site_visit_media
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert site_visit_media" ON site_visit_media
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update site_visit_media" ON site_visit_media
  FOR UPDATE USING (true);

-- Estimates policies
CREATE POLICY "Allow anonymous read estimates" ON estimates
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert estimates" ON estimates
  FOR INSERT WITH CHECK (true);

-- Visit Consents policies
CREATE POLICY "Allow anonymous read visit_consents" ON visit_consents
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert visit_consents" ON visit_consents
  FOR INSERT WITH CHECK (true);

-- Visit Sync Events policies
CREATE POLICY "Allow anonymous read visit_sync_events" ON visit_sync_events
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert visit_sync_events" ON visit_sync_events
  FOR INSERT WITH CHECK (true);

-- Note: In production, replace these with proper tenant-based policies:
-- CREATE POLICY "Tenant isolated reads" ON site_visits
--   FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- For now, also create the tables if they don't exist:
CREATE TABLE IF NOT EXISTS site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  evidence_pack VARCHAR(100),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_email VARCHAR(255),
  property_address TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  estimate_id UUID
);

CREATE TABLE IF NOT EXISTS site_visit_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES site_visits(id) ON DELETE CASCADE,
  media_type VARCHAR(50) NOT NULL,
  storage_path TEXT NOT NULL,
  sequence INTEGER,
  duration_ms INTEGER,
  file_size BIGINT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES site_visits(id),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  line_items JSONB,
  total_amount DECIMAL(10, 2),
  evidence_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE TABLE IF NOT EXISTS visit_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES site_visits(id) ON DELETE CASCADE,
  consent_text TEXT,
  accepted_by VARCHAR(255),
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  geotag JSONB,
  ip_address INET,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS visit_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES site_visits(id) ON DELETE CASCADE,
  event VARCHAR(100),
  payload JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_site_visits_tenant_id ON site_visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_status ON site_visits(status);
CREATE INDEX IF NOT EXISTS idx_site_visits_created_at ON site_visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visit_media_visit_id ON site_visit_media(visit_id);
CREATE INDEX IF NOT EXISTS idx_estimates_visit_id ON estimates(visit_id);
CREATE INDEX IF NOT EXISTS idx_estimates_tenant_id ON estimates(tenant_id);