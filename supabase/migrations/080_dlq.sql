-- 080_dlq.sql
-- Dead Letter Queue management
-- Idempotent: CREATE OR REPLACE

-- Move specific job to DLQ
CREATE OR REPLACE FUNCTION move_to_dlq(
  p_job_id UUID,
  p_error TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_job RECORD;
BEGIN
  -- Get job details
  SELECT * INTO v_job
  FROM ai_jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Only move if exceeded attempts
  IF v_job.attempts >= COALESCE(v_job.max_attempts, 3) THEN
    -- First mark as failed
    UPDATE ai_jobs
    SET 
      status = 'failed',
      last_error = p_error,
      finished_at = NOW()
    WHERE id = p_job_id;

    -- Insert into DLQ
    INSERT INTO ai_jobs_dlq (
      original_job_id,
      visit_id,
      job_type,
      last_error,
      attempts,
      payload
    ) VALUES (
      p_job_id,
      v_job.visit_id,
      v_job.job_type,
      p_error,
      v_job.attempts,
      v_job.payload
    );

    -- Delete from main queue
    DELETE FROM ai_jobs WHERE id = p_job_id;

    -- Update visit status to failed if this was the estimate job
    IF v_job.job_type = 'estimate' THEN
      UPDATE site_visits
      SET status = 'failed'
      WHERE id = v_job.visit_id
        AND status = 'finalizing';
    END IF;
  END IF;
END;
$$;

-- Bulk move failed jobs to DLQ
CREATE OR REPLACE FUNCTION move_failed_to_dlq()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  WITH failed AS (
    DELETE FROM ai_jobs
    WHERE (status = 'failed' OR 
           (status = 'running' AND started_at < NOW() - INTERVAL '10 minutes'))
      AND attempts >= COALESCE(max_attempts, 3)
    RETURNING *
  )
  INSERT INTO ai_jobs_dlq (
    original_job_id, visit_id, job_type, 
    last_error, attempts, payload
  )
  SELECT 
    id, visit_id, job_type,
    COALESCE(last_error, 'Exceeded max attempts or timeout'), 
    attempts, payload
  FROM failed;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Retry DLQ item (admin only)
CREATE OR REPLACE FUNCTION retry_dlq_item(p_dlq_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dlq RECORD;
  v_new_job_id UUID;
BEGIN
  -- Check admin role
  IF auth.jwt() -> 'app_metadata' ->> 'role' != 'admin' THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  -- Get DLQ item
  SELECT * INTO v_dlq
  FROM ai_jobs_dlq
  WHERE id = p_dlq_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DLQ item not found';
  END IF;

  -- Create new job with reset attempts
  INSERT INTO ai_jobs (
    visit_id, job_type, status, payload, 
    attempts, max_attempts, priority
  ) VALUES (
    v_dlq.visit_id, v_dlq.job_type, 'queued', v_dlq.payload,
    0, 3, 1  -- Higher priority for retries
  ) RETURNING id INTO v_new_job_id;

  -- Mark DLQ item as retried
  UPDATE ai_jobs_dlq
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{retried_at}',
    to_jsonb(NOW())
  )
  WHERE id = p_dlq_id;

  RETURN v_new_job_id;
END;
$$;

-- DLQ statistics
CREATE OR REPLACE FUNCTION dlq_stats()
RETURNS TABLE (
  job_type TEXT,
  count BIGINT,
  oldest TIMESTAMPTZ,
  newest TIMESTAMPTZ,
  avg_attempts NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    job_type,
    COUNT(*) as count,
    MIN(moved_at) as oldest,
    MAX(moved_at) as newest,
    AVG(attempts) as avg_attempts
  FROM ai_jobs_dlq
  GROUP BY job_type
  ORDER BY count DESC;
$$;

-- Cleanup old DLQ items (30+ days)
CREATE OR REPLACE FUNCTION cleanup_old_dlq()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM ai_jobs_dlq
  WHERE moved_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;