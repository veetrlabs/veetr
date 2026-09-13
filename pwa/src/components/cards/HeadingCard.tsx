import '../Dashboard.css'

interface HeadingCardProps {
  heading: number
}

export default function HeadingCard({ heading }: HeadingCardProps) {
  const displayHeading = heading.toFixed(0)

  return (
    <div className="card heading-card">
      <div className="card-value">
        <span className="card-title">HDG</span>
        <span className="value-unit-row">
          <span className="value-number">{displayHeading}</span>
          <span className="card-unit">°</span>
        </span>
      </div>
    </div>
  )
}
