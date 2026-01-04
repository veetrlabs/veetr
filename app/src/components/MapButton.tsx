import './MapButton.css'

interface MapButtonProps {
  onClick: () => void
  hasGPS: boolean
}

export default function MapButton({ onClick, hasGPS }: MapButtonProps) {
  return (
    <button 
      className={`map-button ${!hasGPS ? 'no-gps' : ''}`}
      onClick={onClick}
      title={hasGPS ? 'Open navigation map' : 'Open map (no GPS signal)'}
    >
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
        <line x1="8" y1="2" x2="8" y2="18"></line>
        <line x1="16" y1="6" x2="16" y2="22"></line>
      </svg>
    </button>
  )
}
