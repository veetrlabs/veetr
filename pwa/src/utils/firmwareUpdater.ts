import { FirmwareUpdateProgress, FirmwareUpdateCallback, FIRMWARE_COMMANDS, formatTime } from '@veetr/shared'

export type { FirmwareUpdateProgress, FirmwareUpdateCallback }
export { FIRMWARE_COMMANDS, formatTime }

export class BLEFirmwareUpdater {
  private characteristic: BluetoothRemoteGATTCharacteristic
  private onProgress: FirmwareUpdateCallback
  private chunkSize = 200
  private aborted = false
  private pending: { type: string; index?: number; resolve: () => void; reject: (error: Error) => void } | null = null
  private stage = 'preparing'
  private terminalError: Error | null = null
  private startTime = 0

  constructor(
    characteristic: BluetoothRemoteGATTCharacteristic,
    onProgress: FirmwareUpdateCallback
  ) {
    this.characteristic = characteristic
    this.onProgress = onProgress
    this.aborted = false
  }

  handleResponse(data: { type: string; index?: number; message?: string; error?: string }): boolean {
    if (['error', 'update_error', 'chunk_error'].includes(data.type)) {
      this.terminalError = new Error(`Device rejected ${this.stage}: ${data.message || data.error || data.type}`)
      this.pending?.reject(this.terminalError)
      return true
    }
    if (this.pending && data.type === this.pending.type &&
        (this.pending.index === undefined || data.index === this.pending.index)) {
      this.pending.resolve()
      return true
    }
    return false
  }

  handleChunkAck(data: { type: string; index?: number }): void {
    this.handleResponse(data)
  }

  abort(): void {
    this.aborted = true
    this.pending?.reject(new Error('Firmware update was aborted'))
  }

  private checkAborted(): void {
    if (this.terminalError) throw this.terminalError
    if (this.aborted) throw new Error('Firmware update was aborted')
  }

  private async commandWithAck(command: object, type: string, stage: string, index?: number): Promise<void> {
    this.checkAborted()
    this.stage = stage
    const bytes = new TextEncoder().encode(JSON.stringify(command))
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timeout)
        this.pending = null
        if (error) reject(error)
        else resolve()
      }
      const timeout = setTimeout(() => finish(new Error(
        `No ${type} response during ${stage} (${bytes.length} BLE bytes). Transfer stopped; no chunk resent.`
      )), type === 'chunk_ack' ? 10000 : 30000)
      // Install the listener before writing: notifications can arrive before the write resolves.
      const pending = { type, index, resolve: () => finish(), reject: (error: Error) => finish(error) }
      this.pending = pending
      this.characteristic.writeValueWithoutResponse(bytes).catch(error => {
        if (this.pending === pending) finish(new Error(`BLE write failed during ${stage}: ${error instanceof Error ? error.message : String(error)}`))
      })
    })
  }

  async getCurrentVersion(): Promise<string> {
    try {
      const command = JSON.stringify({ cmd: FIRMWARE_COMMANDS.GET_VERSION })
      const encoder = new TextEncoder()
      await this.characteristic.writeValue(encoder.encode(command))
      return 'v1.0.0'
    } catch (error) {
      throw new Error('Could not retrieve current firmware version')
    }
  }

  async updateFirmware(firmwareData: ArrayBuffer): Promise<void> {
    try {
      this.startTime = Date.now()

      this.onProgress({
        percentage: 0,
        bytesTransferred: 0,
        totalBytes: firmwareData.byteLength,
        stage: 'preparing',
        message: 'Preparing firmware update...',
        elapsedTimeMs: 0,
        estimatedTotalTimeMs: 0,
        estimatedRemainingTimeMs: 0
      })

      await this.initializeUpdate(firmwareData.byteLength)
      await this.transferFirmware(firmwareData)
      await this.verifyFirmware()
      await this.applyUpdate()

      this.onProgress({
        percentage: 100,
        bytesTransferred: firmwareData.byteLength,
        totalBytes: firmwareData.byteLength,
        stage: 'complete',
        message: 'Firmware update sent successfully! Device is restarting. Please reconnect to verify new version.'
      })

    } catch (error) {
      this.onProgress({
        percentage: 0,
        bytesTransferred: 0,
        totalBytes: firmwareData.byteLength,
        stage: 'error',
        message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
      throw error
    }
  }

  private async initializeUpdate(totalSize: number): Promise<void> {
    await this.commandWithAck({ cmd: FIRMWARE_COMMANDS.START_UPDATE, size: totalSize }, 'update_ready', 'initialization')
  }

  private async transferFirmware(firmwareData: ArrayBuffer): Promise<void> {
    const totalChunks = Math.ceil(firmwareData.byteLength / this.chunkSize)
    const dataView = new DataView(firmwareData)

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      this.checkAborted()

      const offset = chunkIndex * this.chunkSize
      const chunkSize = Math.min(this.chunkSize, firmwareData.byteLength - offset)

      const chunkData = new ArrayBuffer(chunkSize)
      const chunkView = new Uint8Array(chunkData)

      for (let i = 0; i < chunkSize; i++) {
        chunkView[i] = dataView.getUint8(offset + i)
      }

      await this.sendFirmwareChunk(chunkIndex, chunkData)

      const bytesTransferred = offset + chunkSize
      const percentage = Math.round((bytesTransferred / firmwareData.byteLength) * 90)

      const currentTime = Date.now()
      const elapsedTimeMs = currentTime - this.startTime
      const transferRate = bytesTransferred / elapsedTimeMs
      const remainingBytes = firmwareData.byteLength - bytesTransferred
      const estimatedRemainingTimeMs = remainingBytes / transferRate
      const estimatedTotalTimeMs = elapsedTimeMs + estimatedRemainingTimeMs

      this.onProgress({
        percentage,
        bytesTransferred,
        totalBytes: firmwareData.byteLength,
        stage: 'transferring',
        message: `Transferring firmware... ${chunkIndex + 1}/${totalChunks} chunks`,
        elapsedTimeMs,
        estimatedTotalTimeMs,
        estimatedRemainingTimeMs
      })
    }
  }

  private async sendFirmwareChunk(chunkIndex: number, chunkData: ArrayBuffer): Promise<void> {
    // Legacy firmware appends chunks without deduplicating indices. Never retry an uncertain write.
    await this.commandWithAck({
      cmd: FIRMWARE_COMMANDS.TRANSFER_CHUNK,
      index: chunkIndex,
      data: this.arrayBufferToBase64(chunkData)
    }, 'chunk_ack', `chunk ${chunkIndex}, offset ${chunkIndex * this.chunkSize}, ${chunkData.byteLength} firmware bytes`, chunkIndex)
  }

  private async verifyFirmware(): Promise<void> {
    this.onProgress({
      percentage: 95,
      bytesTransferred: 0,
      totalBytes: 0,
      stage: 'verifying',
      message: 'Verifying firmware integrity...'
    })

    await this.commandWithAck({ cmd: FIRMWARE_COMMANDS.VERIFY_UPDATE }, 'update_complete', 'verification')
  }

  private async applyUpdate(): Promise<void> {
    this.onProgress({
      percentage: 98,
      bytesTransferred: 0,
      totalBytes: 0,
      stage: 'verifying',
      message: 'Applying firmware update (device will restart)...'
    })

    await this.commandWithAck({ cmd: FIRMWARE_COMMANDS.APPLY_UPDATE }, 'restarting', 'restart')
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

}
