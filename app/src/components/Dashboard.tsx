import { View, StyleSheet, useWindowDimensions } from 'react-native'
import { useBLE } from '../context/BLEContext'
import SpeedCard from './cards/SpeedCard'
import WindCard from './cards/WindCard'
import TiltCard from './cards/TiltCard'
import ApparentAngleCard from './cards/ApparentAngleCard'
import TrueWindAngleCard from './cards/TrueWindAngleCard'
import WindAngleCard from './cards/WindAngleCard'
import StartingLineCard from './cards/StartingLineCard'
import HeadingCard from './cards/HeadingCard'

export default function Dashboard() {
  const { state } = useBLE()
  const { sailingData } = state
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const compass = (
    <WindAngleCard
      windDirection={sailingData.windDirection}
      trueWindSpeed={sailingData.trueWindSpeed}
      trueWindAngle={sailingData.trueWindAngle}
      deadWindAngle={sailingData.deadWindAngle}
      heading={sailingData.heading}
    />
  )

  const cardRows = (
    <>
      <View style={styles.cardRow}>
        <View style={styles.cardCell}>
          <WindCard windSpeed={sailingData.windSpeed} title="Apparent Wind" />
        </View>
        <View style={styles.cardCell}>
          <ApparentAngleCard awa={sailingData.windAngle} />
        </View>
      </View>
      <View style={styles.cardRow}>
        <View style={styles.cardCell}>
          <WindCard windSpeed={sailingData.trueWindSpeed} title="True Wind" />
        </View>
        <View style={styles.cardCell}>
          <TrueWindAngleCard twa={sailingData.trueWindAngle} />
        </View>
      </View>
      <View style={styles.cardRow}>
        <View style={styles.cardCell}>
          <SpeedCard speed={sailingData.gpsSpeed > 0.5 ? sailingData.gpsSpeed : sailingData.speed} />
        </View>
        <View style={styles.cardCell}>
          <HeadingCard heading={sailingData.heading} />
        </View>
      </View>
      <View style={styles.cardRow}>
        <View style={styles.cardCell}>
          <StartingLineCard
            hasStartLine={sailingData.hasStartLine}
            distanceToLine={sailingData.distanceToLine}
          />
        </View>
        <View style={styles.cardCell}>
          <TiltCard tilt={sailingData.tilt} />
        </View>
      </View>
    </>
  )

  return (
    <View style={styles.container}>
      {isLandscape ? (
        <View style={styles.landscapeWrap}>
          <View style={styles.compassColumn}>
            <View style={styles.compassWrapper}>
              {compass}
            </View>
          </View>
          <View style={styles.cardsColumn}>
            {cardRows}
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.compassSection}>
            {compass}
          </View>
          <View style={styles.cardsGrid}>
            {cardRows}
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    padding: 8,
    paddingBottom: 100,
  },
  compassSection: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    aspectRatio: 1,
    marginBottom: 12,
  },
  cardsGrid: {
    flex: 1,
    gap: 8,
  },
  landscapeWrap: {
    flex: 1,
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  compassColumn: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassWrapper: {
    width: '100%',
    maxWidth: 400,
    aspectRatio: 1,
  },
  cardsColumn: {
    flex: 3,
    gap: 8,
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  cardCell: {
    flex: 1,
  },
})