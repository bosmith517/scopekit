import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface SendForApprovalProps {
  estimateId: string
  onSent?: (approval: any) => void
  onCancel?: () => void
}

export default function SendForApproval({ estimateId, onSent, onCancel }: SendForApprovalProps) {
  const [approverName, setApproverName] = useState('')
  const [approverEmail, setApproverEmail] = useState('')
  const [approverPhone, setApproverPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!approverName || !approverEmail) {
      setError('Name and email are required')
      return
    }

    setSending(true)
    setError('')

    try {
      // Call the RPC to send for approval
      const { data, error: rpcError } = await supabase
        .rpc('send_estimate_for_approval', {
          p_estimate_id: estimateId,
          p_approver_name: approverName,
          p_approver_email: approverEmail,
          p_approver_phone: approverPhone || null
        })

      if (rpcError) throw rpcError

      // Generate the approval link
      const approvalLink = `${window.location.origin}/approve/${data.token}`
      
      // For now, show the link (in production, this would be sent via email)
      console.log('Approval link:', approvalLink)
      
      // Trigger callback
      if (onSent) {
        onSent({
          ...data,
          approvalLink
        })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send for approval')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Send for Approval</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label htmlFor="approverName" className="block text-sm font-medium text-gray-700 mb-1">
              Client Name *
            </label>
            <input
              id="approverName"
              type="text"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Jane Smith"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="approverEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Client Email *
            </label>
            <input
              id="approverEmail"
              type="email"
              value={approverEmail}
              onChange={(e) => setApproverEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="jane@example.com"
            />
          </div>

          <div>
            <label htmlFor="approverPhone" className="block text-sm font-medium text-gray-700 mb-1">
              Client Phone (Optional)
            </label>
            <input
              id="approverPhone"
              type="tel"
              value={approverPhone}
              onChange={(e) => setApproverPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              The client will receive an email with a secure link to review and approve this estimate. 
              The link expires in 7 days or after 10 views.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              disabled={sending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                sending
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {sending ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </span>
              ) : (
                'Send for Approval'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}