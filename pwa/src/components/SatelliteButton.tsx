import { useState } from 'react'
import { Satellite, X } from 'lucide-react'
import { useBLE } from '../context/BLEContext'
import './SatelliteButton.css'

export default function SatelliteButton() {
  const { state } = useBLE()
  const { sailingData } = state
  const [showModal, setShowModal] = useState(false)

  // Only show the satellite button when connected
  if (!state.isConnected) {
    return null
  }

  const formatLatLon = (value: number, isLatitude: boolean) => {
    if (!value || value === 0) return isLatitude ? "0.000°" : "0.000°"
    return `${Math.abs(value).toFixed(3)}°${isLatitude ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W')}`
  }

  const getHdopColor = (hdop: number) => {
    if (hdop <= 1.0) return '#22c55e' // Green - excellent
    if (hdop <= 2.0) return '#f97316' // Orange - good
    return '#ef4444' // Red - poor
  }

  const handleButtonClick = () => {
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
  }

  // Handle click outside modal to close
  const handleModalOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModal()
    }
  }

  return (
    <>
      <button 
        className="satellite-btn"
        onClick={handleButtonClick}
        title="GPS Information"
      >
        <Satellite 
          size={24} 
          className="satellite-icon" 
          style={{ color: getHdopColor(sailingData.hdop || 99) }}
        />
      </button>

      {/* GPS Information Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleModalOverlayClick}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>GPS Information</h3>
              <button 
                className="modal-close-btn"
                onClick={closeModal}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="gps-info-grid">
                <div className="gps-info-row">
                  <span className="gps-info-label">Satellites</span>
                  <span className="gps-info-value">{sailingData.gpsSatellites || 0}</span>
                </div>
                <div className="gps-info-row">
                  <span className="gps-info-label">HDOP</span>
                  <span className="gps-info-value">{(sailingData.hdop || 0).toFixed(1)}</span>
                </div>
                <div className="gps-info-row">
                  <span className="gps-info-label">Latitude</span>
                  <span className="gps-info-value">{formatLatLon(sailingData.lat || 0, true)}</span>
                </div>
                <div className="gps-info-row">
                  <span className="gps-info-label">Longitude</span>
                  <span className="gps-info-value">{formatLatLon(sailingData.lon || 0, false)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}