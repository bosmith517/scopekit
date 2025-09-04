/**
 * AI Estimation Service for Mobile App
 * Handles AI job creation, monitoring, and offline queueing
 */

import { supabase } from '../lib/supabase'
import { useVisitStore } from '../stores/visitStore'
import localforage from 'localforage'
import { Capacitor } from '@capacitor/core'

// AI job storage for offline queue
const aiJobQueue = localforage.createInstance({
  name: 'scopekit',
  storeName: 'ai_jobs_queue'
})

export interface AIJob {
  id: string
  visit_id: string
  job_type: 'transcribe' | 'estimate'
  status: 'queued' | 'processing' | 'completed' | 'failed'
  created_at: string
  completed_at?: string
  result?: any
  error?: string
  attempts?: number
}

export interface EstimateResult {
  id: string
  visit_id: string
  total_amount: number
  line_items: EstimateLineItem[]
  metadata?: {
    ai_model: string
    processing_time_ms: number
    evidence_pack: string
    confidence_score?: number
  }
}

export interface EstimateLineItem {
  line_number: number
  description: string
  quantity: number
  unit: string
  unit_price: number
  total_price: number
  category?: string
  evidence?: Evidence[]
}

export interface Evidence {
  type: 'photo' | 'transcript'
  media_id?: string
  bbox?: { x: number; y: number; w: number; h: number }
  start_ms?: number
  end_ms?: number
  confidence: number
  label: string
}

class AIEstimationService {
  private monitoringIntervals = new Map<string, NodeJS.Timeout>()
  
  /**
   * Trigger AI estimation for a visit
   * Queues offline if no connection
   */
  async triggerEstimation(visitId: string): Promise<AIJob> {
    console.log('[AI] Triggering estimation for visit:', visitId)
    
    // Check if online
    const isOnline = await this.checkConnection()
    
    if (!isOnline) {
      // Queue for later
      return this.queueOfflineJob(visitId)
    }
    
    try {
      // Direct trigger via Edge Function
      const { data, error } = await supabase.functions.invoke('trigger-ai-estimation', {
        body: { visit_id: visitId }
      })
      
      if (error) throw error
      
      // Start monitoring if successful
      if (data?.success) {
        this.startMonitoring(visitId)
        
        // Store job info locally for tracking
        const job: AIJob = {
          id: crypto.randomUUID(),
          visit_id: visitId,
          job_type: 'estimate',
          status: 'processing',
          created_at: new Date().toISOString()
        }
        
        await this.storeJobLocally(job)
        return job
      }
      
      throw new Error(data?.error || 'Failed to trigger estimation')
      
    } catch (error) {
      console.error('[AI] Failed to trigger estimation:', error)
      
      // Queue for retry
      return this.queueOfflineJob(visitId)
    }
  }
  
  /**
   * Queue job for offline processing
   */
  private async queueOfflineJob(visitId: string): Promise<AIJob> {
    const job: AIJob = {
      id: crypto.randomUUID(),
      visit_id: visitId,
      job_type: 'estimate',
      status: 'queued',
      created_at: new Date().toISOString(),
      attempts: 0
    }
    
    // Add to offline queue
    await aiJobQueue.setItem(job.id, job)
    
    // Add to sync queue without circular dependency
    const { useSyncStore } = await import('../stores/syncStore')
    await useSyncStore.getState().addToQueue({
      visitId: visitId,
      type: 'ai_job',
      metadata: {
        jobType: 'estimate'
      }
    })
    
    console.log('[AI] Job queued for offline processing:', job.id)
    
    return job
  }
  
  /**
   * Process queued AI jobs when back online
   */
  async processQueuedJobs(): Promise<void> {
    const jobs: AIJob[] = []
    
    // Get all queued jobs
    await aiJobQueue.iterate((job: AIJob) => {
      if (job.status === 'queued') {
        jobs.push(job)
      }
    })
    
    console.log(`[AI] Processing ${jobs.length} queued jobs`)
    
    for (const job of jobs) {
      try {
        // Retry the job
        const { data, error } = await supabase.functions.invoke('trigger-ai-estimation', {
          body: { visit_id: job.visit_id }
        })
        
        if (error) throw error
        
        if (data?.success) {
          // Update job status
          job.status = 'processing'
          job.attempts = (job.attempts || 0) + 1
          await aiJobQueue.setItem(job.id, job)
          
          // Start monitoring
          this.startMonitoring(job.visit_id)
        }
        
      } catch (error) {
        console.error('[AI] Failed to process queued job:', job.id, error)
        
        // Update attempt count
        job.attempts = (job.attempts || 0) + 1
        
        // Mark as failed after 3 attempts
        if (job.attempts >= 3) {
          job.status = 'failed'
          job.error = String(error)
        }
        
        await aiJobQueue.setItem(job.id, job)
      }
    }
  }
  
