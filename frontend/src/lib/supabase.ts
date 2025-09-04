import { createClient } from '@supabase/supabase-js'

// Your Supabase project
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ihzvnlstlavrvhvvxcgo.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY - check .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})

// Helper to get current user's tenant
export async function getCurrentTenant(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.app_metadata?.tenant_id || null
}