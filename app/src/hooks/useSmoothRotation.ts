import { useRef, useEffect, useState } from 'react'
import { Animated, Easing } from 'react-native'

interface UseSmoothRotationOptions {
  duration?: number
}

export function useSmoothRotation(
  targetAngle: number,
  options: UseSmoothRotationOptions = {}
): number {
  const { duration = 1000 } = options
  const initialAngle = ((targetAngle % 360) + 360) % 360
  const [currentAngle, setCurrentAngle] = useState(initialAngle)
  const animatedValue = useRef(new Animated.Value(initialAngle)).current
  const currentValueRef = useRef(initialAngle)
  const animRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    let lastUpdate = 0
    const id = animatedValue.addListener(({ value }) => {
      currentValueRef.current = value
      const now = Date.now()
      if (now - lastUpdate > 33) {
        lastUpdate = now
        setCurrentAngle(((value % 360) + 360) % 360)
      }
    })
    return () => animatedValue.removeListener(id)
  }, [animatedValue])

  useEffect(() => {
    const target = ((targetAngle % 360) + 360) % 360
    const current = ((currentValueRef.current % 360) + 360) % 360
    const diff = ((target - current + 540) % 360) - 180

    if (Math.abs(diff) < 0.1) {
      animRef.current?.stop()
      animatedValue.setValue(target)
      setCurrentAngle(target)
      return
    }

    const from = currentValueRef.current
    const to = from + diff

    animRef.current?.stop()
    animatedValue.setValue(from)

    animRef.current = Animated.timing(animatedValue, {
      toValue: to,
      duration,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    })
    animRef.current.start()
  }, [targetAngle, duration])

  useEffect(() => {
    return () => {
      animRef.current?.stop()
    }
  }, [])

  return currentAngle
}
