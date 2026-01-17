import { useState, useEffect } from 'react'
import { BLEProvider } from './context/BLEContext'
import { ThemeProvider } from './context/ThemeContext'
import Dashboard from './components/Dashboard'
import Map from './pages/Map'
import MapButton from './components/MapButton'
import OfflineIndicator from './components/OfflineIndicator'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'map'>(() => {
    // Initialize from URL
    return window.location.pathname === '/map' ? 'map' : 'dashboard';
  });

  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newPage = customEvent.detail as 'dashboard' | 'map';
      setCurrentPage(newPage);
      
      // Update URL
      const newPath = newPage === 'map' ? '/map' : '/';
      window.history.pushState({}, '', newPath);
    };

    const handlePopState = () => {
      // Handle browser back/forward
      setCurrentPage(window.location.pathname === '/map' ? 'map' : 'dashboard');
    };

    window.addEventListener('navigate', handleNavigate);
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return (
    <ThemeProvider>
      <BLEProvider>
        <div className="app">
          <OfflineIndicator />
          <main className="app-main">
            {currentPage === 'dashboard' ? (
              <>
                <Dashboard />
                <MapButton />
              </>
            ) : (
              <Map />
            )}
          </main>
        </div>
      </BLEProvider>
    </ThemeProvider>
  )
}

export default App
