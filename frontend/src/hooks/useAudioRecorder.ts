import { useState, useRef, useCallback } from 'react'
import { VoiceRecorder } from 'capacitor-voice-recorder'
import { Capacitor } from '@capacitor/core'
import { useSyncStore } from '../stores/syncStore'
import { useVisitStore } from '../stores/visitStore'

const CHUNK_DURATION_MS = 2000 // 2 seconds

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

  // Helper to convert base64 to blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

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

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null)
      const visitId = visitStore.visitId
      const tenantId = visitStore.tenantId
      
      if (!visitId || !tenantId) {
        throw new Error('No active visit')
      }

      if (Capacitor.isNativePlatform()) {
        // Native recording with VoiceRecorder
        const hasPermission = await VoiceRecorder.hasAudioRecordingPermission()
        if (!hasPermission.value) {
          const permission = await VoiceRecorder.requestAudioRecordingPermission()
          if (!permission.value) {
            throw new Error('Microphone permission denied')
          }
        }

        await VoiceRecorder.startRecording()
        
        // Set up chunking interval for native recording
        intervalRef.current = setInterval(async () => {
          try {
            // Stop current recording
            const result = await VoiceRecorder.stopRecording()
            if (result.value && result.value.recordDataBase64) {
              const audioBlob = base64ToBlob(
                result.value.recordDataBase64, 
                result.value.mimeType || 'audio/aac'
              )
              await saveAudioChunk(
                audioBlob,
                visitId,
                tenantId,
                chunkCountRef.current++
              )
            }
            // Start new recording for next chunk
            await VoiceRecorder.startRecording()
          } catch (err) {
            console.error('Chunk recording error:', err)
          }
        }, CHUNK_DURATION_MS)
      } else {
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

      setIsRecording(true)
      visitStore.setRecording(true)
      startTimeRef.current = Date.now()

      // Update duration every second
      intervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)

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

      if (Capacitor.isNativePlatform()) {
        // Native stop
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        
        const result = await VoiceRecorder.stopRecording()
        if (result.value && result.value.recordDataBase64) {
          const audioBlob = base64ToBlob(
            result.value.recordDataBase64, 
            result.value.mimeType || 'audio/aac'
          )
          await saveAudioChunk(
            audioBlob,
            visitId,
            tenantId,
            chunkCountRef.current
          )
        }
      } else if (mediaRecorderRef.current) {
        // Web stop
        if (mediaRecorderRef.current.state !== 'inactive') {
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

  return {
    isRecording,
    duration,
    error,
    startRecording,
    stopRecording
  }
}