# PRP — ScopeKit Capture v1.2
**Product:** ScopeKit Capture  
**Version:** 1.2 FINAL  
**Domain:** app.scopekit.io / share.scopekit.io  
**Status:** Ship-Ready  

---

## Executive Summary

ScopeKit Capture is a mobile-first field data collection system that transforms site visits into structured estimates in <60 seconds. Field technicians use guided Evidence Packs to capture photos and voice narration, which are processed through a rules-first AI pipeline to generate draft estimates with mandatory evidence binding (photo regions + transcript timestamps). The system operates offline-first with background sync, ensuring 99.5% upload success rate. Built on Supabase's managed infrastructure, it provides tenant-isolated, consent-tracked, GDPR-compliant data handling. Default configuration uses polling for compatibility, with optional WebSocket support behind feature flags.

---

## Objectives & KPIs

### Primary Objectives
1. Reduce estimate creation time from 45 minutes to <5 minutes total interaction
2. Achieve ≥80% first-pass coverage accuracy with ≤0.5 edits/line median
3. Enable offline capture with resilient background sync
4. Provide auditable evidence chain for every estimate line item

### Key Performance Indicators
- **Processing Speed**: Finish→Draft p95 ≤60s
- **Upload Success**: p99 ≥99.5% success rate
- **Accuracy**: ≥80% first-pass coverage, ≤0.5 edits/line median
- **Evidence Quality**: 100% of lines have bbox and/or timecode references
- **Sync Performance**: 5min WiFi, 15min cellular background sync
- **Availability**: 99.9% API uptime, offline capture always works

---

## In/Out of Scope

### In Scope (v1.2)
- Mobile capture app (Capacitor/React)
- Guided Evidence Pack workflows
- Photo capture with drawing/annotations
- Voice recording with 2-5s chunked uploads
- Rules-first AI synthesis with LLM augmentation
- Evidence binding (bboxes + timestamps)
- Offline queue with exponential backoff
- Consent tracking with geotag
- Signed, expiring share links
- Tenant isolation via RLS

### Out of Scope
- Desktop capture apps
- Video recording (photos + audio only)
- Real-time collaboration
- Custom pricing rules editor
- White-label theming
- Payment processing
- CRM integration (future v2.0)

---

## Personas & Happy Path

### Primary Persona: Field Technician
**Profile**: 2-10 years experience, works 6-8 site visits/day  
**Needs**: Fast capture, works offline, minimal typing, clear next steps  
**Friction Points**: Poor cell coverage, wet/dirty conditions, time pressure  

### Happy Path Flow
1. **Select Evidence Pack** (5s): Choose "Residential Roofing" template
2. **Capture Photos** (90s): 8-12 guided photos following checklist
3. **Record Voice** (60s): Narrate observations while walking site
4. **Add Markers** (30s): Circle damage areas on 2-3 key photos
5. **Review & Submit** (15s): Confirm consent, tap finalize
6. **Background Sync** (automatic): Uploads when connection available
7. **AI Processing** (45s): Transcribe → Extract → Rules → LLM → Evidence bind
8. **Notification** (instant): "Estimate ready for review"
9. **Share Link** (10s): Send signed URL to customer
10. **Customer View** (self-serve): Reviews estimate with photo evidence

**Total Active Time**: ~3.5 minutes  
**End-to-End**: <5 minutes with good connectivity

---

## UX Specs

### Camera Module
```typescript
interface CameraSpec {
  resolution: { width: 2000, height: "auto" }, // Longest edge ~2000px
  format: "jpeg",
  quality: 85, // Balance size/quality
  metadata: true, // EXIF preserved
  orientation: "auto-correct",
  flash: "auto",
  grid: true, // Composition aid
  maxPhotos: 30,
  minPhotos: 3
}
```

### Evidence Packs
```typescript
interface EvidencePack {
  id: string, // "roofing_residential_v2"
  name: string,
  category: "roofing" | "electrical" | "plumbing" | "hvac",
  checklist: ChecklistItem[],
  requiredPhotos: PhotoRequirement[],
  voicePrompts: string[],
  priceRules: PriceRule[]
}

interface PhotoRequirement {
  label: string, // "North elevation"
  helpText: string,
  exampleUrl: string,
  optional: boolean,
  aiguidance: string[] // ML hints
}
```

### Audio Recorder
```typescript
interface AudioSpec {
  format: "webm" | "aac",
  sampleRate: 16000, // Optimized for speech
  channels: 1, // Mono
  chunkDuration: 3000, // 3s chunks (2-5s range)
  silenceDetection: true,
  noiseSupression: true,
  maxDuration: 300000, // 5 minutes
  uploadWhileRecording: true
}
```

