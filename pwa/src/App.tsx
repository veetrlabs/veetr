import { useState, useEffect } from 'react'
import { BLEProvider } from './context/BLEContext'
import { ThemeProvider } from './context/ThemeContext'
import Dashboard from './components/Dashboard'
import MapPage from './pages/Map'
import History from './pages/History'
import ConnectPage from './pages/Connect'
import SettingsPage from './pages/SettingsPage'
import OfflineIndicator from './components/OfflineIndicator'
import { Map, BarChart3, Bluetooth, Settings, Gauge } from 'lucide-react'
import './App.css'

type Page = 'dashboard' | 'map' | 'history' | 'connect' | 'settings'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const path = window.location.pathname
    if (path === '/map') return 'map'
    if (path === '/history') return 'history'
    if (path === '/connect') return 'connect'
    if (path === '/settings') return 'settings'
    return 'dashboard'
  })

  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent
      const newPage = customEvent.detail as Page
      setCurrentPage(newPage)
      const paths: Record<Page, string> = {
        dashboard: '/',
        map: '/map',
        history: '/history',
        connect: '/connect',
        settings: '/settings',
      }
      window.history.pushState({}, '', paths[newPage])
    }

    const handlePopState = () => {
      const path = window.location.pathname
      if (path === '/map') setCurrentPage('map')
      else if (path === '/history') setCurrentPage('history')
      else if (path === '/connect') setCurrentPage('connect')
      else if (path === '/settings') setCurrentPage('settings')
      else setCurrentPage('dashboard')
    }

    window.addEventListener('navigate', handleNavigate)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('navigate', handleNavigate)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case 'map': return <MapPage />
      case 'history': return <History />
      case 'connect': return <ConnectPage />
      case 'settings': return <SettingsPage />
      default: return <Dashboard />
    }
  }

  const tabs: { id: Page; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Data', icon: <Gauge size={20} /> },
    { id: 'map', label: 'Map', icon: <Map size={20} /> },
    { id: 'history', label: 'History', icon: <BarChart3 size={20} /> },
    { id: 'connect', label: 'Connect', icon: <Bluetooth size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ]

  return (
    <ThemeProvider>
      <BLEProvider>
        <div className="app">
          <OfflineIndicator />
          <main className="app-main">
            {renderPage()}
          </main>
          <nav className="bottom-tab-bar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`bottom-tab ${currentPage === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPage(tab.id)
                  const paths: Record<Page, string> = { dashboard: '/', map: '/map', history: '/history', connect: '/connect', settings: '/settings' }
                  window.history.pushState({}, '', paths[tab.id])
                }}
              >
                {tab.icon}
                <span className="bottom-tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </BLEProvider>
    </ThemeProvider>
  )
}

export default App
