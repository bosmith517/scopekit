import { useState } from 'react'

interface CameraCaptureProps {
  visitId?: string
  onCapture?: (photo: Blob) => void
}

export default function CameraCapture({ visitId, onCapture }: CameraCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  
  const handleCapture = () => {
    setIsCapturing(true)
    // Camera capture logic will be implemented with Capacitor Camera plugin
    setTimeout(() => {
      setIsCapturing(false)
      console.log('Photo captured for visit:', visitId)
    }, 1000)
  }
  
  return (
    <div className="text-center py-8">
      <div className="w-full h-64 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
        <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <button
        onClick={handleCapture}
        disabled={isCapturing}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isCapturing ? 'Capturing...' : 'Take Photo'}
      </button>
    </div>
  )
}