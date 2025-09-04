import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVisitStore } from '../stores/visitStore'
import { useSyncStore } from '../stores/syncStore'
import { recordConsent, finalizeVisit } from '../lib/api'
import { Geolocation } from '@capacitor/geolocation'

export default function ReviewScreen() {
  const navigate = useNavigate()
  const visitStore = useVisitStore()
  const syncStore = useSyncStore()
  
  const [consentGiven, setConsentGiven] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFinalize = async () => {
    if (!visitStore.visitId) return
    
    setIsSubmitting(true)
    try {
      // Get geolocation if available
      let geotag = null
      try {
        const position = await Geolocation.getCurrentPosition()
        geotag = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        }
      } catch (err) {
        console.log('Geolocation not available:', err)
      }

      // Record consent if provided
      if (consentGiven && customerName) {
        await recordConsent(
          visitStore.visitId,
          'I consent to the inspection and estimate of my property.',
          customerName,
          geotag || undefined
        )
      }

      // Finalize visit
      await finalizeVisit(visitStore.visitId)

      // Navigate to estimate view
      navigate(`/estimate/${visitStore.visitId}`)
      
    } catch (error) {
      console.error('Failed to finalize visit:', error)
      alert('Failed to submit. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const completedRequired = visitStore.checklist.filter(i => i.required && i.completed).length
  const totalRequired = visitStore.checklist.filter(i => i.required).length
  const isComplete = completedRequired === totalRequired

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Review Visit
        </h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-3xl mb-1">📷</div>
            <div className="text-2xl font-bold text-gray-900">
              {visitStore.mediaCount}
            </div>
            <div className="text-sm text-gray-600">Photos captured</div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-3xl mb-1">🎙️</div>
            <div className="text-2xl font-bold text-gray-900">
              {visitStore.audioChunks.length}
            </div>
            <div className="text-sm text-gray-600">Audio chunks</div>
          </div>
        </div>

        {/* Checklist Completion */}
        <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">
            Checklist Completion
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Required items</span>
              <span className={`text-sm font-medium ${
                isComplete ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {completedRequired} / {totalRequired}
              </span>
            </div>
            {!isComplete && (
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Some required photos are missing. The estimate may be less accurate.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sync Status */}
        <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">
            Upload Status
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Items in queue</span>
              <span className="text-sm font-medium">
                {syncStore.queue.length}
              </span>
            </div>
            {syncStore.queue.length > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  {syncStore.isOnline 
                    ? '📡 Items will upload in the background'
                    : '📵 Items will upload when connection is restored'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Consent Section */}
        <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">
            Customer Consent
          </h2>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 rounded"
            />
            <div className="flex-1">
              <p className="text-sm text-gray-700">
                Customer consents to property inspection and estimate
              </p>
            </div>
          </label>
          
          {consentGiven && (
            <div className="mt-3">
              <input
                type="text"
                placeholder="Customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Back to Capture
          </button>
          
          <button
            onClick={handleFinalize}
            disabled={isSubmitting || (!isComplete && !window.confirm('Some required photos are missing. Continue anyway?'))}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Finish Visit'}
          </button>
        </div>
      </div>
    </div>
  )
}