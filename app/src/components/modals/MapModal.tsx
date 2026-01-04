import { useEffect, useRef, useState } from 'react'
import { dataStorage, getLastReading } from '../../utils/dataStorage'
import './MapModal.css'

interface MapModalProps {
  isOpen: boolean
  onClose: () => void
  lat: number
  lon: number
  hdm: number // Heading (degrees)
}

// OpenSeaMap with OpenStreetMap tiles
export default function MapModal({ isOpen, onClose, lat, lon, hdm }: MapModalProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const headingLineRef = useRef<any>(null)
  const trackLayerRef = useRef<any>(null)
  const [finalLat, setFinalLat] = useState(lat)
  const [finalLon, setFinalLon] = useState(lon)
  const [finalHdm, setFinalHdm] = useState(hdm)
  const [isFromDatabase, setIsFromDatabase] = useState(false)

  // If no active GPS coordinates, try to get last known position from database
  useEffect(() => {
    const loadLastPosition = async () => {
      // Check if we have valid GPS from device
      const hasValidGPS = lat && lon && lat !== 0 && lon !== 0
      
      if (!hasValidGPS) {
        const lastReading = await getLastReading()
        if (lastReading && lastReading.lat && lastReading.lon && lastReading.lat !== 0 && lastReading.lon !== 0) {
          setFinalLat(lastReading.lat)
          setFinalLon(lastReading.lon)
          setFinalHdm(lastReading.HDM || 0)
          setIsFromDatabase(true)
        }
      } else {
        setFinalLat(lat)
        setFinalLon(lon)
        setFinalHdm(hdm)
        setIsFromDatabase(false)
      }
    }
    
    if (isOpen) {
      loadLastPosition()
    }
  }, [isOpen, lat, lon, hdm])

  // Initialize map only once when modal opens
  useEffect(() => {
    if (!isOpen || !mapRef.current) return

    // If map already exists, just update position
    if (mapInstanceRef.current) {
      const validLat = finalLat || 0
      const validLon = finalLon || 0
      mapInstanceRef.current.setView([validLat, validLon], finalLat && finalLon ? 13 : 2)
      return
    }

    const loadLeaflet = async () => {
      // Check if Leaflet is already loaded
      if (!(window as any).L) {
        // Load CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)
        }

        // Load JS
        await new Promise<void>((resolve) => {
          const script = document.createElement('script')
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
          script.onload = () => resolve()
          document.head.appendChild(script)
        })
      }

      const L = (window as any).L

      // Use valid coordinates or default to center of world
      const validLat = finalLat || 0
      const validLon = finalLon || 0

      const map = L.map(mapRef.current).setView([validLat, validLon], finalLat && finalLon ? 13 : 2)

      // Add OpenStreetMap base layer
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map)

      // Add OpenSeaMap overlay
      L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: '© <a href="http://www.openseamap.org">OpenSeaMap</a> contributors'
      }).addTo(map)

      // Add marker if we have valid GPS coordinates
      if (finalLat && finalLon) {
        // Create a simple dark grey circle marker
        markerRef.current = L.circleMarker([finalLat, finalLon], {
          radius: 6,
          fillColor: '#444',
          fillOpacity: 1,
          color: '#222',
          weight: 2
        }).addTo(map)
      }

      mapInstanceRef.current = map
    }

    loadLeaflet()
  }, [isOpen, finalLat, finalLon])

  // Cleanup map on modal close
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      headingLineRef.current = null
      trackLayerRef.current = null
      // Clear the map container HTML to fully reset it
      if (mapRef.current) {
        mapRef.current.innerHTML = ''
        const container = mapRef.current as any
        delete container._leaflet_id
      }
    }
  }, [isOpen])

  // Load and display GPS track from database
  useEffect(() => {
    if (!mapInstanceRef.current || !isOpen) return

    const loadTrack = async () => {
      const L = (window as any).L
      if (!L) return

      // Get last 100 readings with GPS data
      const now = Date.now()
      const readings = await dataStorage.getReadings(now - 24 * 60 * 60 * 1000, now) // Last 24 hours
      
      // Filter readings with valid GPS coordinates and take last 100
      const gpsReadings = readings
        .filter(r => r.lat && r.lon && r.lat !== 0 && r.lon !== 0)
        .slice(-100)

      if (gpsReadings.length > 1) { // Need at least 2 points for a line
        // Create array of [lat, lon] coordinates
        const trackCoords = gpsReadings.map(r => [r.lat, r.lon])

        // Remove old track layer if exists
        if (trackLayerRef.current) {
          mapInstanceRef.current.removeLayer(trackLayerRef.current)
        }

        // Create polyline for the track
        trackLayerRef.current = L.polyline(trackCoords, {
          color: '#0066cc',
          weight: 2,
          opacity: 0.6
        }).addTo(mapInstanceRef.current)

        // Helper to calculate true wind
        const calculateTrueWind = (aws: number, awa: number, sog: number): { tws: number, twa: number } => {
          if (sog < 0.5) {
            return { tws: aws, twa: awa }
          }
          const awaRad = (awa * Math.PI) / 180
          const twsX = aws * Math.cos(awaRad) - sog
          const twsY = aws * Math.sin(awaRad)
          const tws = Math.sqrt(twsX * twsX + twsY * twsY)
          let twa = (Math.atan2(twsY, twsX) * 180) / Math.PI
          if (twa < 0) twa += 360
          return { tws, twa }
        }

        // Add small dots at each GPS point with tooltips
        gpsReadings.forEach(reading => {
          const timestamp = new Date(reading.t).toLocaleString()
          
          // Calculate TWS and TWA
          const { tws, twa } = calculateTrueWind(reading.AWS || 0, reading.AWA || 0, reading.SOG || 0)
          
          // COG = HDM (assuming no current for now)
          const cog = reading.HDM
          
          const tooltipContent = `
            <div style="font-size: 11px;">
              <strong>${timestamp}</strong><br/>
              SOG: ${reading.SOG?.toFixed(1) || 'N/A'} kt<br/>
              COG: ${cog?.toFixed(0) || 'N/A'}°<br/>
              HDM: ${reading.HDM?.toFixed(0) || 'N/A'}°<br/>
              AWS: ${reading.AWS?.toFixed(1) || 'N/A'} kt<br/>
              AWA: ${reading.AWA?.toFixed(0) || 'N/A'}°<br/>
              TWS: ${tws?.toFixed(1) || 'N/A'} kt<br/>
              TWA: ${twa?.toFixed(0) || 'N/A'}°<br/>
              Heel: ${reading.heel?.toFixed(1) || 'N/A'}°<br/>
              Pitch: ${reading.pitch?.toFixed(1) || 'N/A'}°
            </div>
          `
          L.circleMarker([reading.lat, reading.lon], {
            radius: 2,
            fillColor: '#0066cc',
            fillOpacity: 0.6,
            color: '#004499',
            weight: 1
          }).bindTooltip(tooltipContent, {
            direction: 'top',
            offset: [0, -5]
          }).addTo(mapInstanceRef.current)
        })
      }
    }

    loadTrack()
  }, [isOpen])

  // Update marker position and heading line when coordinates/heading change
  useEffect(() => {
    if (!mapInstanceRef.current || !finalLat || !finalLon) return

    const L = (window as any).L
    if (!L) return

    // Update marker position
    if (markerRef.current) {
      markerRef.current.setLatLng([finalLat, finalLon])
    } else {
      // Create marker if it doesn't exist - simple dark grey circle
      markerRef.current = L.circleMarker([finalLat, finalLon], {
        radius: 6,
        fillColor: '#444',
        fillOpacity: 1,
        color: '#222',
        weight: 2
      }).addTo(mapInstanceRef.current)
    }

    // Update or create heading line
    if (finalHdm !== undefined && finalHdm !== null && mapInstanceRef.current) {
      // Calculate endpoint for heading line - extend to map edge
      const bounds = mapInstanceRef.current.getBounds()
      const mapDiagonal = Math.sqrt(
        Math.pow(bounds.getNorth() - bounds.getSouth(), 2) +
        Math.pow(bounds.getEast() - bounds.getWest(), 2)
      )
      const lineLength = mapDiagonal * 2 // Extend beyond visible area
      const headingRad = (finalHdm * Math.PI) / 180
      const endLat = finalLat + lineLength * Math.cos(headingRad)
      const endLon = finalLon + lineLength * Math.sin(headingRad) / Math.cos((finalLat * Math.PI) / 180)

      if (headingLineRef.current) {
        // Update existing line
        headingLineRef.current.setLatLngs([[finalLat, finalLon], [endLat, endLon]])
      } else {
        // Create new heading line
        headingLineRef.current = L.polyline(
          [[finalLat, finalLon], [endLat, endLon]], 
          {
            color: '#00ff00',
            weight: 3,
            opacity: 0.8
          }
        ).addTo(mapInstanceRef.current)
      }
    }
  }, [finalLat, finalLon, finalHdm, isFromDatabase])

  // Cleanup on close
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      headingLineRef.current = null
      trackLayerRef.current = null
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content map-modal map-fullscreen" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close map-close-button" onClick={onClose}>×</button>
        <div ref={mapRef} className="map-container map-fullheight"></div>
      </div>
    </div>
  )
}
