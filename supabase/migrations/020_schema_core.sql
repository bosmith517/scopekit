-- 020_schema_core.sql
-- Core tables for ScopeKit Capture
-- Idempotent: CREATE TABLE IF NOT EXISTS

-- Site visits (main capture sessions)
CREATE TABLE IF NOT EXISTS site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  lead_id UUID,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  address TEXT,
  evidence_pack VARCHAR(100) NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' 
    CHECK (status IN ('in_progress','finalizing','completed','failed')),
  consent_id UUID,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Visit media (photos and audio)
CREATE TABLE IF NOT EXISTS site_visit_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo','audio','video')),
  storage_path TEXT NOT NULL,
  file_size INT,
  duration_ms INT,
  sequence INT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  hash VARCHAR(64), -- SHA-256 for deduplication
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

-- Media markers (annotations on photos)
CREATE TABLE IF NOT EXISTS site_visit_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES site_visit_media(id) ON DELETE CASCADE,
  bbox JSONB NOT NULL, -- {x, y, w, h} normalized 0-1
  label VARCHAR(255),
  color VARCHAR(7) DEFAULT '#FF0000',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visit transcripts
CREATE TABLE IF NOT EXISTS site_visit_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
  media_id UUID REFERENCES site_visit_media(id),
  segments JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {start_ms, end_ms, text, confidence, speaker}
  full_text TEXT,
  language VARCHAR(10) DEFAULT 'en',
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visit sync events (for offline sync tracking)
CREATE TABLE IF NOT EXISTS visit_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Visit consents
CREATE TABLE IF NOT EXISTS visit_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID UNIQUE NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
  consent_text TEXT NOT NULL,
  accepted_by TEXT NOT NULL,
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  geotag JSONB, -- {lat, lng, accuracy, timestamp}
  signature_data TEXT
);

-- AI processing queue
CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES site_visits(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('transcribe','estimate','export')),
  status TEXT NOT NULL DEFAULT 'queued' 
    CHECK (status IN ('queued','running','completed','failed')),
  priority INT DEFAULT 0,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_error TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  idempotency_key VARCHAR(255) UNIQUE
);

-- Dead letter queue
CREATE TABLE IF NOT EXISTS ai_jobs_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id UUID NOT NULL,
  visit_id UUID,
  job_type TEXT NOT NULL,
  last_error TEXT,
  attempts INT,
  payload JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  moved_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estimates
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID UNIQUE NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  version INT DEFAULT 1,
  total_amount DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estimate line items with evidence
CREATE TABLE IF NOT EXISTS estimate_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {media_id, type, bbox?, start_ms?, end_ms?, confidence, label?}
  category VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(estimate_id, line_number)
);

-- Tenant settings (for feature flags)
CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL,
  feature_flags JSONB DEFAULT '{
    "visits": {
      "enabled": true,
      "consent_required": true,
      "ai_estimation_enabled": false,
      "ws_progress_enabled": false,
      "redaction_enabled": false
    }
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Share link tokens (with view counter)
CREATE TABLE IF NOT EXISTS share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(255) UNIQUE NOT NULL,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  view_count INT DEFAULT 0,
  max_views INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb
);