import { create } from 'zustand'
import localforage from 'localforage'
import { uploadToStorage, registerMedia } from '../lib/api'
import { Network } from '@capacitor/network'

export interface QueueItem {
  id: string
  visitId: string
  type: 'photo' | 'audio' | 'ai_job'
  blob?: Blob // Optional for AI jobs
  path?: string // Optional for AI jobs
  sequence?: number // Optional for AI jobs
  attempts: number
  createdAt: number
  metadata?: {
    duration?: number
    size?: number
    jobType?: 'transcribe' | 'estimate' // For AI jobs
  }
}

interface SyncStore {
  queue: QueueItem[]
  isOnline: boolean
  isSyncing: boolean
  uploadProgress: { [id: string]: number }
  
  // Actions
  addToQueue: (item: Omit<QueueItem, 'id' | 'attempts' | 'createdAt'>) => Promise<void>
  removeFromQueue: (id: string) => Promise<void>
  processQueue: () => Promise<void>
  setOnline: (isOnline: boolean) => void
  updateProgress: (id: string, progress: number) => void
  clearQueue: () => Promise<void>
}

// Configure localforage
const queueStorage = localforage.createInstance({
  name: 'scopekit-sync-queue'
})

export const useSyncStore = create<SyncStore>((set, get) => ({
  queue: [],
  isOnline: true,
  isSyncing: false,
  uploadProgress: {},

  addToQueue: async (item) => {
    const queueItem: QueueItem = {
      ...item,
      id: crypto.randomUUID(),
      attempts: 0,
      createdAt: Date.now()
    }

    console.log(`[SyncStore] Adding item to queue:`, {
      id: queueItem.id,
      type: queueItem.type,
      path: queueItem.path,
      size: item.blob?.size
    })

    // Save blob to IndexedDB
    if (item.blob) {
      await queueStorage.setItem(queueItem.id, item.blob)
    }

    set((state) => ({
      queue: [...state.queue, { ...queueItem, blob: undefined }] // Don't keep blob in memory
    }))

    // Trigger sync if online
    if (get().isOnline && !get().isSyncing) {
      console.log('[SyncStore] Triggering automatic sync...')
      setTimeout(() => get().processQueue(), 100) // Small delay to let state settle
    }
  },

  removeFromQueue: async (id) => {
    await queueStorage.removeItem(id)
    set((state) => {
      const newProgress = { ...state.uploadProgress }
      delete newProgress[id]
      return {
        queue: state.queue.filter(item => item.id !== id),
        uploadProgress: newProgress
      }
    })
  },

  processQueue: async () => {
    const { queue, isOnline, isSyncing } = get()
    
    if (!isOnline || isSyncing || queue.length === 0) return

    set({ isSyncing: true })
    console.log(`[SyncStore] Processing queue with ${queue.length} items`)

    try {
      for (const item of queue) {
        if (item.attempts >= 5) {
          console.error(`Max attempts reached for ${item.id}`)
          continue
        }

        try {
          // Handle AI jobs differently
          if (item.type === 'ai_job') {
            // Import aiEstimation dynamically to avoid circular deps
            const { aiEstimation } = await import('../services/aiEstimation')
            await aiEstimation.triggerEstimation(item.visitId)
            
            // Remove from queue on success
            await get().removeFromQueue(item.id)
          } else {
            // Handle media uploads
            if (!item.path) {
              console.error(`No path for item ${item.id}`)
              continue
            }
            
            // Get blob from storage
            const blob = await queueStorage.getItem<Blob>(item.id)
            if (!blob) {
              console.error(`No blob found for item ${item.id}`)
              continue
            }

            console.log(`[SyncStore] Uploading ${item.type} to ${item.path}, size: ${blob.size}`)
            
            try {
              // Upload using proper Supabase API
              await uploadToStorage(blob, item.path)
              console.log(`[SyncStore] Upload successful for ${item.path}`)
            } catch (uploadError: any) {
              console.error(`[SyncStore] Upload failed:`, uploadError)
              if (uploadError.message?.includes('row-level security')) {
                console.error('[SyncStore] RLS policy error - check Supabase permissions')
              }
              throw uploadError
            }

            try {
              // Register in database
              await registerMedia(
                item.visitId,
                item.type as 'photo' | 'audio',
                item.path,
                item.metadata?.size || blob.size,
                item.metadata?.duration,
                item.sequence
              )
              console.log(`[SyncStore] Media registered in database for ${item.id}`)
            } catch (dbError) {
              console.error(`[SyncStore] Database registration failed:`, dbError)
              throw dbError
            }

            console.log(`[SyncStore] Successfully uploaded and registered ${item.id}`)
            // Remove from queue on success
            await get().removeFromQueue(item.id)
          }
        } catch (error) {
          console.error(`Failed to process ${item.id}:`, error)
          
          // Update attempts
          set((state) => ({
            queue: state.queue.map(q =>
              q.id === item.id
                ? { ...q, attempts: q.attempts + 1 }
                : q
            )
          }))

          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, item.attempts), 16000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    } finally {
      set({ isSyncing: false })
      console.log('[SyncStore] Queue processing completed')
    }
  },

  setOnline: (isOnline) => {
    set({ isOnline })
    if (isOnline && !get().isSyncing) {
      get().processQueue()
    }
  },

  updateProgress: (id, progress) => {
    set((state) => ({
      uploadProgress: { ...state.uploadProgress, [id]: progress }
    }))
  },

  clearQueue: async () => {
    // Clear all items from storage
    const { queue } = get()
    for (const item of queue) {
      await queueStorage.removeItem(item.id)
    }
    // Reset state
    set({ queue: [], uploadProgress: {} })
  }
}))


// Initialize network monitoring
Network.addListener('networkStatusChange', (status) => {
  useSyncStore.getState().setOnline(status.connected)
})

// Check initial network status
Network.getStatus().then((status) => {
  useSyncStore.getState().setOnline(status.connected)
})

// Auto-sync interval - check every 5 seconds for pending items
setInterval(async () => {
  const { isOnline, isSyncing, queue } = useSyncStore.getState()
  
  if (isOnline && !isSyncing && queue.length > 0) {
    console.log(`[SyncStore] Auto-sync triggered, ${queue.length} items pending`)
    useSyncStore.getState().processQueue()
  }
}, 5000) // Check every 5 seconds