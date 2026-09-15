import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import * as Location from 'expo-location'
import { usablePhoneHeading, type CompassSample } from './phoneHeading'

export function usePhoneHeading() {
  const [sample, setSample] = useState<CompassSample | null>(null)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (Platform.OS === 'web') return
    let alive = true, generation = 0, subscription: Location.LocationSubscription | null = null
    let timeout: ReturnType<typeof setTimeout> | undefined
    const clear = () => { subscription?.remove(); subscription = null; clearTimeout(timeout) }
    async function start() {
      const version = ++generation
      clear(); setSample(null); setFailed(false)
      if (AppState.currentState !== 'active') return
      timeout = setTimeout(() => { if (alive && version === generation) setFailed(true) }, 15000)
      try {
        const next = await Location.watchHeadingAsync(value => {
          if (!alive || version !== generation) return
          clearTimeout(timeout)
          setSample({ magHeading: value.magHeading, trueHeading: value.trueHeading, accuracy: value.accuracy, receivedAt: Date.now() })
          setFailed(false)
        }, () => { if (alive && version === generation) { setSample(null); setFailed(true) } })
        if (!alive || version !== generation) next.remove()
        else subscription = next
      } catch { if (alive && version === generation) { clearTimeout(timeout); setFailed(true) } }
    }
    void start()
    const appState = AppState.addEventListener('change', () => void start())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => { alive = false; generation++; clear(); clearInterval(timer); appState.remove() }
  }, [])
  const heading = usablePhoneHeading(sample, Math.max(now, sample?.receivedAt ?? 0))
  const status = Platform.OS === 'web' ? '' : failed ? 'Compass unavailable' : sample && sample.accuracy < 2 ? 'Compass accuracy low' : sample && heading === null ? 'Compass unavailable' : heading === null ? 'Waiting for compass' : 'Phone compass · magnetic north'
  return { heading, status, sample }
}
