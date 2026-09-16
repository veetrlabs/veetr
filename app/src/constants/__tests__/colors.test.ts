import { themeColors } from '../colors'

describe('themeColors', () => {
  it('defines light and dark themes', () => {
    expect(themeColors).toHaveProperty('light')
    expect(themeColors).toHaveProperty('dark')
  })

  const colorKeys = [
    'bg', 'cardBg', 'text', 'textSecondary', 'textMuted', 'textSubtle',
    'panelBg', 'buttonBg', 'border', 'inputBg',
    'compassStroke', 'compassFill', 'compassAccent', 'chartBg',
  ] as const

  it.each(colorKeys)('light theme has key %s', (key) => {
    expect(themeColors.light).toHaveProperty(key)
    expect(typeof themeColors.light[key]).toBe('string')
  })

  it.each(colorKeys)('dark theme has key %s', (key) => {
    expect(themeColors.dark).toHaveProperty(key)
    expect(typeof themeColors.dark[key]).toBe('string')
  })

  it('has different values for light and dark', () => {
    expect(themeColors.light.bg).not.toBe(themeColors.dark.bg)
    expect(themeColors.light.text).not.toBe(themeColors.dark.text)
  })
})
