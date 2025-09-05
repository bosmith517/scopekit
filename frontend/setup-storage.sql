-- Create storage bucket for site visits if it doesn't exist
-- Run this in Supabase SQL Editor

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'site-visits',
    'site-visits', 
    true,  -- Public bucket for sharing
    10485760,  -- 10MB limit per file
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/mpeg', 'audio/wav', 'audio/mp4']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760;

-- Set up RLS policies for the bucket
-- Note: These need to be created through Supabase dashboard or API
-- as direct SQL may not have permissions

-- Allow anonymous uploads (for testing)
CREATE POLICY "Allow anonymous uploads" ON storage.objects
    FOR INSERT TO anon
    WITH CHECK (bucket_id = 'site-visits');

-- Allow public read access
CREATE POLICY "Allow public read" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'site-visits');

-- Test that the bucket exists
SELECT * FROM storage.buckets WHERE id = 'site-visits';