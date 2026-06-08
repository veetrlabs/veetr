import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { WifiOff, Wifi } from 'lucide-react'
import './OfflineIndicator.css'

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus()

  if (isOnline) {
    return null // Don't show anything when online
  }

  return (
    <div className="offline-indicator">
      <div className="offline-content">
        <WifiOff size={16} />
        <span>Offline Mode</span>
        <div className="offline-tooltip">
          <div className="offline-tooltip-content">
            <Wifi size={14} />
            <span>App cached for offline use. All sailing features work without internet!</span>
          </div>
        </div>
      </div>
    </div>
  )
}