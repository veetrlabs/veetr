// Shared alert utilities to prevent multiple simultaneous alerts

// Global flag to prevent multiple simultaneous alerts
let alertInProgress = false
let lastAlertMessage = ''
let lastAlertTime = 0

/**
 * Shows a single alert with title and message, preventing multiple simultaneous alerts
 * @param message The alert message content
 * @param title The alert title (defaults to '❌ Error')
 */
export function showSingleAlert(message: string, title: string = '❌ Error') {
  const currentTime = Date.now()
  const fullMessage = `${title}: ${message}`
  
  // Prevent duplicate alerts (same message within 10 seconds)
  if (lastAlertMessage === fullMessage && currentTime - lastAlertTime < 10000) {
    console.warn(`[ALERT PREVENTED - DUPLICATE] ${title}: ${message}`)
    return
  }
  
  // Prevent multiple simultaneous alerts
  if (alertInProgress) {
    console.warn(`[ALERT PREVENTED - IN PROGRESS] ${title}: ${message}`)
    return
  }
  
  alertInProgress = true
  lastAlertMessage = fullMessage
  lastAlertTime = currentTime
  
  try {
    alert(`${title}\n\n${message}`)
  } finally {
    // Reset flag after a longer delay to prevent rapid-fire alerts
    setTimeout(() => {
      alertInProgress = false
    }, 3000) // Increased from 1s to 3s
  }
}

/**
 * Reset the alert flag manually (useful for testing or error recovery)
 */
export function resetAlertFlag() {
  alertInProgress = false
}

/**
 * Check if an alert is currently in progress
 */
export function isAlertInProgress(): boolean {
  return alertInProgress
}