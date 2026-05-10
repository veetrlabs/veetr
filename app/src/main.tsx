import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { dataStorage } from './utils/dataStorage'

// Initialize IndexedDB for sensor data storage
dataStorage.init().then(() => {
  console.log('[DataStorage] Initialized successfully')
}).catch(err => {
  console.error('[DataStorage] Failed to initialize:', err)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)

if (isLocalhost && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch((error) => {
      console.error('[Main] Failed to unregister development SW:', error)
    })

  if ('caches' in window) {
    caches.keys()
      .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
      .catch((error) => {
        console.error('[Main] Failed to clear development caches:', error)
      })
  }
}

// Register Service Worker for offline capability
if (!isLocalhost && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[Main] SW registered successfully:', registration);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
        
        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is available
                console.log('[Main] New SW version available');
                // You could show a notification to the user here
                // For now, just log it
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[Main] SW registration failed:', error);
      });
    
    // Handle online/offline status
    const updateOnlineStatus = () => {
      const status = navigator.onLine ? 'online' : 'offline';
      console.log('[Main] Network status:', status);
      
      // You could dispatch a custom event here to notify components
      window.dispatchEvent(new CustomEvent('networkstatus', { 
        detail: { online: navigator.onLine }
      }));
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Initial status check
    updateOnlineStatus();
  });
}
