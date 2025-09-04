/**
 * Push Notification Service for iOS
 * Handles APNs registration, local notifications, and Live Activities
 */

import { Capacitor } from '@capacitor/core'
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'
import { supabase } from '../lib/supabase'
import { useVisitStore } from '../stores/visitStore'

interface NotificationPayload {
  type: 'draft_ready' | 'sync_complete' | 'estimate_updated'
  visit_id?: string
  title: string
  body: string
  data?: any
}

class PushNotificationService {
  private deviceToken: string | null = null
  private isInitialized = false
  
  /**
   * Initialize push notifications
   */
  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[Push] Not on native platform, skipping initialization')
      return
    }
    
    if (this.isInitialized) {
      console.log('[Push] Already initialized')
      return
    }
    
    try {
      // Request permission
      const permission = await PushNotifications.requestPermissions()
      
      if (permission.receive === 'granted') {
        console.log('[Push] Permission granted')
        
        // Register with APNs
        await PushNotifications.register()
        
        // Set up listeners
        this.setupListeners()
        
        this.isInitialized = true
      } else {
        console.log('[Push] Permission denied')
      }
    } catch (error) {
      console.error('[Push] Initialization error:', error)
    }
  }
  
  /**
   * Set up notification listeners
   */
  private setupListeners(): void {
    // Registration success
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[Push] Registration success:', token.value)
      this.deviceToken = token.value
      
      // Store token in Supabase
      await this.storeDeviceToken(token.value)
    })
    
    // Registration error
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[Push] Registration error:', error)
    })
    
    // Notification received in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[Push] Notification received:', notification)
      
      // Show local notification if app is in foreground
      this.showLocalNotification({
        title: notification.title || 'ScopeKit',
        body: notification.body || '',
        data: notification.data
      })
    })
    
    // Notification action performed
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('[Push] Action performed:', action)
      
      // Handle notification tap
      const data = action.notification.data
      if (data?.visit_id) {
        this.handleNotificationTap(data)
      }
    })
  }
  
  /**
   * Store device token in Supabase
   */
  private async storeDeviceToken(token: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Upsert device token
        const { error } = await supabase
          .from('device_tokens')
          .upsert({
            user_id: user.id,
            token: token,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'token'
          })
        
        if (error) {
          console.error('[Push] Failed to store token:', error)
        }
      }
    } catch (error) {
      console.error('[Push] Token storage error:', error)
    }
  }
  
  /**
   * Show local notification
   */
  async showLocalNotification(payload: {
    title: string
    body: string
    data?: any
  }): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: Date.now(),
          title: payload.title,
          body: payload.body,
          extra: payload.data,
          sound: 'default',
          attachments: undefined,
          actionTypeId: '',
          threadIdentifier: payload.data?.visit_id || 'default'
        }]
      })
    } catch (error) {
      console.error('[Push] Local notification error:', error)
    }
  }
  
  /**
   * Send draft ready notification
   */
  async notifyDraftReady(visitId: string, estimateTotal?: number): Promise<void> {
    const visit = useVisitStore.getState().visits.find(v => v.id === visitId)
    
    const title = 'Draft Estimate Ready!'
    const body = estimateTotal
      ? `Your estimate of $${estimateTotal.toFixed(2)} is ready for ${visit?.customer_name || 'your visit'}`
      : `Your estimate is ready for ${visit?.customer_name || 'your visit'}`
    
    await this.showLocalNotification({
      title,
      body,
      data: {
        type: 'draft_ready',
        visit_id: visitId,
        estimate_total: estimateTotal
      }
    })
    
    // Update Live Activity if iOS 16+
    if (Capacitor.getPlatform() === 'ios') {
      await this.updateLiveActivity(visitId, 'completed', estimateTotal)
    }
  }
  
  /**
   * Update iOS Live Activity
   * This requires native Swift implementation
   */
  async updateLiveActivity(visitId: string, status: 'processing' | 'completed', total?: number): Promise<void> {
    // This would call a native plugin
    // For now, just log
    console.log('[Push] Would update Live Activity:', { visitId, status, total })
    
    // In native implementation:
    // - Create/update Live Activity for visit processing
    // - Show progress indicator
    // - Display completion with total
  }
  
  /**
   * Handle notification tap
   */
  private handleNotificationTap(data: any): void {
    if (data.type === 'draft_ready' && data.visit_id) {
      // Navigate to review screen
      window.location.href = `/review/${data.visit_id}`
    }
  }
  
  /**
   * Send sync complete notification
   */
  async notifySyncComplete(itemCount: number): Promise<void> {
    await this.showLocalNotification({
      title: 'Sync Complete',
      body: `${itemCount} item${itemCount !== 1 ? 's' : ''} uploaded successfully`,
      data: {
        type: 'sync_complete',
        count: itemCount
      }
    })
  }
  
  /**
   * Check if notifications are enabled
   */
  async checkPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false
    }
    
    const result = await PushNotifications.checkPermissions()
    return result.receive === 'granted'
  }
  
  /**
   * Open notification settings
   */
  async openSettings(): Promise<void> {
    // This would open iOS settings for the app
    // Requires native implementation
    console.log('[Push] Would open notification settings')
  }
}

export const pushNotifications = new PushNotificationService()