// trigger-ai-estimation/index.ts
// Manual trigger endpoint for testing AI estimation
// This is for development/testing only

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get visit_id from request
    const { visit_id } = await req.json()
    
    if (!visit_id) {
      return new Response(
        JSON.stringify({ error: 'visit_id is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Triggering AI estimation for visit: ${visit_id}`)

    // Check if visit exists
    const { data: visit, error: visitError } = await supabase
      .from('site_visits')
      .select('id, tenant_id')
      .eq('id', visit_id)
      .single()

    if (visitError || !visit) {
      return new Response(
        JSON.stringify({ error: 'Visit not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Call the AI estimator directly (simulating queue processor)
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-estimator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': Deno.env.get('INTERNAL_QUEUE_KEY')!,
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`
      },
      body: JSON.stringify({
        job_id: crypto.randomUUID(),
        visit_id: visit_id,
        job_type: 'estimate',
        created_at: new Date().toISOString()
      })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'AI estimation failed')
    }

    // Get the generated estimate
    let estimate = null
    if (result.result?.estimate_id) {
      const { data } = await supabase
        .from('estimates')
        .select(`
          *,
          estimate_lines(*)
        `)
        .eq('id', result.result.estimate_id)
        .single()
      
      estimate = data
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'AI estimation triggered successfully',
        result: result.result,
        estimate
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Trigger error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})