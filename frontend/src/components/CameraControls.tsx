interface Props {
  onCapture: () => void
  onRecordToggle: () => void
  onFinish: () => void
  isRecording: boolean
  isCapturing: boolean
  photoCount: number
}

export default function CameraControls({
  onCapture,
  onRecordToggle,
  onFinish,
  isRecording,
  isCapturing,
  photoCount
}: Props) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent">
      <div className="p-6 pb-8 safe-area-bottom">
        <div className="flex items-center gap-6 justify-center">
          {/* Record Button - Following spec design */}
          <button
            onClick={onRecordToggle}
            className={`px-5 py-3 rounded-full font-medium transition-all active:scale-95 flex items-center gap-2 ${
              isRecording 
                ? 'bg-red-600 text-white shadow-lg' 
                : 'bg-neutral-900 text-white shadow-lg hover:bg-neutral-800'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <rect x="6" y="6" width="8" height="8" rx="1" />
                </svg>
                <span>Stop</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="4" />
                </svg>
                <span>Record</span>
              </>
            )}
          </button>

          {/* Shutter Button - Large circular per spec */}
          <button
            onClick={onCapture}
            disabled={isCapturing}
            className="relative active:scale-95 transition-transform"
            aria-label="Take photo"
          >
            <div className="h-20 w-20 rounded-full bg-white border-4 border-black shadow-xl flex items-center justify-center">
              <div className={`h-16 w-16 rounded-full bg-white transition-all ${
                isCapturing ? 'scale-75' : 'scale-100'
              }`} />
            </div>
            {photoCount > 0 && (
              <div className="absolute -top-1 -right-1 h-7 w-7 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-sm font-bold">{photoCount}</span>
              </div>
            )}
          </button>

          {/* Finish Visit Button */}
          <button
            onClick={onFinish}
            disabled={photoCount === 0 && !isRecording}
            className={`px-5 py-3 rounded-full font-medium transition-all active:scale-95 ${
              photoCount > 0 
                ? 'bg-emerald-600 text-white shadow-lg hover:bg-emerald-700' 
                : 'bg-white/20 text-white/50 cursor-not-allowed'
            }`}
            aria-label="Finish visit"
          >
            Finish Visit
          </button>
        </div>
      </div>
    </div>
  )
}