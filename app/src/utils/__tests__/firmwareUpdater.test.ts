import { BLEFirmwareUpdater } from '../firmwareUpdater';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function setup(reply?: (command: any, updater: BLEFirmwareUpdater) => void, maxWriteBytes = 512) {
  const commands: any[] = [];
  const progress = jest.fn();
  const updater: BLEFirmwareUpdater = new BLEFirmwareUpdater(async (_index, text): Promise<void> => {
    const command = JSON.parse(text);
    commands.push(command);
    if (reply) return reply(command, updater);
    const types: Record<string, string> = { START_FW_UPDATE: 'update_ready', FW_CHUNK: 'chunk_ack', VERIFY_FW: 'update_complete', APPLY_FW: 'restarting' };
    updater.handleResponse({ type: types[command.cmd], index: command.index });
  }, progress, maxWriteBytes);
  return { updater, commands, progress };
}

test('sends each byte exactly once in bounded chunks, including the final partial chunk', async () => {
  const { updater, commands, progress } = setup();
  const bytes = Uint8Array.from({ length: 457 }, (_, i) => i % 256);
  await updater.updateFirmware(bytes.buffer);
  const chunks = commands.filter(c => c.cmd === 'FW_CHUNK');
  expect(chunks.map(c => c.index)).toEqual([0, 1, 2]);
  expect(chunks.map(c => atob(c.data).length)).toEqual([200, 200, 57]);
  expect(chunks.flatMap(c => Array.from(atob(c.data), char => char.charCodeAt(0)))).toEqual(Array.from(bytes));
  expect(commands.map(c => c.cmd)).toEqual(['START_FW_UPDATE', 'FW_CHUNK', 'FW_CHUNK', 'FW_CHUNK', 'VERIFY_FW', 'APPLY_FW']);
  expect(progress.mock.calls.at(-1)?.[0].stage).toBe('complete');
  expect(jest.getTimerCount()).toBe(0);
});

test('surfaces firmware rejection and never applies an unverified image', async () => {
  const { updater, commands } = setup((c, u) => {
    u.handleResponse(c.cmd === 'START_FW_UPDATE' ? {type:'update_ready'} : {type:'error',message:'Write failed'});
  });
  await expect(updater.updateFirmware(new ArrayBuffer(5))).rejects.toThrow('Write failed');
  expect(commands.map(c => c.cmd)).toEqual(['START_FW_UPDATE', 'FW_CHUNK']);
  expect(jest.getTimerCount()).toBe(0);
});

test('does not resend a chunk when its acknowledgement is missing or for the wrong index', async () => {
  const { updater, commands } = setup((c, u) => {
    u.handleResponse(c.cmd === 'START_FW_UPDATE' ? {type:'update_ready'} : {type:'chunk_ack',index:99});
  });
  const result = expect(updater.updateFirmware(new ArrayBuffer(5))).rejects.toThrow('Timeout waiting for chunk_ack for chunk 0');
  await jest.advanceTimersByTimeAsync(10000);
  await result;
  expect(commands.filter(c => c.cmd === 'FW_CHUNK')).toHaveLength(1);
});

test('write failures and cancellation clear the pending timer', async () => {
  const failed = new BLEFirmwareUpdater(async () => { throw new Error('Disconnected'); }, jest.fn());
  await expect(failed.updateFirmware(new ArrayBuffer(5))).rejects.toThrow('Disconnected');
  expect(jest.getTimerCount()).toBe(0);
  const { updater } = setup(() => {});
  const result = expect(updater.updateFirmware(new ArrayBuffer(5))).rejects.toThrow('aborted');
  updater.abort();
  await result;
  expect(jest.getTimerCount()).toBe(0);
});

test.each([182, 244, 509])('fits every encoded command within a %i-byte BLE payload', async (limit) => {
  const { updater, commands } = setup(undefined, limit);
  const bytes = Uint8Array.from({ length: 12001 }, (_, i) => i % 251);
  await updater.updateFirmware(bytes.buffer);
  expect(commands.every(c => JSON.stringify(c).length <= limit)).toBe(true);
  const chunks = commands.filter(c => c.cmd === 'FW_CHUNK');
  expect(chunks.flatMap(c => Array.from(atob(c.data), char => char.charCodeAt(0)))).toEqual(Array.from(bytes));
});

test('rejects an insufficient MTU before starting an update', async () => {
  const { updater, commands } = setup(undefined, 20);
  await expect(updater.updateFirmware(new ArrayBuffer(200))).rejects.toThrow('packet size is too small');
  expect(commands).toEqual([]);
});

test('identifies the flash-write boundary and confirmed byte count in device errors', async () => {
  const { updater } = setup((c, u) => {
    if (c.cmd === 'START_FW_UPDATE') u.handleResponse({type:'update_ready'});
    else if (c.index < 20) u.handleResponse({type:'chunk_ack',index:c.index,written:(c.index+1)*200});
    else u.handleResponse({type:'error',message:'Write failed'});
  });
  await expect(updater.updateFirmware(new ArrayBuffer(8000))).rejects.toThrow('Device rejected chunk 20, offset 4000, length 200: Write failed; confirmed=4000 bytes');
});

test.each([182,509,512])('negotiated fast chunks remain bounded and byte-perfect at %i bytes',async limit=>{
 const {updater,commands}=setup((c,u)=>{
  const types:Record<string,string>={START_FW_UPDATE:'update_ready',FW_CHUNK:'chunk_ack',VERIFY_FW:'update_complete',APPLY_FW:'restarting'};
  u.handleResponse({type:types[c.cmd],index:c.index,maxChunkBytes:330});
 },limit);
 const bytes=Uint8Array.from({length:1501},(_,i)=>i%251);await updater.updateFirmware(bytes.buffer);
 const chunks=commands.filter(c=>c.cmd==='FW_CHUNK');
 expect(commands.every(c=>JSON.stringify(c).length<=limit)).toBe(true);
 expect(chunks.flatMap(c=>Array.from(atob(c.data),v=>v.charCodeAt(0)))).toEqual(Array.from(bytes));
 if(limit>=509)expect(atob(chunks[0].data).length).toBe(330);
});
