import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.scopekit.capture',
  appName: 'ScopeKit Capture',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'app.scopekit.io',
    cleartext: false
  },
  plugins: {
    CameraPreview: {
      position: 'rear',
      height: 1920,
      width: 1080,
      quality: 85,
      toBack: false
    },
    VoiceRecorder: {
      androidAudioSource: 'MIC',
      samplingRate: 16000,
      frameDuration: 20,
      bufferSize: 4096
    }
  },
  ios: {
    contentInset: 'automatic',
    limitsNavigationBarChanges: false
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;