import { useEffect } from 'react'
import { useVisitStore } from './stores/visitStore'
import { useSyncStore } from './stores/syncStore'
import { supabase } from './lib/supabase'
import { Capacitor } from '@capacitor/core'
import { pushNotifications } from './services/pushNotifications'
import { aiEstimation } from './services/aiEstimation'

// Components
import Layout from './components/Layout'
import OfflineIndicator from './components/OfflineIndicator'
import SyncStatus from './components/SyncStatus'

export default function App() {
  useEffect(() => {
    // Set default tenant ID (would come from auth in production)
    const defaultTenantId = '00000000-0000-0000-0000-000000000001'
    useVisitStore.getState().setTenant(defaultTenantId)
    console.log('[App] Initialized with tenant:', defaultTenantId)
    
    // Expose stores and sync functions for debugging
    if (typeof window !== 'undefined') {
      (window as any).stores = {
        visitStore: useVisitStore.getState(),
        syncStore: useSyncStore.getState()
      };
      (window as any).manualSync = async () => {
        console.log('Manual sync triggered');
        const syncStore = useSyncStore.getState();
        syncStore.setOnline(true);
        await syncStore.processQueue();
        console.log('Manual sync completed');
      }
    }
    
    // Initialize mobile services
    if (Capacitor.isNativePlatform()) {
      // Initialize push notifications for draft ready alerts
      pushNotifications.initialize().catch(console.error)
      
      // Process any queued AI jobs from offline capture
      aiEstimation.processQueuedJobs().catch(console.error)
    }
    
    // Check for auth session, create anonymous if none
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const tenantId = session.user.app_metadata?.tenant_id
        if (tenantId) {
          useVisitStore.getState().setTenant(tenantId)
        }
        console.log('[App] Authenticated user:', session.user.id)
      } else {
        // Sign in anonymously for testing
        console.log('[App] No session, signing in anonymously...')
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error) {
          console.error('[App] Anonymous auth failed:', error)
        } else {
          console.log('[App] Anonymous auth successful:', data.user?.id)
        }
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const tenantId = session.user.app_metadata?.tenant_id
        if (tenantId) {
          useVisitStore.getState().setTenant(tenantId)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <OfflineIndicator />
      <SyncStatus />
      <Layout />
    </div>
  )
}