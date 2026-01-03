import { useState, useRef, useEffect } from 'react'
import { useBLE } from '../context/BLEContext'
import { FirmwareUpdateCard } from './cards/FirmwareUpdateCard'
import DataManager from './DataManager'
import ThemeToggle from './ThemeToggle'
import { APP_VERSION } from '../utils/version'
import { Menu, X, Moon, Bluetooth, Flag, Settings as SettingsIcon, Info, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react'
import './Settings.css'

export default function Settings() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [currentView, setCurrentView] = useState<'main' | 'bluetooth' | 'calibration' | 'regatta' | 'about'>('main')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [deviceName, setDeviceName] = useState('')
  const [refreshRate, setRefreshRate] = useState(1.0) // Default 1 second
  const menuRef = useRef<HTMLDivElement>(null)
  const { state, sendCommand, connect, disconnect } = useBLE()

  // Pre-fill device name when connected device name is available
  useEffect(() => {
    if (state.deviceName && deviceName === '') {
      setDeviceName(state.deviceName)
    }
  }, [state.deviceName, deviceName])

  // Load saved refresh rate from localStorage
  useEffect(() => {
    const savedRefreshRate = localStorage.getItem('veetr-refresh-rate')
    if (savedRefreshRate) {
      const rate = parseFloat(savedRefreshRate)
      if (rate >= 0.5 && rate <= 2.0) {
        setRefreshRate(rate)
      }
    }
  }, [])

  // Sync refresh rate with device when connected (only once per connection)
  useEffect(() => {
    if (state.isConnected && refreshRate !== 1.0) {
      // Send saved refresh rate to device when connection is established
      sendCommand({ 
        action: 'setRefreshRate', 
        refreshRate: refreshRate 
      }).catch(error => {
        console.error('Error syncing refresh rate with device:', error)
      })
    }
  }, [state.isConnected]) // Remove refreshRate and sendCommand from dependencies to prevent loops

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
        setCurrentView('main')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
    if (!menuOpen) {
      setCurrentView('main')
    }
  }

  const navigateToView = (view: 'main' | 'bluetooth' | 'calibration' | 'regatta' | 'about') => {
    setCurrentView(view)
  }

  const handleCalibrateLevel = async () => {
    if (!state.isConnected) {
      alert('Please connect to Veetr device first')
      return
    }

    if (window.confirm('Calibrate vessel level position? This will set the current orientation as level (0°) across all axes.')) {
      setActionInProgress('resetHeel')
      try {
        const success = await sendCommand({ action: 'resetHeelAngle' })
        if (success) {
          alert('Vessel level calibration completed successfully!')
        } else {
          alert('Failed to calibrate level position. Please try again.')
        }
      } catch (error) {
        console.error('Failed to calibrate level:', error)
        alert('Error calibrating level position')
      } finally {
        setActionInProgress(null)
      }
    }
  }

  const handleCalibrateCompass = async () => {
    if (!state.isConnected) {
      alert('Please connect to Veetr device first')
      return
    }

    if (window.confirm('Calibrate compass to north? Point the vessel\'s bow toward north and press OK. This will set the current magnetic heading as the north reference.')) {
      setActionInProgress('resetCompass')
      try {
        const success = await sendCommand({ action: 'resetCompassNorth' })
        if (success) {
          alert('Compass calibrated successfully! The current heading is now set as north (0°).')
        } else {
          alert('Failed to calibrate compass. Please try again.')
        }
      } catch (error) {
        console.error('Failed to calibrate compass:', error)
        alert('Error calibrating compass')
      } finally {
        setActionInProgress(null)
      }
    }
  }

  const handleSetDeviceName = async () => {
    if (!state.isConnected) {
      alert('Please connect to Veetr device first')
      return
    }

    if (!deviceName.trim()) {
      alert('Please enter a device name')
      return
    }

    if (deviceName.length > 20) {
      alert('Device name must be 20 characters or less')
      return
    }

    if (!/^[A-Za-z0-9_\- ]+$/.test(deviceName)) {
      alert('Device name can only contain letters, numbers, underscore (_), hyphen (-), and space')
      return
    }

    if (window.confirm(`Change device name to "${deviceName.trim()}"? The device will restart and you'll need to reconnect.`)) {
      setActionInProgress('setDeviceName')
      try {
        const success = await sendCommand({ 
          action: 'setDeviceName', 
          deviceName: deviceName.trim() 
        })
        if (success) {
          alert(`Device name changed to "${deviceName.trim()}". Device is restarting...`)
          setDeviceName('')
          // The device will restart, so we'll be disconnected
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        } else {
          alert('Failed to set device name. Please try again.')
        }
      } catch (error) {
        console.error('Failed to set device name:', error)
        alert('Error setting device name')
      } finally {
        setActionInProgress(null)
      }
    }
  }

    const handleRefreshRateChange = async (newRate: number) => {
    setRefreshRate(newRate)
    
    // Save to localStorage
    localStorage.setItem('veetr-refresh-rate', newRate.toString())
    
    if (!state.isConnected) {
      return // Just update local state, don't try to send command
    }

    try {
      const success = await sendCommand({ 
        action: 'setRefreshRate', 
        refreshRate: newRate 
      })
      if (!success) {
        console.error('Failed to set refresh rate on device')
      }
    } catch (error) {
      console.error('Error setting refresh rate:', error)
    }
  }

  const handleRegattaSetPort = async () => {
    if (!state.isConnected) {
      alert('Please connect to Veetr device first')
      return
    }

    // Check GPS status from sailing data
    const hasGPS = state.sailingData.gpsSatellites > 0 && state.sailingData.lat !== 0 && state.sailingData.lon !== 0

    if (!hasGPS) {
      alert('GPS fix required to set regatta line positions.\n\nPlease wait for GPS satellite acquisition (need at least 3 satellites) and try again.')
      return
    }

    setActionInProgress('regattaPort')
    try {
      const success = await sendCommand({ action: 'regattaSetPort' })
      if (!success) {
        console.error('Failed to set port position')
        alert('Failed to set port position. Please ensure GPS has a valid fix and try again.')
      }
    } catch (error) {
      console.error('Failed to set port marker:', error)
      alert('Error setting port position. Please check GPS connection and try again.')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleRegattaSetStarboard = async () => {
    if (!state.isConnected) {
      alert('Please connect to Veetr device first')
      return
    }

    // Check GPS status from sailing data
    const hasGPS = state.sailingData.gpsSatellites > 0 && state.sailingData.lat !== 0 && state.sailingData.lon !== 0

    if (!hasGPS) {
      alert('GPS fix required to set regatta line positions.\n\nPlease wait for GPS satellite acquisition (need at least 3 satellites) and try again.')
      return
    }

    setActionInProgress('regattaStarboard')
    try {
      const success = await sendCommand({ action: 'regattaSetStarboard' })
      if (!success) {
        console.error('Failed to set starboard position')
        alert('Failed to set starboard position. Please ensure GPS has a valid fix and try again.')
      }
    } catch (error) {
      console.error('Failed to set starboard marker:', error)
      alert('Error setting starboard position. Please check GPS connection and try again.')
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <div className="settings-container" ref={menuRef}>
      <button 
        className="hamburger-button"
        onClick={toggleMenu}
        aria-label="Settings menu"
      >
        <Menu size={24} />
      </button>
      
      {menuOpen && (
        <div className="settings-menu">
          {currentView === 'main' && (
            <>
              <div className="menu-header">
                <h3>Veetr Menu</h3>
                <button 
                  className="close-button" 
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="menu-section">
                <div className="menu-item main-menu-item theme-menu-item">
                  <span className="menu-icon">
                    <Moon size={20} />
                  </span>
                  <div className="menu-item-content">
                    <h4>Theme</h4>
                    <p>Switch between light and dark mode</p>
                  </div>
                  <div className="theme-toggle-container">
                    <ThemeToggle variant="menu" />
                  </div>
                </div>

                <button 
                  className="menu-item main-menu-item" 
                  onClick={() => navigateToView('bluetooth')}
                >
                  <span className="menu-icon">
                    <Bluetooth size={20} />
                  </span>
                  <div className="menu-item-content">
                    <h4>Bluetooth</h4>
                    <p>Connection and device pairing</p>
                  </div>
                  <span className="menu-arrow">
                    <ChevronRight size={16} />
                  </span>
                </button>
                
                <button 
                  className="menu-item main-menu-item" 
                  onClick={() => navigateToView('regatta')}
                >
                  <span className="menu-icon">
                    <Flag size={20} />
                  </span>
                  <div className="menu-item-content">
                    <h4>Regatta</h4>
                    <p>Starting procedure and race setup</p>
                  </div>
                  <span className="menu-arrow">
                    <ChevronRight size={16} />
                  </span>
                </button>

                <button 
                  className="menu-item main-menu-item" 
                  onClick={() => navigateToView('calibration')}
                >
                  <span className="menu-icon">
                    <SettingsIcon size={20} />
                  </span>
                  <div className="menu-item-content">
                    <h4>Calibration</h4>
                    <p>Calibrate after installation</p>
                  </div>
                  <span className="menu-arrow">
                    <ChevronRight size={16} />
                  </span>
                </button>
                
                <button 
                  className="menu-item main-menu-item" 
                  onClick={() => navigateToView('about')}
                >
                  <span className="menu-icon">
                    <Info size={20} />
                  </span>
                  <div className="menu-item-content">
                    <h4>About</h4>
                    <p>Version info and updates</p>
                  </div>
                  <span className="menu-arrow">
                    <ChevronRight size={16} />
                  </span>
                </button>
              </div>
            </>
          )}

          {currentView === 'bluetooth' && (
            <>
              <div className="menu-header">
                <button 
                  className="back-button" 
                  onClick={() => navigateToView('main')}
                  aria-label="Back to main menu"
                >
                  <ChevronLeft size={20} />
                </button>
                <h3>Bluetooth</h3>
                <button 
                  className="close-button" 
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="menu-section">
                <div className="bluetooth-status">
                  {state.isConnected ? (
                    <div className="connection-info">
                      <div className="status-indicator connected">
                        <span className="status-dot"></span>
                        <span className="status-text">Connected</span>
                      </div>
                      {state.rssi !== null && (
                        <p className="signal-strength">Signal: {state.rssi}dBm ({state.signalQuality})</p>
                      )}
                      {state.lastMessageTime && (
                        <p className="last-update">
                          Last update: {Math.floor((Date.now() - state.lastMessageTime) / 1000)}s ago
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="connection-info">
                      <div className="status-indicator disconnected">
                        <span className="status-dot"></span>
                        <span className="status-text">
                          {state.isConnecting ? 'Connecting...' : 'Disconnected'}
                        </span>
                      </div>
                      {state.error && (
                        <p className="error-message">Error: {state.error}</p>
                      )}
                    </div>
                  )}
                </div>
                
                <button 
                  className={`menu-item connection-button ${state.isConnected ? 'connected' : 'disconnected'}`}
                  onClick={() => state.isConnected ? disconnect() : connect()}
                  disabled={state.isConnecting}
                >
                  {state.isConnecting 
                    ? 'Connecting...' 
                    : state.isConnected 
                      ? 'Disconnect' 
                      : 'Connect to Veetr'
                  }
                </button>
              </div>

              <div className="menu-section">
                <div className="input-group">
                  <label htmlFor="deviceName">Device Name:</label>
                  <input 
                    id="deviceName"
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder={state.deviceName || "Veetr_Port_Side"}
                    maxLength={20}
                    disabled={actionInProgress !== null}
                  />
                  <button 
                    onClick={handleSetDeviceName}
                    disabled={actionInProgress !== null || !state.isConnected || !deviceName.trim()}
                    className="action-button"
                  >
                    {actionInProgress === 'setDeviceName' ? 'Setting...' : 'Set Name'}
                  </button>
                </div>
                <p className="help-text">Device will restart after name change. Allowed: letters, numbers, underscore, hyphen, space</p>
              </div>

              <div className="menu-section">
                <div className="input-group">
                  <label htmlFor="refreshRate">Data Refresh Rate: {refreshRate.toFixed(1)}s</label>
                  <input 
                    id="refreshRate"
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={refreshRate}
                    onChange={(e) => handleRefreshRateChange(parseFloat(e.target.value))}
                    className="range-input"
                    disabled={!state.isConnected}
                  />
                </div>
                <p className="help-text">Controls how often sensor data is transmitted. Lower values provide smoother updates but use more battery.</p>
              </div>

              {!state.isConnected && (
                <div className="connection-warning">
                  <p><AlertTriangle size={16} className="inline-icon" /> Connect to Veetr device to configure settings</p>
                </div>
              )}
            </>
          )}

          {currentView === 'calibration' && (
            <>
              <div className="menu-header">
                <button 
                  className="back-button" 
                  onClick={() => navigateToView('main')}
                  aria-label="Back to main menu"
                >
                  <ChevronLeft size={20} />
                </button>
                <h3>Calibration</h3>
                <button 
                  className="close-button" 
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="menu-section">
                <button 
                  className="menu-item" 
                  onClick={handleCalibrateLevel}
                  disabled={actionInProgress !== null || !state.isConnected}
                >
                  {actionInProgress === 'resetHeel' ? 'Calibrating...' : 'Set vessel is Level'}
                </button>
                <p className="help-text">Calibrates current position as level across all axes (heel, pitch, roll)</p>
                
                <button 
                  className="menu-item" 
                  onClick={handleCalibrateCompass}
                  disabled={actionInProgress !== null || !state.isConnected}
                >
                  {actionInProgress === 'resetCompass' ? 'Calibrating...' : 'Set vessel pointing North'}
                </button>
                <p className="help-text">Point vessel's bow to north, then press to calibrate compass heading</p>
              </div>

              {!state.isConnected && (
                <div className="connection-warning">
                  <p><AlertTriangle size={16} className="inline-icon" /> Connect to Veetr device to access settings</p>
                </div>
              )}
            </>
          )}

          {currentView === 'regatta' && (
            <>
              <div className="menu-header">
                <button 
                  className="back-button" 
                  onClick={() => navigateToView('main')}
                  aria-label="Back to main menu"
                >
                  <ChevronLeft size={20} />
                </button>
                <h3>Regatta</h3>
                <button 
                  className="close-button" 
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="menu-section">
                <h4>Starting Line Setup</h4>
                <div className="button-group">
                  <button 
                    className={`menu-item half-width ${state.sailingData.hasStartLine ? 'position-set' : ''}`}
                    onClick={handleRegattaSetPort}
                    disabled={actionInProgress !== null || !state.isConnected}
                    style={state.sailingData.hasStartLine ? { backgroundColor: '#2196F3', color: 'white' } : {}}
                  >
                    {actionInProgress === 'regattaPort' ? 'Setting...' : state.sailingData.hasStartLine ? 'Port Set ✓' : 'Set Port Line'}
                  </button>
                  
                  <button 
                    className={`menu-item half-width ${state.sailingData.hasStartLine ? 'position-set' : ''}`}
                    onClick={handleRegattaSetStarboard}
                    disabled={actionInProgress !== null || !state.isConnected}
                    style={state.sailingData.hasStartLine ? { backgroundColor: '#2196F3', color: 'white' } : {}}
                  >
                    {actionInProgress === 'regattaStarboard' ? 'Setting...' : state.sailingData.hasStartLine ? 'Starboard Set ✓' : 'Set Starboard Line'}
                  </button>
                </div>
                <p className="help-text">
                  {state.sailingData.hasStartLine 
                    ? 'Start line configured! Both port and starboard positions are set.' 
                    : 'Set both port and starboard markers to configure the starting line for race timing'}
                </p>
              </div>

              <div className="menu-section">
                <h4>Starting Procedure</h4>
                <button 
                  className="menu-item" 
                  disabled={true}
                >
                  Coming Soon: Race Timer
                </button>
                <p className="help-text">Countdown timer and race start alerts (Planned feature)</p>
              </div>

              {!state.isConnected && (
                <div className="connection-warning">
                  <p><AlertTriangle size={16} className="inline-icon" /> Connect to Veetr device to access regatta features</p>
                </div>
              )}
            </>
          )}

          {currentView === 'about' && (
            <>
              <div className="menu-header">
                <button 
                  className="back-button" 
                  onClick={() => navigateToView('main')}
                  aria-label="Back to main menu"
                >
                  <ChevronLeft size={20} />
                </button>
                <h3>About</h3>
                <button 
                  className="close-button" 
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="menu-section">
                <FirmwareUpdateCard />
              </div>

              <div className="menu-section">
                <DataManager />
              </div>

              <div className="menu-section">
                <h4>Information</h4>
                <p>App Version: {APP_VERSION}</p>
                <p className="help-text">
                  Veetr is an open-source sailing dashboard providing real-time wind, GPS, and boat data via Bluetooth Low Energy.
                </p>
                <p className="help-text">
                  For support and updates, visit the GitHub repository or check the documentation.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
