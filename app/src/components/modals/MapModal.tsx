import { useEffect, useRef, useState } from 'react'
import { getLastReading } from '../../utils/dataStorage'
import { isValidCoordinates } from '../../utils/gpsValidation'
import './MapModal.css'

interface MapModalProps {
  isOpen: boolean
  onClose: () => void
  lat: number
  lon: number
  hdm: number
}

export default function MapModal({ isOpen, onClose, lat, lon }: MapModalProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [displayLat, setDisplayLat] = useState(0)
  const [displayLon, setDisplayLon] = useState(0)

  // Load coordinates when modal opens
  useEffect(() => {
    if (!isOpen) return

    const loadPosition = async () => {
      if (isValidCoordinates(lat, lon)) {
        setDisplayLat(lat)
        setDisplayLon(lon)
      } else {
        const lastReading = await getLastReading()
        if (lastReading?.lat && lastReading?.lon) {
          setDisplayLat(lastReading.lat)
          setDisplayLon(lastReading.lon)
        }
      }
    }

    loadPosition()
  }, [isOpen, lat, lon])

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapRef.current || mapInstanceRef.current) return
    if (displayLat === 0 || displayLon === 0) return

    const initMap = async () => {
      const L = (window as any).L
      
      if (!L) {
        // Load Leaflet
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)

        await new Promise<void>((resolve) => {
          const script = document.createElement('script')
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
          script.onload = () => resolve()
          document.head.appendChild(script)
        })
      }

      const mapInstance: any = (window as any).L.map(mapRef.current).setView([displayLat, displayLon], 13);
      
      (window as any).L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(mapInstance);

      (window as any).L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: '© OpenSeaMap'
      }).addTo(mapInstance);

      // Add marker after brief delay for map to fully render
      setTimeout(() => {
        (window as any).L.circleMarker([displayLat, displayLon], {
          radius: 6,
          fillColor: '#444',
          fillOpacity: 1,
          color: '#222',
          weight: 2
        }).addTo(mapInstance)
      }, 200)

      mapInstanceRef.current = mapInstance
    }

    initMap()
  }, [isOpen, displayLat, displayLon])

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content map-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div ref={mapRef} style={{ width: '100%', height: '80vh' }} />
      </div>
    </div>
  )
}
