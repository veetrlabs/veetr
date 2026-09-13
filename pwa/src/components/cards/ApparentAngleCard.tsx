import '../Dashboard.css'
import './TiltCard.css'

interface ApparentAngleCardProps {
  angle: number
}

export default function ApparentAngleCard({ angle }: ApparentAngleCardProps) {
  return (
    <div className="card apparent-angle-card">
      <div className="card-value">
        <span className="card-title">AWA</span>
        <span className="value-unit-row">
          <span className="value-number">{Math.abs(angle)}</span>
          <span className="card-unit">°</span>
        </span>
      </div>
    </div>
  )
}
