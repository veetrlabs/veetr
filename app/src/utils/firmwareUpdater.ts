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

// BLE command types for firmware update
export const FIRMWARE_COMMANDS = {
  GET_VERSION: 'GET_FW_VERSION',
  START_UPDATE: 'START_FW_UPDATE',
  TRANSFER_CHUNK: 'FW_CHUNK',
  VERIFY_UPDATE: 'VERIFY_FW',
  APPLY_UPDATE: 'APPLY_FW',
  STOP_UPDATE: 'STOP_FW_UPDATE',
  GET_OTA_STATUS: 'GET_OTA_STATUS'
} as const

export class BLEFirmwareUpdater {
  private characteristic: BluetoothRemoteGATTCharacteristic
  private onProgress: FirmwareUpdateCallback
  private chunkSize = 200 // Small chunks to stay well under 512-byte BLE MTU with JSON + base64 overhead
  private aborted = false // Flag to stop the update process
  private pendingAckResolve: ((value: any) => void) | null = null // For waiting on chunk acknowledgments
  private expectedChunkIndex = 0 // Track which chunk we're expecting acknowledgment for
  private startTime = 0 // Track when transfer started

  constructor(
    characteristic: BluetoothRemoteGATTCharacteristic,
    onProgress: FirmwareUpdateCallback
  ) {
    this.characteristic = characteristic
    this.onProgress = onProgress
    this.aborted = false
  }

  // Method to handle chunk acknowledgment from ESP32
  handleChunkAck(data: any): void {
    if (this.pendingAckResolve && data.index === this.expectedChunkIndex) {
      this.pendingAckResolve(data)
      this.pendingAckResolve = null
    }
  }

  // Method to abort the firmware update
  abort(): void {
    console.log('[FirmwareUpdater] Aborting firmware update...')
    this.aborted = true
    // Reject any pending acknowledgment
    if (this.pendingAckResolve) {
      this.pendingAckResolve = null
    }
  }

  // Check if update was aborted
  private checkAborted(): void {
    if (this.aborted) {
      throw new Error('Firmware update was aborted')
    }
  }

  // Wait for chunk acknowledgment from ESP32
  private async waitForChunkAck(chunkIndex: number): Promise<any> {
    return new Promise((resolve, reject) => {
      // Set up timeout for acknowledgment
      const timeout = setTimeout(() => {
        this.pendingAckResolve = null
        reject(new Error(`Timeout waiting for chunk ${chunkIndex} acknowledgment`))
      }, 5000) // 5 second timeout

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
      
      // Listen for response (this would need to be handled in your main BLE context)
      // For now, return a placeholder
      return 'v1.0.0'
    } catch (error) {
      console.error('Failed to get firmware version:', error)
      throw new Error('Could not retrieve current firmware version')
    }
  }

  async updateFirmware(firmwareData: ArrayBuffer): Promise<void> {
    try {
      // Initialize timing
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

      // Step 1: Initialize update
      await this.initializeUpdate(firmwareData.byteLength)

      // Step 2: Transfer firmware in chunks
      await this.transferFirmware(firmwareData)

      // Step 3: Verify firmware
      await this.verifyFirmware()

      // Step 4: Apply update (ESP32 will restart)
      await this.applyUpdate()

      // The ESP32 restarts during apply, so we can't get immediate confirmation
      // The success will be confirmed when the user reconnects and sees the new version
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
    
    console.log('Initializing firmware update...', { totalSize })
    
    const encoder = new TextEncoder()
    
    // Retry mechanism for better reliability
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.characteristic.writeValueWithoutResponse(encoder.encode(command))
        console.log(`Update initialization sent (attempt ${attempt})`)
        
        // Wait longer for ESP32 to initialize OTA
        await this.delay(2000)
        break
      } catch (error) {
        console.error(`Initialization attempt ${attempt} failed:`, error)
        if (attempt === 3) {
          throw new Error(`Failed to initialize update after 3 attempts: ${error}`)
        }
        await this.delay(1000) // Wait before retry
      }
    }
  }

