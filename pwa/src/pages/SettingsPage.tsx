import { useState } from 'react'
import { useBLE } from '../context/BLEContext'
import { hasValidGPSFix } from '../utils/gpsValidation'
import { FirmwareUpdateCard } from '../components/cards/FirmwareUpdateCard'
import DataManager from '../components/DataManager'
import ThemeToggle from '../components/ThemeToggle'
import { APP_VERSION } from '../utils/version'
import { ChevronLeft } from 'lucide-react'
import '../styles/SettingsPage.css'

type View = 'main' | 'regatta' | 'calibration' | 'about'

export default function SettingsPage() {
  const [view, setView] = useState<View>('main')

  return (
    <div className="settings-page">
      {view === 'main' && <MainMenu onNavigate={setView} />}
      {view === 'regatta' && <RegattaView onBack={() => setView('main')} />}
      {view === 'calibration' && <CalibrationView onBack={() => setView('main')} />}
      {view === 'about' && <AboutView onBack={() => setView('main')} />}
    </div>
  )
}

function MainMenu({ onNavigate }: { onNavigate: (v: View) => void }) {
  return (
    <>
      <h2 className="settings-page-title">Settings</h2>
      <div className="settings-menu-items">
        <button className="settings-menu-item" onClick={() => onNavigate('regatta')}>
          <span>Regatta</span>
          <span className="settings-arrow">›</span>
        </button>
        <button className="settings-menu-item" onClick={() => onNavigate('calibration')}>
          <span>Calibration</span>
          <span className="settings-arrow">›</span>
        </button>
        <button className="settings-menu-item" onClick={() => onNavigate('about')}>
          <span>About</span>
          <span className="settings-arrow">›</span>
        </button>
        <div className="settings-theme-row">
          <span>Theme</span>
          <ThemeToggle variant="menu" />
        </div>
      </div>
    </>
  )
}

function RegattaView({ onBack }: { onBack: () => void }) {
  const { state, sendCommand } = useBLE()

  const handleSet = async (side: 'port' | 'starboard') => {
    if (!state.isConnected) { alert('Please connect first'); return }
    const hasGPS = hasValidGPSFix(state.sailingData)
    if (!hasGPS) { alert('GPS fix required'); return }
    await sendCommand({ action: side === 'port' ? 'regattaSetPort' : 'regattaSetStarboard' })
  }

  const handleClear = async (side: 'port' | 'starboard') => {
    if (!state.isConnected) { alert('Please connect first'); return }
    await sendCommand({ action: side === 'port' ? 'regattaClearPort' : 'regattaClearStarboard' })
  }

  return (
    <>
      <div className="settings-header">
        <button className="settings-back-btn" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2 className="settings-page-title">Regatta</h2>
        <div style={{ width: 32 }} />
      </div>
      <div className="settings-section">
        <button className="settings-action-btn" onClick={() => handleSet('port')}>Set Port Line</button>
        <button className="settings-action-btn danger" onClick={() => handleClear('port')}>Clear Port Line</button>
        <button className="settings-action-btn" onClick={() => handleSet('starboard')}>Set Starboard Line</button>
        <button className="settings-action-btn danger" onClick={() => handleClear('starboard')}>Clear Starboard Line</button>
      </div>
    </>
  )
}

function CalibrationView({ onBack }: { onBack: () => void }) {
  const { state, sendCommand } = useBLE()

  const handleLevel = async () => {
    if (!state.isConnected) { alert('Connect first'); return }
    const success = await sendCommand({ action: 'resetHeelAngle' })
    alert(success ? 'Level calibrated!' : 'Failed')
  }

  const handleCompass = async () => {
    if (!state.isConnected) { alert('Connect first'); return }
    const success = await sendCommand({ action: 'resetCompassNorth' })
    alert(success ? 'Compass calibrated!' : 'Failed')
  }

  return (
    <>
      <div className="settings-header">
        <button className="settings-back-btn" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2 className="settings-page-title">Calibration</h2>
        <div style={{ width: 32 }} />
      </div>
      <div className="settings-section">
        <button className="settings-action-btn" onClick={handleLevel}>Set vessel is Level</button>
        <button className="settings-action-btn" onClick={handleCompass}>Set vessel pointing North</button>
      </div>
    </>
  )
}

function AboutView({ onBack }: { onBack: () => void }) {
  return (
    <>
      <div className="settings-header">
        <button className="settings-back-btn" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2 className="settings-page-title">About</h2>
        <div style={{ width: 32 }} />
      </div>
      <div className="settings-section">
        <FirmwareUpdateCard />
      </div>
      <div className="settings-section">
        <DataManager />
      </div>
      <div className="settings-section">
        <p className="settings-version">App Version: {APP_VERSION}</p>
      </div>
    </>
  )
}
