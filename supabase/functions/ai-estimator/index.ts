// ai-estimator/index.ts
// Internal function to process AI estimation jobs

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'

const AI_FETCH_TTL = 600 // 10 minutes for signed URLs

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')!,
})

serve(async (req) => {
  // Check internal key
  const internalKey = req.headers.get('x-internal-key')
  if (internalKey !== Deno.env.get('INTERNAL_QUEUE_KEY')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const job = await req.json()
    const { job_id, visit_id, job_type } = job

    console.log(`Processing ${job_type} for visit ${visit_id}`)

    // Get visit details
    const { data: visit } = await supabase
      .from('site_visits')
      .select('*, site_visit_media(*), site_visit_transcripts(*)')
      .eq('id', visit_id)
      .single()

    if (!visit) {
      throw new Error('Visit not found')
    }

    // Generate signed URLs for media
    const mediaUrls = await Promise.all(
      visit.site_visit_media.map(async (media: any) => {
        const { data } = await supabase.storage
          .from('site-visits')
          .createSignedUrl(media.storage_path, AI_FETCH_TTL)
        
        return {
          media_id: media.id,
          type: media.media_type,
          url: data?.signedUrl,
          sequence: media.sequence
        }
      })
    )

    // Process based on job type
    let result
    switch (job_type) {
      case 'transcribe':
        result = await processTranscription(mediaUrls, visit)
        break
      case 'estimate':
        result = await processEstimate(mediaUrls, visit)
        break
      default:
        throw new Error(`Unknown job type: ${job_type}`)
    }

    // Store estimate
    if (job_type === 'estimate' && result.estimate) {
      const { data: estimate } = await supabase
        .from('estimates')
        .insert({
          visit_id,
          tenant_id: visit.tenant_id,
          total_amount: result.estimate.total,
          metadata: result.estimate.metadata
        })
        .select()
        .single()

      // Store line items with evidence
      if (estimate && result.estimate.lines) {
        await supabase
          .from('estimate_lines')
          .insert(
            result.estimate.lines.map((line: any, index: number) => ({
              estimate_id: estimate.id,
              line_number: index + 1,
              description: line.description,
              quantity: line.quantity,
              unit: line.unit,
              unit_price: line.unit_price,
              total_price: line.total,
              evidence: line.evidence, // Must have bbox/timestamps
              category: line.category
            }))
          )
      }

      result.estimate_id = estimate.id
    }

    return new Response(JSON.stringify({
      success: true,
      result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('AI estimator error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

async function processTranscription(mediaUrls: any[], visit: any) {
  const audioUrls = mediaUrls.filter(m => m.type === 'audio')
  
  if (audioUrls.length === 0) {
    return { segments: [], full_text: '' }
  }

  try {
    // Process each audio file with Whisper
    const transcriptions = await Promise.all(
      audioUrls.map(async (audio) => {
        const response = await fetch(audio.url)
        const audioBlob = await response.blob()
        
        const transcription = await openai.audio.transcriptions.create({
          file: new File([audioBlob], 'audio.webm', { type: 'audio/webm' }),
          model: 'whisper-1',
          response_format: 'verbose_json',
          timestamp_granularities: ['segment', 'word']
        })
        
        return {
          sequence: audio.sequence,
          ...transcription
        }
      })
    )
    
    // Combine all transcriptions
    const segments = transcriptions.flatMap((t, idx) => 
      (t.segments || []).map((seg: any) => ({
        start_ms: seg.start * 1000,
        end_ms: seg.end * 1000,
        text: seg.text,
        confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : 0.9,
        audio_sequence: transcriptions[idx].sequence
      }))
    )
    
    const full_text = transcriptions
      .sort((a, b) => a.sequence - b.sequence)
      .map(t => t.text)
      .join(' ')
    
    return { segments, full_text }
  } catch (error) {
    console.error('Transcription error:', error)
    // Return empty on error rather than failing the whole process
    return { segments: [], full_text: '' }
  }
}

async function processEstimate(mediaUrls: any[], visit: any) {
  const startTime = Date.now()
  
  try {
    // 1. Process transcriptions first
    const transcription = await processTranscription(mediaUrls, visit)
    
    // 2. Prepare photo URLs for vision API
    const photoUrls = mediaUrls
      .filter(m => m.type === 'photo')
      .sort((a, b) => a.sequence - b.sequence)
    
    // 3. Build the prompt based on evidence pack
    const systemPrompt = `You are an expert contractor creating detailed estimates from site visit data.
    Evidence Pack: ${visit.evidence_pack || 'standard'}
    Property Type: ${visit.property_type || 'residential'}
    
    Create a detailed estimate with line items. Each line item MUST include:
    - Clear description of work to be done
    - Quantity and unit of measurement
    - Unit price and total price
    - Evidence linking (photo bounding boxes and/or transcript timestamps)
    
    Return JSON in this exact format:
    {
      "lines": [
        {
          "description": "Work description",
          "quantity": 10,
          "unit": "sqft",
          "unit_price": 5.50,
          "total": 55.00,
          "category": "Category",
          "evidence": [
            {
              "type": "photo",
              "media_id": "uuid",
              "bbox": {"x": 0.1, "y": 0.1, "w": 0.3, "h": 0.2},
              "confidence": 0.85,
              "label": "What was detected"
            }
          ]
        }
      ],
      "total": 1234.56,
      "notes": "Any additional observations"
    }`
    
    // 4. Build messages for GPT-4 Vision
    const messages: any[] = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Site Visit Information:
            Address: ${visit.street_address}
            Visit Notes: ${visit.visit_notes || 'None'}
            Audio Transcription: ${transcription.full_text || 'No audio notes'}
            
            Please analyze the provided photos and create a detailed estimate.`
          },
          ...photoUrls.map(photo => ({
            type: 'image_url',
            image_url: {
              url: photo.url,
              detail: 'high'
            }
          }))
        ]
      }
    ]
    
    // 5. Call OpenAI GPT-4 Vision
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages,
      max_tokens: 2000,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
    
    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}')
    
    // 6. Add media IDs to evidence
    if (aiResponse.lines) {
      aiResponse.lines = aiResponse.lines.map((line: any) => {
        if (line.evidence) {
          line.evidence = line.evidence.map((ev: any, idx: number) => {
            if (ev.type === 'photo' && !ev.media_id && photoUrls[idx]) {
              ev.media_id = photoUrls[idx].media_id
            }
            return ev
          })
        }
        return line
      })
    }
    
    // 7. Add metadata
    aiResponse.metadata = {
      evidence_pack: visit.evidence_pack || 'standard',
      processing_time_ms: Date.now() - startTime,
      ai_model: 'gpt-4-vision-preview',
      rules_applied: [`${visit.property_type || 'residential'}_v2`],
      transcription_used: transcription.full_text?.length > 0
    }
    
    return { estimate: aiResponse }
    
  } catch (error) {
    console.error('AI estimation error:', error)
    
    // Fallback to basic estimate if AI fails
    return {
      estimate: {
        total: 0,
        lines: [],
        metadata: {
          evidence_pack: visit.evidence_pack,
          processing_time_ms: Date.now() - startTime,
          ai_model: 'gpt-4-vision-preview',
          error: String(error),
          fallback: true
        }
      }
    }
  }
}