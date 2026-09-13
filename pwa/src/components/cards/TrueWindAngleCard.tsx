import '../Dashboard.css'

interface TrueWindAngleCardProps {
  twa: number
}

export default function TrueWindAngleCard({ twa }: TrueWindAngleCardProps) {
  return (
    <div className="card true-wind-angle-card">
      <div className="card-value">
        <span className="card-title">TWA</span>
        <span className="value-unit-row">
          <span className="value-number">{Math.abs(twa)}</span>
          <span className="card-unit">°</span>
        </span>
      </div>
    </div>
  )
}
