import { APP_VERSION, getVersionString } from '../version'

describe('APP_VERSION', () => {
  it('is a string', () => {
    expect(typeof APP_VERSION).toBe('string')
  })

  it('follows semver pattern', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('getVersionString', () => {
  it('returns version with app name by default', () => {
    expect(getVersionString()).toBe(`Veetr ${APP_VERSION}`)
  })

  it('returns just the version when includeAppName is false', () => {
    expect(getVersionString(false)).toBe(APP_VERSION)
  })

  it('returns version with app name when includeAppName is true', () => {
    expect(getVersionString(true)).toBe(`Veetr ${APP_VERSION}`)
  })
})
