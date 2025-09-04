import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSyncStore } from '../stores/syncStore'
import { useVisitStore } from '../stores/visitStore'

export default function SettingsScreen() {
  const navigate = useNavigate()
  const { clearQueue } = useSyncStore()
  const { tenantId } = useVisitStore()
  
  const [settings, setSettings] = useState({
    autoSync: true,
    wifiOnly: false,
    photoQuality: 85,
    maxPhotos: 30,
    audioChunkSize: 2,
    notifications: true
  })

  const handleSave = () => {
    // Save settings to local storage
    localStorage.setItem('scopekit_settings', JSON.stringify(settings))
    alert('Settings saved!')
  }

  const handleClearCache = async () => {
    if (confirm('This will clear all pending uploads. Are you sure?')) {
      await clearQueue()
      localStorage.clear()
      alert('Cache cleared!')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure your ScopeKit capture preferences
        </p>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600">Tenant ID</p>
            <p className="font-mono text-xs text-gray-900 mt-1">{tenantId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Version</p>
            <p className="text-gray-900">ScopeKit Capture v1.2.0</p>
          </div>
        </div>
      </div>

      {/* Sync Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sync Settings</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Auto-sync when online</span>
            <input
              type="checkbox"
              checked={settings.autoSync}
              onChange={(e) => setSettings({ ...settings, autoSync: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">WiFi only sync</span>
            <input
              type="checkbox"
              checked={settings.wifiOnly}
              onChange={(e) => setSettings({ ...settings, wifiOnly: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </label>
        </div>
      </div>

      {/* Capture Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Capture Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Photo Quality (50-100)
            </label>
            <input
              type="range"
              min="50"
              max="100"
              value={settings.photoQuality}
              onChange={(e) => setSettings({ ...settings, photoQuality: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Lower quality, smaller size</span>
              <span className="font-medium">{settings.photoQuality}%</span>
              <span>Higher quality, larger size</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Max Photos per Visit
            </label>
            <select
              value={settings.maxPhotos}
              onChange={(e) => setSettings({ ...settings, maxPhotos: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10 photos</option>
              <option value={20}>20 photos</option>
              <option value={30}>30 photos</option>
              <option value={50}>50 photos</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Audio Chunk Size (seconds)
            </label>
            <select
              value={settings.audioChunkSize}
              onChange={(e) => setSettings({ ...settings, audioChunkSize: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={2}>2 seconds</option>
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Enable notifications</span>
          <input
            type="checkbox"
            checked={settings.notifications}
            onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        </label>
      </div>

      {/* Cache Management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cache & Storage</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Cached data</p>
              <p className="text-xs text-gray-500">Photos, audio, and pending uploads</p>
            </div>
            <button
              onClick={handleClearCache}
              className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded-lg hover:bg-red-50"
            >
              Clear Cache
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save Settings
        </button>
      </div>
    </div>
  )
}