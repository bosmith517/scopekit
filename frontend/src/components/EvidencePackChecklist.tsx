import { useState } from 'react'
import { useVisitStore, ChecklistItem } from '../stores/visitStore'

export default function EvidencePackChecklist() {
  const { checklist, markItemComplete, evidencePack } = useVisitStore()
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  
  if (!checklist || checklist.length === 0) {
    return null
  }

  const completedCount = checklist.filter(item => item.completed).length
  const totalCount = checklist.length
  const requiredCount = checklist.filter(item => item.required).length
  const requiredCompleted = checklist.filter(item => item.required && item.completed).length
  const progress = (completedCount / totalCount) * 100

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">
            {evidencePack?.name || 'Evidence Checklist'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {requiredCompleted}/{requiredCount} required • {completedCount}/{totalCount} total
          </p>
        </div>
        <span className={`text-sm font-medium ${progress === 100 ? 'text-green-600' : 'text-gray-600'}`}>
          {Math.round(progress)}%
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${
            progress === 100 ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2">
        {checklist.map((item: ChecklistItem) => {
          const isExpanded = expandedItems.includes(item.id)
          
          return (
            <div 
              key={item.id}
              className={`rounded-lg border transition-all ${
                item.completed 
                  ? 'bg-green-50 border-green-200' 
                  : item.required
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center p-3">
                <input
                  type="checkbox"
                  id={`check-${item.id}`}
                  checked={item.completed}
                  onChange={() => markItemComplete(item.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label 
                  htmlFor={`check-${item.id}`}
                  className="flex-1 ml-3 cursor-pointer"
                >
                  <p className={`font-medium ${
                    item.completed ? 'text-green-800 line-through' : 'text-gray-900'
                  }`}>
                    {item.label}
                    {item.required && <span className="text-red-500 ml-1">*</span>}
                  </p>
                </label>
                <button
                  onClick={() => toggleExpanded(item.id)}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  <svg 
                    className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {isExpanded && item.helpText && (
                <div className="px-3 pb-3 pl-10">
                  <p className="text-sm text-gray-600">{item.helpText}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {progress === 100 && (
        <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
          <p className="text-sm text-green-800 font-medium flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            All evidence captured! Ready to finalize.
          </p>
        </div>
      )}
    </div>
  )
}