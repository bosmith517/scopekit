-- 050_storage.sql
-- Storage bucket configuration and policies
-- Idempotent: safe to run multiple times

-- Note: RLS on storage.objects is managed by Supabase
-- We can only create policies, not enable RLS on this system table
-- RLS should already be enabled by default on storage.objects

-- Create bucket (via SQL or Dashboard)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-visits', 
  'site-visits', 
  false,
  104857600, -- 100MB per file
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'audio/webm', 'audio/mp4', 'audio/aac', 'audio/mpeg'
  ]
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies (tenant-isolated by path prefix)
DROP POLICY IF EXISTS "Tenant isolated uploads" ON storage.objects;
CREATE POLICY "Tenant isolated uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'site-visits' 
  AND (storage.foldername(name))[1] = app.current_tenant_id()::text
);

DROP POLICY IF EXISTS "Tenant isolated reads" ON storage.objects;
CREATE POLICY "Tenant isolated reads" ON storage.objects
FOR SELECT USING (
  bucket_id = 'site-visits' 
  AND (storage.foldername(name))[1] = app.current_tenant_id()::text
);

DROP POLICY IF EXISTS "Tenant isolated updates" ON storage.objects;
CREATE POLICY "Tenant isolated updates" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'site-visits' 
  AND (storage.foldername(name))[1] = app.current_tenant_id()::text
);

DROP POLICY IF EXISTS "Tenant isolated deletes" ON storage.objects;
CREATE POLICY "Tenant isolated deletes" ON storage.objects
FOR DELETE USING (
  bucket_id = 'site-visits' 
  AND (storage.foldername(name))[1] = app.current_tenant_id()::text
);

-- Service role bypass for cleanup
DROP POLICY IF EXISTS "Service role full access" ON storage.objects;
CREATE POLICY "Service role full access" ON storage.objects
FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role'
);