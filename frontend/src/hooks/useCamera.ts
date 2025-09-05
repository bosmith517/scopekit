import { useState, useEffect, useRef } from 'react'
import { CameraPreview } from '@capacitor-community/camera-preview'
import { Capacitor } from '@capacitor/core'

export function useCamera() {
  const [isPreviewActive, setIsPreviewActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Start camera preview
  const startPreview = async () => {
    try {
      setError(null)
      
      if (Capacitor.isNativePlatform()) {
        // Native camera preview - FULL SCREEN
        await CameraPreview.start({
          position: 'rear',
          height: window.innerHeight,
          width: window.innerWidth,
          x: 0,
          y: 0,
          toBack: true, // Put camera behind the webview
          enableZoom: true,
          disableAudio: true,
          storeToFile: true, // Store to file instead of base64 for speed
          enableHighResolution: true
        })
      } else {
        // Web fallback
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 2000 },
            height: { ideal: 2000 }
          }
        })
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        
        streamRef.current = stream
      }
      
      setIsPreviewActive(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera access denied')
      console.error('Camera error:', err)
    }
  }

  // Stop camera preview
  const stopPreview = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await CameraPreview.stop()
      } else {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null
        }
      }
      setIsPreviewActive(false)
    } catch (err) {
      console.error('Stop preview error:', err)
    }
  }

  // Capture photo
  const capturePhoto = async (): Promise<Blob | null> => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Native capture - optimized for speed
        const result = await CameraPreview.capture({
          quality: 85,
          width: 0, // 0 = use current preview size
          height: 0
        })
        
        // Convert base64 to blob (CameraPreview always returns base64)
        const response = await fetch(`data:image/jpeg;base64,${result.value}`)
        return await response.blob()
      } else {
        // Web canvas capture
        if (!videoRef.current) return null
        
        const canvas = document.createElement('canvas')
        const video = videoRef.current
        
        // Calculate dimensions to maintain aspect ratio with max 2000px
        const maxDim = 2000
        let width = video.videoWidth
        let height = video.videoHeight
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim
            width = maxDim
          } else {
            width = (width / height) * maxDim
            height = maxDim
          }
        }
        
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        
        ctx.drawImage(video, 0, 0, width, height)
        
        return new Promise((resolve) => {
          canvas.toBlob(
            (blob) => resolve(blob),
            'image/jpeg',
            0.85
          )
        })
      }
    } catch (err) {
      console.error('Capture error:', err)
      return null
    }
  }

  // Flip camera
  const flipCamera = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await CameraPreview.flip()
      } else {
        // Web: restart with different facing mode
        await stopPreview()
        // Toggle facing mode and restart
        // Implementation depends on current facing mode tracking
      }
    } catch (err) {
      console.error('Flip camera error:', err)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreview()
    }
  }, [])

  return {
    isPreviewActive,
    error,
    videoRef,
    startPreview,
    stopPreview,
    capturePhoto,
    flipCamera
  }
}