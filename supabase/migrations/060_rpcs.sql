-- 060_rpcs.sql
-- Remote Procedure Calls with tenant validation
-- Idempotent: CREATE OR REPLACE

-- Create site visit
CREATE OR REPLACE FUNCTION create_site_visit(
  p_tenant_id UUID,
  p_evidence_pack VARCHAR DEFAULT 'general_v1',
  p_customer_id UUID DEFAULT NULL,
  p_customer_name VARCHAR DEFAULT NULL,
  p_customer_email VARCHAR DEFAULT NULL,
  p_customer_phone VARCHAR DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visit_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Verify tenant match
  IF p_tenant_id != app.current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  INSERT INTO site_visits (
    tenant_id, lead_id, evidence_pack, created_by, 
    customer_name, customer_email, customer_phone, address, status
  ) VALUES (
    p_tenant_id, p_customer_id, p_evidence_pack, v_user_id,
    p_customer_name, p_customer_email, p_customer_phone, p_address, 'in_progress'
  ) RETURNING id INTO v_visit_id;

  INSERT INTO visit_sync_events (visit_id, event, payload)
  VALUES (v_visit_id, 'created', jsonb_build_object(
    'user_id', v_user_id,
    'evidence_pack', p_evidence_pack
  ));

  RETURN v_visit_id;
END;
$$;

-- Record consent
CREATE OR REPLACE FUNCTION record_visit_consent(
  p_visit_id UUID,
  p_consent_text TEXT,
  p_accepted_by TEXT,
  p_geotag JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent_id UUID;
  v_ip_raw TEXT;
  v_ip INET;
  v_user_agent TEXT;
BEGIN
  -- Verify visit belongs to current tenant
  IF NOT EXISTS(
    SELECT 1 FROM site_visits 
    WHERE id = p_visit_id 
    AND tenant_id = app.current_tenant_id()
  ) THEN
    RAISE EXCEPTION 'Visit not found or forbidden';
  END IF;

  -- Extract IP and user agent from headers
  BEGIN
    v_ip_raw := current_setting('request.headers', true)::json->>'x-forwarded-for';
    IF v_ip_raw IS NOT NULL THEN
      v_ip := split_part(v_ip_raw, ',', 1)::inet;
    END IF;
    v_user_agent := current_setting('request.headers', true)::json->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO visit_consents (
    visit_id, consent_text, accepted_by, geotag, ip_address, user_agent
  ) VALUES (
    p_visit_id, p_consent_text, p_accepted_by, p_geotag, v_ip, v_user_agent
  ) 
  ON CONFLICT (visit_id) 
  DO UPDATE SET
    consent_text = EXCLUDED.consent_text,
    accepted_by = EXCLUDED.accepted_by,
    geotag = EXCLUDED.geotag,
    accepted_at = NOW()
  RETURNING id INTO v_consent_id;

  UPDATE site_visits 
  SET consent_id = v_consent_id 
  WHERE id = p_visit_id
    AND tenant_id = app.current_tenant_id();

  INSERT INTO visit_sync_events (visit_id, event, payload)
  VALUES (p_visit_id, 'consent_recorded', jsonb_build_object(
    'consent_id', v_consent_id,
    'accepted_by', p_accepted_by
  ));

  RETURN v_consent_id;
END;
$$;

-- Finalize visit
CREATE OR REPLACE FUNCTION finalize_site_visit(
  p_visit_id UUID,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key VARCHAR;
BEGIN
  -- Verify visit belongs to current tenant
  IF NOT EXISTS(
    SELECT 1 FROM site_visits 
    WHERE id = p_visit_id 
    AND tenant_id = app.current_tenant_id()
  ) THEN
    RAISE EXCEPTION 'Visit not found or forbidden';
  END IF;

  -- Check if consent required
  IF app.feature_flag('visits.consent_required') THEN
    IF NOT EXISTS(
      SELECT 1 FROM visit_consents
      WHERE visit_id = p_visit_id
    ) THEN
      RAISE EXCEPTION 'Consent required before finalizing';
    END IF;
  END IF;

  UPDATE site_visits 
  SET status = 'finalizing', finished_at = NOW()
  WHERE id = p_visit_id 
    AND status = 'in_progress'
    AND tenant_id = app.current_tenant_id();

  -- Create AI job if enabled
  IF app.feature_flag('visits.ai_estimation_enabled') THEN
    v_key := COALESCE(p_idempotency_key, p_visit_id::text || '_estimate_' || gen_random_uuid()::text);
    
    INSERT INTO ai_jobs (
      visit_id, job_type, status, idempotency_key, payload
    ) VALUES (
      p_visit_id, 'estimate', 'queued', v_key,
      jsonb_build_object('visit_id', p_visit_id)
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  INSERT INTO visit_sync_events (visit_id, event)
  VALUES (p_visit_id, 'finalized');
END;
$$;

-- Get visit status
CREATE OR REPLACE FUNCTION get_visit_status(p_visit_id UUID)
RETURNS TABLE (
  visit_status TEXT,
  ai_status TEXT,
  estimate_id UUID,
  processing_time_ms INT,
  media_count INT,
  consent_status BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify visit belongs to current tenant
  IF NOT EXISTS(
    SELECT 1 FROM site_visits 
    WHERE id = p_visit_id 
    AND tenant_id = app.current_tenant_id()
  ) THEN
    RAISE EXCEPTION 'Visit not found or forbidden';
  END IF;

  RETURN QUERY
  SELECT 
    v.status AS visit_status,
    j.status AS ai_status,
    e.id AS estimate_id,
    EXTRACT(EPOCH FROM (j.finished_at - j.started_at))::INT * 1000 AS processing_time_ms,
    COUNT(DISTINCT m.id)::INT AS media_count,
    (v.consent_id IS NOT NULL) AS consent_status
  FROM site_visits v
  LEFT JOIN ai_jobs j ON j.visit_id = v.id AND j.job_type = 'estimate'
  LEFT JOIN estimates e ON e.visit_id = v.id
  LEFT JOIN site_visit_media m ON m.visit_id = v.id
  WHERE v.id = p_visit_id
    AND v.tenant_id = app.current_tenant_id()
  GROUP BY v.status, j.status, e.id, j.finished_at, j.started_at, v.consent_id;
END;
$$;

-- Register uploaded media
CREATE OR REPLACE FUNCTION register_media(
  p_visit_id UUID,
  p_media_type TEXT,
  p_storage_path TEXT,
  p_file_size INT DEFAULT NULL,
  p_duration_ms INT DEFAULT NULL,
  p_sequence INT DEFAULT 0,
  p_hash VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_media_id UUID;
BEGIN
  -- Verify visit ownership
  IF NOT EXISTS(
    SELECT 1 FROM site_visits 
    WHERE id = p_visit_id 
    AND tenant_id = app.current_tenant_id()
  ) THEN
    RAISE EXCEPTION 'Visit not found or forbidden';
  END IF;

  INSERT INTO site_visit_media (
    visit_id, media_type, storage_path, 
    file_size, duration_ms, sequence, hash
  ) VALUES (
    p_visit_id, p_media_type, p_storage_path,
    p_file_size, p_duration_ms, p_sequence, p_hash
  ) RETURNING id INTO v_media_id;

  INSERT INTO visit_sync_events (visit_id, event, payload)
  VALUES (p_visit_id, 'media_uploaded', jsonb_build_object(
    'media_id', v_media_id,
    'type', p_media_type,
    'sequence', p_sequence
  ));

  RETURN v_media_id;
END;
$$;

-- Create share token with view limit
CREATE OR REPLACE FUNCTION create_share_token(
  p_estimate_id UUID,
  p_expires_in_seconds INT DEFAULT 600,
  p_max_views INT DEFAULT 10
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_token_id UUID;
BEGIN
  -- Verify estimate belongs to current tenant
  IF NOT EXISTS(
    SELECT 1 FROM estimates 
    WHERE id = p_estimate_id 
    AND tenant_id = app.current_tenant_id()
  ) THEN
    RAISE EXCEPTION 'Estimate not found or forbidden';
  END IF;

  -- Generate secure token
  v_token := encode(gen_random_bytes(32), 'hex');
  
  INSERT INTO share_tokens (
    token, estimate_id, expires_at, max_views, created_by
  ) VALUES (
    v_token, p_estimate_id, 
    NOW() + (p_expires_in_seconds || ' seconds')::interval,
    p_max_views, auth.uid()
  ) RETURNING id INTO v_token_id;

  RETURN v_token;
END;
$$;

-- Validate and increment share token
CREATE OR REPLACE FUNCTION validate_share_token(p_token TEXT)
RETURNS TABLE (
  estimate_id UUID,
  remaining_views INT,
  expires_in_seconds INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Get token details and increment view count atomically
  UPDATE share_tokens
  SET view_count = view_count + 1
  WHERE token = p_token
    AND expires_at > NOW()
    AND view_count < max_views
  RETURNING 
    share_tokens.estimate_id,
    max_views - view_count - 1 as remaining_views,
    EXTRACT(EPOCH FROM (expires_at - NOW()))::INT as expires_in_seconds
  INTO v_record;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  RETURN QUERY SELECT v_record.estimate_id, v_record.remaining_views, v_record.expires_in_seconds;
END;
$$;