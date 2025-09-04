# ScopeKit Capture Frontend Setup Guide

## ✅ Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
# or
pnpm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://ihzvnlstlavrvhvvxcgo.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Run Development Server
```bash
npm run dev
```

Visit http://localhost:3000

## 📱 Mobile Setup (Capacitor)

### iOS Setup
```bash
# Add iOS platform
npx cap add ios

# Open in Xcode
npx cap open ios
```

In Xcode:
1. Add to `Info.plist`:
   - `NSCameraUsageDescription`: "ScopeKit needs camera access to capture site photos"
   - `NSMicrophoneUsageDescription`: "ScopeKit needs microphone access to record notes"
   - `NSLocationWhenInUseUsageDescription`: "ScopeKit uses location for consent tracking"

2. Set bundle identifier: `io.scopekit.capture`
3. Configure signing team

### Android Setup
```bash
# Add Android platform
npx cap add android

# Open in Android Studio
npx cap open android
```

In Android Studio:
1. Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

2. Set application ID: `io.scopekit.capture`
3. Configure signing

### Build & Deploy
```bash
# Build web assets
npm run build

# Sync to native projects
npx cap sync

# Run on device
npx cap run ios
npx cap run android
```

## 🔧 Key Features Implemented

### ✅ Camera Module
- Native camera preview (iOS/Android)
- Web fallback with getUserMedia
- Auto-resize to ~2000px longest edge
- JPEG compression at 85% quality
- Shutter animation

### ✅ Audio Recording
- 2-second chunking for resilience
- Continuous upload while recording
- Native (Capacitor) and web (MediaRecorder) support
- Background upload queue

### ✅ Offline Sync
- IndexedDB queue with localforage
- Exponential backoff with jitter
- Network status monitoring
- Auto-sync on WiFi (5min) and cellular (15min)
- Progress tracking per upload

### ✅ Evidence Packs
- Roofing, Electrical, Plumbing, HVAC, General templates
- Required vs optional photo checklist
- Auto-completion tracking
- Visual progress indicators

### ✅ Consent Management
- Customer name capture
- Geolocation tagging
- IP and user-agent recording
- Digital consent storage

## 🎯 Acceptance Criteria Checks

1. **Photo Capture** ✅
   - Tap shutter → photo saved in <100ms
   - Checklist chip auto-marks complete

2. **Audio Chunks** ✅
   - 2-second chunks upload continuously
   - Survives app force-quit

3. **Offline Mode** ✅
   - Airplane mode: capture continues
   - Reconnect: automatic sync resumes

4. **Processing** ✅
   - Finalize → AI processing starts
   - Status screen polls for completion
   - Share link generation

## 🚀 Production Deployment

### 1. Update Environment
```bash
# Set production Supabase URL and key
VITE_SUPABASE_URL=https://your-prod.supabase.co
VITE_SUPABASE_ANON_KEY=your-prod-anon-key
```

### 2. Build for Production
```bash
npm run build
```

### 3. Deploy to Hosting
Options:
- **Vercel**: `vercel --prod`
- **Netlify**: `netlify deploy --prod`
- **AWS Amplify**: Via console
- **Custom**: Upload `dist/` to your server

### 4. Configure Domain
Point `app.scopekit.io` to your hosting provider.

### 5. Update CORS
In Supabase Edge Functions, ensure CORS allows:
- `https://app.scopekit.io`
- `https://share.scopekit.io`

## 📊 Telemetry Events to Track

Add your analytics provider (Mixpanel, Amplitude, PostHog) and track:

```typescript
// In appropriate components
track('visit_started', { evidence_pack, tenant_id })
track('photo_captured', { visit_id, sequence, size_kb })
track('recording_started', { visit_id })
track('recording_stopped', { visit_id, duration_ms, chunks })
track('visit_finalized', { visit_id, media_count, checklist_completion })
track('estimate_ready', { visit_id, processing_time_ms })
track('share_link_created', { estimate_id })
```

## 🐛 Troubleshooting

### Camera not working
- Check permissions in device settings
- Ensure HTTPS (required for getUserMedia)
- Try force-closing and reopening app

### Audio not recording
- Check microphone permissions
- Verify MediaRecorder support (web)
- Check console for errors

### Sync not working
- Verify network connection
- Check Supabase storage bucket exists
- Ensure RLS policies allow uploads
- Check browser console for CORS errors

### Build errors
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Capacitor: `npx cap sync --deployment`
- Check TypeScript: `npx tsc --noEmit`

## 📝 Next Steps

1. **Authentication**: Add Supabase Auth login screen
2. **Customer Search**: Add lead/customer lookup
3. **Estimate Editing**: Allow manual adjustments
4. **History**: Show past visits
5. **Settings**: User preferences, Evidence Pack customization

---

**Ready to capture!** 📸 🎙️ ✨