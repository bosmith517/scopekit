-- 070_queue_claim.sql
-- Atomic job claiming with FOR UPDATE SKIP LOCKED
-- Idempotent: CREATE OR REPLACE

-- Claim jobs atomically (prevents race conditions)
CREATE OR REPLACE FUNCTION claim_ai_jobs(p_limit INT DEFAULT 10)
RETURNS SETOF ai_jobs
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id 
    FROM ai_jobs
    WHERE status = 'queued'
      AND attempts < COALESCE(max_attempts, 3)
    ORDER BY priority DESC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE ai_jobs j 
  SET 
    status = 'running',
    started_at = NOW(),
    attempts = attempts + 1
  FROM claimed c
  WHERE j.id = c.id
  RETURNING j.*;
END;
$$;

-- Mark job complete
CREATE OR REPLACE FUNCTION mark_job_complete(
  p_job_id UUID,
  p_result JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE ai_jobs
  SET 
    status = 'completed',
    finished_at = NOW(),
    result = p_result
  WHERE id = p_job_id;

  -- Update visit status if this was an estimate job
  UPDATE site_visits
  SET status = 'completed'
  WHERE id = (SELECT visit_id FROM ai_jobs WHERE id = p_job_id)
    AND status = 'finalizing';
END;
$$;

-- Mark job failed
CREATE OR REPLACE FUNCTION mark_job_failed(
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

  -- Update job status
  UPDATE ai_jobs
  SET 
    status = 'failed',
    last_error = p_error,
    finished_at = NOW()
  WHERE id = p_job_id;

  -- Check if should move to DLQ
  IF v_job.attempts >= COALESCE(v_job.max_attempts, 3) THEN
    PERFORM move_to_dlq(p_job_id, p_error);
  END IF;
END;
$$;

-- Process queue batch (for Edge Function)
CREATE OR REPLACE FUNCTION process_ai_queue(p_batch_size INT DEFAULT 10)
RETURNS TABLE (
  job_id UUID,
  visit_id UUID,
  job_type TEXT,
  payload JSONB,
  attempt INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- First clean up stuck jobs (running > 5 minutes)
  UPDATE ai_jobs
  SET status = 'failed', last_error = 'Job timeout'
  WHERE status = 'running'
    AND started_at < NOW() - INTERVAL '5 minutes';

  -- Move failed jobs to DLQ
  PERFORM cleanup_failed_jobs();
  
  -- Then claim and return new batch
  RETURN QUERY
  SELECT 
    j.id AS job_id,
    j.visit_id,
    j.job_type,
    j.payload,
    j.attempts AS attempt
  FROM claim_ai_jobs(p_batch_size) j;
END;
$$;

-- Cleanup failed jobs
CREATE OR REPLACE FUNCTION cleanup_failed_jobs()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  WITH failed AS (
    DELETE FROM ai_jobs
    WHERE (status = 'failed' OR status = 'running')
      AND attempts >= COALESCE(max_attempts, 3)
      AND finished_at < NOW() - INTERVAL '1 hour'
    RETURNING *
  )
  INSERT INTO ai_jobs_dlq (
    original_job_id, visit_id, job_type, 
    last_error, attempts, payload
  )
  SELECT 
    id, visit_id, job_type,
    COALESCE(last_error, 'Max attempts exceeded'), 
    attempts, payload
  FROM failed;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;