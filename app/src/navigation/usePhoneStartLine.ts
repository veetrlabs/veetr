import { useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { emptyLine, parsePhoneLine, type PhoneStartLine, type StartMark } from './phoneStartLine'
const KEY = '@veetr_phone_start_line_v1'
export function usePhoneStartLine() {
  const [line, setLine] = useState<PhoneStartLine>(emptyLine)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const current = useRef(line), ready = useRef(false), tail = useRef(Promise.resolve())
  useEffect(() => {
    let alive = true
    AsyncStorage.getItem(KEY).then(raw => {
      const value = parsePhoneLine(raw)
      if (alive) { current.current = value; setLine(value); ready.current = true; setLoaded(true) }
    }).catch(e => { if (alive) setError(String(e)) })
    return () => { alive = false }
  }, [])
  function saveMark(side: 'port' | 'starboard', mark: StartMark | null) {
    const next = tail.current.then(async () => {
      if (!ready.current) throw new Error('Phone start line has not loaded. Reopen the app and try again.')
      const value = { ...current.current, [side]: mark }
      await AsyncStorage.setItem(KEY, JSON.stringify(value))
      current.current = value; setLine(value)
    })
    tail.current = next.catch(() => {})
    return next
  }
  return { line, loaded, error, saveMark }
}
