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
  private pendingReply: { type: string; index?: number; resolve: (data: any) => void; reject: (error: Error) => void } | null = null
  private startTime = 0
  private lastWritten = 0
  private diagnostic = "preparing"
  private writeChunk: (chunkIndex: number, data: string) => Promise<void>

  constructor(
    writeChunk: (chunkIndex: number, data: string) => Promise<void>,
    onProgress: FirmwareUpdateCallback,
    private maxWriteBytes = 512
  ) {
    this.writeChunk = writeChunk
    this.onProgress = onProgress
  }

  handleResponse(data: any): void {
    const pending = this.pendingReply
    if (!pending) return
    if (['error', 'update_error', 'chunk_error'].includes(data.type)) {
      pending.reject(new Error(`Device rejected ${this.diagnostic}: ${typeof data.message === 'string' ? data.message : 'Firmware update rejected'}; confirmed=${this.lastWritten} bytes, payload limit=${this.maxWriteBytes}`))
    } else if (data.type === pending.type && (pending.index === undefined || data.index === pending.index)) {
      if (data.type === "chunk_ack" && Number.isFinite(data.written)) this.lastWritten = data.written
      pending.resolve(data)
    }
  }

  abort(): void {
    this.aborted = true
    this.pendingReply?.reject(new Error('Firmware update was aborted'))
  }

  private checkAborted(): void {
    if (this.aborted) throw new Error('Firmware update was aborted')
  }

  private exchange(command: object, type: string, index?: number, timeoutMs = 10000): Promise<any> {
    this.checkAborted()
    const encoded = JSON.stringify(command)
    // OTA commands are ASCII, so their character length is their byte length.
    if (encoded.length > this.maxWriteBytes) return Promise.reject(new Error('Bluetooth packet size is too small for a firmware update. Reconnect and try again.'))
    return new Promise((resolve, reject) => {
      const finish = (error?: Error, data?: any) => {
        if (this.pendingReply !== pending) return
        clearTimeout(timeout)
        this.pendingReply = null
        if (error) reject(error)
        else resolve(data)
      }
      const pending = { type, index, resolve: (data: any) => finish(undefined, data), reject: (error: Error) => finish(error) }
      const timeout = setTimeout(() => finish(new Error(`Timeout waiting for ${type}${index === undefined ? '' : ` for chunk ${index}`}`)), timeoutMs)
      this.pendingReply = pending
      // Install the listener before writing: replies can arrive before the write resolves.
      void this.writeChunk(index ?? -1, encoded).catch(error => {
        const codes = ['errorCode', 'attErrorCode', 'iosErrorCode', 'androidErrorCode']
          .filter(key => Number.isFinite(error?.[key])).map(key => `${key}=${error[key]}`).join(', ')
        finish(new Error(`BLE write failed during ${this.diagnostic}: ${error instanceof Error ? error.message : String(error)}${codes ? ` (${codes})` : ''}; packet=${encoded.length}, limit=${this.maxWriteBytes}`))
      })
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

      const overhead = JSON.stringify({ cmd: FIRMWARE_COMMANDS.TRANSFER_CHUNK, index: firmwareData.byteLength, data: '' }).length
      this.chunkSize = Math.min(200, Math.floor((this.maxWriteBytes - overhead) / 4) * 3)
      if (this.chunkSize < 1) throw new Error('Bluetooth packet size is too small for a firmware update. Reconnect and try again.')
      this.diagnostic = `START_FW_UPDATE (${firmwareData.byteLength} bytes)`
      const ready = await this.initializeUpdate(firmwareData.byteLength)
      if (Number.isInteger(ready.maxChunkBytes) && ready.maxChunkBytes > 200) {
        this.chunkSize = Math.min(330, ready.maxChunkBytes, Math.floor((this.maxWriteBytes - overhead) / 4) * 3)
      }
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

  private async initializeUpdate(totalSize: number): Promise<any> {
    return this.exchange({ cmd: FIRMWARE_COMMANDS.START_UPDATE, size: totalSize }, 'update_ready', undefined, 30000)
  }

  private async transferFirmware(firmwareData: ArrayBuffer): Promise<void> {
    const totalChunks = Math.ceil(firmwareData.byteLength / this.chunkSize)

    let lastProgress = 0
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      this.checkAborted()
      const offset = chunkIndex * this.chunkSize
      const chunkSize = Math.min(this.chunkSize, firmwareData.byteLength - offset)
      const chunkData = new Uint8Array(firmwareData, offset, chunkSize)
      const base64Data = this.arrayBufferToBase64(chunkData)
      // Older firmware appends duplicate chunks. Stop on a lost acknowledgement
      // rather than blindly retrying and corrupting the update image.
      this.diagnostic = `chunk ${chunkIndex}, offset ${offset}, length ${chunkSize}`
      await this.exchange({ cmd: FIRMWARE_COMMANDS.TRANSFER_CHUNK, index: chunkIndex, data: base64Data }, 'chunk_ack', chunkIndex)

      const bytesTransferred = offset + chunkSize
      const percentage = Math.round((bytesTransferred / firmwareData.byteLength) * 90)
      const elapsedTimeMs = Date.now() - this.startTime
      const transferRate = bytesTransferred / elapsedTimeMs
      const remainingBytes = firmwareData.byteLength - bytesTransferred
      const estimatedRemainingTimeMs = remainingBytes / transferRate
      const estimatedTotalTimeMs = elapsedTimeMs + estimatedRemainingTimeMs

      if (chunkIndex === totalChunks - 1 || Date.now() - lastProgress >= 250) {
      lastProgress = Date.now()
      this.onProgress({
        percentage, bytesTransferred, totalBytes: firmwareData.byteLength,
        stage: 'transferring', message: `Transferring... ${chunkIndex + 1}/${totalChunks}`,
        elapsedTimeMs, estimatedTotalTimeMs, estimatedRemainingTimeMs
      })
      }
    }
  }

  private async verifyFirmware(): Promise<void> {
    this.onProgress({ percentage: 95, bytesTransferred: 0, totalBytes: 0, stage: 'verifying', message: 'Verifying firmware integrity...' })
    this.diagnostic = 'VERIFY_FW'
    await this.exchange({ cmd: FIRMWARE_COMMANDS.VERIFY_UPDATE }, 'update_complete', undefined, 30000)
  }

  private async applyUpdate(): Promise<void> {
    this.onProgress({ percentage: 98, bytesTransferred: 0, totalBytes: 0, stage: 'verifying', message: 'Applying firmware update...' })
    this.diagnostic = 'APPLY_FW'
    await this.exchange({ cmd: FIRMWARE_COMMANDS.APPLY_UPDATE }, 'restarting')
  }

  private arrayBufferToBase64(bytes: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }

}
