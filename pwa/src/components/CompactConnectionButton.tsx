import { useBLE } from '../context/BLEContext'
import './CompactConnectionButton.css'
import { useState } from 'react'

export default function CompactConnectionButton() {
  const { state, connect, disconnect, refreshPWA, checkPWAHealth } = useBLE()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [failCount, setFailCount] = useState(0)

  const handleButtonClick = async () => {
    if (state.isConnected) {
      disconnect()
    } else {
      try {
        await connect()
        setFailCount(0) // Reset on successful connection
      } catch (error) {
        const newFailCount = failCount + 1
        setFailCount(newFailCount)
        
        // Show advanced options after 2 failed attempts
        if (newFailCount >= 2) {
          setShowAdvanced(true)
        }
        
        console.log(`[Connection] Failed attempts: ${newFailCount}`)
      }
    }
  }

  const handlePWARefresh = () => {
    console.log('[PWA] User requested PWA refresh')
    refreshPWA()
  }

  const handleDiagnostics = () => {
    const health = checkPWAHealth()
    console.log('[PWA Diagnostics]', health)
    alert(`PWA Health Check:\n• Standalone: ${health.isStandalone}\n• Issues: ${health.issues.length > 0 ? health.issues.join(', ') : 'None'}\n\nCheck console for details.`)
  }

  // Only show the red connect button when disconnected
  if (state.isConnected) {
    return null
  }

  // Red "Connect" button when disconnected
  return (
    <div className="connection-button-container">
      <button 
        className="compact-connection-btn disconnected"
        onClick={handleButtonClick}
        disabled={state.isConnecting}
      >
        {state.isConnecting ? 'Connecting...' : 'Connect'}
      </button>
      
      {/* Show advanced recovery options after failed attempts */}
      {showAdvanced && (
        <div className="advanced-connection-options">
          <small>Connection issues? Try:</small>
          <button 
            className="recovery-btn" 
            onClick={handlePWARefresh}
            title="Refresh the PWA to clear any cached issues"
          >
            Refresh PWA
          </button>
          <button 
            className="recovery-btn" 
            onClick={handleDiagnostics}
            title="Check PWA health and Bluetooth status"
          >
            Diagnostics
          </button>
          <button 
            className="recovery-btn" 
            onClick={() => setShowAdvanced(false)}
          >
            Hide
          </button>
        </div>
      )}
    </div>
  )
}
