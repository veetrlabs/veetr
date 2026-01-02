import { useState, useEffect } from 'react'
import { dataStorage } from '../utils/dataStorage'
import './DataManager.css'

export default function DataManager() {
  const [recordCount, setRecordCount] = useState<number>(0)
  const [storageSize, setStorageSize] = useState<number>(0)
  const [storageQuota, setStorageQuota] = useState<{ usage: number, quota: number, percentage: number }>({ usage: 0, quota: 0, percentage: 0 })
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    updateStats()
    const interval = setInterval(updateStats, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const updateStats = async () => {
    try {
      const count = await dataStorage.getReadingCount()
      const size = await dataStorage.getStorageSize()
      const quota = await dataStorage.getStorageQuota()
      setRecordCount(count)
      setStorageSize(size)
      setStorageQuota(quota)
    } catch (error) {
      console.error('Failed to get storage stats:', error)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const data = await dataStorage.exportData()
      
      // Convert to CSV
      const csv = convertToCSV(data)
      
      // Download as file
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `veetr-data-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      
      console.log(`Exported ${data.length} records`)
    } catch (error) {
      console.error('Failed to export data:', error)
      alert('Failed to export data. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleClear = async () => {
    if (!confirm(`Are you sure you want to delete all ${recordCount} stored records? This cannot be undone.`)) {
      return
    }

    try {
      await dataStorage.clearAllData()
      await updateStats()
      console.log('All data cleared')
    } catch (error) {
      console.error('Failed to clear data:', error)
      alert('Failed to clear data. Please try again.')
    }
  }

  const convertToCSV = (data: any[]): string => {
    if (data.length === 0) return ''

    // Headers
    const headers = [
      'Timestamp',
      'Date',
      'Time',
      'AWS (kt)',
      'AWA (°)',
      'SOG (kt)',
      'HDM (°)',
      'Heel (°)',
      'TWS (kt)',
      'TWA (°)',
      'Lat',
      'Lon',
      'Satellites',
      'Samples'
    ]

    // Rows
    const rows = data.map(reading => {
      const date = new Date(reading.timestamp)
      
      // Calculate true wind speed and angle
      const { tws, twa } = calculateTrueWind(
        reading.AWS,
        reading.AWA,
        reading.SOG
      )
      
      return [
        reading.timestamp,
        date.toISOString().split('T')[0],
        date.toTimeString().split(' ')[0],
        reading.AWS.toFixed(2),
        reading.AWA.toFixed(1),
        reading.SOG.toFixed(2),
        reading.HDM.toFixed(1),
        reading.heel.toFixed(1),
        tws.toFixed(2),
        twa.toFixed(1),
        reading.lat?.toFixed(6) || '',
        reading.lon?.toFixed(6) || '',
        reading.satellites || '',
        reading.sampleCount
      ]
    })

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
  }

  // Calculate true wind from apparent wind and boat speed
  const calculateTrueWind = (aws: number, awa: number, sog: number): { tws: number, twa: number } => {
    if (sog < 0.5) {
      // Boat is stationary, true wind = apparent wind
      return { tws: aws, twa: awa }
    }

    // Convert to radians
    const awaRad = (awa * Math.PI) / 180

    // Calculate true wind components
    const twsX = aws * Math.cos(awaRad) - sog
    const twsY = aws * Math.sin(awaRad)

    // Calculate true wind speed
    const tws = Math.sqrt(twsX * twsX + twsY * twsY)

    // Calculate true wind angle
    let twa = (Math.atan2(twsY, twsX) * 180) / Math.PI
    if (twa < 0) twa += 360

    return { tws, twa }
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const estimatedDuration = Math.round((recordCount * 10) / 60) // 10 seconds per record, converted to minutes
  const maxRecords = dataStorage.getMaxRecords()
  const capacityPercentage = (recordCount / maxRecords) * 100
  const isNearCapacity = capacityPercentage > 80

  return (
    <div className="data-manager">
      <h4>Data Storage</h4>
      
      <div className="storage-stats">
        <div className="stat-item">
          <span className="stat-label">Records:</span>
          <span className="stat-value">
            {recordCount.toLocaleString()} / {maxRecords.toLocaleString()}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Capacity:</span>
          <span className="stat-value">{capacityPercentage.toFixed(0)}%</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Duration:</span>
          <span className="stat-value">~{estimatedDuration} min</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Storage:</span>
          <span className="stat-value">{formatSize(storageSize)}</span>
        </div>
      </div>

      {isNearCapacity && (
        <div className="capacity-warning">
          ⚠️ Storage is {capacityPercentage.toFixed(0)}% full. Old data will be automatically deleted when limit is reached.
        </div>
      )}

      <div className="data-info">
        <p>Sensor data is automatically saved every 10 seconds (averaged).</p>
      </div>

      <div className="data-actions">
        <button 
          onClick={handleExport}
          disabled={recordCount === 0 || isExporting}
          className="btn btn-secondary"
        >
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>

        <button 
          onClick={handleClear}
          disabled={recordCount === 0}
          className="btn btn-danger"
        >
          Clear All Data
        </button>
      </div>
    </div>
  )
}
