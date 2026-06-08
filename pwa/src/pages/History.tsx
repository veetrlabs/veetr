import { useState, useEffect } from 'react'
import { dataStorage } from '../utils/dataStorage'
import '../styles/History.css'

interface DataPoint {
  timestamp: number
  AWS: number
  TWS: number
  SOG: number
}

export default function History() {
  const [data, setData] = useState<DataPoint[]>([])
  const [timeRange, setTimeRange] = useState(10)
  const [loading, setLoading] = useState(true)

  const calculateTWS = (aws: number, awa: number, sog: number): number => {
    if (sog < 0.5) return aws
    const awaRad = (awa * Math.PI) / 180
    const twsX = aws * Math.cos(awaRad) - sog
    const twsY = aws * Math.sin(awaRad)
    return Math.sqrt(twsX * twsX + twsY * twsY)
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      const now = Date.now()
      const startTime = now - timeRange * 60 * 1000
      const readings = await dataStorage.getReadings(startTime, now)
      const processed = readings.map(r => ({
        timestamp: r.timestamp,
        AWS: r.AWS,
        TWS: calculateTWS(r.AWS, r.AWA, r.SOG),
        SOG: r.SOG,
      }))
      setData(processed)
      setLoading(false)
    }
    loadData()
  }, [timeRange])

  return (
    <div className="history-page">
      <h2 className="history-title">Historical Data</h2>

      <div className="history-range-row">
        {[10, 60, 720, 1440].map(m => (
          <button
            key={m}
            className={`history-range-btn ${timeRange === m ? 'active' : ''}`}
            onClick={() => setTimeRange(m)}
          >
            {m < 60 ? `${m}min` : m < 1440 ? `${m / 60}h` : `${m / 1440}d`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="history-status">Loading data...</p>
      ) : data.length === 0 ? (
        <p className="history-status">No data available for this time range</p>
      ) : (
        <div className="history-content">
          <div className="history-legend">
            <span className="legend-item"><span className="legend-dot" style={{ background: '#2196F3' }} /> AWS</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#4CAF50' }} /> TWS</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#FF9800' }} /> SOG</span>
          </div>
          <Chart data={data} />
          <Stats data={data} />
        </div>
      )}
    </div>
  )
}

function Chart({ data }: { data: DataPoint[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.AWS, d.TWS, d.SOG]), 1)

  return (
    <div className="history-chart">
      <div className="history-bars">
        {data.map((point, i) => {
          const hAws = (point.AWS / maxVal) * 200
          const hTws = (point.TWS / maxVal) * 200
          const hSog = (point.SOG / maxVal) * 200
          return (
            <div key={i} className="history-bar-group">
              <div className="history-bar" style={{ height: hAws, background: '#2196F3' }} title={`AWS: ${point.AWS.toFixed(1)}`} />
              <div className="history-bar" style={{ height: hTws, background: '#4CAF50' }} title={`TWS: ${point.TWS.toFixed(1)}`} />
              <div className="history-bar" style={{ height: hSog, background: '#FF9800' }} title={`SOG: ${point.SOG.toFixed(1)}`} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stats({ data }: { data: DataPoint[] }) {
  const calc = (arr: number[]) => ({
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
  })

  const aws = calc(data.map(d => d.AWS))
  const tws = calc(data.map(d => d.TWS))
  const sog = calc(data.map(d => d.SOG))

  const renderStat = (title: string, s: { min: number; max: number; avg: number }) => (
    <div className="history-stat">
      <h4>{title} (kt)</h4>
      <p>Min: {s.min.toFixed(1)}</p>
      <p>Avg: {s.avg.toFixed(1)}</p>
      <p>Max: {s.max.toFixed(1)}</p>
    </div>
  )

  return (
    <div className="history-stats">
      {renderStat('AWS', aws)}
      {renderStat('TWS', tws)}
      {renderStat('SOG', sog)}
    </div>
  )
}
