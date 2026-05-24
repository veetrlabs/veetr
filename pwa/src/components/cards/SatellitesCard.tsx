import '../Dashboard.css'

interface SatellitesCardProps {
  satellites: number
  hdop: number
  lat: number
  lon: number
}

export default function SatellitesCard({ satellites, hdop, lat, lon }: SatellitesCardProps) {
  const formatLatLon = (value: number, isLatitude: boolean) => {
    if (!value || value === 0) return isLatitude ? "0.000°" : "0.000°"
    return `${Math.abs(value).toFixed(3)}°${isLatitude ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W')}`
  }

  return (
    <div className="card satellites-card">
      <div className="card-value">
        <div className="gps-grid">
          <div className="gps-row">
            <span className="gps-label">SAT</span>
            <span className="gps-value">{satellites || 0}</span>
          </div>
          <div className="gps-row">
            <span className="gps-label">HDOP</span>
            <span className="gps-value">{(hdop || 0).toFixed(1)}</span>
          </div>
          <div className="gps-row">
            <span className="gps-label">LAT</span>
            <span className="gps-value">{formatLatLon(lat || 0, true)}</span>
          </div>
          <div className="gps-row">
            <span className="gps-label">LON</span>
            <span className="gps-value">{formatLatLon(lon || 0, false)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
