import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVisitStore, EVIDENCE_PACKS } from '../stores/visitStore'
import { createSiteVisit } from '../lib/api'

const evidencePacks = [
  {
    id: 'roofing_residential',
    name: 'Residential Roofing',
    icon: '🏠',
    description: 'Complete roofing inspection with shingle assessment',
    requiredPhotos: ['Front elevation', 'All roof slopes', 'Gutters', 'Damage areas'],
    estimatedTime: '10-15 min'
  },
  {
    id: 'electrical_service',
    name: 'Electrical Service',
    icon: '⚡',
    description: 'Electrical panel and service inspection',
    requiredPhotos: ['Main panel', 'Meter', 'Grounding', 'Service entrance'],
    estimatedTime: '8-12 min'
  },
  {
    id: 'plumbing_repair',
    name: 'Plumbing Repair',
    icon: '🔧',
    description: 'Plumbing fixtures and leak assessment',
    requiredPhotos: ['Problem area', 'Water heater', 'Main shutoff', 'Under sinks'],
    estimatedTime: '10-15 min'
  },
  {
    id: 'hvac_service',
    name: 'HVAC Service',
    icon: '❄️',
    description: 'Heating and cooling system inspection',
    requiredPhotos: ['Indoor unit', 'Outdoor unit', 'Thermostat', 'Filters'],
    estimatedTime: '8-10 min'
  },
  {
    id: 'general_inspection',
    name: 'General Inspection',
    icon: '📋',
    description: 'Flexible inspection for various needs',
    requiredPhotos: ['As needed'],
    estimatedTime: '5-20 min'
  }
]

export default function NewVisitScreen() {
  const navigate = useNavigate()
  const { setVisitId, startVisit } = useVisitStore()
  const [selectedPack, setSelectedPack] = useState<string>('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateVisit = async () => {
    if (!selectedPack) {
      alert('Please select an Evidence Pack')
      return
    }

    setIsCreating(true)
    try {
      const { data, error } = await createSiteVisit(
        selectedPack,
        undefined, // leadId
        {
          name: customerName || undefined,
          phone: customerPhone || undefined,
          email: customerEmail || undefined,
          address: propertyAddress || undefined
        }
      )
      
      if (error) throw error
      if (data) {
        setVisitId(data.id)
        
        // Find the matching Evidence Pack from the store
        let evidencePack = EVIDENCE_PACKS.find(pack => 
          pack.id.includes('roofing') && selectedPack.includes('roofing') ||
          pack.id.includes('electrical') && selectedPack.includes('electrical') ||
          pack.id.includes('plumbing') && selectedPack.includes('plumbing') ||
          pack.id.includes('hvac') && selectedPack.includes('hvac') ||
          pack.id.includes('general') && selectedPack.includes('general')
        )
        
        // Fallback to general if no match
        if (!evidencePack) {
          evidencePack = EVIDENCE_PACKS.find(pack => pack.id.includes('general'))!
        }
        
        // Initialize the visit with the Evidence Pack
        startVisit(data.id, evidencePack)
        
        navigate(`/capture/${data.id}`)
      }
    } catch (error) {
      console.error('Error creating visit:', error)
      alert('Failed to create visit. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">New Site Visit</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select an Evidence Pack and enter customer information
        </p>
      </div>

      {/* Evidence Pack Selection */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">1. Choose Evidence Pack</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {evidencePacks.map((pack) => (
            <button
              key={pack.id}
              onClick={() => setSelectedPack(pack.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedPack === pack.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start">
                <span className="text-2xl mr-3">{pack.icon}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{pack.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{pack.description}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {pack.requiredPhotos.length} photos
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {pack.estimatedTime}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Customer Information */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">2. Customer Information (Optional)</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Smith"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Address
            </label>
            <input
              type="text"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="123 Main St, City, State ZIP"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleCreateVisit}
          disabled={!selectedPack || isCreating}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
            selectedPack && !isCreating
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isCreating ? 'Creating...' : 'Start Capture'}
        </button>
      </div>
    </div>
  )
}