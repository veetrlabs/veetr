import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ThemeProvider } from '../context/ThemeContext'
import { BLEProvider } from '../context/BLEContext'
import OfflineIndicator from '../components/OfflineIndicator'
import { dataStorage } from '../utils/dataStorage'

export default function RootLayout() {
  useEffect(() => {
    dataStorage.init().then(() => {
      console.log('[DataStorage] Initialized successfully')
    }).catch(err => {
      console.error('[DataStorage] Failed to initialize:', err)
    })
  }, [])

  return (
    <ThemeProvider>
      <BLEProvider>
        <StatusBar style="auto" />
        <View style={styles.container}>
          <OfflineIndicator />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </View>
      </BLEProvider>
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})
