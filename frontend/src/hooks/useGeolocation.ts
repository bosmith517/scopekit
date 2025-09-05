import { useState, useCallback } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import { Capacitor } from '@capacitor/core'

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  altitude?: number | null
  altitudeAccuracy?: number | null
  heading?: number | null
  speed?: number | null
  timestamp: number
}

export function useGeolocation() {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const requestPermissions = useCallback(async () => {
    try {
      if (!Capacitor.isNativePlatform()) {
        // Web fallback
        return await new Promise((resolve, reject) => {
          navigator.permissions.query({ name: 'geolocation' }).then(result => {
            resolve(result.state === 'granted')
          }).catch(reject)
        })
      }

      const permission = await Geolocation.requestPermissions()
      return permission.location === 'granted' || permission.location === 'prompt'
    } catch (err) {
      console.error('Permission error:', err)
      return false
    }
  }, [])

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    setLoading(true)
    setError(null)

    try {
      // Request permissions first
      const hasPermission = await requestPermissions()
      if (!hasPermission) {
        throw new Error('Location permission denied')
      }

      console.log('Getting current position...')
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      })

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp
      }

      console.log('Location captured:', locationData)
      setLocation(locationData)
      return locationData
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location'
      console.error('Geolocation error:', err)
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [requestPermissions])

  const watchPosition = useCallback(async (
    callback: (location: LocationData) => void
  ): Promise<string | null> => {
    try {
      const hasPermission = await requestPermissions()
      if (!hasPermission) {
        throw new Error('Location permission denied')
      }

      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        },
        (position) => {
          if (position) {
            const locationData: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp
            }
            callback(locationData)
          }
        }
      )

      return watchId
    } catch (err) {
      console.error('Watch position error:', err)
      return null
    }
  }, [requestPermissions])

  const clearWatch = useCallback(async (watchId: string) => {
    await Geolocation.clearWatch({ id: watchId })
  }, [])

  return {
    location,
    error,
    loading,
    getCurrentLocation,
    watchPosition,
    clearWatch
  }
}