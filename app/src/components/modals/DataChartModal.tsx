import { useState, useEffect, useRef } from 'react'
import { dataStorage } from '../../utils/dataStorage'
import './DataChartModal.css'

interface DataPoint {
  timestamp: number
  AWS: number
  TWS: number
  SOG: number
}

interface DataChartModalProps {
  onClose: () => void
}

export default function DataChartModal({ onClose }: DataChartModalProps) {
  const [data, setData] = useState<DataPoint[]>([])
  const [timeRange, setTimeRange] = useState<number>(10) // minutes
  const [loading, setLoading] = useState(true)

  // Time range options in minutes
  const timeRangeOptions = [
    { value: 10, label: '10 minutes' },
    { value: 60, label: '1 hour' },
    { value: 720, label: '12 hours' },
    { value: 1440, label: '1 day' },
    { value: 4320, label: '3 days' },
    { value: 10080, label: '7 days' },
    { value: 20160, label: '14 days' },
    { value: 43200, label: '1 month' },
    { value: 129600, label: '3 months' },
    { value: 259200, label: '6 months' },
    { value: 525600, label: '1 year' }
  ]

  const calculateTWS = (aws: number, awa: number, sog: number): number => {
    if (sog < 0.5) return aws
    
    const awaRad = (awa * Math.PI) / 180
    const twsX = aws * Math.cos(awaRad) - sog
    const twsY = aws * Math.sin(awaRad)
    
    return Math.sqrt(twsX * twsX + twsY * twsY)
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const now = Date.now()
        const startTime = now - (timeRange * 60 * 1000)
        
        console.log(`[Chart] Loading data for ${timeRange} minutes from ${new Date(startTime).toISOString()} to ${new Date(now).toISOString()}`)
        
        const readings = await dataStorage.getReadings(startTime, now)
        
        console.log(`[Chart] Loaded ${readings.length} readings`)
        
        // Calculate TWS for each reading
        const processedData = readings.map(reading => ({
          timestamp: reading.timestamp,
          AWS: reading.AWS,
          TWS: calculateTWS(reading.AWS, reading.AWA, reading.SOG),
          SOG: reading.SOG
        }))
        
        setData(processedData)
        setLoading(false)
      } catch (error) {
        console.error('Failed to load chart data:', error)
        setLoading(false)
      }
    }

    loadData()
    const interval = setInterval(loadData, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [timeRange])

  const getChartStats = () => {
    if (data.length === 0) return { aws: { min: 0, max: 0, avg: 0 }, tws: { min: 0, max: 0, avg: 0 }, sog: { min: 0, max: 0, avg: 0 } }
    
    const awsValues = data.map(d => d.AWS).filter(v => !isNaN(v) && isFinite(v))
    const twsValues = data.map(d => d.TWS).filter(v => !isNaN(v) && isFinite(v))
    const sogValues = data.map(d => d.SOG).filter(v => !isNaN(v) && isFinite(v))
    
    if (awsValues.length === 0 || twsValues.length === 0 || sogValues.length === 0) {
      return { aws: { min: 0, max: 0, avg: 0 }, tws: { min: 0, max: 0, avg: 0 }, sog: { min: 0, max: 0, avg: 0 } }
    }
    
    return {
      aws: {
        min: Math.min(...awsValues),
        max: Math.max(...awsValues),
        avg: awsValues.reduce((a, b) => a + b, 0) / awsValues.length
      },
      tws: {
        min: Math.min(...twsValues),
        max: Math.max(...twsValues),
        avg: twsValues.reduce((a, b) => a + b, 0) / twsValues.length
      },
      sog: {
        min: Math.min(...sogValues),
        max: Math.max(...sogValues),
        avg: sogValues.reduce((a, b) => a + b, 0) / sogValues.length
      }
    }
  }

  const stats = getChartStats()

  return (
    <div className="chart-modal-overlay" onClick={onClose}>
      <div className="chart-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chart-header">
          <h3>Performance Data</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="time-range-selector">
          <label htmlFor="time-range">Time Range:</label>
          <select 
            id="time-range"
            value={timeRange} 
            onChange={(e) => setTimeRange(Number(e.target.value))}
          >
            {timeRangeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="chart-loading">Loading data...</div>
        ) : data.length === 0 ? (
          <div className="chart-empty">
            <p>No data available for this time range</p>
            <p className="chart-empty-hint">Data is stored every 10 seconds. Start sailing to collect data!</p>
          </div>
        ) : (
          <>
            <SimpleLineChart data={data} timeRange={timeRange} />
            
            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: '#2196F3' }}></span>
                <span className="legend-label">AWS</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: '#4CAF50' }}></span>
                <span className="legend-label">TWS</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: '#FF9800' }}></span>
                <span className="legend-label">SOG</span>
              </div>
            </div>

            <div className="chart-stats">
              <div className="stat-group">
                <h4>AWS (kt)</h4>
                <div className="stat-values">
                  <span>Min: {stats.aws.min.toFixed(1)}</span>
                  <span>Avg: {stats.aws.avg.toFixed(1)}</span>
                  <span>Max: {stats.aws.max.toFixed(1)}</span>
                </div>
              </div>
              <div className="stat-group">
                <h4>TWS (kt)</h4>
                <div className="stat-values">
                  <span>Min: {stats.tws.min.toFixed(1)}</span>
                  <span>Avg: {stats.tws.avg.toFixed(1)}</span>
                  <span>Max: {stats.tws.max.toFixed(1)}</span>
                </div>
              </div>
              <div className="stat-group">
                <h4>SOG (kt)</h4>
                <div className="stat-values">
                  <span>Min: {stats.sog.min.toFixed(1)}</span>
                  <span>Avg: {stats.sog.avg.toFixed(1)}</span>
                  <span>Max: {stats.sog.max.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface SimpleLineChartProps {
  data: DataPoint[]
  timeRange: number
}

function SimpleLineChart({ data, timeRange }: SimpleLineChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number, y: number, data: DataPoint } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    drawChart()
  }, [data, timeRange])

  const drawChart = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const width = rect.width
    const height = rect.height
    const padding = { top: 20, right: 20, bottom: 30, left: 40 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    if (data.length === 0) return

    // Find min/max for scaling
    const allValues = data.flatMap(d => [d.AWS, d.TWS, d.SOG]).filter(v => !isNaN(v) && isFinite(v))
    
    if (allValues.length === 0) {
      console.warn('[Chart] No valid values to display')
      return
    }
    
    const minValue = Math.max(0, Math.min(...allValues) - 2)
    const maxValue = Math.max(...allValues) + 2

    if (!isFinite(minValue) || !isFinite(maxValue) || minValue === maxValue) {
      console.warn('[Chart] Invalid min/max values:', { minValue, maxValue })
      return
    }

    // Use the requested time range for X-axis, not just the data range
    const now = Date.now()
    const timeMin = now - (timeRange * 60 * 1000)
    const timeMax = now

    // Helper function to convert data point to canvas coordinates
    const getX = (timestamp: number) => {
      return padding.left + ((timestamp - timeMin) / (timeMax - timeMin)) * chartWidth
    }

    const getY = (value: number) => {
      return padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight
    }

    // Draw grid
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i / 5) * chartHeight
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()
    }

    // Draw Y-axis labels
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#666'
    ctx.fillStyle = textColor
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 5; i++) {
      const value = minValue + (maxValue - minValue) * (1 - i / 5)
      const y = padding.top + (i / 5) * chartHeight
      ctx.fillText(value.toFixed(1), padding.left - 5, y + 4)
    }

    // Draw lines with gap detection
    const drawLine = (values: number[], color: string) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      
      const MAX_GAP_MS = 30000 // 30 seconds - break line if gap is larger
      
      data.forEach((point, index) => {
        const x = getX(point.timestamp)
        const y = getY(values[index])
        
        if (index === 0) {
          ctx.beginPath()
          ctx.moveTo(x, y)
        } else {
          const prevPoint = data[index - 1]
          const timeDiff = point.timestamp - prevPoint.timestamp
          
          if (timeDiff > MAX_GAP_MS) {
            // Gap detected - finish current path and start a new one
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(x, y)
          } else {
            // Continue line
            ctx.lineTo(x, y)
          }
        }
      })
      
      ctx.stroke()
    }

    drawLine(data.map(d => d.AWS), '#2196F3')
    drawLine(data.map(d => d.TWS), '#4CAF50')
    drawLine(data.map(d => d.SOG), '#FF9800')
  }

  const handleCanvasInteraction = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    const x = clientX - rect.left

    const padding = { top: 20, right: 20, bottom: 30, left: 40 }
    const chartWidth = rect.width - padding.left - padding.right

    // Check if click is within chart area
    if (x < padding.left || x > rect.width - padding.right) {
      setTooltip(null)
      return
    }

    // Find closest data point based on X position
    const now = Date.now()
    const timeMin = now - (timeRange * 60 * 1000)
    const timeMax = now
    const timeAtX = timeMin + ((x - padding.left) / chartWidth) * (timeMax - timeMin)

    let closestPoint = data[0]
    let minDistance = Math.abs(data[0].timestamp - timeAtX)

    data.forEach(point => {
      const distance = Math.abs(point.timestamp - timeAtX)
      if (distance < minDistance) {
        minDistance = distance
        closestPoint = point
      }
    })

    setTooltip({ x: clientX, y: clientY, data: closestPoint })
  }

  const handleMouseLeave = () => {
    setTooltip(null)
  }

  return (
    <div className="chart-container">
      <canvas 
        ref={canvasRef}
        className="chart-canvas"
        onMouseMove={handleCanvasInteraction}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleCanvasInteraction}
        onTouchMove={handleCanvasInteraction}
        onTouchEnd={handleMouseLeave}
      ></canvas>
      
      {tooltip && tooltip.data && (
        <div 
          className="chart-tooltip" 
          style={{ 
            left: tooltip.x + 10, 
            top: tooltip.y - 10 
          }}
        >
          <div className="tooltip-time">
            {formatDateTime(tooltip.data.timestamp)}
          </div>
          <div className="tooltip-values">
            <div className="tooltip-item">
              <span className="tooltip-color" style={{ backgroundColor: '#2196F3' }}></span>
              <span>AWS: {(tooltip.data.AWS ?? 0).toFixed(1)} kt</span>
            </div>
            <div className="tooltip-item">
              <span className="tooltip-color" style={{ backgroundColor: '#4CAF50' }}></span>
              <span>TWS: {(tooltip.data.TWS ?? 0).toFixed(1)} kt</span>
            </div>
            <div className="tooltip-item">
              <span className="tooltip-color" style={{ backgroundColor: '#FF9800' }}></span>
              <span>SOG: {(tooltip.data.SOG ?? 0).toFixed(1)} kt</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}
