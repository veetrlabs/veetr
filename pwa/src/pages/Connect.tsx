import { useState, useEffect } from 'react'
import { useBLE } from '../context/BLEContext'
import '../styles/Connect.css'

export default function ConnectPage() {
  const { state, connect, disconnect, sendCommand } = useBLE()
  const [deviceName, setDeviceName] = useState('')
  const [refreshRate, setRefreshRate] = useState(1.0)

  useEffect(() => {
    if (state.deviceName && deviceName === '') {
      setDeviceName(state.deviceName)
    }
  }, [state.deviceName, deviceName])

  useEffect(() => {
    const saved = localStorage.getItem('veetr-refresh-rate')
    if (saved) {
      const rate = parseFloat(saved)
      if (rate >= 0.5 && rate <= 2.0) setRefreshRate(rate)
    }
  }, [])

  const handleSetDeviceName = async () => {
    if (!state.isConnected) return
    const success = await sendCommand({ action: 'setDeviceName', deviceName: deviceName.trim() })
    if (success) alert('Device name set. Device is restarting.')
  }

  const handleRefreshRateChange = async (rate: number) => {
    setRefreshRate(rate)
    localStorage.setItem('veetr-refresh-rate', rate.toString())
    if (state.isConnected) {
      await sendCommand({ action: 'setRefreshRate', refreshRate: rate })
    }
  }

  return (
    <div className="connect-page">
      <h2 className="connect-title">Connect</h2>

      <div className="connect-card">
        <div className="connect-status-row">
          <span className={`connect-dot ${state.isConnected ? 'connected' : state.isConnecting ? 'connecting' : 'disconnected'}`} />
          <span className="connect-status-text">
            {state.isConnecting ? 'Connecting...' : state.isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <button
          className={`connect-big-btn ${state.isConnected ? 'disconnect' : 'connect'}`}
          onClick={() => state.isConnected ? disconnect() : connect()}
          disabled={state.isConnecting}
        >
          {state.isConnecting ? 'Connecting...' : state.isConnected ? 'Disconnect' : 'Connect to Veetr'}
        </button>
      </div>

      <div className="connect-card">
        <h3 className="connect-section-title">Device Configuration</h3>

        <label className="connect-label">Device Name</label>
        <div className="connect-input-row">
          <input
            type="text"
            value={deviceName}
            onChange={e => setDeviceName(e.target.value)}
            placeholder={state.deviceName || 'Veetr_Port_Side'}
            maxLength={20}
            className="connect-input"
          />
          <button
            onClick={handleSetDeviceName}
            disabled={!state.isConnected || !deviceName.trim()}
            className="connect-action-btn"
          >
            Set Name
          </button>
        </div>

        <label className="connect-label">Data Refresh Rate: {refreshRate.toFixed(1)}s</label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={refreshRate}
          onChange={e => handleRefreshRateChange(parseFloat(e.target.value))}
          className="connect-range"
        />
        <p className="connect-help">Controls how often sensor data is transmitted. Lower values = smoother updates, more battery.</p>
      </div>
    </div>
  )
}
