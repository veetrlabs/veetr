import '../Dashboard.css'
import './WindAngleCard.css'
import { useSmoothRotation } from '../../hooks/useSmoothRotation'

interface WindAngleCardProps {
  windDirection: number
  windSpeed: number
  trueWindSpeed: number
  trueWindAngle: number
  deadWindAngle: number
  heading: number
}

export default function WindAngleCard({ 
  windDirection, 
  windSpeed: _windSpeed, 
  trueWindSpeed, 
  trueWindAngle,
  deadWindAngle,
  heading 
}: WindAngleCardProps) {
  const smoothWindDirection = useSmoothRotation(windDirection, { duration: 800 })
  const smoothTrueWindAngle = useSmoothRotation(trueWindAngle, { duration: 800 })
  const smoothHeading = useSmoothRotation(heading, { duration: 1000 })

  return (
    <div className="card wind-angle-card">
      <div className="wind-compass">
        <svg viewBox="0 0 500 500" className="compass-svg">
          {/* Outer compass ring */}
          <circle 
            cx="250" 
            cy="250" 
            r="180" 
            className="compass-outer-ring"
            strokeWidth="4"
          />
          
          {/* Inner compass ring */}
          <circle 
            cx="250" 
            cy="250" 
            r="150" 
            className="compass-inner-ring"
            strokeWidth="2"
          />
          
          {/* North pointer on inner ring - rotates with boat heading to show compass direction */}
          <g transform={`rotate(${smoothHeading} 250 250)`}>
            <path
              d="M 245,99 L 250,84 L 255,99 Z"
              className="compass-north-pointer"
            />
            <text 
              x="250" 
              y="115" 
              className="compass-north-text"
              fontSize="12" 
              fontWeight="bold"
              textAnchor="middle"
            >
              N
            </text>
          </g>
          
          {/* Degree markers */}
          {Array.from({ length: 36 }, (_, i) => {
            const angle = i * 10;
            const isCardinal = angle % 90 === 0;
            const isMajor = angle % 30 === 0;
            const radius = isCardinal ? 165 : isMajor ? 170 : 175; // Start inside outer circle
            const endRadius = 180; // End at outer circle
            const x1 = 250 - radius * Math.sin((angle * Math.PI) / 180);
            const y1 = 250 - radius * Math.cos((angle * Math.PI) / 180);
            const x2 = 250 - endRadius * Math.sin((angle * Math.PI) / 180);
            const y2 = 250 - endRadius * Math.cos((angle * Math.PI) / 180);
            
            return (
              <line
                key={angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className="compass-tick-marks"
                strokeWidth={isCardinal ? "3" : isMajor ? "2" : "1"}
              />
            );
          })}
          
          {/* Degree labels for major markers (boat-relative, symmetrical) */}
          {Array.from({ length: 11 }, (_, i) => {
            const angle = i * 30;
            if (angle === 0) return null; // Skip 0° as we have "N" marker (bow)
            
            const radius = 195; // Position outside the outer circle
            
            // Create labels for both port and starboard sides
            const labels = [];
            
            if (angle <= 180) {
              // Starboard side (right)
              const x1 = 250 - radius * Math.sin((angle * Math.PI) / 180);
              const y1 = 250 - radius * Math.cos((angle * Math.PI) / 180);
              labels.push(
                <text
                  key={`starboard-${angle}`}
                  x={x1}
                  y={y1 + 4}
                  className="compass-degree-labels"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {angle}
                </text>
              );
              
              // Port side (left) - mirror the angle (use +Math.sin)
              if (angle !== 180) { // Don't duplicate 180° (stern)
                const x2 = 250 + radius * Math.sin((angle * Math.PI) / 180);
                const y2 = 250 - radius * Math.cos((angle * Math.PI) / 180);
                labels.push(
                  <text
                    key={`port-${angle}`}
                    x={x2}
                    y={y2 + 4}
                    className="compass-degree-labels"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {angle}
                  </text>
                );
              }
            }
            
            return labels;
          })}
          
          {/* Boat shape at center */}
          <path
            d="M 250,222 Q 264,250 257,278 Q 250,285 243,278 Q 236,250 250,222 Z"
            fill="var(--text-secondary)"
            stroke="var(--text-primary)"
            strokeWidth="2"
          />
          <circle cx="250" cy="250" r="5" fill="var(--text-primary)" stroke="var(--bg-card)" strokeWidth="2" />
          
          {/* Dead wind zone (red V) - drawn after boat to appear on top */}
          <path
            d={`M 250,250 L ${250 + 180 * Math.sin((deadWindAngle * Math.PI) / 180)},${250 - 180 * Math.cos((deadWindAngle * Math.PI) / 180)} M 250,250 L ${250 - 180 * Math.sin((deadWindAngle * Math.PI) / 180)},${250 - 180 * Math.cos((deadWindAngle * Math.PI) / 180)}`}
            stroke="var(--error-color)"
            strokeWidth="4"
            opacity="0.6"
          />
          
          {/* Apparent wind arrow */}
          <g transform={`rotate(${smoothWindDirection} 250 250)`}>
            <path
              d="M 240,70 L 250,250 L 260,70"
              fill="var(--accent-color)"
              stroke="none"
              strokeWidth="0"
              opacity="0.95"
            />
            <circle cx="250" cy="80" r="8" fill="var(--accent-color)" stroke="none" strokeWidth="0" />
            {/* Removed APP label for apparent wind arrow */}
          </g>
          
          {/* True wind angle indicator - triangle spanning from outer to inner circle */}
          {trueWindSpeed > 0 && trueWindAngle > 0 && (
            <g transform={`rotate(${smoothTrueWindAngle} 250 250)`}>
              <path
                d="M 240,70 L 250,100 L 260,70 Z"
                fill="var(--success-color)"
                stroke="var(--success-color)"
                strokeWidth="1"
                opacity="0.8"
              />
            </g>
          )}
          
          {/* No cardinal directions for max density */}
        </svg>
      </div>
    </div>
  )
}
