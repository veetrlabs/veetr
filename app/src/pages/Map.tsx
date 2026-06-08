import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBLE } from '../context/BLEContext'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'
import { getAllReadings } from '../utils/dataStorage'
import { isValidCoordinates } from '../utils/gpsValidation'

const isNative = Platform.OS === 'ios' || Platform.OS === 'android'

let MapView: any = null
let Marker: any = null
let Polyline: any = null
let Circle: any = null

if (isNative) {
  try {
    const Maps = require('react-native-maps')
    MapView = Maps.default
    Marker = Maps.Marker
    Polyline = Maps.Polyline
    Circle = Maps.Circle
  } catch {}
}

interface MapProps {
  onBack?: () => void
}

export default function Map({ onBack }: MapProps) {
  const mapRef = useRef<any>(null)
  const { state } = useBLE()
  const insets = useSafeAreaInsets()
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const data = state.sailingData
  const [loading, setLoading] = useState(true)
  const [trackCoords, setTrackCoords] = useState<Array<{ latitude: number; longitude: number }>>([])

  useEffect(() => {
    const initMap = async () => {
      let lat = data?.lat && data.lat !== 0 ? data.lat : 0
      let lon = data?.lon && data.lon !== 0 ? data.lon : 0

      try {
        const readings = await getAllReadings(50)
        if ((lat === 0 || lon === 0) && readings.length > 0) {
          const validReading = [...readings].reverse().find(r => isValidCoordinates(r.lat, r.lon))
          if (validReading) {
            lat = validReading.lat!
            lon = validReading.lon!
          }
        }

        const validPoints = readings
          .filter(r => isValidCoordinates(r.lat, r.lon))
          .map(r => ({
            latitude: r.lat!,
            longitude: r.lon!,
          }))
        setTrackCoords(validPoints)
      } catch (error) {
        console.error('[Map] Error loading readings:', error)
      }

      if (lat === 0 || lon === 0) {
        lat = 50.0
        lon = 14.0
      }

      setLoading(false)
    }

    initMap()
  }, [])

  const hasValidPos = data?.lat && data?.lon && data.lat !== 0 && data.lon !== 0
  const hasStartLineCoords =
    data?.portLat && data?.portLon && data?.starboardLat && data?.starboardLon

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {onBack && (
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.buttonBg, top: insets.top + 8 }]} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.text }]}>← Back</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={[styles.loading, { backgroundColor: colors.bg }]}>
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading map...</Text>
        </View>
      ) : !isNative || !MapView ? (
        <View style={[styles.fallback, { backgroundColor: colors.bg }]}>
          <Text style={[styles.fallbackTitle, { color: colors.text }]}>Map</Text>
          <Text style={[styles.fallbackText, { color: colors.textMuted }]}>
            Map requires a native build. Use a physical device or simulator.
          </Text>
          {trackCoords.length > 0 && (
            <Text style={[styles.fallbackCoords, { color: colors.textSubtle }]}>
              {trackCoords.length} track points loaded
            </Text>
          )}
          {hasValidPos && (
            <Text style={[styles.fallbackCoords, { color: colors.textSubtle }]}>
              Current: {data.lat.toFixed(4)}, {data.lon.toFixed(4)}
            </Text>
          )}
        </View>
      ) : (
        (() => {
          const children: any[] = []
          if (trackCoords.length > 1) {
            children.push(
              <Polyline
                coordinates={trackCoords}
                strokeColor="rgba(51,136,255,0.7)"
                strokeWidth={3}
              />
            )
          }
          if (hasValidPos) {
            children.push(
              <>
                <Marker
                  coordinate={{ latitude: data.lat, longitude: data.lon }}
                  title="Current Position"
                  pinColor="#00bfff"
                />
                <Circle
                  center={{ latitude: data.lat, longitude: data.lon }}
                  radius={3}
                  fillColor="rgba(0,191,255,0.3)"
                  strokeColor="rgba(0,191,255,0.8)"
                  strokeWidth={2}
                />
              </>
            )
          }
          if (hasStartLineCoords) {
            children.push(
              <>
                <Marker
                  coordinate={{ latitude: data.portLat!, longitude: data.portLon! }}
                  title="Port"
                  pinColor="red"
                />
                <Marker
                  coordinate={{ latitude: data.starboardLat!, longitude: data.starboardLon! }}
                  title="Starboard"
                  pinColor="green"
                />
                <Polyline
                  coordinates={[
                    { latitude: data.portLat!, longitude: data.portLon! },
                    { latitude: data.starboardLat!, longitude: data.starboardLon! },
                  ]}
                  strokeColor="red"
                  strokeWidth={4}
                  lineDashPattern={[10, 5]}
                />
              </>
            )
          }
          return (
            <MapView ref={mapRef} style={styles.map} initialRegion={{
              latitude: hasValidPos ? data.lat : 50.0,
              longitude: hasValidPos ? data.lon : 14.0,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}>
              {children}
            </MapView>
          )
        })()
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  backText: { fontSize: 16, fontWeight: '600' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16 },
  fallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32,
  },
  fallbackTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  fallbackText: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  fallbackCoords: { fontSize: 12, textAlign: 'center' },
  map: { flex: 1 },
})
