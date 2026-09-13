import AsyncStorage from '@react-native-async-storage/async-storage'

interface SensorReading {
  timestamp: number
  AWS: number
  AWA: number
  SOG: number
  HDM: number
  heel: number
  pitch: number
  lat?: number
  lon?: number
  satellites?: number
}

interface AveragedReading extends SensorReading {
  id?: string
  sampleCount: number
}

const STORAGE_KEY = '@veetr_sensor_data'
const STORAGE_KEY_PENDING = '@veetr_sensor_data_pending'
const STORAGE_KEY_ACCUM = '@veetr_sensor_accumulator'
const AVERAGING_INTERVAL_MS = 10000
const MAX_RECORDS = 50000
const AUTO_CLEANUP_THRESHOLD = 45000
const MAX_PENDING_BEFORE_COMPACT = 50

class DataStorageManager {
  private cache: AveragedReading[] = []
  private pending: AveragedReading[] = []
  private saving = false
  private accumulator: { samples: SensorReading[]; lastSaveTime: number } = {
    samples: [],
    lastSaveTime: Date.now()
  }

  private async loadMain(): Promise<AveragedReading[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY)
      return json ? JSON.parse(json) : []
    } catch {
      return []
    }
  }

  private async loadPending(): Promise<AveragedReading[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY_PENDING)
      return json ? JSON.parse(json) : []
    } catch {
      return []
    }
  }

  private async saveMain(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache))
  }

  private async savePending(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(this.pending))
  }

  async init(): Promise<void> {
    const [main, pending] = await Promise.all([this.loadMain(), this.loadPending()])

    if (pending.length > 0) {
      this.cache = [...main, ...pending]
      this.pending = []
      await this.saveMain()
      await AsyncStorage.removeItem(STORAGE_KEY_PENDING)
    } else {
      this.cache = main
    }

    try {
      const accumJson = await AsyncStorage.getItem(STORAGE_KEY_ACCUM)
      if (accumJson) {
        const saved = JSON.parse(accumJson)
        this.accumulator.samples = saved.samples || []
        if (this.accumulator.samples.length > 0) {
          await this.flushAccumulator()
        }
      }
    } catch {}
  }

  async addReading(reading: SensorReading): Promise<void> {
    this.accumulator.samples.push(reading)
    const now = Date.now()
    if (now - this.accumulator.lastSaveTime >= AVERAGING_INTERVAL_MS) {
      await this.flushAccumulator()
    }
  }

  private async flushAccumulator(): Promise<void> {
    if (this.accumulator.samples.length === 0) return
    if (this.saving) return

    this.saving = true
    try {
      const averaged = this.calculateAverage(this.accumulator.samples)
      this.pending.push(averaged)

      await this.savePending()

      this.accumulator.samples = []
      this.accumulator.lastSaveTime = Date.now()

      if (this.pending.length >= MAX_PENDING_BEFORE_COMPACT) {
        await this.compact()
      }
    } finally {
      this.saving = false
    }
  }

  private async compact(): Promise<void> {
    this.cache.push(...this.pending)
    this.pending = []
    await Promise.all([this.saveMain(), this.savePending()])
    await this.autoCleanupIfNeeded()
  }

  private async autoCleanupIfNeeded(): Promise<void> {
    if (this.cache.length >= AUTO_CLEANUP_THRESHOLD) {
      const deleteCount = this.cache.length - MAX_RECORDS + 5000
      if (deleteCount > 0) {
        this.cache.splice(0, deleteCount)
        await this.saveMain()
      }
    }
  }

  private calculateAverage(samples: SensorReading[]): AveragedReading {
    const count = samples.length
    const avg = (vals: number[]) => vals.reduce((s, v) => s + v, 0) / vals.length
    const avgCircular = (angles: number[]) => {
      let sumSin = 0, sumCos = 0
      for (const a of angles) {
        const rad = (a * Math.PI) / 180
        sumSin += Math.sin(rad)
        sumCos += Math.cos(rad)
      }
      let deg = (Math.atan2(sumSin / count, sumCos / count) * 180) / Math.PI
      if (deg < 0) deg += 360
      return deg
    }

    const averaged: AveragedReading = {
      timestamp: samples[samples.length - 1].timestamp,
      AWS: avg(samples.map(s => s.AWS)),
      AWA: avgCircular(samples.map(s => s.AWA)),
      SOG: avg(samples.map(s => s.SOG)),
      HDM: avgCircular(samples.map(s => s.HDM)),
      heel: avg(samples.map(s => s.heel)),
      pitch: avg(samples.map(s => s.pitch)),
      sampleCount: count
    }

    const gpsReadings = samples.filter(s => s.lat !== undefined && s.lon !== undefined)
    if (gpsReadings.length > 0) {
      averaged.lat = avg(gpsReadings.map(s => s.lat!))
      averaged.lon = avg(gpsReadings.map(s => s.lon!))
      averaged.satellites = Math.round(avg(gpsReadings.map(s => s.satellites || 0)))
    }

    return averaged
  }

  async getReadings(startTime?: number, endTime?: number, limit?: number): Promise<AveragedReading[]> {
    const all = [...this.cache, ...this.pending]
    let readings = all
    if (startTime) readings = readings.filter(r => r.timestamp >= startTime)
    if (endTime) readings = readings.filter(r => r.timestamp <= endTime)
    if (limit && readings.length > limit) readings = readings.slice(-limit)
    return readings
  }

  async getReadingCount(): Promise<number> {
    return this.cache.length + this.pending.length
  }

  async getLastReading(): Promise<AveragedReading | null> {
    if (this.pending.length > 0) return this.pending[this.pending.length - 1]
    if (this.cache.length > 0) return this.cache[this.cache.length - 1]
    return null
  }

  async clearAllData(): Promise<void> {
    this.cache = []
    this.pending = []
    this.accumulator.samples = []
    this.accumulator.lastSaveTime = Date.now()
    await AsyncStorage.multiRemove([STORAGE_KEY, STORAGE_KEY_PENDING, STORAGE_KEY_ACCUM])
  }

  async exportData(): Promise<AveragedReading[]> {
    return [...this.cache, ...this.pending]
  }

  async getStorageSize(): Promise<number> {
    try {
      const keys = [STORAGE_KEY, STORAGE_KEY_PENDING]
      const items = await AsyncStorage.multiGet(keys)
      return items.reduce((sum, [_, val]) => sum + (val ? val.length : 0), 0)
    } catch {
      return 0
    }
  }

  getMaxRecords(): number {
    return MAX_RECORDS
  }

  async close(): Promise<void> {
    if (this.accumulator.samples.length > 0) {
      await AsyncStorage.setItem(STORAGE_KEY_ACCUM, JSON.stringify({
        samples: this.accumulator.samples
      }))
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
