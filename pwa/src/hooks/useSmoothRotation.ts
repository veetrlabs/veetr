import { useState, useEffect, useRef } from 'react'

interface UseSmoothRotationOptions {
  duration?: number // Animation duration in milliseconds
  easing?: (t: number) => number // Easing function
}

export function useSmoothRotation(
  targetAngle: number,
  options: UseSmoothRotationOptions = {}
) {
  const { duration = 1000, easing = (t) => t * (2 - t) } = options // Default to ease-out
  const [currentAngle, setCurrentAngle] = useState(targetAngle)
  const animationRef = useRef<number>()
  const startTimeRef = useRef<number>()
  const startAngleRef = useRef<number>(targetAngle)

  useEffect(() => {
    // Calculate the shortest path between angles (handling 360° wrap-around)
    const angleDiff = ((targetAngle - currentAngle + 540) % 360) - 180
    const targetNormalized = currentAngle + angleDiff

    if (Math.abs(angleDiff) < 0.1) {
      // If the difference is tiny, just snap to target
      setCurrentAngle(targetAngle)
      return
    }

    startAngleRef.current = currentAngle
    startTimeRef.current = performance.now()

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTimeRef.current!
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easing(progress)

      const newAngle = startAngleRef.current + (targetNormalized - startAngleRef.current) * easedProgress
      
      // Normalize angle to 0-360 range
      const normalizedAngle = ((newAngle % 360) + 360) % 360
      setCurrentAngle(normalizedAngle)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        // Ensure we end exactly at the target
        setCurrentAngle(((targetAngle % 360) + 360) % 360)
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [targetAngle, duration, easing])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return currentAngle
}
