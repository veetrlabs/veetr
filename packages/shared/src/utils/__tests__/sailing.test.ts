import { convertToSailingAngle, getSignalQuality } from '../sailing'

describe('convertToSailingAngle', () => {
  it('returns 0 for 0 degrees', () => {
    expect(convertToSailingAngle(0)).toBe(0)
  })

  it('returns positive angle for wind from port side (0-180)', () => {
    expect(convertToSailingAngle(45)).toBe(45)
    expect(convertToSailingAngle(90)).toBe(90)
    expect(convertToSailingAngle(180)).toBe(180)
  })

  it('returns negative angle for wind from starboard side (180-360)', () => {
    expect(convertToSailingAngle(270)).toBe(-90)
    expect(convertToSailingAngle(315)).toBe(-45)
    expect(convertToSailingAngle(181)).toBe(-179)
  })

  it('handles angles over 360', () => {
    expect(convertToSailingAngle(405)).toBe(45)
    expect(convertToSailingAngle(450)).toBe(90)
    expect(convertToSailingAngle(720)).toBe(0)
    expect(convertToSailingAngle(540)).toBe(180)
  })

  it('handles negative angles by normalizing', () => {
    expect(convertToSailingAngle(-45)).toBe(-45)
    expect(convertToSailingAngle(-90)).toBe(-90)
    expect(convertToSailingAngle(-270)).toBe(90)
    expect(Math.abs(convertToSailingAngle(-360))).toBe(0)
  })

  it('handles edge cases', () => {
    expect(convertToSailingAngle(360)).toBe(0)
    expect(convertToSailingAngle(359)).toBe(-1)
    expect(convertToSailingAngle(1)).toBe(1)
  })
})

describe('getSignalQuality', () => {
  it('returns excellent for RSSI >= -50', () => {
    expect(getSignalQuality(-30)).toBe('excellent')
    expect(getSignalQuality(-50)).toBe('excellent')
    expect(getSignalQuality(0)).toBe('excellent')
  })

  it('returns good for RSSI between -70 and -51', () => {
    expect(getSignalQuality(-51)).toBe('good')
    expect(getSignalQuality(-60)).toBe('good')
    expect(getSignalQuality(-70)).toBe('good')
  })

  it('returns fair for RSSI between -85 and -71', () => {
    expect(getSignalQuality(-71)).toBe('fair')
    expect(getSignalQuality(-80)).toBe('fair')
    expect(getSignalQuality(-85)).toBe('fair')
  })

  it('returns poor for RSSI < -85', () => {
    expect(getSignalQuality(-86)).toBe('poor')
    expect(getSignalQuality(-90)).toBe('poor')
    expect(getSignalQuality(-100)).toBe('poor')
  })

  it('handles edge case at -50 exact boundary', () => {
    expect(getSignalQuality(-50)).toBe('excellent')
    expect(getSignalQuality(-51)).toBe('good')
  })
})
