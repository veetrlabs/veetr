import '../Dashboard.css'

interface StartingLineCardProps {
  hasStartLine: boolean
  distanceToLine: number | null
}

export default function StartingLineCard({ hasStartLine, distanceToLine }: StartingLineCardProps) {
  const formatDistance = (distance: number | null) => {
    if (!hasStartLine || distance === null) return null
    // Show absolute value with +/- indicator
    return Math.abs(distance).toFixed(0)
  }

  const distanceValue = formatDistance(distanceToLine)
  const isBehindLine = distanceToLine !== null && distanceToLine < 0

  return (
    <div className="card starting-line-card">
      <div className="card-value">
        <span className="card-title">Line</span>
        {distanceValue ? (
          <span className="value-unit-row">
            {isBehindLine && <span style={{ color: '#ff9800', marginRight: '4px' }}>−</span>}
            <span className="value-number">{distanceValue}</span>
            <span className="card-unit">m</span>
          </span>
        ) : (
          <span className="value-number">--</span>
        )}
      </div>
    </div>
  )
}