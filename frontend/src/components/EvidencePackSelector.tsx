import { EVIDENCE_PACKS } from '../stores/visitStore'

interface Props {
  onSelect: (packId: string) => void
}

export default function EvidencePackSelector({ onSelect }: Props) {
  const packIcons = {
    roofing: {
      icon: '🏠',
      bgColor: 'bg-orange-100',
      iconColor: 'text-orange-600',
      borderHover: 'hover:border-orange-300'
    },
    electrical: {
      icon: '⚡',
      bgColor: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      borderHover: 'hover:border-yellow-300'
    },
    plumbing: {
      icon: '🔧',
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
      borderHover: 'hover:border-blue-300'
    },
    hvac: {
      icon: '❄️',
      bgColor: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      borderHover: 'hover:border-cyan-300'
    },
    general: {
      icon: '📋',
      bgColor: 'bg-neutral-100',
      iconColor: 'text-neutral-600',
      borderHover: 'hover:border-neutral-300'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-4 pt-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-neutral-900 mb-3">
            Choose Your Inspection Type
          </h1>
          <p className="text-lg text-neutral-600 max-w-md mx-auto">
            Select a guided workflow to ensure complete and accurate capture
          </p>
        </div>

        {/* Evidence Pack Cards */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {EVIDENCE_PACKS.map((pack) => {
            const style = packIcons[pack.category as keyof typeof packIcons] || packIcons.general
            const requiredCount = pack.checklist.filter(i => i.required).length
            const optionalCount = pack.checklist.filter(i => !i.required).length
            
            return (
              <button
                key={pack.id}
                onClick={() => onSelect(pack.id)}
                className={`group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 text-left border-2 border-transparent ${style.borderHover}`}
              >
                {/* Popular Badge */}
                {pack.category === 'roofing' && (
                  <div className="absolute -top-3 right-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-14 h-14 ${style.bgColor} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <span className="text-3xl">{style.icon}</span>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-neutral-900 mb-2 group-hover:text-emerald-600 transition-colors">
                      {pack.name}
                    </h3>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-neutral-700">{requiredCount} required</span>
                      </div>
                      {optionalCount > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 bg-neutral-100 rounded-full flex items-center justify-center">
                            <span className="text-xs text-neutral-500">+</span>
                          </div>
                          <span className="text-sm text-neutral-500">{optionalCount} optional</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Sample Items */}
                    <div className="flex flex-wrap gap-1.5">
                      {pack.checklist.slice(0, 3).map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center px-2.5 py-1 bg-neutral-50 text-neutral-600 text-xs rounded-full border border-neutral-200"
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${item.required ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                          {item.label}
                        </span>
                      ))}
                      {pack.checklist.length > 3 && (
                        <span className="inline-flex items-center px-2.5 py-1 text-neutral-500 text-xs font-medium">
                          +{pack.checklist.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <div className="flex items-center pt-2">
                    <div className="w-8 h-8 rounded-full bg-neutral-50 group-hover:bg-emerald-50 flex items-center justify-center transition-all">
                      <svg
                        className="w-4 h-4 text-neutral-400 group-hover:text-emerald-600 transition-colors transform group-hover:translate-x-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gradient-to-br from-emerald-50 via-white to-blue-50 px-4 text-sm text-neutral-500 font-medium">
              Need something quick?
            </span>
          </div>
        </div>
        
        {/* Quick Start Button */}
        <button
          onClick={() => onSelect('general_v1')}
          className="w-full py-5 bg-white border-2 border-dashed border-neutral-300 rounded-2xl hover:border-emerald-400 hover:bg-emerald-50/50 transition-all duration-200 group"
        >
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-neutral-100 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center transition-colors">
              <svg className="w-5 h-5 text-neutral-600 group-hover:text-emerald-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="font-semibold text-neutral-900 group-hover:text-emerald-600 transition-colors">
                Quick Start - General Inspection
              </div>
              <div className="text-sm text-neutral-500">
                Flexible capture without a specific checklist
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}