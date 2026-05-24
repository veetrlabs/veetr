import '../Dashboard.css'
import './TiltCard.css'

interface TiltCardProps {
  tilt: number
  portMax: number
  starboardMax: number
}

export default function TiltCard({ tilt }: TiltCardProps) {
  const displayTilt = Math.abs(tilt).toFixed(0)
  return (
    <div className="card tilt-card">
      <div className="card-value">
        <span className="card-title">HEEL</span>
        <span className="value-unit-row">
          <span className="value-number">{displayTilt}</span>
          <span className="card-unit">°</span>
        </span>
      </div>
    </div>
  )
}
