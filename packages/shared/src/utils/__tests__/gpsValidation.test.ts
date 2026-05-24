import { isValidCoordinates, hasValidGPSFix, hasGPSCoordinates } from '../gpsValidation'
import type { SailingData } from '../../types'

describe('isValidCoordinates', () => {
  it('returns false for null or undefined values', () => {
    expect(isValidCoordinates(null, null)).toBe(false)
    expect(isValidCoordinates(null, 10)).toBe(false)
    expect(isValidCoordinates(10, undefined)).toBe(false)
    expect(isValidCoordinates(undefined, undefined)).toBe(false)
  })

  it('returns false for 0,0 (null island)', () => {
    expect(isValidCoordinates(0, 0)).toBe(false)
  })

  it('returns false for out of range latitude', () => {
    expect(isValidCoordinates(91, 0)).toBe(false)
    expect(isValidCoordinates(-91, 0)).toBe(false)
  })

  it('returns false for out of range longitude', () => {
    expect(isValidCoordinates(0, 181)).toBe(false)
    expect(isValidCoordinates(0, -181)).toBe(false)
  })

  it('returns true for valid coordinates', () => {
    expect(isValidCoordinates(51.5, -0.12)).toBe(true)
    expect(isValidCoordinates(-33.86, 151.21)).toBe(true)
    expect(isValidCoordinates(90, 180)).toBe(true)
    expect(isValidCoordinates(-90, -180)).toBe(true)
  })
})

describe('hasValidGPSFix', () => {
  const makeSailingData = (overrides: Partial<SailingData> = {}): SailingData => ({
    speed: 0,
    speedMax: 0,
    speedAvg: 0,
    windSpeed: 0,
    windSpeedMax: 0,
    windSpeedAvg: 0,
    windAngle: 0,
    windDirection: 0,
    trueWindSpeed: 0,
    trueWindSpeedMax: 0,
    trueWindSpeedAvg: 0,
    trueWindAngle: 0,
    tilt: 0,
    tiltPortMax: 0,
    tiltStarboardMax: 0,
    deadWindAngle: 0,
    gpsSpeed: 0,
    gpsSatellites: 0,
    hdop: 0,
    lat: 0,
    lon: 0,
    heading: 0,
    hasStartLine: false,
    distanceToLine: null,
    portLat: null,
    portLon: null,
    starboardLat: null,
    starboardLon: null,
    ...overrides,
  })

  it('returns false when no satellites tracked', () => {
    const data = makeSailingData({ gpsSatellites: 0, lat: 51.5, lon: -0.12 })
    expect(hasValidGPSFix(data)).toBe(false)
  })

  it('returns false when satellites > 0 but coordinates are 0,0', () => {
    const data = makeSailingData({ gpsSatellites: 8, lat: 0, lon: 0 })
    expect(hasValidGPSFix(data)).toBe(false)
  })

  it('returns true when satellites > 0 and coordinates are valid', () => {
    const data = makeSailingData({ gpsSatellites: 8, lat: 51.5, lon: -0.12 })
    expect(hasValidGPSFix(data)).toBe(true)
  })

  it('returns true with valid GPS', () => {
    const data = makeSailingData({ gpsSatellites: 12, lat: 48.8566, lon: 2.3522 })
    expect(hasValidGPSFix(data)).toBe(true)
  })
})

describe('hasGPSCoordinates', () => {
  it('delegates to isValidCoordinates', () => {
    expect(hasGPSCoordinates(51.5, -0.12)).toBe(true)
    expect(hasGPSCoordinates(0, 0)).toBe(false)
    expect(hasGPSCoordinates(null, null)).toBe(false)
  })
})
