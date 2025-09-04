# INFRA — ScopeKit Spine (Supabase) v1.0
**System:** ScopeKit Capture Infrastructure  
**Stack:** Supabase (Postgres, Storage, Edge Functions, Auth)  
**Status:** Production-Ready Runbook  

---

## Provisioning Checklist

### 1. Supabase Project Setup
```bash
# Create project via dashboard or CLI
supabase projects create scopekit-prod --region us-east-1
supabase link --project-ref <project-ref>

# Enable required extensions
supabase db push --include-seed
```

### 2. Extensions & Settings
```sql
-- Run via SQL Editor
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Set statement timeout for long queries
ALTER DATABASE postgres SET statement_timeout = '30s';
```

### 3. Storage Bucket Configuration
```sql
-- Create bucket with RLS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-visits', 
  'site-visits', 
  false,
  104857600, -- 100MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'audio/webm', 'audio/mp4', 'audio/aac', 'audio/mpeg'
  ]
);

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

### 4. Environment Secrets
```bash
# Set via dashboard Settings > Edge Functions
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service-key]
INTERNAL_QUEUE_KEY=[random-uuid]
OPENAI_API_KEY=sk-...
ALLOWED_ORIGINS=https://app.scopekit.io,https://share.scopekit.io
SENTRY_DSN=https://...@sentry.io/...
```

### 5. CORS Configuration
```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://app.scopekit.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sequence, x-duration-ms',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}
```

### 6. Edge Function Schedules
```bash
# Deploy functions first
supabase functions deploy queue-processor
supabase functions deploy cleanup-media
supabase functions deploy health

