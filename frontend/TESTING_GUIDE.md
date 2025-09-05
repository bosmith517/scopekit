# ScopeKit Capture v1.2 - Testing Guide

## Current Status ✅
- **Frontend**: Running on http://localhost:3000
- **Database**: Migrations applied to Supabase project
- **Default Tenant**: `00000000-0000-0000-0000-000000000001` (for testing)
- **Authentication**: Bypassed for initial testing

## Testing Steps

### 1. Database Setup Verification
Run the storage bucket creation in Supabase SQL Editor:
```sql
-- Run the contents of setup-storage.sql
-- This creates the site-visits storage bucket
```

### 2. System Test Page
Open the test page in your browser:
```
file:///C:/Users/Bo%20Smith/Documents/Website%20Builds/Web%20Apps/TaurusTech/Pipecats%20Playhouse/development/ScopeKit%20v1.2/frontend/test-scopekit.html
```

This test page will:
1. Test Supabase connection
2. Create a test visit
3. Upload test media
4. Record consent
5. Finalize the visit

### 3. Main Application Testing
Navigate to: http://localhost:3000

#### Test Flow:
1. **Select Evidence Pack**
   - Choose "General v1" or "Premium v1"
   - Enter optional customer information
   - Click "Start Visit"

2. **Capture Photos**
   - Allow camera permissions when prompted
   - Take 3-5 test photos
   - Photos are queued for upload automatically

3. **Record Audio**
   - Click microphone button to start recording
   - Speak for 10-20 seconds
   - Audio chunks save every 2 seconds
   - Click stop when done

4. **Monitor Sync**
   - Bottom timeline shows upload progress
   - Green = uploaded, yellow = queued, red = failed
   - Automatic retry on network reconnection

5. **Complete Visit**
   - Review captured media count
   - Click "Complete Visit"
   - System finalizes and processes data

### 4. Verify in Supabase Dashboard

Check these tables in your Supabase project:
- `site_visits` - Should show your test visit
- `visit_media` - Should list uploaded photos/audio
- `visit_consents` - Should have consent record
- `sync_queue` - Should be empty after successful sync

### 5. Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "No tenant ID set" | Fixed - default tenant added to App.tsx |
| Storage upload fails | Run setup-storage.sql in Supabase |
| RPC functions fail | Falls back to direct inserts automatically |
| Camera not working | Use HTTPS or localhost, check browser permissions |
| Audio not recording | Ensure microphone permissions granted |

### 6. Mobile Testing (Optional)

For Capacitor mobile app testing:
```bash
# Build for mobile
npm run build

# Sync with Capacitor
npx cap sync

# Run on iOS simulator
npx cap run ios

# Run on Android emulator  
npx cap run android
```

### 7. Performance Metrics to Verify

- [ ] Photo capture < 2 seconds
- [ ] Audio chunks save every 2 seconds
- [ ] Upload queue processes automatically
- [ ] Offline mode preserves all data
- [ ] Network recovery resumes uploads

### 8. Data Verification Queries

Run in Supabase SQL Editor:
```sql
-- Check recent visits
SELECT * FROM site_visits 
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC
LIMIT 5;

-- Check media uploads
SELECT vm.*, sv.customer_name 
FROM visit_media vm
JOIN site_visits sv ON sv.id = vm.visit_id
WHERE sv.tenant_id = '00000000-0000-0000-0000-000000000001'
ORDER BY vm.created_at DESC;

-- Check sync queue (should be empty after sync)
SELECT * FROM sync_queue
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
```

## Next Steps After Testing

1. **Enable Authentication**
   - Remove default tenant ID from App.tsx
   - Implement login flow
   - Set up user profiles

2. **Configure AI Processing**
   - Deploy Edge Functions (optional)
   - Add OpenAI API key
   - Enable estimate generation

3. **Production Deployment**
   - Set up custom domain
   - Configure SSL certificates
   - Enable monitoring/logging
   - Set up backup strategy

## Support & Troubleshooting

- **Logs**: Check browser console (F12)
- **Network**: Monitor Network tab for API calls
- **Storage**: IndexedDB stores offline queue
- **State**: Zustand DevTools for state debugging

## Test Checklist

- [ ] Test page loads and connects to Supabase
- [ ] Main app creates visit successfully
- [ ] Photos capture and upload
- [ ] Audio records in 2-second chunks
- [ ] Sync queue processes automatically
- [ ] Data appears in Supabase tables
- [ ] Offline mode queues properly
- [ ] Network recovery resumes sync

---
Ready for testing! The system is configured for immediate use without authentication.