import { SensorReading, AveragedReading } from '@veetr/shared/types'

const DB_NAME = 'VeetrSensorData'
const DB_VERSION = 1
const STORE_NAME = 'sensorReadings'
const AVERAGING_INTERVAL_MS = 10000
const MAX_RECORDS = 50000
const AUTO_CLEANUP_THRESHOLD = 45000

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
        await this.deleteOldestRecords(count - MAX_RECORDS + 5000)
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
          Promise.all(deleteRequests.map(req => new Promise((res) => {
            req.onsuccess = () => res(null)
          }))).then(() => {
            resolve()
          })
        }
      }

      cursorRequest.onerror = () => reject(cursorRequest.error)
    })
  }

  private calculateAverage(samples: SensorReading[]): AveragedReading {
    const count = samples.length

    const averaged: AveragedReading = {
      timestamp: samples[samples.length - 1].timestamp,
      AWS: this.avg(samples.map(s => s.AWS)),
      AWA: this.avgCircular(samples.map(s => s.AWA)),
      SOG: this.avg(samples.map(s => s.SOG)),
      HDM: this.avgCircular(samples.map(s => s.HDM)),
      heel: this.avg(samples.map(s => s.heel)),
      pitch: this.avg(samples.map(s => s.pitch)),
      sampleCount: count
    }

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

  private avgCircular(angles: number[]): number {
    if (angles.length === 0) return 0

    let sumSin = 0
    let sumCos = 0

    for (const angle of angles) {
      const rad = (angle * Math.PI) / 180
      sumSin += Math.sin(rad)
      sumCos += Math.cos(rad)
    }

    const avgRad = Math.atan2(sumSin / angles.length, sumCos / angles.length)
    let avgDeg = (avgRad * 180) / Math.PI

    if (avgDeg < 0) avgDeg += 360

    return avgDeg
  }

  async getReadings(startTime?: number, endTime?: number, limit?: number): Promise<AveragedReading[]> {
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

      if (limit && !startTime && !endTime) {
        const results: AveragedReading[] = []
        const request = index.openCursor(null, 'prev')

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor && results.length < limit) {
            results.push(cursor.value)
            cursor.continue()
          } else {
            resolve(results.reverse())
          }
        }
        request.onerror = () => reject(request.error)
      } else {
        const request = range ? index.getAll(range) : store.getAll()

        request.onsuccess = () => {
          const results = request.result
          if (limit && results.length > limit) {
            resolve(results.slice(-limit))
          } else {
            resolve(results)
          }
        }
        request.onerror = () => reject(request.error)
      }
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

  async getLastReading(): Promise<AveragedReading | null> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('timestamp')

      const request = index.openCursor(null, 'prev')

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          resolve(cursor.value as AveragedReading)
        } else {
          resolve(null)
        }
      }
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

export const dataStorage = new DataStorageManager()

export async function getLastReading(): Promise<AveragedReading | null> {
  return dataStorage.getLastReading()
}

export async function getAllReadings(limit?: number): Promise<AveragedReading[]> {
  return dataStorage.getReadings(undefined, undefined, limit)
}
