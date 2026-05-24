import { useState, useEffect } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    const handleNetworkStatus = (event: CustomEvent) => {
      setIsOnline(event.detail.online)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('networkstatus', handleNetworkStatus as EventListener)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('networkstatus', handleNetworkStatus as EventListener)
    }
  }, [])

  return isOnline
}