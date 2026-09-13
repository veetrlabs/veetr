import { formatTime } from '../firmware'

describe('formatTime', () => {
  it('formats milliseconds as "Xms"', () => {
    expect(formatTime(0)).toBe('0ms')
    expect(formatTime(500)).toBe('500ms')
    expect(formatTime(999)).toBe('999ms')
  })

  it('formats seconds', () => {
    expect(formatTime(1000)).toBe('1s')
    expect(formatTime(5000)).toBe('5s')
    expect(formatTime(59000)).toBe('59s')
  })

  it('formats minutes and seconds', () => {
    expect(formatTime(60000)).toBe('1m 0s')
    expect(formatTime(61000)).toBe('1m 1s')
    expect(formatTime(3599000)).toBe('59m 59s')
  })

  it('formats hours, minutes and seconds', () => {
    expect(formatTime(3600000)).toBe('1h 0m 0s')
    expect(formatTime(3661000)).toBe('1h 1m 1s')
    expect(formatTime(7200000)).toBe('2h 0m 0s')
  })
})
