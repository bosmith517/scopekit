import { ChecklistItem } from '../stores/visitStore'

interface Props {
  checklist: ChecklistItem[]
  onClose: () => void
}

export default function ChecklistOverlay({ checklist, onClose }: Props) {
  const requiredItems = checklist.filter(i => i.required)
  const optionalItems = checklist.filter(i => !i.required)
  const completedCount = checklist.filter(i => i.completed).length
  const progress = (completedCount / checklist.length) * 100

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-40">
      <div className="h-full overflow-y-auto">
        <div className="min-h-full p-4">
          <div className="max-w-md mx-auto bg-white rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-white text-lg font-semibold">
                  Capture Checklist
                </h2>
                <button
                  onClick={onClose}
                  className="text-white/80 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Progress Bar */}
              <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-white h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-white/90 text-sm mt-2">
                {completedCount} of {checklist.length} completed
              </p>
            </div>

            {/* Required Items */}
            {requiredItems.length > 0 && (
              <div className="p-4 border-b">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Required Photos
                </h3>
                <div className="space-y-2">
                  {requiredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                        item.completed ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="mt-0.5">
                        {item.completed ? (
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${
                          item.completed ? 'text-gray-600 line-through' : 'text-gray-900'
                        }`}>
                          {item.label}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {item.helpText}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Items */}
            {optionalItems.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Optional Photos
                </h3>
                <div className="space-y-2">
                  {optionalItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                        item.completed ? 'bg-blue-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="mt-0.5">
                        {item.completed ? (
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-5 h-5 border-2 border-gray-300 border-dashed rounded-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${
                          item.completed ? 'text-gray-600' : 'text-gray-700'
                        }`}>
                          {item.label}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {item.helpText}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="p-4 bg-gray-50">
              <button
                onClick={onClose}
                className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Continue Capturing
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}