import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVisitStatus, createShareToken, buildShareUrl } from '../lib/api'
import { useVisitStore } from '../stores/visitStore'
import SendForApproval from '../components/SendForApproval'

export default function EstimateScreen() {
  const { visitId } = useParams<{ visitId: string }>()
  const navigate = useNavigate()
  const visitStore = useVisitStore()
  
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState<any>(null)

  useEffect(() => {
    if (!visitId) return
    
    const checkStatus = async () => {
      try {
        const result = await getVisitStatus(visitId)
        setStatus(result)
        
        // If processing complete, stop polling
        if (result.estimate_id || result.visit_status === 'failed') {
          setLoading(false)
        }
      } catch (error) {
        console.error('Failed to get status:', error)
        setLoading(false)
      }
    }

    // Initial check
    checkStatus()

    // Poll every 5 seconds while processing
    const interval = setInterval(() => {
      if (loading) {
        checkStatus()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [visitId, loading])

  const handleShare = async () => {
    if (!status?.estimate_id) return
    
    try {
      const token = await createShareToken(status.estimate_id)
      const url = buildShareUrl(token)
      setShareUrl(url)
      
      // Copy to clipboard
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to create share link:', error)
    }
  }

  const handleNewVisit = () => {
    visitStore.reset()
    navigate('/')
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading visit status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Visit Status
        </h1>

        {/* Status Card */}
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Visit Status</p>
              <p className="text-lg font-semibold capitalize">
                {status.visit_status}
              </p>
            </div>
            <div className={`w-3 h-3 rounded-full ${
              status.visit_status === 'completed' ? 'bg-green-500' :
              status.visit_status === 'failed' ? 'bg-red-500' :
              'bg-yellow-500 animate-pulse'
            }`} />
          </div>

          {status.ai_status && (
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-1">AI Processing</p>
              <p className="text-lg font-semibold capitalize">
                {status.ai_status}
              </p>
              {status.processing_time_ms && (
                <p className="text-sm text-gray-500 mt-1">
                  Processed in {(status.processing_time_ms / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div>
              <p className="text-sm text-gray-600">Media Count</p>
              <p className="text-lg font-semibold">{status.media_count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Consent</p>
              <p className="text-lg font-semibold">
                {status.consent_status ? '✅ Recorded' : '❌ Not provided'}
              </p>
            </div>
          </div>
        </div>

        {/* Processing Animation */}
        {status.ai_status === 'running' && (
          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="font-semibold text-blue-900">
                  AI is processing your visit...
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  This typically takes 30-60 seconds
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Estimate Ready */}
        {status.estimate_id && (
          <div className="bg-green-50 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-green-900">
                  Estimate Ready!
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Your AI-generated estimate is complete
                </p>
              </div>
            </div>

            {shareUrl && (
              <div className="bg-white rounded-lg p-3 mb-3">
                <p className="text-xs text-gray-600 mb-1">Share Link (expires in 10 min)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-2 py-1 bg-gray-50 rounded text-sm"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(shareUrl)}
                    className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                  >
                    {copied ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleShare}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                {shareUrl ? 'New Link' : 'Share'}
              </button>
              <button
                onClick={() => setShowApprovalModal(true)}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Send for Approval
              </button>
            </div>
          </div>
        )}

        {/* Failed */}
        {status.visit_status === 'failed' && (
          <div className="bg-red-50 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-red-900">
                  Processing Failed
                </p>
                <p className="text-sm text-red-700 mt-1">
                  There was an error processing your visit. Please try again.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Approval Status */}
        {approvalStatus && (
          <div className={`rounded-lg p-6 mb-6 ${
            approvalStatus.status === 'approved' ? 'bg-green-50' :
            approvalStatus.status === 'declined' ? 'bg-red-50' :
            'bg-yellow-50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  {approvalStatus.status === 'approved' ? 'Approved by Client' :
                   approvalStatus.status === 'declined' ? 'Declined by Client' :
                   'Awaiting Client Approval'}
                </p>
                <p className="text-sm mt-1 opacity-75">
                  {approvalStatus.approver_name} • {approvalStatus.approver_email}
                </p>
              </div>
              {approvalStatus.status === 'pending' && (
                <span className="text-sm opacity-75">
                  Views: {approvalStatus.view_count}/10
                </span>
              )}
            </div>
            {approvalStatus.decline_reason && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm font-medium">Reason:</p>
                <p className="text-sm mt-1">{approvalStatus.decline_reason}</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <button
          onClick={handleNewVisit}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Start New Visit
        </button>
      </div>

      {/* Send for Approval Modal */}
      {showApprovalModal && status?.estimate_id && (
        <SendForApproval
          estimateId={status.estimate_id}
          onSent={(approval) => {
            setApprovalStatus(approval)
            setShowApprovalModal(false)
            // Show success message
            alert(`Approval request sent to ${approval.approver_email}`)
          }}
          onCancel={() => setShowApprovalModal(false)}
        />
      )}
    </div>
  )
}