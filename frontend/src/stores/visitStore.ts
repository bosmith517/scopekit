import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface EvidencePack {
  id: string
  name: string
  category: 'roofing' | 'electrical' | 'plumbing' | 'hvac' | 'general'
  checklist: ChecklistItem[]
}

export interface ChecklistItem {
  id: string
  label: string
  helpText: string
  required: boolean
  completed: boolean
  mediaId?: string
}

interface VisitStore {
  // Core state
  tenantId: string | null
  visitId: string | null
  currentVisitId: string | null
  visits: any[]
  evidencePack: EvidencePack | null
  checklist: ChecklistItem[]
  mediaCount: number
  audioChunks: string[]
  isRecording: boolean
  
  // Actions
  setTenant: (tenantId: string) => void
  setVisitId: (visitId: string) => void
  setEstimate: (visitId: string, estimate: any) => void
  startVisit: (visitId: string, pack: EvidencePack) => void
  markItemComplete: (itemId: string, mediaId?: string) => void
  addMedia: () => void
  addAudioChunk: (chunkId: string) => void
  setRecording: (isRecording: boolean) => void
  reset: () => void
}

export const useVisitStore = create<VisitStore>()(
  persist(
    (set) => ({
      // Initial state - with default tenant for testing
      tenantId: '00000000-0000-0000-0000-000000000001',
      visitId: null,
      currentVisitId: null,
      visits: [],
      evidencePack: null,
      checklist: [],
      mediaCount: 0,
      audioChunks: [],
      isRecording: false,

      // Actions
      setTenant: (tenantId) => set({ tenantId }),
      
      setVisitId: (visitId) => set({ currentVisitId: visitId }),
      
      setEstimate: (visitId, estimate) => set((state) => ({
        visits: state.visits.map((v: any) => 
          v.id === visitId ? { ...v, estimate } : v
        )
      })),
      
      startVisit: (visitId, pack) => set({
        visitId,
        evidencePack: pack,
        checklist: pack.checklist.map(item => ({ ...item, completed: false })),
        mediaCount: 0,
        audioChunks: []
      }),
      
      markItemComplete: (itemId, mediaId) => set((state) => ({
        checklist: state.checklist.map(item =>
          item.id === itemId
            ? { ...item, completed: true, mediaId }
            : item
        )
      })),
      
      addMedia: () => set((state) => ({
        mediaCount: state.mediaCount + 1
      })),
      
      addAudioChunk: (chunkId) => set((state) => ({
        audioChunks: [...state.audioChunks, chunkId]
      })),
      
      setRecording: (isRecording) => set({ isRecording }),
      
      reset: () => set({
        visitId: null,
        evidencePack: null,
        checklist: [],
        mediaCount: 0,
        audioChunks: [],
        isRecording: false
      })
    }),
    {
      name: 'scopekit-visit-store',
      partialize: (state) => ({
        tenantId: state.tenantId,
        visitId: state.visitId
      })
    }
  )
)

// Default Evidence Packs
export const EVIDENCE_PACKS: EvidencePack[] = [
  {
    id: 'roofing_residential_v2',
    name: 'Residential Roofing',
    category: 'roofing',
    checklist: [
      { id: 'r1', label: 'North elevation', helpText: 'Capture full north side', required: true, completed: false },
      { id: 'r2', label: 'South elevation', helpText: 'Capture full south side', required: true, completed: false },
      { id: 'r3', label: 'East elevation', helpText: 'Capture full east side', required: true, completed: false },
      { id: 'r4', label: 'West elevation', helpText: 'Capture full west side', required: true, completed: false },
      { id: 'r5', label: 'Damaged areas', helpText: 'Close-up of damage', required: true, completed: false },
      { id: 'r6', label: 'Gutters', helpText: 'Gutter condition', required: false, completed: false },
      { id: 'r7', label: 'Flashing', helpText: 'Chimney/vent flashing', required: false, completed: false },
      { id: 'r8', label: 'Ridge/valleys', helpText: 'Ridge and valley shots', required: false, completed: false }
    ]
  },
  {
    id: 'electrical_panel_v1',
    name: 'Electrical Panel',
    category: 'electrical',
    checklist: [
      { id: 'e1', label: 'Panel exterior', helpText: 'Full panel closed', required: true, completed: false },
      { id: 'e2', label: 'Panel interior', helpText: 'Panel open, breakers visible', required: true, completed: false },
      { id: 'e3', label: 'Main breaker', helpText: 'Close-up of main', required: true, completed: false },
      { id: 'e4', label: 'Grounding', helpText: 'Grounding connections', required: true, completed: false },
      { id: 'e5', label: 'Meter', helpText: 'Electric meter', required: false, completed: false },
      { id: 'e6', label: 'Subpanel', helpText: 'Any subpanels', required: false, completed: false }
    ]
  },
  {
    id: 'general_v1',
    name: 'General Inspection',
    category: 'general',
    checklist: [
      { id: 'g1', label: 'Overview', helpText: 'General site overview', required: true, completed: false },
      { id: 'g2', label: 'Problem area 1', helpText: 'First issue', required: true, completed: false },
      { id: 'g3', label: 'Problem area 2', helpText: 'Second issue', required: false, completed: false },
      { id: 'g4', label: 'Additional photos', helpText: 'Any other relevant shots', required: false, completed: false }
    ]
  }
]