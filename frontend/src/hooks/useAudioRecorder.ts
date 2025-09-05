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
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)

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
    organizationId: string,
    chunkNumber: number
  ) => {
    const timestamp = Date.now()
    const path = `${organizationId}/${visitId}/audio/chunk_${chunkNumber}_${timestamp}.webm`
    
    console.log(`[AudioRecorder] Saving audio chunk ${chunkNumber} to queue, size: ${blob.size}, path: ${path}`)
    
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
    console.log(`[AudioRecorder] Audio chunk ${chunkNumber} added to queue successfully`)
  }

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null)
      const visitId = visitStore.visitId
      const organizationId = visitStore.tenantId // Still using tenantId from store but it's organizationId
      
      console.log('[AudioRecorder] Starting recording with visitId:', visitId, 'organizationId:', organizationId)
      
      if (!visitId || !organizationId) {
        throw new Error(`No active visit - visitId: ${visitId}, organizationId: ${organizationId}`)
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
        chunkIntervalRef.current = setInterval(async () => {
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
                organizationId,
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
              organizationId,
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
      durationIntervalRef.current = setInterval(() => {
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
      const organizationId = visitStore.tenantId
      
      if (!visitId || !organizationId) return

      if (Capacitor.isNativePlatform()) {
        // Native stop
        if (chunkIntervalRef.current) {
          clearInterval(chunkIntervalRef.current)
          chunkIntervalRef.current = null
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
            organizationId,
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

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
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