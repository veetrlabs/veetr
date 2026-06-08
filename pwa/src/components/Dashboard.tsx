import { useBLE } from '../context/BLEContext'
import SpeedCard from './cards/SpeedCard'
import WindCard from './cards/WindCard'
import TiltCard from './cards/TiltCard'
import ApparentAngleCard from './cards/ApparentAngleCard'
import TrueWindAngleCard from './cards/TrueWindAngleCard'
import WindAngleCard from './cards/WindAngleCard'
import StartingLineCard from './cards/StartingLineCard'
import HeadingCard from './cards/HeadingCard'
import CompactConnectionButton from './CompactConnectionButton'
import SatelliteButton from './SatelliteButton'
import BluetoothButton from './BluetoothButton'
import './Dashboard.css'

export default function Dashboard() {
  const { state } = useBLE()
  const { sailingData } = state

  return (
    <div className="dashboard">
      <CompactConnectionButton />
      <SatelliteButton />
      <BluetoothButton />
      <div className="dashboard-layout">
        <div className="wind-direction-area">
          <WindAngleCard
            windDirection={sailingData.windDirection}
            windSpeed={sailingData.windSpeed}
            trueWindSpeed={sailingData.trueWindSpeed}
            trueWindAngle={sailingData.trueWindAngle}
            deadWindAngle={sailingData.deadWindAngle}
            heading={sailingData.heading}
          />
        </div>
        <div className="dashboard-cards-area">
          <WindCard
            windSpeed={sailingData.windSpeed}
            title="Apparent Wind"
          />
          <ApparentAngleCard angle={sailingData.windAngle} />
          <WindCard
            windSpeed={sailingData.trueWindSpeed}
            title="True Wind"
          />
          <TrueWindAngleCard twa={sailingData.trueWindAngle} />
          <SpeedCard 
            speed={sailingData.gpsSpeed > 0.5 ? sailingData.gpsSpeed : sailingData.speed}
            satellites={sailingData.gpsSatellites}
          />
          <HeadingCard 
            heading={sailingData.heading}
          />
          <StartingLineCard 
            hasStartLine={sailingData.hasStartLine}
            distanceToLine={sailingData.distanceToLine}
          />
          <TiltCard
            tilt={sailingData.tilt}
            portMax={sailingData.tiltPortMax}
            starboardMax={sailingData.tiltStarboardMax}
          />
        </div>
      </div>
    </div>
  )
}
