import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useVisitStore } from '../stores/visitStore'
import { useCamera } from '../hooks/useCamera'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useSyncStore } from '../stores/syncStore'
import { useGeolocation } from '../hooks/useGeolocation'

export default function CaptureFlowScreen() {
  const { visitId } = useParams()
  const navigate = useNavigate()
  const visitStore = useVisitStore()
  const syncStore = useSyncStore()
  const camera = useCamera()
  const audio = useAudioRecorder()
  const geolocation = useGeolocation()
  
  const [activeTab, setActiveTab] = useState<'photos' | 'audio'>('photos')
  const [photoCount, setPhotoCount] = useState(0)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)

  // Initialize visit
  useEffect(() => {
    if (visitId) {
      console.log('Setting visit ID:', visitId)
      visitStore.setVisitId(visitId)
      // Also set tenant ID if not set
      if (!visitStore.tenantId) {
        visitStore.setTenant('00000000-0000-0000-0000-000000000001')
      }
    }
  }, [visitId])

  // Open camera
  const handleOpenCamera = async () => {
    try {
      console.log('Opening camera...')
      await camera.startPreview()
      setIsCameraOpen(true)
    } catch (error) {
      console.error('Failed to open camera:', error)
      alert('Camera access failed. Please check permissions.')
    }
  }

  // Close camera
  const handleCloseCamera = async () => {
    await camera.stopPreview()
    setIsCameraOpen(false)
  }

  // Capture photo
  const handleCapturePhoto = async () => {
    if (isCapturing) return
    setIsCapturing(true)

    try {
      const blob = await camera.capturePhoto()
      if (!blob) throw new Error('Failed to capture photo')

      // Get current location for this photo
      const location = await geolocation.getCurrentLocation()
      
      const tenantId = visitStore.tenantId || '00000000-0000-0000-0000-000000000001'
      
      // Add to sync queue
      const sequence = photoCount
      const timestamp = Date.now()
      const path = `${tenantId}/${visitId}/photos/photo_${sequence}_${timestamp}.jpg`
      
      await syncStore.addToQueue({
        visitId: visitId!,
        type: 'photo',
        blob,
        path,
        sequence,
        metadata: {
          size: blob.size
        }
      })
      
      // Store location separately in visit store if needed
      if (location) {
        console.log('Photo captured with location:', {
          lat: location.latitude,
          lng: location.longitude,
          accuracy: location.accuracy
        })
      }

      setPhotoCount(photoCount + 1)
      console.log(`Photo ${sequence} captured and queued`)

      // Quick flash effect (only 50ms)
      const flash = document.createElement('div')
      flash.className = 'fixed inset-0 bg-white z-[60] pointer-events-none animate-flash'
      document.body.appendChild(flash)
      setTimeout(() => flash.remove(), 50)

    } catch (error) {
      console.error('Capture error:', error)
      alert('Failed to capture photo')
    } finally {
      setIsCapturing(false)
    }
  }

  // Toggle recording
  const handleRecordToggle = async () => {
    try {
      if (audio.isRecording) {
        await audio.stopRecording()
      } else {
        await audio.startRecording()
      }
    } catch (error) {
      console.error('Recording error:', error)
      alert('Recording failed. Please check microphone permissions.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Capture Site Data</h1>
        <button
          onClick={() => {
            console.log('Navigating to finalize screen for visit:', visitId)
            navigate(`/finalize/${visitId}`)
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Finish Visit
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('photos')}
              className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'photos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Photos ({photoCount})
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'audio'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Audio Notes {audio.isRecording && '🔴'}
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'photos' ? (
            isCameraOpen ? (
              // Full screen camera view with overlay controls
              <div className="fixed inset-0 z-50 bg-black">
                {/* Camera preview container - full screen */}
                <div id="camera-preview" className="absolute inset-0">
                  <video
                    ref={camera.videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                </div>
                
                {/* Top overlay - header with close button */}
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 safe-top">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleCloseCamera}
                      className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white"
                      aria-label="Close camera"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
                      <span className="text-white text-sm font-medium">{photoCount} photos</span>
                    </div>
                  </div>
                </div>
                
                {/* Bottom overlay - capture controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 safe-bottom">
                  <div className="flex items-center justify-center gap-8">
                    {/* Gallery button (placeholder) */}
                    <div className="w-12 h-12" />
                    
                    {/* Capture button - big and centered */}
                    <button
                      onClick={handleCapturePhoto}
                      disabled={isCapturing}
                      className="relative"
                      aria-label="Take photo"
                    >
                      <div className={`w-20 h-20 rounded-full border-4 border-white ${isCapturing ? 'bg-white/50' : 'bg-white/20'} backdrop-blur-sm transition-all`}>
                        <div className={`absolute inset-2 rounded-full bg-white ${isCapturing ? 'scale-75' : ''} transition-transform`} />
                      </div>
                    </button>
                    
                    {/* Flip camera button */}
                    <button
                      onClick={() => camera.flipCamera()}
                      className="w-12 h-12 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-full text-white"
                      aria-label="Flip camera"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // Camera placeholder
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="mb-4">
                  {camera.error || 'Camera capture will appear here'}
                </p>
                <button 
                  onClick={handleOpenCamera}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Open Camera
                </button>
                {photoCount > 0 && (
                  <p className="mt-4 text-sm text-green-600">
                    {photoCount} photo{photoCount !== 1 ? 's' : ''} captured
                  </p>
                )}
              </div>
            )
          ) : (
            // Audio tab
            <div className="text-center py-12 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <p className="mb-4">
                {audio.error || (audio.isRecording ? `Recording: ${audio.duration}s` : 'Ready to record audio')}
              </p>
              <button 
                onClick={handleRecordToggle}
                className={`px-6 py-3 rounded-lg text-white transition-colors ${
                  audio.isRecording 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {audio.isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}