# Then schedule via dashboard or API
# queue-processor: */30 * * * * * (every 30 seconds)
# cleanup-media: 0 3 * * 0 (Sundays 3 AM)
```

---

## Operational Runbook

### Deployment Procedure
```bash
# 1. Run migrations in order
for file in supabase/migrations/*.sql; do
  echo "Running $file"
  supabase db push --file $file
done

# 2. Deploy Edge Functions
supabase functions deploy --all

# 3. Verify health
curl https://[project-ref].supabase.co/functions/v1/health

# 4. Enable feature flags per tenant
UPDATE tenant_settings 
SET feature_flags = feature_flags || '{"visits.enabled": true}'
WHERE tenant_id = '[tenant-uuid]';
```

### Secret Rotation
```bash
# 1. Generate new service role key in dashboard
# 2. Update Edge Functions secrets
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=[new-key]

# 3. Restart functions to pick up new secrets
supabase functions deploy queue-processor --no-build

# 4. Update any external services using old key
# 5. Revoke old key after 24h
```

### Feature Flag Management
```sql
-- Enable AI for specific tenant
UPDATE tenant_settings
SET feature_flags = jsonb_set(
  feature_flags, 
  '{visits,ai_estimation_enabled}', 
  'true'
)
WHERE tenant_id = '[tenant-uuid]';

-- Check current flags
SELECT tenant_id, feature_flags
FROM tenant_settings
WHERE feature_flags->>'visits.enabled' = 'true';
```

### Rollback Procedure
```bash
# 1. Disable feature flag immediately
UPDATE tenant_settings 
SET feature_flags = jsonb_set(feature_flags, '{visits,enabled}', 'false');

# 2. Stop queue processing
supabase functions delete queue-processor

# 3. Revert to previous function version
git checkout [previous-tag]
supabase functions deploy --all

# 4. Data remains intact - no destructive rollback
```

---

## Health & Observability

### Structured Logging
```typescript
// Every log entry includes correlation ID
interface LogContext {
  correlation_id: string,
  tenant_id?: string,
  user_id?: string,
  visit_id?: string,
  job_id?: string,
}

function log(level: string, message: string, context: LogContext, metadata?: any) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    metadata
  }));
}

// Usage in Edge Functions
const correlationId = crypto.randomUUID();
log('info', 'Processing job', { correlation_id: correlationId, job_id }, { attempt: 1 });
```

### Health Endpoint
```typescript
// supabase/functions/health/index.ts
import { serve } from 'https://deno.land/std/http/server.ts'
import { createClient } from '@supabase/supabase-js'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const checks = {
    database: false,
    storage: false,
    queue: { depth: 0, healthy: false },
    last_job_success: null
  }

  try {
    // Check database
    const { error: dbError } = await supabase
      .from('site_visits')
      .select('id')
      .limit(1)
    checks.database = !dbError

    // Check storage
    const { error: storageError } = await supabase
      .storage
      .from('site-visits')
      .list('health-check', { limit: 1 })
    checks.storage = !storageError

    // Check queue depth
    const { data: queueData } = await supabase
      .from('ai_jobs')
      .select('id', { count: 'exact' })
      .eq('status', 'queued')
    checks.queue.depth = queueData?.length || 0
    checks.queue.healthy = checks.queue.depth < 100

    // Check last successful job
    const { data: lastJob } = await supabase
      .from('ai_jobs')
      .select('finished_at')
      .eq('status', 'completed')
      .order('finished_at', { ascending: false })
      .limit(1)
      .single()
    checks.last_job_success = lastJob?.finished_at

    const allHealthy = checks.database && 
                       checks.storage && 
                       checks.queue.healthy

    return new Response(JSON.stringify({
      status: allHealthy ? 'healthy' : 'degraded',
      ...checks
    }), {
      status: allHealthy ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: String(error)
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

### Sentry Integration
```typescript
// supabase/functions/_shared/sentry.ts
import * as Sentry from "https://deno.land/x/sentry/mod.ts"

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('ENVIRONMENT') || 'production',
  beforeSend(event) {
    // Scrub sensitive data
    delete event.request?.cookies
    delete event.request?.headers?.authorization
    return event
  }
})

export function captureError(error: Error, context?: any) {
  Sentry.captureException(error, {
    extra: context,
    tags: {
      tenant_id: context?.tenant_id,
      function: Deno.env.get('FUNCTION_NAME')
    }
  })
}
```

### Product Analytics Events
```typescript
// Track key product metrics
async function trackEvent(event: string, properties: any) {
  await supabase.from('analytics_events').insert({
    event,
    properties,
    tenant_id: properties.tenant_id,
    user_id: properties.user_id,
    timestamp: new Date().toISOString()
  })
}

// Usage
await trackEvent('estimate_generated', {
  visit_id,
  processing_time_ms: Date.now() - startTime,
  line_count: estimate.line_items.length,
  evidence_count: evidenceCount,
  ai_model: 'gpt-4-vision'
})
```

### SLO Alerts
```sql
-- Alert 1: Processing time p95 > 60s
CREATE OR REPLACE FUNCTION check_processing_slo()
RETURNS boolean AS $$
  SELECT 
    percentile_cont(0.95) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (finished_at - started_at))
    ) > 60
  FROM ai_jobs
  WHERE finished_at > NOW() - INTERVAL '1 hour'
    AND status = 'completed';
$$ LANGUAGE sql;

-- Alert 2: Upload retry exhaustion
CREATE OR REPLACE FUNCTION check_upload_retries()
RETURNS bigint AS $$
  SELECT COUNT(*)
  FROM visit_sync_events
  WHERE event = 'upload_failed'
    AND created_at > NOW() - INTERVAL '1 hour'
    AND (payload->>'attempts')::int >= 5;
$$ LANGUAGE sql;
```

---

## Queue Strategy

### Edge Scheduled Function
```typescript
// supabase/functions/queue-processor/index.ts
import { serve } from 'https://deno.land/std/http/server.ts'
import { createClient } from '@supabase/supabase-js'

const BATCH_SIZE = 10
const MAX_PROCESSING_TIME = 55000 // 55s (under 60s limit)

serve(async (req) => {
  const startTime = Date.now()
  const correlationId = crypto.randomUUID()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Queue processor started',
    correlation_id: correlationId
  }))

  try {
    // Atomic job claiming with FOR UPDATE SKIP LOCKED
    const { data: jobs, error } = await supabase
      .rpc('claim_ai_jobs', { p_limit: BATCH_SIZE })

    if (error) throw error
    if (!jobs?.length) {
      return new Response(JSON.stringify({ 
        message: 'No jobs to process' 
      }), { status: 200 })
    }

    const results = []
    for (const job of jobs) {
      // Check timeout
      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        console.log('Approaching timeout, stopping batch')
        break
      }

      try {
        const result = await processJob(job, supabase, correlationId)
        results.push({ job_id: job.id, status: 'completed', result })
      } catch (error) {
        await handleJobError(job, error, supabase, correlationId)
        results.push({ job_id: job.id, status: 'failed', error: String(error) })
      }
    }

    return new Response(JSON.stringify({ 
      processed: results.length, 
      results 
    }), { status: 200 })

  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'Queue processor error',
      correlation_id: correlationId,
      error: String(error)
    }))
    
    return new Response(JSON.stringify({ 
      error: String(error) 
    }), { status: 500 })
  }
})

async function processJob(job: any, supabase: any, correlationId: string) {
  // Job-specific processing
  switch (job.job_type) {
    case 'estimate':
      return await processEstimate(job, supabase, correlationId)
    default:
      throw new Error(`Unknown job type: ${job.job_type}`)
  }
}
```

### Backoff with Jitter
```typescript
// supabase/functions/_shared/retry.ts
export function calculateBackoff(attempt: number): number {
  // Exponential: 1s, 2s, 4s, 8s, 16s
  const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 16000)
  // Add ±30% jitter
  const jitter = baseDelay * 0.3 * (Math.random() * 2 - 1)
  return Math.round(baseDelay + jitter)
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 5
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxAttempts) throw error
      
      const delay = calculateBackoff(attempt)
      console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max attempts exceeded')
}
```

---

## Signed URL Management

### TTL Configuration
```typescript
// For AI services fetching media
const AI_FETCH_TTL = 600 // 10 minutes (300-600s range)
const SHARE_LINK_TTL = 300 // 5 minutes for customer shares

async function generateSignedUrls(visitId: string) {
  const { data: media } = await supabase
    .from('site_visit_media')
    .select('*')
    .eq('visit_id', visitId)

  return Promise.all(media.map(async (m) => {
    const { data: signedUrl } = await supabase.storage
      .from('site-visits')
      .createSignedUrl(m.storage_path, AI_FETCH_TTL)
    
    return {
      media_id: m.id,
      type: m.media_type,
      url: signedUrl.signedUrl,
      expires_at: Date.now() + (AI_FETCH_TTL * 1000)
    }
  }))
}
```

---

## DLQ Management

### Move to DLQ Function
```sql
-- When attempts >= max_attempts, move to DLQ
CREATE OR REPLACE FUNCTION move_to_dlq(
  p_job_id UUID,
  p_error TEXT
)
RETURNS void
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

  -- Check if exceeded attempts
  IF v_job.attempts >= COALESCE(v_job.max_attempts, 3) THEN
    -- Mark as failed first
    UPDATE ai_jobs
    SET 
      status = 'failed',
      last_error = p_error,
      finished_at = NOW()
    WHERE id = p_job_id;

    -- Then move to DLQ
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
  END IF;
END;
$$;
```

### DLQ Monitoring
```sql
-- Monitor DLQ growth
SELECT 
  DATE(moved_at) as date,
  job_type,
  COUNT(*) as failed_count,
  AVG(attempts) as avg_attempts
FROM ai_jobs_dlq
WHERE moved_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(moved_at), job_type
ORDER BY date DESC;

-- Retry DLQ items manually
INSERT INTO ai_jobs (visit_id, job_type, payload, attempts)
SELECT visit_id, job_type, payload, 0
FROM ai_jobs_dlq
WHERE id = '[dlq-item-id]';
```

---

## Optional Enhancements

### SSE Progress Endpoint (Behind Flag)
```typescript
// supabase/functions/sse-progress/index.ts
// Only enabled when visits.ws_progress_enabled = true
import { serve } from 'https://deno.land/std/http/server.ts'

serve(async (req) => {
  const visitId = new URL(req.url).searchParams.get('visit_id')
  
  // Check feature flag
  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('feature_flags')
    .eq('tenant_id', getCurrentTenantId())
    .single()

  if (!settings?.feature_flags?.visits?.ws_progress_enabled) {
    return new Response('SSE not enabled', { status: 404 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // Send heartbeat every 30s
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }, 30000)

      // Subscribe to processing events
      const subscription = supabase
        .channel(`visit:${visitId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'processing_events',
          filter: `visit_id=eq.${visitId}`
        }, (payload) => {
          const event = `data: ${JSON.stringify(payload)}\n\n`
          controller.enqueue(encoder.encode(event))
        })
        .subscribe()

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        subscription.unsubscribe()
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
})
```

---

## Monitoring Dashboard Queries

```sql
-- Real-time queue depth
SELECT 
  status, 
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_age_seconds
FROM ai_jobs
GROUP BY status;

-- Processing performance (last hour)
SELECT 
  DATE_TRUNC('minute', finished_at) as minute,
  COUNT(*) as completed,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (finished_at - started_at))) as p50_seconds,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (finished_at - started_at))) as p95_seconds
FROM ai_jobs
WHERE finished_at > NOW() - INTERVAL '1 hour'
  AND status = 'completed'
GROUP BY minute
ORDER BY minute DESC;

-- Tenant usage
SELECT 
  t.name as tenant,
  COUNT(DISTINCT v.id) as visits_today,
  COUNT(DISTINCT e.id) as estimates_today,
  SUM(m.file_size) / 1048576 as total_mb
FROM site_visits v
JOIN tenants t ON t.id = v.tenant_id
LEFT JOIN estimates e ON e.visit_id = v.id
LEFT JOIN site_visit_media m ON m.visit_id = v.id
WHERE v.created_at > CURRENT_DATE
GROUP BY t.name
ORDER BY visits_today DESC;
```

---

**Document Status**: Production-Ready Runbook