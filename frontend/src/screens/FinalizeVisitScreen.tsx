import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useVisitStore } from '../stores/visitStore'
import { aiEstimation } from '../services/aiEstimation'
import { supabase } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export default function FinalizeVisitScreen() {
  const { visitId } = useParams()
  const navigate = useNavigate()
  const { visits } = useVisitStore()
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<'ready' | 'processing' | 'completed' | 'error'>('ready')
  const [estimate, setEstimate] = useState<any>(null)
  const [error, setError] = useState<string>('')
  
  const visit = visits.find(v => v.id === visitId)
  
  useEffect(() => {
    if (!visit) {
      navigate('/visits')
    }
  }, [visit, navigate])
  
  const handleFinalize = async () => {
    if (!visitId) return
    
    setProcessing(true)
    setStatus('processing')
    setError('')
    
    // Haptic feedback on native
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium })
    }
    
    try {
      // 1. Update visit status to finalized
      const { error: updateError } = await supabase
        .from('site_visits')
        .update({
          status: 'finalized',
          finished_at: new Date().toISOString()
        })
        .eq('id', visitId)
      
      if (updateError) throw updateError
      
      // 2. Trigger AI estimation
      const job = await aiEstimation.triggerEstimation(visitId)
      
      console.log('[Finalize] AI job created:', job.id)
      
      // 3. Wait for estimation (with timeout)
      let attempts = 0
      const maxAttempts = 60 // 60 seconds max
      
      const checkInterval = setInterval(async () => {
        attempts++
        
        // Check for local estimate
        const localEstimate = await aiEstimation.getLocalEstimate(visitId)
        
        if (localEstimate) {
          clearInterval(checkInterval)
          setEstimate(localEstimate)
          setStatus('completed')
          setProcessing(false)
          
          // Success haptic
          if (Capacitor.isNativePlatform()) {
            await Haptics.impact({ style: ImpactStyle.Heavy })
          }
          
          // Navigate to review after short delay
          setTimeout(() => {
            navigate(`/review/${visitId}`)
          }, 1500)
          
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval)
          setStatus('completed')
          setProcessing(false)
          
          // Navigate to review anyway - estimate will load async
          navigate(`/review/${visitId}`)
        }
      }, 1000)
      
    } catch (err) {
      console.error('[Finalize] Error:', err)
      setError(String(err))
      setStatus('error')
      setProcessing(false)
      
      // Error haptic
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light })
      }
    }
  }
  
  const getStatusMessage = () => {
    switch (status) {
      case 'processing':
        return 'Processing your visit data...'
      case 'completed':
        return 'AI estimation complete!'
      case 'error':
        return error || 'An error occurred'
      default:
        return 'Ready to finalize visit'
    }
  }
  
  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-blue-600'
      case 'completed':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Finalize Visit</h1>
          
          {visit && (
            <div className="space-y-4 mb-8">
              <div>
                <p className="text-sm text-gray-500">Customer</p>
                <p className="font-medium">{visit.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">{visit.property_address}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Evidence Pack</p>
                <p className="font-medium capitalize">
                  {visit.evidence_pack?.replace('_', ' ') || 'Standard'}
                </p>
              </div>
            </div>
          )}
          
          {/* Status indicator */}
          <div className="mb-8">
            <div className={`text-center p-4 rounded-lg bg-gray-50 ${getStatusColor()}`}>
              {status === 'processing' && (
                <div className="flex justify-center mb-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
              {status === 'completed' && (
                <svg className="w-8 h-8 mx-auto mb-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className="font-medium">{getStatusMessage()}</p>
            </div>
          </div>
          
          {/* Estimate preview if available */}
          {estimate && (
            <div className="mb-8 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Draft Estimate Ready</h3>
              <p className="text-blue-700">
                Total: ${estimate.total_amount?.toFixed(2) || '0.00'}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                {estimate.line_items?.length || 0} line items
              </p>
              {estimate.metadata?.confidence_score && (
                <div className="mt-2">
                  <p className="text-sm text-blue-600">
                    Confidence: {(estimate.metadata.confidence_score * 100).toFixed(0)}%
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/capture/${visitId}`)}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              disabled={processing}
            >
              Back to Capture
            </button>
            
            <button
              onClick={handleFinalize}
              className={`flex-1 px-4 py-3 rounded-lg font-medium ${
                processing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              disabled={processing || status === 'completed'}
            >
              {processing ? 'Processing...' : 'Finalize & Generate Estimate'}
            </button>
          </div>
          
          {/* Offline notice */}
          {!navigator.onLine && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Offline Mode:</span> Visit will be queued and processed when connection is restored.
              </p>
            </div>
          )}
        </div>
        
        {/* Progress details */}
        {status === 'processing' && (
          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-3">Processing Steps:</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span>Visit data uploaded</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></div>
                <span>AI analyzing photos...</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-300"></div>
                <span>Generating estimate</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}