import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCamera } from '../hooks/useCamera'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useVisitStore, EVIDENCE_PACKS } from '../stores/visitStore'
import { useSyncStore } from '../stores/syncStore'
import { createSiteVisit } from '../lib/api'
import { createSiteVisitDirect } from '../lib/api-direct'
import EvidencePackSelector from '../components/EvidencePackSelector'
import CameraControls from '../components/CameraControls'
import ChecklistOverlay from '../components/ChecklistOverlay'

export default function CaptureScreen() {
  const navigate = useNavigate()
  const visitStore = useVisitStore()
  const syncStore = useSyncStore()
  const camera = useCamera()
  const audio = useAudioRecorder()
  
  const [showPackSelector, setShowPackSelector] = useState(!visitStore.visitId)
  const [showChecklist, setShowChecklist] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)

  // Start new visit
  const handlePackSelect = async (packId: string) => {
    try {
      console.log('[CaptureScreen] Starting visit with pack:', packId)
      console.log('[CaptureScreen] Current tenant ID:', visitStore.tenantId)
      
      const pack = EVIDENCE_PACKS.find(p => p.id === packId)
      if (!pack) return

      // Create visit in database - use direct method to bypass cache issues
      const visitId = await createSiteVisitDirect(packId)
      
      // Initialize store
      visitStore.startVisit(visitId, pack)
      
      // Start camera preview
      await camera.startPreview()
      
      setShowPackSelector(false)
    } catch (error) {
      console.error('Failed to start visit:', error)
      alert('Failed to start visit. Please try again.')
    }
  }

  // Capture photo
  const handleCapture = async () => {
    if (isCapturing) return
    setIsCapturing(true)

    try {
      const blob = await camera.capturePhoto()
      if (!blob) throw new Error('Failed to capture photo')

      const visitId = visitStore.visitId
      const tenantId = visitStore.tenantId
      if (!visitId || !tenantId) throw new Error('No active visit')

      // Add to sync queue
      const sequence = visitStore.mediaCount
      const timestamp = Date.now()
      const path = `${tenantId}/${visitId}/photos/photo_${sequence}_${timestamp}.jpg`
      
      await syncStore.addToQueue({
        visitId,
        type: 'photo',
        blob,
        path,
        sequence,
        metadata: {
          size: blob.size
        }
      })

      visitStore.addMedia()

      // Flash effect
      const flash = document.createElement('div')
      flash.className = 'fixed inset-0 bg-white z-50 pointer-events-none animate-flash'
      document.body.appendChild(flash)
      setTimeout(() => flash.remove(), 300)

      // Auto-mark checklist item if applicable
      const nextItem = visitStore.checklist.find(item => !item.completed && item.required)
      if (nextItem) {
        visitStore.markItemComplete(nextItem.id, `photo_${sequence}`)
      }

    } catch (error) {
      console.error('Capture error:', error)
    } finally {
      setIsCapturing(false)
    }
  }

  // Toggle recording
  const handleRecordToggle = async () => {
    if (audio.isRecording) {
      await audio.stopRecording()
    } else {
      await audio.startRecording()
    }
  }

  // Finish visit
  const handleFinish = async () => {
    if (audio.isRecording) {
      await audio.stopRecording()
    }
    
    await camera.stopPreview()
    navigate('/review')
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audio.isRecording) {
        audio.stopRecording()
      }
      camera.stopPreview()
    }
  }, [])

  if (showPackSelector) {
    return <EvidencePackSelector onSelect={handlePackSelect} />
  }

  return (
    <div className="relative h-screen bg-black">
      {/* Camera Preview */}
      {camera.isPreviewActive ? (
        <div id="camera-preview" className="absolute inset-0" />
      ) : (
        <video
          ref={camera.videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
      )}

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex justify-between items-start">
          <button
            onClick={() => setShowChecklist(!showChecklist)}
            className="bg-white/20 backdrop-blur rounded-lg px-3 py-2 text-white"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {visitStore.evidencePack?.name}
              </span>
              <span className="text-xs opacity-75">
                {visitStore.checklist.filter(i => i.completed).length}/{visitStore.checklist.length}
              </span>
            </div>
          </button>

          <div className="flex gap-2">
            <div className="bg-white/20 backdrop-blur rounded-lg px-3 py-2">
              <span className="text-white text-sm">
                📷 {visitStore.mediaCount}
              </span>
            </div>
            {audio.isRecording && (
              <div className="bg-red-500 rounded-lg px-3 py-2 animate-pulse">
                <span className="text-white text-sm">
                  🎙️ {formatDuration(audio.duration)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Checklist Overlay */}
      {showChecklist && (
        <ChecklistOverlay
          checklist={visitStore.checklist}
          onClose={() => setShowChecklist(false)}
        />
      )}

      {/* Camera Controls */}
      <CameraControls
        onCapture={handleCapture}
        onRecordToggle={handleRecordToggle}
        onFinish={handleFinish}
        isRecording={audio.isRecording}
        isCapturing={isCapturing}
        photoCount={visitStore.mediaCount}
      />
    </div>
  )
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}