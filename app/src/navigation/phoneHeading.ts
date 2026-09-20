export type CompassSample = { magHeading: number; trueHeading?: number; accuracy: number; receivedAt: number }

const wrap = (angle: number) => (angle % 360 + 360) % 360
const delta = (to: number, from: number) => wrap(to - from + 180) - 180

// Time-based circular low-pass filter: north crossings must not average to south.
// Keep declination separate so magnetic and true headings receive the same filtering.
export function createCompassFilter() {
  let previous: CompassSample | null = null
  let x = 0, y = 0, displayed = 0
  return (sample: CompassSample): CompassSample => {
    if (usablePhoneHeading(sample, sample.receivedAt) === null) {
      previous = null
      return sample
    }
    const radians = sample.magHeading * Math.PI / 180
    const elapsed = previous ? sample.receivedAt - previous.receivedAt : 0
    if (!previous || elapsed <= 0 || elapsed > 15000) {
      x = Math.cos(radians); y = Math.sin(radians)
      displayed = sample.magHeading
    } else {
      const alpha = 1 - Math.exp(-elapsed / 450)
      x += alpha * (Math.cos(radians) - x)
      y += alpha * (Math.sin(radians) - y)
      const filtered = wrap(Math.atan2(y, x) * 180 / Math.PI)
      // Suppress sub-degree flicker while allowing small sustained turns through.
      if (Math.abs(delta(filtered, displayed)) >= 0.8) displayed = filtered
    }
    previous = sample
    const trueHeading = sample.trueHeading != null && Number.isFinite(sample.trueHeading) && sample.trueHeading >= 0 && sample.trueHeading < 360
      ? wrap(displayed + delta(sample.trueHeading, sample.magHeading)) : sample.trueHeading
    return { ...sample, magHeading: displayed, trueHeading }
  }
}
export function usablePhoneHeading(sample: CompassSample | null, now: number): number | null {
  if (!sample || !Number.isFinite(sample.magHeading) || sample.magHeading < 0 || sample.magHeading >= 360 || !Number.isFinite(sample.accuracy) || sample.accuracy < 2 || !Number.isFinite(sample.receivedAt) || now < sample.receivedAt || now - sample.receivedAt > 15000) return null
  return sample.magHeading
}

export function compassBearings(course: number | null, sample: CompassSample | null, now: number) {
  const magnetic = usablePhoneHeading(sample, now)
  const trueHeading = magnetic !== null && sample?.trueHeading != null && Number.isFinite(sample.trueHeading) && sample.trueHeading >= 0 && sample.trueHeading < 360 ? sample.trueHeading : null
  const magneticOnly = magnetic !== null && trueHeading === null
  const validCourse = course !== null && Number.isFinite(course) && course >= 0 && course < 360 ? course : null
  return { reference: magneticOnly ? 'magnetic' as const : 'true' as const, heading: magneticOnly ? magnetic : trueHeading, course: magneticOnly ? null : validCourse }
}
