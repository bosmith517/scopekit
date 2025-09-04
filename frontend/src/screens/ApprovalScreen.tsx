import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Approval {
  id: string
  estimate_id: string
  status: string
  approver_name: string
  approver_email: string
  view_count: number
  expires_at: string
}

interface Estimate {
  id: string
  total_amount: number
  estimate_lines?: any[]
  line_items?: any[]
  metadata: any
  site_visits?: {
    customer_name: string
    property_address?: string
    street_address?: string
    city?: string
    state?: string
    zip?: string
  }
}

export default function ApprovalScreen() {
  const { token } = useParams<{ token: string }>()
  const [approval, setApproval] = useState<Approval | null>(null)
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [decision, setDecision] = useState<'approve' | 'decline' | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [signature, setSignature] = useState('')
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn'>('typed')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)

  useEffect(() => {
    if (token) {
      loadApproval()
    }
  }, [token])

  const loadApproval = async () => {
    try {
      // Track view
      const { data: approvalData, error: trackError } = await supabase
        .rpc('track_approval_view', {
          p_token: token,
          p_ip: null, // Would be captured server-side
          p_user_agent: navigator.userAgent
        })

      if (trackError) throw trackError

      setApproval(approvalData)

      // Load estimate details
      const { data: estimateData, error: estimateError } = await supabase
        .from('estimates')
        .select(`
          *,
          estimate_lines(*),
          site_visits(
            customer_name,
            property_address,
            street_address,
            city,
            state,
            zip
          )
        `)
        .eq('id', approvalData.estimate_id)
        .single()

      if (estimateError) throw estimateError

      setEstimate(estimateData)
    } catch (err: any) {
      setError(err.message || 'Failed to load approval')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!decision || !token) return

    if (decision === 'decline' && !declineReason) {
      setError('Please provide a reason for declining')
      return
    }

    if (decision === 'approve' && signatureType === 'typed' && !signature) {
      setError('Please type your signature')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      let signatureData = null
      
      if (decision === 'approve') {
        if (signatureType === 'typed') {
          signatureData = signature
        } else if (signatureType === 'drawn' && canvasRef.current) {
          signatureData = canvasRef.current.toDataURL('image/png')
        }
      }

      const { error: decisionError } = await supabase
        .rpc('record_estimate_decision', {
          p_token: token,
          p_decision: decision === 'approve' ? 'approved' : 'declined',
          p_signature_data: signatureData,
          p_signature_type: decision === 'approve' ? signatureType : 'none',
          p_decline_reason: declineReason || null,
          p_ip: null,
          p_user_agent: navigator.userAgent
        })

      if (decisionError) throw decisionError

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Failed to submit decision')
      setSubmitting(false)
    }
  }

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return
    isDrawing.current = true
    
    const rect = canvasRef.current.getBoundingClientRect()
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    
    ctx.beginPath()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#000'
    
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    isDrawing.current = false
  }

  const clearCanvas = () => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading estimate...</p>
        </div>
      </div>
    )
  }

  if (error && !estimate) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-red-900 mb-2">Invalid or Expired Link</h2>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className={`${decision === 'approve' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-8`}>
            <svg className={`w-16 h-16 ${decision === 'approve' ? 'text-green-500' : 'text-yellow-500'} mx-auto mb-4`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={decision === 'approve' ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
            </svg>
            <h2 className={`text-2xl font-bold ${decision === 'approve' ? 'text-green-900' : 'text-yellow-900'} mb-2`}>
              {decision === 'approve' ? 'Estimate Approved!' : 'Estimate Declined'}
            </h2>
            <p className={`${decision === 'approve' ? 'text-green-700' : 'text-yellow-700'}`}>
              Your decision has been recorded and the contractor has been notified.
            </p>
            {decision === 'approve' && (
              <p className="mt-4 text-gray-600">
                The contractor will contact you shortly to schedule the work.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Estimate Approval Request</h1>
          <p className="text-gray-600">
            Review the estimate below from {estimate?.site_visits?.customer_name || 'your contractor'}
          </p>
          {approval && (
            <div className="mt-4 flex gap-4 text-sm text-gray-500">
              <span>For: {approval.approver_name}</span>
              <span>•</span>
              <span>Views: {approval.view_count}/10</span>
              <span>•</span>
              <span>Expires: {new Date(approval.expires_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Estimate Details */}
        {estimate && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Estimate Details</h2>
            
            {estimate.site_visits && (
              <div className="mb-4 text-sm text-gray-600">
                <p>Property: {estimate.site_visits.property_address || 
                  (estimate.site_visits.street_address ? 
                    `${estimate.site_visits.street_address}${estimate.site_visits.city ? `, ${estimate.site_visits.city}` : ''}${estimate.site_visits.state ? `, ${estimate.site_visits.state}` : ''}${estimate.site_visits.zip ? ` ${estimate.site_visits.zip}` : ''}` 
                    : 'Address not provided')}</p>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(estimate.estimate_lines || estimate.line_items)?.map((line: any) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 text-sm">{line.description}</td>
                      <td className="px-4 py-3 text-sm text-center">{line.quantity} {line.unit}</td>
                      <td className="px-4 py-3 text-sm text-right">${line.unit_price?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">${line.total_price?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold">Total:</td>
                    <td className="px-4 py-3 text-right font-bold text-lg">${estimate.total_amount?.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Decision Section */}
        {!decision && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Decision</h2>
            <div className="flex gap-4">
              <button
                onClick={() => setDecision('approve')}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Approve Estimate
              </button>
              <button
                onClick={() => setDecision('decline')}
                className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Decline Estimate
              </button>
            </div>
          </div>
        )}

        {/* Approval Form */}
        {decision === 'approve' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Signature Required</h3>
            
            <div className="mb-4">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSignatureType('typed')}
                  className={`px-4 py-2 rounded-lg ${signatureType === 'typed' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Type Signature
                </button>
                <button
                  onClick={() => setSignatureType('drawn')}
                  className={`px-4 py-2 rounded-lg ${signatureType === 'drawn' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Draw Signature
                </button>
              </div>

              {signatureType === 'typed' ? (
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Type your full name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-script"
                  style={{ fontFamily: 'cursive' }}
                />
              ) : (
                <div>
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="border border-gray-300 rounded-lg w-full"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  <button
                    onClick={clearCanvas}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    Clear Signature
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400"
            >
              {submitting ? 'Submitting...' : 'Submit Approval'}
            </button>
          </div>
        )}

        {/* Decline Form */}
        {decision === 'decline' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reason for Declining</h3>
            
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Please provide a reason for declining this estimate..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg h-32 resize-none"
              required
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setDecision(null)
                  setDeclineReason('')
                }}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !declineReason}
                className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:bg-gray-400"
              >
                {submitting ? 'Submitting...' : 'Submit Decline'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}