-- Add customer fields to site_visits table
ALTER TABLE site_visits 
ADD COLUMN IF NOT EXISTS lead_id TEXT,
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Drop ALL existing versions of the create_site_visit function
DROP FUNCTION IF EXISTS create_site_visit(UUID, VARCHAR);
DROP FUNCTION IF EXISTS create_site_visit(UUID, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_site_visit CASCADE;

-- Recreate the create_site_visit function with customer parameters
CREATE OR REPLACE FUNCTION create_site_visit(
  p_tenant_id UUID DEFAULT NULL,
  p_evidence_pack VARCHAR DEFAULT 'general_v1',
  p_customer_id TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_visit_id UUID;
BEGIN
  INSERT INTO site_visits (
    tenant_id, 
    evidence_pack, 
    lead_id,
    customer_name,
    customer_email,
    customer_phone,
    address,
    created_by,
    status
  )
  VALUES (
    COALESCE(p_tenant_id, gen_random_uuid()),
    p_evidence_pack,
    p_customer_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_address,
    auth.uid(),
    'in_progress'
  ) 
  RETURNING id INTO v_visit_id;
  
  RETURN v_visit_id;
END;
$$;

-- Grant execute permission to authenticated users  
GRANT EXECUTE ON FUNCTION create_site_visit(UUID, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_site_visit(UUID, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;