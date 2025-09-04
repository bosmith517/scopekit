import { useState, useRef, useCallback } from 'react'
// Voice recorder removed - using web MediaRecorder only
import { Capacitor } from '@capacitor/core'
import { useSyncStore } from '../stores/syncStore'
import { useVisitStore } from '../stores/visitStore'

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const chunkCountRef = useRef<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const visitStore = useVisitStore()
  const syncStore = useSyncStore()

  const CHUNK_DURATION_MS = 2000 // 2 seconds

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null)
      const visitId = visitStore.visitId
      const tenantId = visitStore.tenantId
      
      if (!visitId || !tenantId) {
        throw new Error('No active visit')
      }

      // Always use web MediaRecorder (works on mobile browsers too)
      {
        // Web recording with MediaRecorder
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : 'audio/mp4'
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: 64000 // Lower bitrate for smaller files
        })
        
        mediaRecorderRef.current = mediaRecorder
        chunksRef.current = []

        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0) {
            // Save chunk immediately
            await saveAudioChunk(
              event.data,
              visitId,
              tenantId,
              chunkCountRef.current++
            )
          }
        }

        mediaRecorder.start(CHUNK_DURATION_MS) // Chunk every 2 seconds
      }

      startTimeRef.current = Date.now()
      setIsRecording(true)
      visitStore.setRecording(true)

      // Update duration every 100ms
      const durationInterval = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current)
      }, 100)
      
      // Store interval to clear later
      if (!intervalRef.current) {
        intervalRef.current = durationInterval
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording')
      console.error('Recording error:', err)
    }
  }, [visitStore, syncStore])

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      const visitId = visitStore.visitId
      const tenantId = visitStore.tenantId
      
      if (!visitId || !tenantId) return

      // Stop web recording
      {
        // Stop web recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
          
          // Stop all tracks
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
          mediaRecorderRef.current = null
        }
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      setIsRecording(false)
      setDuration(0)
      visitStore.setRecording(false)
      chunkCountRef.current = 0

    } catch (err) {
      console.error('Stop recording error:', err)
    }
  }, [visitStore, syncStore])

  // Save audio chunk to sync queue
  const saveAudioChunk = async (
    blob: Blob,
    visitId: string,
    tenantId: string,
    chunkNumber: number
  ) => {
    const timestamp = Date.now()
    const path = `${tenantId}/${visitId}/audio/chunk_${chunkNumber}_${timestamp}.webm`
    
    await syncStore.addToQueue({
      visitId,
      type: 'audio',
      blob,
      path,
      sequence: chunkNumber,
      metadata: {
        duration: CHUNK_DURATION_MS,
        size: blob.size
      }
    })

    visitStore.addAudioChunk(`chunk_${chunkNumber}_${timestamp}`)
  }

  return {
    isRecording,
    duration,
    error,
    startRecording,
    stopRecording
  }
}

// Helper to convert base64 to blob
async function base64ToBlob(base64: string, mimeType: string): Promise<Blob> {
  const response = await fetch(`data:${mimeType};base64,${base64}`)
  return await response.blob()
}