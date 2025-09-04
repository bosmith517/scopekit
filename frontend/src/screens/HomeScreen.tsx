import { useNavigate } from 'react-router-dom'
import { useVisitStore } from '../stores/visitStore'
import { useSyncStore } from '../stores/syncStore'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function HomeScreen() {
  const navigate = useNavigate()
  const { visitId, tenantId } = useVisitStore()
  const { queue, isOnline } = useSyncStore()
  const [recentVisits, setRecentVisits] = useState<any[]>([])
  const [stats, setStats] = useState({
    todayVisits: 0,
    pendingEstimates: 0,
    completedEstimates: 0
  })

  useEffect(() => {
    loadRecentVisits()
    loadStats()
  }, [])

  const loadRecentVisits = async () => {
    try {
      const { data } = await supabase
        .from('site_visits')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (data) {
        setRecentVisits(data)
      }
    } catch (error) {
      console.error('Error loading visits:', error)
    }
  }

  const loadStats = async () => {
    try {
      // Get today's visits
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { data: todayData } = await supabase
        .from('site_visits')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .gte('created_at', today.toISOString())
      
      // Get pending estimates
      const { data: pendingData } = await supabase
        .from('site_visits')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('status', 'processing')
      
      // Get completed estimates
      const { data: completedData } = await supabase
        .from('estimates')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId)
      
      setStats({
        todayVisits: todayData?.length || 0,
        pendingEstimates: pendingData?.length || 0,
        completedEstimates: completedData?.length || 0
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome to ScopeKit</h1>
        <p className="mt-1 text-sm text-gray-500">
          Field data capture and estimate generation
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <button
          onClick={() => navigate('/new-visit')}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
            <div className="ml-4 text-left">
              <h3 className="text-lg font-semibold text-gray-900">New Site Visit</h3>
              <p className="text-sm text-gray-500">Start capturing field data</p>
            </div>
          </div>
        </button>

        {visitId && (
          <button
            onClick={() => navigate(`/capture/${visitId}`)}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 text-left">
                <h3 className="text-lg font-semibold text-gray-900">Continue Visit</h3>
                <p className="text-sm text-gray-500">Resume current capture</p>
              </div>
            </div>
          </button>
        )}

        <button
          onClick={() => navigate('/history')}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4 text-left">
              <h3 className="text-lg font-semibold text-gray-900">View History</h3>
              <p className="text-sm text-gray-500">Past visits and estimates</p>
            </div>
          </div>
        </button>
      </div>

      {/* Stats Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Overview</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.todayVisits}</p>
            <p className="text-sm text-gray-500">Site Visits</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-600">{stats.pendingEstimates}</p>
            <p className="text-sm text-gray-500">Processing</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{stats.completedEstimates}</p>
            <p className="text-sm text-gray-500">Completed</p>
          </div>
        </div>
      </div>

      {/* Sync Status */}
      {queue.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {queue.length} item{queue.length > 1 ? 's' : ''} pending sync
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                {isOnline ? 'Syncing in progress...' : 'Will sync when connection is restored'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Visits */}
      {recentVisits.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Visits</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentVisits.map((visit) => (
              <div key={visit.id} className="px-6 py-4 hover:bg-gray-50 cursor-pointer" onClick={() => {
                if (visit.status === 'completed') {
                  navigate(`/estimate/${visit.id}`)
                } else if (visit.status === 'processing') {
                  navigate(`/processing/${visit.id}`)
                } else {
                  navigate(`/capture/${visit.id}`)
                }
              }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {visit.evidence_pack || 'General Inspection'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(visit.created_at).toLocaleDateString()} at {new Date(visit.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      visit.status === 'completed' ? 'bg-green-100 text-green-800' :
                      visit.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {visit.status || 'draft'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}