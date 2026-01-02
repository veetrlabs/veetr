// IndexedDB storage for sensor data with 10-second averaging

const DB_NAME = 'VeetrSensorData'
const DB_VERSION = 1
const STORE_NAME = 'sensorReadings'
const AVERAGING_INTERVAL_MS = 10000 // 10 seconds
const MAX_RECORDS = 50000 // ~5.7 days of sailing at 10s intervals
const AUTO_CLEANUP_THRESHOLD = 45000 // Clean up when 90% full

export interface SensorReading {
  timestamp: number
  AWS: number    // Apparent Wind Speed
  AWA: number    // Apparent Wind Angle
  SOG: number    // Speed Over Ground
  HDM: number    // Heading Magnetic
  heel: number   // Heel angle
  lat?: number   // GPS Latitude
  lon?: number   // GPS Longitude
  satellites?: number
}

export interface AveragedReading extends SensorReading {
  id?: number
  sampleCount: number
}

class DataStorageManager {
  private db: IDBDatabase | null = null
  private accumulator: {
    samples: SensorReading[]
    lastSaveTime: number
  } = {
    samples: [],
    lastSaveTime: Date.now()
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { 
            keyPath: 'id', 
            autoIncrement: true 
          })
          objectStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  async addReading(reading: SensorReading): Promise<void> {
    this.accumulator.samples.push(reading)

    const now = Date.now()
    const timeSinceLastSave = now - this.accumulator.lastSaveTime

    if (timeSinceLastSave >= AVERAGING_INTERVAL_MS) {
      await this.saveAveragedData()
    }
  }

  private async saveAveragedData(): Promise<void> {
    if (this.accumulator.samples.length === 0) return
    if (!this.db) throw new Error('Database not initialized')

    const averaged = this.calculateAverage(this.accumulator.samples)
    
    return new Promise(async (resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.add(averaged)

      request.onsuccess = async () => {
        this.accumulator.samples = []
        this.accumulator.lastSaveTime = Date.now()
        
        // Check if we need to cleanup old records
        await this.autoCleanupIfNeeded()
        
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  private async autoCleanupIfNeeded(): Promise<void> {
    try {
      const count = await this.getReadingCount()
      
      if (count >= AUTO_CLEANUP_THRESHOLD) {
        console.log(`[DataStorage] Auto-cleanup triggered: ${count} records`)
        await this.deleteOldestRecords(count - MAX_RECORDS + 5000) // Keep 5000 buffer
      }
    } catch (error) {
      console.error('[DataStorage] Auto-cleanup failed:', error)
    }
  }

  private async deleteOldestRecords(deleteCount: number): Promise<void> {
    if (!this.db || deleteCount <= 0) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('timestamp')
      
      const deleteRequests: IDBRequest[] = []
      let deleted = 0

      const cursorRequest = index.openCursor()
      
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        
        if (cursor && deleted < deleteCount) {
          deleteRequests.push(store.delete(cursor.primaryKey))
          deleted++
          cursor.continue()
        } else {
          // All deletions queued
          Promise.all(deleteRequests.map(req => new Promise((res) => {
            req.onsuccess = () => res(null)
          }))).then(() => {
            console.log(`[DataStorage] Deleted ${deleted} old records`)
            resolve()
          })
        }
      }
      
      cursorRequest.onerror = () => reject(cursorRequest.error)
    })
  }

  private calculateAverage(samples: SensorReading[]): AveragedReading {
    const count = samples.length
    
    // Average all numeric values
    const averaged: AveragedReading = {
      timestamp: samples[samples.length - 1].timestamp, // Use latest timestamp
      AWS: this.avg(samples.map(s => s.AWS)),
      AWA: this.avgCircular(samples.map(s => s.AWA)),
      SOG: this.avg(samples.map(s => s.SOG)),
      HDM: this.avgCircular(samples.map(s => s.HDM)),
      heel: this.avg(samples.map(s => s.heel)),
      sampleCount: count
    }

    // Handle optional GPS data (only if present)
    const gpsReadings = samples.filter(s => s.lat !== undefined && s.lon !== undefined)
    if (gpsReadings.length > 0) {
      averaged.lat = this.avg(gpsReadings.map(s => s.lat!))
      averaged.lon = this.avg(gpsReadings.map(s => s.lon!))
      averaged.satellites = Math.round(this.avg(gpsReadings.map(s => s.satellites || 0)))
    }

    return averaged
  }

  private avg(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  // Average circular values (angles in degrees)
  private avgCircular(angles: number[]): number {
    if (angles.length === 0) return 0
    
    // Convert to radians and use vector averaging
    let sumSin = 0
    let sumCos = 0
    
    for (const angle of angles) {
      const rad = (angle * Math.PI) / 180
      sumSin += Math.sin(rad)
      sumCos += Math.cos(rad)
    }
    
    const avgRad = Math.atan2(sumSin / angles.length, sumCos / angles.length)
    let avgDeg = (avgRad * 180) / Math.PI
    
    // Normalize to 0-360
    if (avgDeg < 0) avgDeg += 360
    
    return avgDeg
  }

  async getReadings(startTime?: number, endTime?: number): Promise<AveragedReading[]> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('timestamp')
      
      let range: IDBKeyRange | undefined
      if (startTime && endTime) {
        range = IDBKeyRange.bound(startTime, endTime)
      } else if (startTime) {
        range = IDBKeyRange.lowerBound(startTime)
      } else if (endTime) {
        range = IDBKeyRange.upperBound(endTime)
      }

      const request = range ? index.getAll(range) : store.getAll()
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getReadingCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.count()
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()
      
      request.onsuccess = () => {
        this.accumulator.samples = []
        this.accumulator.lastSaveTime = Date.now()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async exportData(): Promise<AveragedReading[]> {
    return this.getReadings()
  }

  async getStorageSize(): Promise<number> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return 0
    }
    
    const estimate = await navigator.storage.estimate()
    return estimate.usage || 0
  }

  async getStorageQuota(): Promise<{ usage: number, quota: number, percentage: number }> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return { usage: 0, quota: 0, percentage: 0 }
    }
    
    const estimate = await navigator.storage.estimate()
    const usage = estimate.usage || 0
    const quota = estimate.quota || 0
    const percentage = quota > 0 ? (usage / quota) * 100 : 0
    
    return { usage, quota, percentage }
  }

  isNearCapacity(percentage: number): boolean {
    return percentage > 80
  }

  getMaxRecords(): number {
    return MAX_RECORDS
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// Singleton instance
export const dataStorage = new DataStorageManager()
