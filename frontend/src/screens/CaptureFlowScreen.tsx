import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useVisitStore } from '../stores/visitStore'
import CameraCapture from '../components/CameraCapture'
import AudioRecorder from '../components/AudioRecorder'

export default function CaptureFlowScreen() {
  const { visitId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'photos' | 'audio'>('photos')
  const [photoCount, setPhotoCount] = useState(0)
  const [audioRecorded, setAudioRecorded] = useState(false)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Capture Site Data</h1>
        <button
          onClick={() => navigate(`/finalize/${visitId}`)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Finish Visit
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('photos')}
              className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'photos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Photos ({photoCount})
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'audio'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Audio Notes {audioRecorded && '✓'}
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'photos' ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p>Camera capture will appear here</p>
              <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
                Open Camera
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <p>Audio recorder will appear here</p>
              <button className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">
                Start Recording
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}