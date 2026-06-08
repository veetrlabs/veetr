import { useTheme } from '../context/ThemeContext'
import './ThemeToggle.css'

interface ThemeToggleProps {
  variant?: 'default' | 'menu'
}

export default function ThemeToggle({ variant = 'default' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button 
      className={`theme-toggle theme-toggle--${variant}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className="theme-toggle-icon">
        {theme === 'light' ? (
          // Moon icon for switching to dark mode
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          // Sun icon for switching to light mode
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        )}
      </div>
      <span className="theme-toggle-text">
        {theme === 'light' ? 'Dark' : 'Light'}
      </span>
    </button>
  )
}
