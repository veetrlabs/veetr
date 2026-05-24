import '../Dashboard.css'

interface WindCardProps {
  windSpeed: number
  title: string
  onClick?: () => void
}

export default function WindCard({ windSpeed, title, onClick }: WindCardProps) {
  const isTrue = title.toLowerCase().includes('true')
  const label = isTrue ? 'TWS' : 'AWS'
  const displaySpeed = windSpeed > 0 ? windSpeed.toFixed(1) : '0.0'

  return (
    <div className="card wind-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="card-value">
        <span className="card-title">{label}</span>
        <span className="value-unit-row">
          <span className="value-number">{displaySpeed}</span>
          <span className="card-unit">kt</span>
        </span>
      </div>
    </div>
  )
}
