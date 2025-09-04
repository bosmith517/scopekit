# ScopeKit v1.2 - AI-Powered Field Estimation Platform

## 🚀 Overview

ScopeKit is a production-ready mobile platform for contractors that delivers AI-generated estimates in 60 seconds. Field techs capture photos and audio notes, and our AI (powered by OpenAI GPT-4 Vision) generates detailed, evidence-bound estimates ready for client approval.

### Key Features

- **60-Second Estimates**: From capture to draft estimate in under a minute
- **Evidence Binding**: Every line item linked to specific photos (with bounding boxes) and audio timestamps
- **Offline-First**: Full offline capture with automatic sync when connected
- **Client Approval Flow**: Send estimates for approval without requiring client accounts
- **Multi-Platform**: iOS, Android, and Web support via Capacitor
- **Enterprise Ready**: Multi-tenant architecture with RLS (Row Level Security)

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Mobile    │────▶│   Supabase  │────▶│   OpenAI    │
│   App       │     │   Backend   │     │   GPT-4V    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Capacitor  │     │  PostgreSQL │     │   Whisper   │
│   Native    │     │   Storage   │     │    Audio    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Mobile**: Capacitor 5 (iOS/Android)
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth, Storage)
- **AI**: OpenAI GPT-4 Vision + Whisper
- **State**: Zustand + localforage (offline)
- **Routing**: React Router v6

## 📱 Features by User

### Field Tech
- Camera capture with Evidence Pack guidance
- Audio recording (chunked for reliability)
- Offline capture with sync queue
- Next Best Shot recommendations
- Haptic feedback (iOS)

### Contractor (Owner)
- Email/password authentication
- Send estimates for approval
- Track approval status
- Push notifications
- Dashboard with analytics

### Client
- No account required
- Secure link to view estimate
- Evidence review (photos with annotations)
- E-signature capture
- Approve/Decline with reasons

## 🚦 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase CLI
- OpenAI API key
- Apple Developer Account (for iOS)
- Android Studio (for Android)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/scopekit.git
cd scopekit
```

2. **Install dependencies**
```bash
cd frontend
npm install
```

3. **Configure environment variables**
```bash
# frontend/.env.local
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Set up Supabase**
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Push database schema
supabase db push

# Deploy Edge Functions
supabase functions deploy ai-estimator
supabase functions deploy trigger-ai-estimation
```

5. **Configure OpenAI**
```bash
# Set secrets in Supabase
supabase secrets set OPENAI_API_KEY=sk-your-openai-key
supabase secrets set INTERNAL_QUEUE_KEY=your-secure-key
```

### Development

```bash
# Web development
npm run dev

# Build for production
npm run build

# Add iOS platform
npx cap add ios
npx cap sync ios
npx cap open ios  # Opens Xcode

# Add Android platform
npx cap add android
npx cap sync android
npx cap open android  # Opens Android Studio
```

## 📁 Project Structure

```
scopekit/
├── frontend/               # React frontend + Capacitor
│   ├── src/
│   │   ├── screens/       # Page components
│   │   ├── components/    # Reusable components
│   │   ├── services/      # Business logic
│   │   ├── stores/        # Zustand stores
│   │   └── lib/           # Utilities
│   ├── ios/               # iOS native project
│   └── android/           # Android native project
├── supabase/
│   ├── migrations/        # Database migrations
│   └── functions/         # Edge Functions
│       ├── ai-estimator/  # AI processing
│       └── trigger-ai-estimation/
└── docs/                  # Documentation
```

## 🔐 Security

- Row Level Security (RLS) on all tables
- Tenant isolation for multi-tenancy
- Signed URLs for media (300-600s TTL)
- Token-based approval links
- Audit trail for all approvals
- No client data in localStorage (only IndexedDB)

## 🧪 Testing

```bash
# Run tests
npm test

# Test AI estimation
open test-ai-edge-function.html

# Test approval flow
open test-ai-estimation.html
```

## 📊 Database Schema

Key tables:
- `tenants` - Multi-tenant support
- `site_visits` - Visit records
- `site_visit_media` - Photos/audio
- `estimates` - AI-generated estimates
- `estimate_lines` - Line items with evidence
- `estimate_approvals` - Approval workflow
- `ai_jobs` - Background processing queue

## 🚀 Deployment

### Supabase
```bash
supabase db push
supabase functions deploy
```

### Vercel (Web)
```bash
npm run build
vercel --prod
```

### iOS (via Xcode)
1. Open in Xcode: `npx cap open ios`
2. Configure signing
3. Product → Archive
4. Upload to App Store Connect

### Android (via Android Studio)
1. Open in Android Studio: `npx cap open android`
2. Build → Generate Signed Bundle
3. Upload to Google Play Console

## 📈 Performance Targets

- **Capture → Draft**: ≤60 seconds (p95)
- **Photo capture**: ≤150ms shutter
- **Offline sync**: Automatic on connection
- **Evidence coverage**: ≥90% of line items
- **Draft accuracy**: ≥95% (≤0.5 edits/line)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 👥 Team

- Frontend: React/TypeScript/Capacitor
- Backend: Supabase/PostgreSQL
- AI: OpenAI GPT-4 Vision
- Infrastructure: Vercel/Supabase

## 📞 Support

For support, email support@scopekit.io or join our Slack channel.

## 🎯 Roadmap

- [ ] Android app release
- [ ] Offline AI processing
- [ ] Team collaboration features
- [ ] QuickBooks integration
- [ ] Multi-language support
- [ ] AR measurement tools
- [ ] Voice-to-estimate
- [ ] Custom Evidence Packs

---

**Built with ❤️ for contractors who value their time**