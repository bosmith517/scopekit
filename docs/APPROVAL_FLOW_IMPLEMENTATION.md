# Estimate Approval Flow Implementation

## Overview
Complete implementation of the estimate approval workflow including contractor authentication, client approval process, and audit trail.

## Key Features Implemented

### 1. Contractor Authentication (`/auth`)
- Email/password signup and signin
- Automatic tenant creation for new contractors
- Session persistence with Supabase Auth
- Company profile management

### 2. Send for Approval
- Modal interface to collect client details
- Generates secure, expiring tokens (7 days or 10 views)
- Tracks approval status in real-time
- Email notification ready (requires email service setup)

### 3. Client Approval Page (`/approve/:token`)
- No account required for clients
- View full estimate with line items
- Evidence-bound line items visible
- Signature capture (typed or drawn)
- Decline with required reason
- View tracking and expiration

### 4. Database Schema
- `estimate_approvals` table with full audit trail
- Tracks IP, user agent, timestamps
- Signature storage (base64 encoded)
- Status tracking (pending/approved/declined/expired)
- RLS policies for security

### 5. Security Features
- Token-based access (no client account needed)
- Expiring links (7 days or 10 views)
- IP and user agent tracking
- Audit trail for compliance
- Tenant-scoped data isolation

## Workflow

### Contractor Flow:
1. Sign in at `/auth`
2. Complete visit and generate estimate
3. Click "Send for Approval" on estimate screen
4. Enter client name and email
5. System generates secure link and sends email
6. Track approval status in dashboard

### Client Flow:
1. Receive email with approval link
2. Click link to view estimate (no login required)
3. Review line items and evidence
4. Approve with signature or Decline with reason
5. Confirmation screen
6. Contractor notified instantly

## API Functions

### `send_estimate_for_approval`
```sql
CALL send_estimate_for_approval(
  p_estimate_id,
  p_approver_name,
  p_approver_email,
  p_approver_phone
)
```

### `record_estimate_decision`
```sql
CALL record_estimate_decision(
  p_token,
  p_decision, -- 'approved' or 'declined'
  p_signature_data,
  p_signature_type,
  p_decline_reason,
  p_ip,
  p_user_agent
)
```

### `track_approval_view`
```sql
CALL track_approval_view(
  p_token,
  p_ip,
  p_user_agent
)
```

## Components

- `AuthScreen.tsx` - Contractor signup/signin
- `SendForApproval.tsx` - Modal for sending approval requests
- `ApprovalScreen.tsx` - Client approval interface
- `EstimateScreen.tsx` - Updated with approval functionality

## Deployment Steps

1. **Run database migration**:
   ```bash
   supabase db push
   ```

2. **Set up email service** (optional but recommended):
   - Configure SMTP in Supabase dashboard
   - Or use SendGrid/Resend integration

3. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy
   ```

4. **Build and deploy frontend**:
   ```bash
   npm run build
   npm run deploy
   ```

## Testing

1. **Create test contractor account**:
   - Go to `/auth`
   - Sign up with email/password
   - Create company profile

2. **Test approval flow**:
   - Create and finalize a visit
   - Generate estimate
   - Send for approval
   - Access approval link
   - Test both approve and decline flows

3. **Verify audit trail**:
   ```sql
   SELECT * FROM estimate_approvals 
   WHERE estimate_id = 'your-estimate-id';
   ```

## Notifications Setup

To enable email notifications:

1. Configure email service in Supabase dashboard
2. Create email templates for:
   - Approval request sent
   - Estimate viewed by client
   - Estimate approved
   - Estimate declined

3. Set up push notifications (mobile):
   - Configure APNs for iOS
   - Configure FCM for Android
   - Update device token management

## Security Considerations

- All approval links expire after 7 days or 10 views
- IP addresses and user agents are logged
- Signatures are stored securely
- RLS policies ensure tenant isolation
- Tokens are cryptographically secure (32 bytes)

## Next Steps

1. Set up email service for notifications
2. Add webhook for Slack/Discord notifications
3. Implement approval reminders (24h, 48h)
4. Add bulk approval sending
5. Create approval analytics dashboard
6. Add DocuSign integration for legal signatures