### Sync Timeline
```typescript
interface SyncBehavior {
  wifi: {
    interval: 300000, // 5 minutes
    batchSize: 10,
    parallel: 3
  },
  cellular: {
    interval: 900000, // 15 minutes  
    batchSize: 5,
    parallel: 1
  },
  retry: {
    maxAttempts: 5,
    backoff: "exponential", // 1s, 2s, 4s, 8s, 16s
    jitter: 0.3 // ±30% randomization
  }
}
```

### Evidence Binding
```typescript
interface EvidenceLine {
  lineNumber: number,
  description: string,
  quantity: number,
  unit: string,
  unitPrice: number,
  evidence: Evidence[] // MANDATORY, never empty
}

interface Evidence {
  media_id: string,
  type: "photo" | "transcript",
  bbox?: BoundingBox, // For photos
  start_ms?: number, // For audio
  end_ms?: number,
  confidence: number,
  label?: string
}

interface BoundingBox {
  x: number, // 0-1 normalized
  y: number,
  w: number,
  h: number
}
```

---

## Data Model

### Core Tables
```sql
-- Visits and capture
site_visits (id, tenant_id, status, evidence_pack, consent_id...)
site_visit_media (id, visit_id, type, storage_path, sequence...)
site_visit_markers (id, media_id, bbox, label, created_by...)
site_visit_transcripts (id, visit_id, segments jsonb, full_text...)

-- Processing pipeline
ai_jobs (id, visit_id, type, status, attempts, payload...)
ai_jobs_dlq (id, original_job_id, error, moved_at...)

-- Output artifacts
estimates (id, visit_id, tenant_id, line_items jsonb...)
estimate_lines (id, estimate_id, line_number, evidence jsonb...)

-- Consent and sync
visit_consents (id, visit_id, accepted_by, geotag, ip_address...)
visit_sync_events (id, visit_id, event, synced_at...)
```

---

## API/RPC Contracts

### Core RPCs
```sql
-- Create visit with tenant validation
create_site_visit(
  p_tenant_id UUID,
  p_evidence_pack VARCHAR,
  p_customer_id UUID DEFAULT NULL
) RETURNS UUID;

-- Record consent with geotag
record_visit_consent(
  p_visit_id UUID,
  p_consent_text TEXT,
  p_accepted_by TEXT,
  p_geotag JSONB
) RETURNS UUID;

-- Finalize with idempotency
finalize_site_visit(
  p_visit_id UUID,
  p_idempotency_key VARCHAR DEFAULT gen_random_uuid()
) RETURNS VOID;

-- Atomic job claiming
claim_ai_jobs(
  p_limit INT DEFAULT 10
) RETURNS SETOF ai_jobs;
```

### REST Endpoints
```typescript
// Media upload (multipart)
POST https://app.scopekit.io/api/visits/{visit_id}/media
Content-Type: multipart/form-data
X-Sequence: 1
X-Duration-Ms: 3000

// Get estimate (signed URL)
GET https://share.scopekit.io/e/{token}
Response: HTML with embedded signed media URLs (5min TTL)

// Health check
GET https://app.scopekit.io/api/health
Response: {
  "status": "healthy",
  "db": true,
  "storage": true,
  "queue_depth": 12,
  "last_job_success": "2024-01-15T10:30:00Z"
}
```

---

## Performance Budgets & SLOs

### Latency Budgets
- Photo capture → preview: <100ms
- Audio chunk upload: <2s per 3s chunk
- Finalize → AI start: <5s
- AI processing (p95): <60s
- Share link generation: <500ms

### Service Level Objectives
- **Availability**: 99.9% API uptime (43min/month)
- **Processing SLO**: 95% of estimates complete in <60s
- **Upload SLO**: 99.5% successful within 3 attempts
- **Sync SLO**: 95% synced within interval (5min WiFi/15min cell)

### Capacity Planning
- 10,000 visits/day peak
- 100 concurrent AI jobs
- 30 photos/visit average
- 5MB photo, 300KB audio chunk
- 30-day media retention

---

## Security & Privacy

### Row Level Security
- All tables use `tenant_id = app.current_tenant_id()`
- Storage paths prefixed with tenant UUID
- SECURITY DEFINER RPCs validate tenant ownership

### Consent Management
```sql
-- Consent required when flag enabled
IF feature_flag('visits.consent_required') THEN
  -- Must have consent before finalize
  REQUIRE visit_consents.visit_id = site_visits.id
END IF;
```

### Data Privacy
- PII redaction in transcripts when `visits.redaction_enabled=true`
- 30-day media retention with automatic cleanup
- Signed URLs expire in 300-600s
- No permanent public URLs
- GDPR export via `export_tenant_data()` RPC

### Share Links
```typescript
// Signed, expiring, single-use tokens
interface ShareToken {
  estimate_id: string,
  expires_at: number, // Unix timestamp
  signature: string, // HMAC-SHA256
  view_count: number,
  max_views: number
}
```

---

## Telemetry