  /**
   * Start monitoring a job for completion
   */
  private startMonitoring(visitId: string): void {
    // Clear any existing monitor
    this.stopMonitoring(visitId)
    
    let attempts = 0
    const maxAttempts = 60 // 60 seconds max
    
    const interval = setInterval(async () => {
      attempts++
      
      try {
        // Check job status
        const { data: jobs, error } = await supabase
          .from('ai_jobs')
          .select('*')
          .eq('visit_id', visitId)
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (error) throw error
        
        if (jobs && jobs.length > 0) {
          const job = jobs[0]
          
          if (job.status === 'completed') {
            console.log('[AI] Job completed:', visitId)
            
            // Fetch the estimate
            await this.fetchEstimate(visitId)
            
            // Send notification if in background
            if (Capacitor.isNativePlatform()) {
              this.sendDraftReadyNotification(visitId)
            }
            
            this.stopMonitoring(visitId)
            
          } else if (job.status === 'failed' || attempts >= maxAttempts) {
            console.log('[AI] Job failed or timed out:', visitId)
            this.stopMonitoring(visitId)
          }
        }
        
      } catch (error) {
        console.error('[AI] Monitoring error:', error)
        
        if (attempts >= maxAttempts) {
          this.stopMonitoring(visitId)
        }
      }
    }, 1000)
    
    this.monitoringIntervals.set(visitId, interval)
  }
  
  /**
   * Stop monitoring a job
   */
  private stopMonitoring(visitId: string): void {
    const interval = this.monitoringIntervals.get(visitId)
    if (interval) {
      clearInterval(interval)
      this.monitoringIntervals.delete(visitId)
    }
  }
  
  /**
   * Fetch and store estimate locally
   */
  private async fetchEstimate(visitId: string): Promise<EstimateResult | null> {
    try {
      const { data, error } = await supabase
        .from('estimates')
        .select(`
          *,
          estimate_lines(*)
        `)
        .eq('visit_id', visitId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error) throw error
      
      if (data) {
        // Store in visit store
        useVisitStore.getState().setEstimate(visitId, data)
        
        // Store locally for offline access
        await this.storeEstimateLocally(data)
        
        return data as EstimateResult
      }
      
    } catch (error) {
      console.error('[AI] Failed to fetch estimate:', error)
    }
    
    return null
  }
  
  /**
   * Store estimate locally for offline access
   */
  private async storeEstimateLocally(estimate: EstimateResult): Promise<void> {
    const estimatesStore = localforage.createInstance({
      name: 'scopekit',
      storeName: 'estimates'
    })
    
    await estimatesStore.setItem(estimate.visit_id, estimate)
  }
  
  /**
   * Get estimate from local storage
   */
  async getLocalEstimate(visitId: string): Promise<EstimateResult | null> {
    const estimatesStore = localforage.createInstance({
      name: 'scopekit',
      storeName: 'estimates'
    })
    
    return await estimatesStore.getItem(visitId)
  }
  
  /**
   * Store job info locally
   */
  private async storeJobLocally(job: AIJob): Promise<void> {
    await aiJobQueue.setItem(job.id, job)
  }
  
  /**
   * Check connection status
   */
  private async checkConnection(): Promise<boolean> {
    if (!navigator.onLine) return false
    
    try {
      // Ping Supabase to verify actual connection
      const { error } = await supabase
        .from('ai_jobs')
        .select('id')
        .limit(1)
      
      return !error
    } catch {
      return false
    }
  }
  
  /**
   * Send push notification when draft is ready
   */
  private async sendDraftReadyNotification(visitId: string): Promise<void> {
    // This will be implemented with native push notifications
    // For now, just log
    console.log('[AI] Draft ready notification for visit:', visitId)
    
    // In a real implementation:
    // - Use @capacitor/push-notifications
    // - Send local notification if app is in background
    // - Update Live Activity on iOS
  }
  
  /**
   * Get confidence score for estimate
   */
  getConfidenceScore(estimate: EstimateResult): number {
    if (!estimate.line_items || estimate.line_items.length === 0) {
      return 0
    }
    
    // Calculate based on evidence coverage
    let totalConfidence = 0
    let evidenceCount = 0
    
    estimate.line_items.forEach(item => {
      if (item.evidence && item.evidence.length > 0) {
        item.evidence.forEach(ev => {
          totalConfidence += ev.confidence || 0.5
          evidenceCount++
        })
      }
    })
    
    return evidenceCount > 0 ? totalConfidence / evidenceCount : 0.5
  }
  
  /**
   * Get evidence coverage percentage
   */
  getEvidenceCoverage(estimate: EstimateResult): number {
    if (!estimate.line_items || estimate.line_items.length === 0) {
      return 0
    }
    
    const itemsWithEvidence = estimate.line_items.filter(
      item => item.evidence && item.evidence.length > 0
    ).length
    
    return (itemsWithEvidence / estimate.line_items.length) * 100
  }
}

export const aiEstimation = new AIEstimationService()