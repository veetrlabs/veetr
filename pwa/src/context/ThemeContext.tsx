import React, { createContext, useContext, useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first, then system preference, default to light for marine use
    const stored = localStorage.getItem('sailing-dashboard-theme') as Theme
    if (stored) return stored
    
    // For sailing applications, default to light mode for better sunlight readability
    return 'light'
  })

  useEffect(() => {
    localStorage.setItem('sailing-dashboard-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
    
    // Update meta theme-color dynamically
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      const themeColor = theme === 'light' ? '#f5f5f5' : '#1a202c'
      metaThemeColor.setAttribute('content', themeColor)
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