### Structured Logging
```typescript
interface LogEntry {
  timestamp: string,
  level: "debug" | "info" | "warn" | "error",
  correlation_id: string, // UUID per request
  tenant_id?: string,
  user_id?: string,
  action: string,
  metadata: Record<string, any>
}
```

### Key Metrics
```typescript
// Capture metrics
track("visit_created", { evidence_pack, tenant_id })
track("photo_captured", { visit_id, sequence, size_kb })
track("audio_recorded", { visit_id, duration_ms })
track("visit_finalized", { visit_id, media_count, duration_ms })

// Processing metrics
track("job_claimed", { job_id, type, attempt })
track("ai_inference", { model, latency_ms, tokens })
track("estimate_generated", { visit_id, line_count, evidence_count })

// Quality metrics
track("estimate_edited", { estimate_id, edits_count })
track("evidence_missing", { line_id, reason })
```

### Alerts
- Processing SLO breach (p95 >60s)
- Upload retry exhaustion (>5 attempts)
- Queue depth >100 for >5min
- Storage quota >80%
- Error rate >1% sustained

---

## Acceptance Criteria

1. **AC-001**: Evidence Pack selection loads in <500ms with offline cache
2. **AC-002**: Audio chunks upload every 2-5s during recording, survive force-quit
3. **AC-003**: Photos resize to ~2000px longest edge, JPEG q=85, <500KB typical
4. **AC-004**: Background sync succeeds within 5min (WiFi) or 15min (cellular)
5. **AC-005**: AI processing completes in <60s for p95 of visits
6. **AC-006**: Every estimate line has ≥1 evidence reference (bbox or timestamp)
7. **AC-007**: 10-photo visit processes in <45s, 30-photo in <90s
8. **AC-008**: Failed uploads retry with exponential backoff + 30% jitter
9. **AC-009**: Share links expire after 300-600s or 10 views
10. **AC-010**: Consent records include accepted_by, geotag, IP, user-agent
11. **AC-011**: Offline captures queue locally and sync when connected
12. **AC-012**: RLS prevents cross-tenant data access (security test)
13. **AC-013**: Health endpoint returns within 500ms with all checks
14. **AC-014**: DLQ captures jobs failing after 3 attempts
15. **AC-015**: Feature flags control consent, AI, WebSockets, redaction per tenant

---

## QA Plan

### Smoke Tests
1. Create visit → capture 5 photos → record 30s audio → finalize
2. Verify estimate has evidence links for all lines
3. Share link loads and expires correctly
4. Health check returns 200 with green status

### Regression Suite
1. Offline capture → airplane mode → reconnect → verify sync
2. Force quit during upload → reopen → verify resume
3. Max photos (30) → verify processing <90s
4. Cross-tenant isolation → verify RLS blocks
5. Consent flow → verify required when flag on
6. DLQ flow → fail job 3x → verify in DLQ table

### Performance Tests
1. 100 concurrent visits → verify p95 <60s
2. 1000 uploads/min → verify p99 success >99.5%
3. Queue depth 200 → verify processing continues
4. 10GB media upload → verify chunking works

### Security Tests
1. Attempt cross-tenant access → verify 403
2. Expired share link → verify 410
3. Missing auth → verify 401
4. SQL injection attempts → verify sanitized
5. File upload exploits → verify MIME validation

---

## Rollout & Migrations

### Migration Sequence
```bash
# Run in order (all idempotent)
001_extensions.sql
010_helpers.sql
020_schema_core.sql
030_indexes.sql
040_rls.sql
050_storage.sql
060_rpcs.sql
070_queue_claim.sql
080_dlq.sql
```

### Feature Flag Rollout
```typescript
// Production defaults (safe)
{
  "visits.enabled": true,
  "visits.consent_required": true,
  "visits.ai_estimation_enabled": false, // Enable per tenant
  "visits.ws_progress_enabled": false,   // Keep polling default
  "visits.redaction_enabled": false      // Enable for GDPR tenants
}
```

### Rollback Plan
1. Disable feature flag `visits.enabled=false`
2. Stop Edge Function schedules
3. Restore previous Edge Function versions
4. Keep data intact (no destructive rollback)

---

## Risks

### Technical Risks
- **AI latency spike**: Mitigated by 60s timeout and queue limits
- **Storage costs**: Mitigated by 30-day retention and size limits
- **Offline sync conflicts**: Mitigated by idempotency keys
- **DDoS**: Mitigated by rate limits and Cloudflare

### Business Risks
- **Low accuracy**: Mitigated by rules-first approach and Evidence Packs
- **User adoption**: Mitigated by 3.5min active time and offline support
- **Compliance**: Mitigated by consent tracking and redaction

---

## Open Questions

1. Should we add progressive JPEG for slow connections?
2. Add draft auto-save every 30s during capture?
3. Support HEIC/HEIF with server-side conversion?
4. Add voice commands for hands-free capture?
5. Implement smart photo suggestions based on ML?

---

**Document Status**: Ship-Ready for Engineering