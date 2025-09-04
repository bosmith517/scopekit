import { supabase } from './supabase'
import { useVisitStore } from '../stores/visitStore'

// Create a new site visit
export async function createSiteVisit(
  evidencePack: string = 'general_v1',
  leadId?: string,
  customerInfo?: {
    name?: string
    email?: string
    phone?: string
    address?: string
  }
) {
  // Always use default tenant for testing
  const tenantId = '00000000-0000-0000-0000-000000000001'
  
  // Also ensure it's set in the store
  if (!useVisitStore.getState().tenantId) {
    useVisitStore.getState().setTenant(tenantId)
  }
  
  console.log('[API] Creating visit with tenant ID:', tenantId)
  
  // Try v2 function first (cache workaround), fallback to original
  let { data, error } = await supabase.rpc('create_site_visit_v2', {
    p_tenant_id: tenantId,
    p_evidence_pack: evidencePack,
    p_customer_id: leadId || null,
    p_customer_name: customerInfo?.name || null,
    p_customer_email: customerInfo?.email || null,
    p_customer_phone: customerInfo?.phone || null,
    p_address: customerInfo?.address || null
  })
  
  // If v2 doesn't exist, try original name
  if (error && error.code === 'PGRST202') {
    const result = await supabase.rpc('create_site_visit', {
      p_tenant_id: tenantId,
      p_evidence_pack: evidencePack,
      p_customer_id: leadId || null,
      p_customer_name: customerInfo?.name || null,
      p_customer_email: customerInfo?.email || null,
      p_customer_phone: customerInfo?.phone || null,
      p_address: customerInfo?.address || null
    })
    data = result.data
    error = result.error
  }

  if (error) {
    console.log('[API] RPC failed, trying direct insert:', error)
    // Fallback: Direct insert for testing
    const { data: directData, error: directError } = await supabase
      .from('site_visits')
      .insert({
        tenant_id: tenantId,
        evidence_pack: evidencePack,
        lead_id: leadId || null,
        customer_name: customerInfo?.name || null,
        customer_email: customerInfo?.email || null,
        customer_phone: customerInfo?.phone || null,
        address: customerInfo?.address || null,
        status: 'in_progress',
        created_by: null // For testing without auth
      })
      .select('id')
      .single()
    
    if (directError) {
      console.error('[API] Direct insert also failed:', directError)
      throw directError
    }
    console.log('[API] Visit created via direct insert:', directData.id)
    return directData.id
  }

  console.log('[API] Visit created via RPC:', data)
  return data as string // visit_id
}

// Record consent
export async function recordConsent(
  visitId: string,
  consentText: string,
  acceptedBy: string,
  geotag?: { lat: number; lng: number; accuracy: number }
) {
  const { data, error } = await supabase.rpc('record_visit_consent', {
    p_visit_id: visitId,
    p_consent_text: consentText,
    p_accepted_by: acceptedBy,
    p_geotag: geotag ? {
      lat: geotag.lat,
      lng: geotag.lng,
      accuracy: geotag.accuracy,
      timestamp: new Date().toISOString()
    } : null
  })

  if (error) throw error
  return data as string // consent_id
}

// Register uploaded media
export async function registerMedia(
  visitId: string,
  mediaType: 'photo' | 'audio',
  storagePath: string,
  fileSize?: number,
  durationMs?: number,
  sequence?: number,
  hash?: string
) {
  const { data, error } = await supabase.rpc('register_media', {
    p_visit_id: visitId,
    p_media_type: mediaType,
    p_storage_path: storagePath,
    p_file_size: fileSize || null,
    p_duration_ms: durationMs || null,
    p_sequence: sequence || 0,
    p_hash: hash || null
  })

  if (error) throw error
  return data as string // media_id
}

// Finalize visit
export async function finalizeVisit(visitId: string) {
  const { error } = await supabase.rpc('finalize_site_visit', {
    p_visit_id: visitId,
    p_idempotency_key: `${visitId}_finalize_${Date.now()}`
  })

  if (error) throw error
}

// Get visit status
export async function getVisitStatus(visitId: string) {
  const { data, error } = await supabase.rpc('get_visit_status', {
    p_visit_id: visitId
  })

  if (error) throw error
  return data as {
    visit_status: string
    ai_status: string | null
    estimate_id: string | null
    processing_time_ms: number | null
    media_count: number
    consent_status: boolean
  }
}

// Upload to storage
export async function uploadToStorage(
  file: Blob,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('site-visits')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error
  return data.path
}

// Get signed URL for sharing
export async function createShareToken(
  estimateId: string,
  expiresInSeconds: number = 600,
  maxViews: number = 10
) {
  const { data, error } = await supabase.rpc('create_share_token', {
    p_estimate_id: estimateId,
    p_expires_in_seconds: expiresInSeconds,
    p_max_views: maxViews
  })

  if (error) throw error
  return data as string // token
}

// Build share URL
export function buildShareUrl(token: string): string {
  return `https://share.scopekit.io/e/${token}`
}