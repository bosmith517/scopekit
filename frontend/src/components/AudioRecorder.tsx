import { useState } from 'react'

interface AudioRecorderProps {
  visitId?: string
  onRecord?: (audio: Blob) => void
}

export default function AudioRecorder({ visitId, onRecord }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  
  const handleToggleRecording = () => {
    if (isRecording) {
      setIsRecording(false)
      setDuration(0)
      console.log('Audio recording stopped for visit:', visitId)
    } else {
      setIsRecording(true)
      // Audio recording logic will be implemented with Capacitor Voice Recorder
      console.log('Audio recording started for visit:', visitId)
    }
  }
  
  return (
    <div className="text-center py-8">
      <div className="w-32 h-32 mx-auto mb-4 relative">
        <div className={`w-full h-full rounded-full flex items-center justify-center ${
          isRecording ? 'bg-red-100 animate-pulse' : 'bg-gray-100'
        }`}>
          <svg className="w-16 h-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
      </div>
      
      {isRecording && (
        <p className="text-sm text-gray-600 mb-4">Recording: {duration}s</p>
      )}
      
      <button
        onClick={handleToggleRecording}
        className={`px-6 py-3 rounded-lg font-medium ${
          isRecording
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-gray-600 text-white hover:bg-gray-700'
        }`}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
    </div>
  )
}