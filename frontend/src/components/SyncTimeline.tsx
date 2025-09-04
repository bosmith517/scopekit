import { useSyncStore } from '../stores/syncStore'
import { useVisitStore } from '../stores/visitStore'

export default function SyncTimeline() {
  const syncStore = useSyncStore()
  const visitStore = useVisitStore()
  
  const { queue, isOnline, isSyncing, uploadProgress } = syncStore
  const queuedCount = queue.length
  const uploadingCount = Object.keys(uploadProgress).length
  
  if (!visitStore.visitId) return null

  const getStatusColor = () => {
    if (!isOnline) return 'bg-gray-500'
    if (isSyncing) return 'bg-blue-500 animate-pulse'
    if (queuedCount === 0) return 'bg-green-500'
    return 'bg-yellow-500'
  }

  const getStatusText = () => {
    if (!isOnline) return 'Offline - Will sync when connected'
    if (isSyncing) return `Syncing ${uploadingCount} items...`
    if (queuedCount === 0) return 'All synced'
    return `${queuedCount} items queued`
  }

  // Calculate overall progress
  const totalProgress = Object.values(uploadProgress).reduce((sum, p) => sum + p, 0)
  const avgProgress = uploadingCount > 0 ? totalProgress / uploadingCount : 0

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Status Indicator */}
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span className="text-sm text-gray-700">{getStatusText()}</span>
        </div>

        {/* Progress Bar (when syncing) */}
        {isSyncing && avgProgress > 0 && (
          <div className="flex-1 max-w-xs">
            <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${avgProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="text-xs text-gray-500">
              📵 No connection
            </span>
          )}
          
          {isOnline && queuedCount > 0 && !isSyncing && (
            <button
              onClick={() => syncStore.processQueue()}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Sync Now
            </button>
          )}
        </div>
      </div>

      {/* Queue Details (collapsible) */}
      {queuedCount > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-gray-500 cursor-pointer">
            Queue details
          </summary>
          <div className="mt-2 space-y-1">
            {queue.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  {item.type === 'photo' ? '📷' : item.type === 'audio' ? '🎙️' : '🤖'} {item.path ? item.path.split('/').pop() : 'AI Job'}
                </span>
                {uploadProgress[item.id] !== undefined && (
                  <span className="text-gray-500">{uploadProgress[item.id]}%</span>
                )}
              </div>
            ))}
            {queue.length > 5 && (
              <div className="text-xs text-gray-400">
                +{queue.length - 5} more items
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  )
}