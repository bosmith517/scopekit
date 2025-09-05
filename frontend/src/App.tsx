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
    
    // Expose stores for debugging
    if (typeof window !== 'undefined') {
      (window as any).stores = {
        visitStore: useVisitStore.getState(),
        syncStore: useSyncStore.getState()
      }
    }
    
    // Initialize mobile services
    if (Capacitor.isNativePlatform()) {
      // Initialize push notifications for draft ready alerts
      pushNotifications.initialize().catch(console.error)
      
      // Process any queued AI jobs from offline capture
      aiEstimation.processQueuedJobs().catch(console.error)
    }
    
    // Check for auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const tenantId = session.user.app_metadata?.tenant_id
        if (tenantId) {
          useVisitStore.getState().setTenant(tenantId)
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