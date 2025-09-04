# OpenAI Integration Setup for ScopeKit

## Prerequisites

1. OpenAI API Key from https://platform.openai.com/api-keys
2. Supabase CLI installed and configured
3. Access to Supabase project dashboard

## Environment Variables

Add these to your Supabase Edge Functions environment:

```bash
# Set locally for development
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key-here

# Set the internal queue key (generate a secure random string)
supabase secrets set INTERNAL_QUEUE_KEY=your-secure-internal-key-here
```

## Deploy Edge Functions

```bash
# Deploy the AI estimator function
supabase functions deploy ai-estimator

# Deploy the trigger function for testing
supabase functions deploy trigger-ai-estimation

# Deploy all functions
supabase functions deploy
```

## Testing the AI Estimation

### Method 1: Web Interface
1. Open `test-ai-edge-function.html` in a browser
2. Click "Create Visit & Process" for a full test
3. Or enter an existing visit ID and click "Trigger AI Estimation"

### Method 2: Direct API Call
```bash
# Replace with your actual visit ID
curl -X POST https://ihzvnlstlavrvhvvxcgo.supabase.co/functions/v1/trigger-ai-estimation \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"visit_id": "your-visit-id-here"}'
```

### Method 3: From the Frontend App
The frontend will automatically trigger AI estimation when:
- A visit is marked as "finalized"
- Media has been uploaded
- The sync process runs

## What the AI Process Does

1. **Retrieves Visit Data**
   - Fetches visit details, media, and transcripts
   - Creates signed URLs for media access

2. **Processes Transcriptions**
   - Uses OpenAI Whisper for audio transcription
   - Segments audio with timestamps
   - Links transcript segments to estimate lines

3. **Generates Estimate**
   - Analyzes photos with GPT-4 Vision
   - Combines visual and audio evidence
   - Creates detailed line items with:
     - Description, quantity, unit, pricing
     - Evidence linking (bounding boxes, timestamps)
     - Confidence scores

4. **Stores Results**
   - Saves estimate to database
   - Links evidence to line items
   - Updates visit status

## OpenAI Models Used

- **GPT-4 Vision** (`gpt-4-vision-preview`) - For analyzing photos and generating estimates
- **Whisper** (`whisper-1`) - For transcribing audio notes

## Cost Considerations

- GPT-4 Vision: ~$0.01-0.03 per image analyzed
- Whisper: $0.006 per minute of audio
- Typical visit (3 photos, 1 min audio): ~$0.05-0.10

## Monitoring

Check Edge Function logs:
```bash
supabase functions logs ai-estimator
supabase functions logs trigger-ai-estimation
```

## Troubleshooting

### 401 Unauthorized
- Verify OPENAI_API_KEY is set correctly
- Check INTERNAL_QUEUE_KEY matches between functions

### No Results
- Ensure media files exist in storage
- Check visit has media attached
- Review function logs for errors

### Timeout Issues
- Large images may take longer to process
- Consider reducing image quality/size
- Increase function timeout in config

## Security Notes

- Never expose OPENAI_API_KEY in client code
- Use INTERNAL_QUEUE_KEY to prevent direct access to ai-estimator
- Media URLs are signed and expire after 10 minutes
- All processing happens server-side in Edge Functions