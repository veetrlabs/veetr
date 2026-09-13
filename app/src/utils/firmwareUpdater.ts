export interface FirmwareUpdateProgress {
  percentage: number
  bytesTransferred: number
  totalBytes: number
  stage: 'preparing' | 'transferring' | 'verifying' | 'complete' | 'error'
  message: string
  elapsedTimeMs?: number
  estimatedTotalTimeMs?: number
  estimatedRemainingTimeMs?: number
}

export type FirmwareUpdateCallback = (progress: FirmwareUpdateProgress) => void

export const FIRMWARE_COMMANDS = {
  GET_VERSION: 'GET_FW_VERSION',
  START_UPDATE: 'START_FW_UPDATE',
  TRANSFER_CHUNK: 'FW_CHUNK',
  VERIFY_UPDATE: 'VERIFY_FW',
  APPLY_UPDATE: 'APPLY_FW',
  STOP_UPDATE: 'STOP_FW_UPDATE',
  GET_OTA_STATUS: 'GET_OTA_STATUS'
} as const

export function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export class BLEFirmwareUpdater {
  private onProgress: FirmwareUpdateCallback
  private chunkSize = 200
  private aborted = false
  private pendingAckResolve: ((value: any) => void) | null = null
  private expectedChunkIndex = 0
  private startTime = 0
  private writeChunk: (chunkIndex: number, data: string) => Promise<void>

  constructor(
    writeChunk: (chunkIndex: number, data: string) => Promise<void>,
    onProgress: FirmwareUpdateCallback
  ) {
    this.writeChunk = writeChunk
    this.onProgress = onProgress
  }

  handleChunkAck(data: any): void {
    if (this.pendingAckResolve && data.index === this.expectedChunkIndex) {
      this.pendingAckResolve(data)
      this.pendingAckResolve = null
    }
  }

  abort(): void {
    this.aborted = true
    this.pendingAckResolve = null
  }

  private checkAborted(): void {
    if (this.aborted) throw new Error('Firmware update was aborted')
  }

  private async waitForChunkAck(chunkIndex: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingAckResolve = null
        reject(new Error(`Timeout waiting for chunk ${chunkIndex} acknowledgment`))
      }, 5000)
      this.pendingAckResolve = (data: any) => {
        clearTimeout(timeout)
        resolve(data)
      }
    })
  }

  async updateFirmware(firmwareData: ArrayBuffer): Promise<void> {
    try {
      this.startTime = Date.now()
      this.onProgress({
        percentage: 0, bytesTransferred: 0, totalBytes: firmwareData.byteLength,
        stage: 'preparing', message: 'Preparing firmware update...',
        elapsedTimeMs: 0, estimatedTotalTimeMs: 0, estimatedRemainingTimeMs: 0
      })

      await this.initializeUpdate(firmwareData.byteLength)
      await this.transferFirmware(firmwareData)
      await this.verifyFirmware()
      await this.applyUpdate()

      this.onProgress({
        percentage: 100, bytesTransferred: firmwareData.byteLength,
        totalBytes: firmwareData.byteLength, stage: 'complete',
        message: 'Firmware update sent successfully! Device is restarting.'
      })
    } catch (error) {
      this.onProgress({
        percentage: 0, bytesTransferred: 0, totalBytes: firmwareData.byteLength,
        stage: 'error', message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
      throw error
    }
  }

  private async initializeUpdate(totalSize: number): Promise<void> {
    const command = JSON.stringify({ cmd: FIRMWARE_COMMANDS.START_UPDATE, size: totalSize })
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.writeChunk(-1, command)
        await this.delay(2000)
        return
      } catch (error) {
        if (attempt === 3) throw new Error(`Failed to initialize update: ${error}`)
        await this.delay(1000)
      }
    }
  }

  private async transferFirmware(firmwareData: ArrayBuffer): Promise<void> {
    const totalChunks = Math.ceil(firmwareData.byteLength / this.chunkSize)
    const dataView = new DataView(firmwareData)

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      this.checkAborted()
      const offset = chunkIndex * this.chunkSize
      const chunkSize = Math.min(this.chunkSize, firmwareData.byteLength - offset)
      const chunkData = new Uint8Array(firmwareData, offset, chunkSize)
      const base64Data = this.arrayBufferToBase64(chunkData.buffer)

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          this.expectedChunkIndex = chunkIndex
          const ackPromise = this.waitForChunkAck(chunkIndex)
          const command = JSON.stringify({ cmd: FIRMWARE_COMMANDS.TRANSFER_CHUNK, index: chunkIndex, data: base64Data })
          await this.writeChunk(chunkIndex, command)
          await ackPromise
          break
        } catch (error) {
          if (attempt === 3) throw new Error(`Failed to send chunk ${chunkIndex}: ${error}`)
          await this.delay(500)
        }
      }

      const bytesTransferred = offset + chunkSize
      const percentage = Math.round((bytesTransferred / firmwareData.byteLength) * 90)
      const elapsedTimeMs = Date.now() - this.startTime
      const transferRate = bytesTransferred / elapsedTimeMs
      const remainingBytes = firmwareData.byteLength - bytesTransferred
      const estimatedRemainingTimeMs = remainingBytes / transferRate
      const estimatedTotalTimeMs = elapsedTimeMs + estimatedRemainingTimeMs

      this.onProgress({
        percentage, bytesTransferred, totalBytes: firmwareData.byteLength,
        stage: 'transferring', message: `Transferring... ${chunkIndex + 1}/${totalChunks}`,
        elapsedTimeMs, estimatedTotalTimeMs, estimatedRemainingTimeMs
      })
    }
  }

  private async verifyFirmware(): Promise<void> {
    this.onProgress({ percentage: 95, bytesTransferred: 0, totalBytes: 0, stage: 'verifying', message: 'Verifying firmware integrity...' })
    await this.writeChunk(-1, JSON.stringify({ cmd: FIRMWARE_COMMANDS.VERIFY_UPDATE }))
    await this.delay(8000)
  }

  private async applyUpdate(): Promise<void> {
    this.onProgress({ percentage: 98, bytesTransferred: 0, totalBytes: 0, stage: 'verifying', message: 'Applying firmware update...' })
    await this.writeChunk(-1, JSON.stringify({ cmd: FIRMWARE_COMMANDS.APPLY_UPDATE }))
    await this.delay(8000)
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
