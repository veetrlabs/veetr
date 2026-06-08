import { FirmwareUpdateProgress, FirmwareUpdateCallback, FIRMWARE_COMMANDS, formatTime } from '@veetr/shared'

export type { FirmwareUpdateProgress, FirmwareUpdateCallback }
export { FIRMWARE_COMMANDS, formatTime }

export class BLEFirmwareUpdater {
  private characteristic: BluetoothRemoteGATTCharacteristic
  private onProgress: FirmwareUpdateCallback
  private chunkSize = 200
  private aborted = false
  private pendingAckResolve: ((value: any) => void) | null = null
  private expectedChunkIndex = 0
  private startTime = 0

  constructor(
    characteristic: BluetoothRemoteGATTCharacteristic,
    onProgress: FirmwareUpdateCallback
  ) {
    this.characteristic = characteristic
    this.onProgress = onProgress
    this.aborted = false
  }

  handleChunkAck(data: any): void {
    if (this.pendingAckResolve && data.index === this.expectedChunkIndex) {
      this.pendingAckResolve(data)
      this.pendingAckResolve = null
    }
  }

  abort(): void {
    this.aborted = true
    if (this.pendingAckResolve) {
      this.pendingAckResolve = null
    }
  }

  private checkAborted(): void {
    if (this.aborted) {
      throw new Error('Firmware update was aborted')
    }
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
    const command = JSON.stringify({
      cmd: FIRMWARE_COMMANDS.START_UPDATE,
      size: totalSize
    })

    const encoder = new TextEncoder()

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.characteristic.writeValueWithoutResponse(encoder.encode(command))
        await this.delay(2000)
        break
      } catch (error) {
        if (attempt === 3) {
          throw new Error(`Failed to initialize update after 3 attempts: ${error}`)
        }
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

      const chunkData = new ArrayBuffer(chunkSize)
      const chunkView = new Uint8Array(chunkData)

      for (let i = 0; i < chunkSize; i++) {
        chunkView[i] = dataView.getUint8(offset + i)
      }

      await this.sendFirmwareChunkWithRetry(chunkIndex, chunkData)

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

  private async sendFirmwareChunkWithRetry(chunkIndex: number, chunkData: ArrayBuffer): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        this.expectedChunkIndex = chunkIndex
        const ackPromise = this.waitForChunkAck(chunkIndex)
        await this.sendFirmwareChunk(chunkIndex, chunkData)
        await ackPromise
        return
      } catch (error) {
        if (attempt === 3) {
          throw new Error(`Failed to send chunk ${chunkIndex} after 3 attempts: ${error}`)
        }
        await this.delay(500)
      }
    }
  }

  private async sendFirmwareChunk(chunkIndex: number, chunkData: ArrayBuffer): Promise<void> {
    const base64Data = this.arrayBufferToBase64(chunkData)

    const command = JSON.stringify({
      cmd: FIRMWARE_COMMANDS.TRANSFER_CHUNK,
      index: chunkIndex,
      data: base64Data
    })

    const encoder = new TextEncoder()
    const encodedCommand = encoder.encode(command)

    if (encodedCommand.length > 2048) {
      throw new Error(`Command too large: ${encodedCommand.length} bytes (max 2048). Chunk ${chunkIndex} size: ${chunkData.byteLength}`)
    }

    await this.characteristic.writeValueWithoutResponse(encodedCommand)
  }

  private async verifyFirmware(): Promise<void> {
    this.onProgress({
      percentage: 95,
      bytesTransferred: 0,
      totalBytes: 0,
      stage: 'verifying',
      message: 'Verifying firmware integrity...'
    })

    const command = JSON.stringify({ cmd: FIRMWARE_COMMANDS.VERIFY_UPDATE })
    const encoder = new TextEncoder()

    try {
      await this.characteristic.writeValueWithoutResponse(encoder.encode(command))
      await this.delay(8000)
    } catch (error) {
      throw new Error(`Verification failed: ${error}`)
    }
  }

  private async applyUpdate(): Promise<void> {
    this.onProgress({
      percentage: 98,
      bytesTransferred: 0,
      totalBytes: 0,
      stage: 'verifying',
      message: 'Applying firmware update (device will restart)...'
    })

    const command = JSON.stringify({ cmd: FIRMWARE_COMMANDS.APPLY_UPDATE })
    const encoder = new TextEncoder()

    try {
      await this.characteristic.writeValueWithoutResponse(encoder.encode(command))
      await this.delay(8000)
    } catch (error) {
      throw error
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
