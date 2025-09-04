import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVisitStore } from '../stores/visitStore'
import { supabase } from '../lib/supabase'

export default function HistoryScreen() {
  const navigate = useNavigate()
  const { tenantId } = useVisitStore()
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'draft' | 'processing' | 'completed'>('all')

  useEffect(() => {
    loadVisits()
  }, [filter])

  const loadVisits = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('site_visits')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query
      
      if (error) throw error
      setVisits(data || [])
    } catch (error) {
      console.error('Error loading visits:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-yellow-100 text-yellow-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleVisitClick = (visit: any) => {
    if (visit.status === 'completed' && visit.estimate_id) {
      navigate(`/estimate/${visit.estimate_id}`)
    } else if (visit.status === 'processing') {
      navigate(`/processing/${visit.id}`)
    } else {
      navigate(`/capture/${visit.id}`)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Visit History</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage your past site visits
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'draft', 'processing', 'completed'] as const).map((filterOption) => (
          <button
            key={filterOption}
            onClick={() => setFilter(filterOption)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === filterOption
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
          </button>
        ))}
      </div>

      {/* Visits List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading visits...</p>
          </div>
        </div>
      ) : visits.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600 mb-4">No visits found</p>
            <button
              onClick={() => navigate('/new-visit')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Start Your First Visit
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {visits.map((visit) => (
              <div
                key={visit.id}
                onClick={() => handleVisitClick(visit)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {visit.evidence_pack?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'General Inspection'}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(visit.status)}`}>
                        {visit.status || 'draft'}
                      </span>
                    </div>
                    
                    {visit.customer_name && (
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Customer:</span> {visit.customer_name}
                      </p>
                    )}
                    
                    {visit.property_address && (
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Address:</span> {visit.property_address}
                      </p>
                    )}
                    
                    <p className="text-sm text-gray-500">
                      {new Date(visit.created_at).toLocaleDateString()} at {new Date(visit.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  
                  <svg className="w-5 h-5 text-gray-400 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}