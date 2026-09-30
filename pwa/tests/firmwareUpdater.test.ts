import test from 'node:test'
import assert from 'node:assert/strict'
import { BLEFirmwareUpdater } from '../src/utils/firmwareUpdater'

function setup(reply: (command: any, updater: BLEFirmwareUpdater) => void) {
  const commands: any[] = []
  const progress: any[] = []
  const characteristic = { async writeValueWithoutResponse(bytes: Uint8Array) {
    const command = JSON.parse(new TextDecoder().decode(bytes))
    commands.push(command)
    reply(command, updater)
  } }
  const updater = new BLEFirmwareUpdater(characteristic as any, p => progress.push(p))
  return { updater, commands, progress }
}
const firmware = Uint8Array.from({ length: 450 }, (_, i) => i % 256)
function success(command: any, updater: BLEFirmwareUpdater) {
  const type = ({ START_FW_UPDATE: 'update_ready', FW_CHUNK: 'chunk_ack', VERIFY_FW: 'update_complete', APPLY_FW: 'restarting' } as any)[command.cmd]
  updater.handleResponse({ type, index: command.index })
}

test('accepts synchronous acknowledgments and transfers exact bytes including final short chunk', async () => {
  const { updater, commands, progress } = setup(success)
  await updater.updateFirmware(firmware.buffer)
  assert.deepEqual(Buffer.concat(commands.filter(c => c.cmd === 'FW_CHUNK').map(c => Buffer.from(c.data, 'base64'))), Buffer.from(firmware))
  assert.equal(progress.at(-1).stage, 'complete')
})

test('generic device error reports chunk and offset immediately without retry or verification', async () => {
  const { updater, commands } = setup((c, u) => c.cmd === 'FW_CHUNK'
    ? u.handleResponse({ type: 'error', message: 'Write failed' }) : success(c, u))
  await assert.rejects(updater.updateFirmware(firmware.buffer), /Device rejected chunk 0, offset 0, 200 firmware bytes: Write failed/)
  assert.deepEqual(commands.map(c => c.cmd), ['START_FW_UPDATE', 'FW_CHUNK'])
})

test('initialization rejection sends no chunks', async () => {
  const { updater, commands } = setup((_, u) => u.handleResponse({ type: 'error', message: 'Failed to begin update' }))
  await assert.rejects(updater.updateFirmware(firmware.buffer), /initialization: Failed to begin update/)
  assert.equal(commands.length, 1)
})

test('verification rejection never applies firmware', async () => {
  const { updater, commands } = setup((c, u) => c.cmd === 'VERIFY_FW'
    ? u.handleResponse({ type: 'error', message: 'Verification failed' }) : success(c, u))
  await assert.rejects(updater.updateFirmware(firmware.buffer), /verification: Verification failed/)
  assert.equal(commands.at(-1).cmd, 'VERIFY_FW')
})

test('abort rejects pending acknowledgment promptly', async () => {
  const { updater } = setup(() => {})
  const update = updater.updateFirmware(firmware.buffer)
  updater.abort()
  await assert.rejects(update, /aborted/)
})

test('transport failure does not leave a pending timer or resend', async () => {
  const { updater, commands } = setup(() => { throw new Error('Disconnected') })
  await assert.rejects(updater.updateFirmware(firmware.buffer), /BLE write failed during initialization: Disconnected/)
  assert.equal(commands.length, 1)
})

test('wrong chunk acknowledgment times out without resending', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { updater, commands } = setup((c, u) => c.cmd === 'FW_CHUNK'
    ? u.handleResponse({ type: 'chunk_ack', index: c.index + 1 }) : success(c, u))
  const update = updater.updateFirmware(firmware.buffer)
  const rejected = assert.rejects(update, /No chunk_ack response during chunk 0/)
  for (let i = 0; i < 5; i++) await Promise.resolve()
  t.mock.timers.tick(10001)
  await rejected
  assert.deepEqual(commands.map(c => c.cmd), ['START_FW_UPDATE', 'FW_CHUNK'])
})
