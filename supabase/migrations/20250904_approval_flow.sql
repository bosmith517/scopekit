-- Estimate Approval Flow Migration
-- Adds approval tracking, signatures, and audit trail

-- Create estimate_approvals table
CREATE TABLE IF NOT EXISTS estimate_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Approval details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'expired')),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Approver information
  approver_name TEXT NOT NULL,
  approver_email TEXT NOT NULL,
  approver_phone TEXT,
  approver_ip INET,
  approver_user_agent TEXT,
  
  -- Signature and decision
  signature_data TEXT, -- Base64 encoded signature image
  signature_type TEXT CHECK (signature_type IN ('drawn', 'typed', 'none')),
  decline_reason TEXT,
  
  -- Tracking
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT estimate_single_active_approval UNIQUE (estimate_id, status)
);

-- Create indexes
CREATE INDEX idx_estimate_approvals_estimate ON estimate_approvals(estimate_id);
CREATE INDEX idx_estimate_approvals_tenant ON estimate_approvals(tenant_id);
CREATE INDEX idx_estimate_approvals_token ON estimate_approvals(token);
CREATE INDEX idx_estimate_approvals_status ON estimate_approvals(status);
CREATE INDEX idx_estimate_approvals_expires ON estimate_approvals(expires_at);

-- Add approval status to estimates table
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft' 
CHECK (approval_status IN ('draft', 'sent', 'approved', 'declined'));

ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS approval_id UUID REFERENCES estimate_approvals(id);

-- Create approval notification queue
CREATE TABLE IF NOT EXISTS approval_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES estimate_approvals(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('sent', 'viewed', 'approved', 'declined')),
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for estimate_approvals
ALTER TABLE estimate_approvals ENABLE ROW LEVEL SECURITY;

-- Contractors can view their own approvals
CREATE POLICY "Contractors view own approvals" ON estimate_approvals
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants 
      WHERE user_id = auth.uid()
    )
  );

-- Contractors can create approvals for their estimates
CREATE POLICY "Contractors create approvals" ON estimate_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants 
      WHERE user_id = auth.uid()
    )
  );

-- Anyone with valid token can view and update approval
CREATE POLICY "Token holders can view approval" ON estimate_approvals
  FOR SELECT
  TO anon, authenticated
  USING (true); -- Token validation happens at application level

CREATE POLICY "Token holders can update approval" ON estimate_approvals
  FOR UPDATE
  TO anon, authenticated
  USING (true) -- Token validation at app level
  WITH CHECK (true);

-- Function to send estimate for approval
CREATE OR REPLACE FUNCTION send_estimate_for_approval(
  p_estimate_id UUID,
  p_approver_name TEXT,
  p_approver_email TEXT,
  p_approver_phone TEXT DEFAULT NULL
)
RETURNS estimate_approvals
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approval estimate_approvals;
  v_tenant_id UUID;
  v_existing_pending UUID;
BEGIN
  -- Get tenant from estimate
  SELECT e.tenant_id INTO v_tenant_id
  FROM estimates e
  WHERE e.id = p_estimate_id;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;
  
  -- Check for existing pending approval
  SELECT id INTO v_existing_pending
  FROM estimate_approvals
  WHERE estimate_id = p_estimate_id
    AND status = 'pending';
  
  -- Expire existing pending approval if exists
  IF v_existing_pending IS NOT NULL THEN
    UPDATE estimate_approvals
    SET status = 'expired',
        updated_at = NOW()
    WHERE id = v_existing_pending;
  END IF;
  
  -- Create new approval
  INSERT INTO estimate_approvals (
    estimate_id,
    tenant_id,
    approver_name,
    approver_email,
    approver_phone,
    created_by
  ) VALUES (
    p_estimate_id,
    v_tenant_id,
    p_approver_name,
    p_approver_email,
    p_approver_phone,
    auth.uid()
  )
  RETURNING * INTO v_approval;
  
  -- Update estimate status
  UPDATE estimates
  SET approval_status = 'sent',
      approval_id = v_approval.id,
      updated_at = NOW()
  WHERE id = p_estimate_id;
  
  -- Queue notification
  INSERT INTO approval_notifications (
    approval_id,
    notification_type,
    recipient_email
  ) VALUES (
    v_approval.id,
    'sent',
    p_approver_email
  );
  
  RETURN v_approval;
END;
$$;

-- Function to record approval decision
CREATE OR REPLACE FUNCTION record_estimate_decision(
  p_token TEXT,
  p_decision TEXT, -- 'approved' or 'declined'
  p_signature_data TEXT DEFAULT NULL,
  p_signature_type TEXT DEFAULT 'none',
  p_decline_reason TEXT DEFAULT NULL,
  p_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS estimate_approvals
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approval estimate_approvals;
  v_estimate_id UUID;
BEGIN
  -- Get approval by token
  SELECT * INTO v_approval
  FROM estimate_approvals
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE;
  
  IF v_approval IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired approval token';
  END IF;
  
  -- Update approval record
  UPDATE estimate_approvals
  SET status = p_decision,
      signature_data = p_signature_data,
      signature_type = p_signature_type,
      decline_reason = p_decline_reason,
      approver_ip = p_ip,
      approver_user_agent = p_user_agent,
      decided_at = NOW(),
      updated_at = NOW()
  WHERE id = v_approval.id
  RETURNING * INTO v_approval;
  
  -- Update estimate
  UPDATE estimates
  SET approval_status = p_decision,
      approved_at = CASE WHEN p_decision = 'approved' THEN NOW() ELSE NULL END,
      updated_at = NOW()
  WHERE id = v_approval.estimate_id;
  
  -- Queue notification to contractor
  INSERT INTO approval_notifications (
    approval_id,
    notification_type,
    recipient_email
  ) VALUES (
    v_approval.id,
    p_decision,
    (SELECT email FROM auth.users WHERE id = v_approval.created_by)
  );
  
  RETURN v_approval;
END;
$$;

-- Function to track approval view
CREATE OR REPLACE FUNCTION track_approval_view(
  p_token TEXT,
  p_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS estimate_approvals
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approval estimate_approvals;
BEGIN
  -- Get and update approval
  UPDATE estimate_approvals
  SET view_count = view_count + 1,
      viewed_at = COALESCE(viewed_at, NOW()),
      approver_ip = COALESCE(approver_ip, p_ip),
      approver_user_agent = COALESCE(approver_user_agent, p_user_agent),
      updated_at = NOW()
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW()
    AND view_count < 10 -- Max 10 views
  RETURNING * INTO v_approval;
  
  IF v_approval IS NULL THEN
    RAISE EXCEPTION 'Invalid, expired, or exceeded view limit';
  END IF;
  
  -- Queue viewed notification (first view only)
  IF v_approval.view_count = 1 THEN
    INSERT INTO approval_notifications (
      approval_id,
      notification_type,
      recipient_email
    ) VALUES (
      v_approval.id,
      'viewed',
      (SELECT email FROM auth.users WHERE id = v_approval.created_by)
    );
  END IF;
  
  RETURN v_approval;
END;
$$;

-- Grant permissions
GRANT ALL ON estimate_approvals TO authenticated;
GRANT SELECT, UPDATE ON estimate_approvals TO anon;
GRANT ALL ON approval_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION send_estimate_for_approval TO authenticated;
GRANT EXECUTE ON FUNCTION record_estimate_decision TO anon, authenticated;
GRANT EXECUTE ON FUNCTION track_approval_view TO anon, authenticated;