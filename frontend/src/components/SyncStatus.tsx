import { useEffect } from 'react'
import { useSyncStore } from '../stores/syncStore'

export default function SyncStatus() {
  const { queue, isSyncing, uploadProgress, processQueue } = useSyncStore()

  useEffect(() => {
    // Process queue periodically
    const interval = setInterval(() => {
      if (queue.length > 0 && navigator.onLine) {
        processQueue()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [queue, processQueue])

  if (queue.length === 0 && !isSyncing) return null

  const totalItems = queue.length
  const uploadingItems = Object.keys(uploadProgress).length

  return (
    <div className="fixed bottom-20 right-4 lg:bottom-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm z-40">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Sync Status</h3>
        <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}`} />
      </div>
      
      {totalItems > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-600">
            {totalItems} item{totalItems > 1 ? 's' : ''} in queue
          </p>
          
          {uploadingItems > 0 && (
            <div className="space-y-1">
              {Object.entries(uploadProgress).map(([id, progress]) => (
                <div key={id} className="bg-gray-50 rounded p-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600 truncate max-w-[200px]">
                      {queue.find(item => item.id === id)?.type || 'Uploading'}
                    </span>
                    <span className="text-gray-900 font-medium">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {isSyncing && uploadingItems === 0 && (
        <p className="text-xs text-gray-600">Processing queue...</p>
      )}
    </div>
  )
}