  private async transferFirmware(firmwareData: ArrayBuffer): Promise<void> {
    const totalChunks = Math.ceil(firmwareData.byteLength / this.chunkSize)
    const dataView = new DataView(firmwareData)
    
    console.log(`Starting firmware transfer: ${totalChunks} chunks of ${this.chunkSize} bytes`)

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      this.checkAborted() // Check for abort before each chunk

      const offset = chunkIndex * this.chunkSize
      const chunkSize = Math.min(this.chunkSize, firmwareData.byteLength - offset)
      
      // Create chunk data
      const chunkData = new ArrayBuffer(chunkSize)
      const chunkView = new Uint8Array(chunkData)
      
      for (let i = 0; i < chunkSize; i++) {
        chunkView[i] = dataView.getUint8(offset + i)
      }

      // Send chunk with retry logic
      await this.sendFirmwareChunkWithRetry(chunkIndex, chunkData)

      // Update progress with timing calculations
      const bytesTransferred = offset + chunkSize
      const percentage = Math.round((bytesTransferred / firmwareData.byteLength) * 90) // Reserve 10% for verification
      
      const currentTime = Date.now()
      const elapsedTimeMs = currentTime - this.startTime
      const transferRate = bytesTransferred / elapsedTimeMs // bytes per millisecond
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

      // No delay needed - acknowledgment-based flow control provides natural pacing
    }
  }

  private async sendFirmwareChunkWithRetry(chunkIndex: number, chunkData: ArrayBuffer): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Set up expectation for this chunk's acknowledgment FIRST
        this.expectedChunkIndex = chunkIndex
        
        // Set up the promise BEFORE sending the chunk to avoid race condition
        const ackPromise = this.waitForChunkAck(chunkIndex)
        
        // Now send the chunk
        await this.sendFirmwareChunk(chunkIndex, chunkData)
        
        // Wait for acknowledgment from ESP32
        await ackPromise
        
        return // Success, exit retry loop
      } catch (error) {
        console.error(`Chunk ${chunkIndex} attempt ${attempt} failed:`, error)
        if (attempt === 3) {
          throw new Error(`Failed to send chunk ${chunkIndex} after 3 attempts: ${error}`)
        }
        await this.delay(500) // Wait before retry
      }
    }
  }

  private async sendFirmwareChunk(chunkIndex: number, chunkData: ArrayBuffer): Promise<void> {
    // Create command with binary data
    const base64Data = this.arrayBufferToBase64(chunkData)
    
    const command = JSON.stringify({
      cmd: FIRMWARE_COMMANDS.TRANSFER_CHUNK,
      index: chunkIndex,
      data: base64Data
    })

    const encoder = new TextEncoder()
    const encodedCommand = encoder.encode(command)
    
    // Validate size before sending
    if (encodedCommand.length > 2048) { // Increased limit for base64 data
      throw new Error(`Command too large: ${encodedCommand.length} bytes (max 2048). Chunk ${chunkIndex} size: ${chunkData.byteLength}`)
    }
    
    // Use writeValueWithoutResponse for better reliability
    await this.characteristic.writeValueWithoutResponse(encodedCommand)
  }

  private async verifyFirmware(): Promise<void> {
    const currentTime = Date.now()
    const elapsedTimeMs = currentTime - this.startTime
    
    this.onProgress({
      percentage: 95,
      bytesTransferred: 0,
      totalBytes: 0,
      stage: 'verifying',
      message: 'Verifying firmware integrity...',
      elapsedTimeMs,
      estimatedTotalTimeMs: elapsedTimeMs + 10000, // Estimate 10 more seconds
      estimatedRemainingTimeMs: 10000
    })

    const command = JSON.stringify({ cmd: FIRMWARE_COMMANDS.VERIFY_UPDATE })
    const encoder = new TextEncoder()
    
    try {
      await this.characteristic.writeValueWithoutResponse(encoder.encode(command))
      console.log('Verification command sent, waiting for ESP32 to verify...')
      
      // Wait longer for verification - firmware verification can take time
      await this.delay(8000)
    } catch (error) {
      throw new Error(`Verification failed: ${error}`)
    }
  }

  private async applyUpdate(): Promise<void> {
    const currentTime = Date.now()
    const elapsedTimeMs = currentTime - this.startTime
    
    this.onProgress({
      percentage: 98,
      bytesTransferred: 0,
      totalBytes: 0,
      stage: 'verifying',
      message: 'Applying firmware update (device will restart)...',
      elapsedTimeMs,
      estimatedTotalTimeMs: elapsedTimeMs + 5000, // Estimate 5 more seconds
      estimatedRemainingTimeMs: 5000
    })

    const command = JSON.stringify({ cmd: FIRMWARE_COMMANDS.APPLY_UPDATE })
    const encoder = new TextEncoder()
    
    try {
      await this.characteristic.writeValueWithoutResponse(encoder.encode(command))
      console.log('Apply command sent, waiting for confirmation...')
      
      // Wait longer for apply confirmation and restart
      await this.delay(8000)
      console.log('Apply phase completed - device should be restarting')
    } catch (error) {
      // Apply command might fail due to device restart - this could be normal
      console.warn('Apply command may have failed due to device restart:', error)
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

// Utility function to format milliseconds into readable time
export function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}
