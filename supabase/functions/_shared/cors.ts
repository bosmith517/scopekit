// _shared/cors.ts
// CORS configuration with both app and share domains

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Will be restricted per function
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sequence, x-duration-ms, x-internal-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
}

// Function-specific CORS
export function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || ''
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || 'https://app.scopekit.io,https://share.scopekit.io').split(',')
  
  if (allowedOrigins.includes(origin)) {
    return {
      ...corsHeaders,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true'
    }
  }
  
  // Default to app domain if origin not in list
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': 'https://app.scopekit.io'
  }
}

// Handle preflight
export function handleOptions(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req)
  })
}