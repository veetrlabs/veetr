import { useRef, useEffect, useState } from 'react'

interface UseSmoothRotationOptions {
  duration?: number
}
const wrap = (angle: number) => (angle % 360 + 360) % 360

export function useSmoothRotation(
  targetAngle: number,
  options: UseSmoothRotationOptions = {}
): number {
  const { duration = 1000 } = options
  const [currentAngle, setCurrentAngle] = useState(() => wrap(targetAngle))
  const current = useRef(currentAngle)
  const target = useRef(targetAngle)
  useEffect(() => { target.current = targetAngle }, [targetAngle])

  // One continuous clock follows the latest target, rather than restarting an
  // ease-in animation on every sensor event (which can leave the arrow behind).
  useEffect(() => {
    let last = Date.now()
    const timer = setInterval(() => {
      const now = Date.now()
      const elapsed = now - last
      last = now
      const diff = wrap(target.current - current.current + 180) - 180
      const fraction = duration <= 0 ? 1 : 1 - Math.exp(-elapsed / (duration / 3))
      current.current = wrap(Math.abs(diff) < 0.1 ? target.current : current.current + diff * fraction)
      setCurrentAngle(current.current)
    }, 33)
    return () => clearInterval(timer)
  }, [duration])
  return currentAngle
}
