/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_MAX_PHOTOS?: string
  readonly VITE_AUDIO_CHUNK_SECONDS?: string
  readonly VITE_SYNC_INTERVAL_WIFI?: string
  readonly VITE_SYNC_INTERVAL_CELL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}