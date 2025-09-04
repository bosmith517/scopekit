import { useState } from 'react'
import { recordConsent } from '../lib/api'

interface Props {
  visitId: string
  onAccept: () => void
  onDecline: () => void
}

export default function ConsentModal({ visitId, onAccept, onDecline }: Props) {
  const [acceptedBy, setAcceptedBy] = useState('')
  const [isAccepted, setIsAccepted] = useState(false)
  const [allowPhotos, setAllowPhotos] = useState(true)
  const [allowAudio, setAllowAudio] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const handleAccept = async () => {
    if (!isAccepted || !acceptedBy.trim()) return
    
    setIsLoading(true)
    try {
      // Get geolocation if available
      let geotag = undefined
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        })
        geotag = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        }
      } catch (err) {
        console.log('Geolocation not available')
      }

      const consentText = `I, ${acceptedBy}, consent to ScopeKit capturing ${
        allowPhotos && allowAudio ? 'photos and audio' : 
        allowPhotos ? 'photos only' : 
        allowAudio ? 'audio only' : 'evidence'
      } for the purpose of creating an estimate for property inspection services.`
      
      await recordConsent(visitId, consentText, acceptedBy, geotag)
      onAccept()
    } catch (error) {
      console.error('Failed to record consent:', error)
      alert('Failed to record consent. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">Recording Consent Required</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div className="text-sm text-neutral-600 space-y-2">
            <p>
              To proceed with this inspection, we need your consent to capture photos and audio recordings 
              that will be used to create an accurate estimate.
            </p>
            <p>
              Your data will be processed securely and used only for the purposes of this inspection and estimate.
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={allowPhotos}
                onChange={(e) => setAllowPhotos(e.target.checked)}
                className="w-5 h-5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-neutral-900">Allow photo capture</span>
            </label>
            
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={allowAudio}
                onChange={(e) => setAllowAudio(e.target.checked)}
                className="w-5 h-5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-neutral-900">Allow audio recording</span>
            </label>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Your Name (required)
            </label>
            <input
              type="text"
              value={acceptedBy}
              onChange={(e) => setAcceptedBy(e.target.value)}
              placeholder="Enter your full name"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Agreement Checkbox */}
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={isAccepted}
              onChange={(e) => setIsAccepted(e.target.checked)}
              className="w-5 h-5 mt-0.5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-neutral-600">
              I understand and agree to the capture and processing of inspection data as described above.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-neutral-50 rounded-b-2xl flex items-center justify-end gap-3">
          <button
            onClick={onDecline}
            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={!isAccepted || !acceptedBy.trim() || (!allowPhotos && !allowAudio) || isLoading}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              isAccepted && acceptedBy.trim() && (allowPhotos || allowAudio) && !isLoading
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? 'Recording...' : 'I Agree & Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}