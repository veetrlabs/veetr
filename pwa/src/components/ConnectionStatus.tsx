import { useBLE } from '../context/BLEContext'
import { useState, useEffect } from 'react'
import './ConnectionStatus.css'

export default function ConnectionStatus() {
  const { state, connect, disconnect } = useBLE()
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Update current time every second to refresh the "last message" display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const getStatusText = () => {
    if (state.isConnecting) return 'Connecting...'
    if (state.isConnected) return 'Connected'
    if (state.error) return `Error: ${state.error}`
    return 'Disconnected'
  }

  const getStatusClass = () => {
    if (state.isConnecting) return 'connecting'
    if (state.isConnected) return 'connected'
    if (state.error) return 'error'
    return 'disconnected'
  }

  const getSignalBars = () => {
    if (!state.isConnected || state.rssi === null) return 0
    if (state.rssi >= -50) return 4
    if (state.rssi >= -70) return 3
    if (state.rssi >= -85) return 2
    return 1
  }

  const getSignalClass = () => {
    const bars = getSignalBars()
    if (bars >= 3) return 'strong'
    if (bars === 2) return 'fair'
    return 'weak'
  }

  const getTimeSinceLastMessage = () => {
    if (!state.lastMessageTime) return 'Never'
    const diff = Math.floor((currentTime - state.lastMessageTime) / 1000)
    // Ensure we never show negative values (can happen due to timing precision)
    const safeDiff = Math.max(0, diff)
    if (safeDiff < 60) return `${safeDiff}s ago`
    if (safeDiff < 3600) return `${Math.floor(safeDiff / 60)}m ago`
    return `${Math.floor(safeDiff / 3600)}h ago`
  }

  const handleButtonClick = () => {
    if (state.isConnected) {
      disconnect()
    } else {
      connect()
    }
  }

  return (
    <div className="connection-status-card">
      <div className="connection-status-info">
        <div className={`status-indicator ${getStatusClass()}`}>
          <span className="status-dot"></span>
          <span className="status-text">{getStatusText()}</span>
        </div>
        {state.isConnected && state.rssi !== null && (
          <div className="signal-strength">
            <div className={`signal-bars ${getSignalClass()}`}>
              {[1, 2, 3, 4].map(bar => (
                <div
                  key={bar}
                  className={`signal-bar ${bar <= getSignalBars() ? 'active' : ''}`}
                />
              ))}
            </div>
            <span className="signal-text">
              {state.rssi}dBm ({state.signalQuality})
            </span>
          </div>
        )}
        {state.isConnected && (
          <div className="last-message-time">
            Updated: {getTimeSinceLastMessage()}
          </div>
        )}
      </div>
      <button 
        className="connection-status-btn"
        onClick={handleButtonClick}
        disabled={state.isConnecting}
      >
        {state.isConnected ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  )
}
