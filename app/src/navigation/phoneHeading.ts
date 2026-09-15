export type CompassSample = { magHeading: number; trueHeading?: number; accuracy: number; receivedAt: number }
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
