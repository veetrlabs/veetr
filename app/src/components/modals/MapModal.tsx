import { useEffect, useRef } from 'react'
import { View, Modal, TouchableOpacity, Text, StyleSheet } from 'react-native'
import MapView, { Marker, Circle } from 'react-native-maps'

interface MapModalProps {
  visible: boolean
  onClose: () => void
  lat: number
  lon: number
}

export default function MapModal({ visible, onClose, lat, lon }: MapModalProps) {
  const mapRef = useRef<MapView>(null)

  const hasValidCoords = lat !== 0 && lon !== 0

  useEffect(() => {
    if (visible && hasValidCoords && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500)
    }
  }, [visible, lat, lon, hasValidCoords])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        {hasValidCoords ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: lat,
              longitude: lon,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker
              coordinate={{ latitude: lat, longitude: lon }}
              title="Current Position"
              pinColor="#e53e3e"
            />
            <Circle
              center={{ latitude: lat, longitude: lon }}
              radius={5}
              fillColor="rgba(229,62,62,0.3)"
              strokeColor="rgba(229,62,62,0.8)"
              strokeWidth={2}
            />
          </MapView>
        ) : (
          <View style={styles.noData}>
            <Text style={styles.noDataText}>No GPS data available</Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { flex: 1 },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  noData: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noDataText: { color: '#fff', fontSize: 18 },
})
