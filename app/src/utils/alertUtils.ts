import { Alert } from 'react-native'

let alertInProgress = false
let lastAlertMessage = ''
let lastAlertTime = 0

export function showSingleAlert(message: string, title: string = 'Error') {
  const currentTime = Date.now()
  const fullMessage = `${title}: ${message}`

  if (lastAlertMessage === fullMessage && currentTime - lastAlertTime < 10000) {
    return
  }

  if (alertInProgress) {
    return
  }

  alertInProgress = true
  lastAlertMessage = fullMessage
  lastAlertTime = currentTime

  Alert.alert(title, message, [
    { text: 'OK', onPress: () => {
      setTimeout(() => { alertInProgress = false }, 3000)
    }}
  ])
}

export function resetAlertFlag() {
  alertInProgress = false
  lastAlertMessage = ''
  lastAlertTime = 0
}

export function isAlertInProgress(): boolean {
  return alertInProgress
}
