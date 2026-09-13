export type Theme = 'light' | 'dark'

export interface Colors {
  bg: string
  cardBg: string
  text: string
  textSecondary: string
  textMuted: string
  textSubtle: string
  panelBg: string
  buttonBg: string
  border: string
  inputBg: string
  compassStroke: string
  compassFill: string
  compassAccent: string
  chartBg: string
}

export const themeColors: Record<Theme, Colors> = {
  light: {
    bg: '#f5f5f5',
    cardBg: 'transparent',
    text: '#2d3748',
    textSecondary: '#4a5568',
    textMuted: '#718096',
    textSubtle: '#a0aec0',
    panelBg: '#ffffff',
    buttonBg: 'rgba(0,0,0,0.05)',
    border: '#e2e8f0',
    inputBg: '#ffffff',
    compassStroke: '#a9a9a9',
    compassFill: '#a9a9a9',
    compassAccent: '#4a5568',
    chartBg: '#e2e8f0',
  },
  dark: {
    bg: '#1a202c',
    cardBg: 'transparent',
    text: '#e2e8f0',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    textSubtle: '#64748b',
    panelBg: '#1e293b',
    buttonBg: 'rgba(255,255,255,0.1)',
    border: '#334155',
    inputBg: '#334155',
    compassStroke: '#64748b',
    compassFill: '#94a3b8',
    compassAccent: '#cbd5e1',
    chartBg: '#334155',
  },
}
