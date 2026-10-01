import { downloadFirmware } from '../githubApi';
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  digest: async (_algorithm: string, data: Uint8Array) => {
    if (!(data instanceof Uint8Array)) throw new Error("Native digest requires a TypedArray");
    const hash = require('crypto').createHash('sha256').update(Buffer.from(data)).digest();
    return Uint8Array.from(hash).buffer;
  },
}));
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
function setup(bytes: number[]) {
  const data = Uint8Array.from(bytes).buffer;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => data });
  return { version: '0.0.31', downloadUrl: 'https://example.test/firmware.bin', filename: 'firmware.bin', size: data.byteLength,
    sha256: require('crypto').createHash('sha256').update(Buffer.from(data)).digest('hex') };
}
test('accepts exact image bytes with matching release checksum', async () => {
  const asset = setup([0xe9, 0, 255, 128]);
  expect(Array.from(new Uint8Array(await downloadFirmware(asset)))).toEqual([0xe9, 0, 255, 128]);
});
test('rejects truncated, non-firmware and corrupted downloads', async () => {
  const asset = setup([0xe9, 0, 255, 128]);
  await expect(downloadFirmware({...asset, size: 5})).rejects.toThrow('size mismatch');
  await expect(downloadFirmware({...asset, sha256: '0'.repeat(64)})).rejects.toThrow('checksum mismatch');
  await expect(downloadFirmware(setup([60, 104, 116, 109, 108]))).rejects.toThrow('Invalid ESP32');
});

test('selects the requested board regardless of release asset order and never falls back', async () => {
  const {getFirmwareAsset} = require('../githubApi');
  const release = {tag_name:'0.0.32', assets:[
    {name:'veetr-0.0.32.bin',browser_download_url:'standard',size:100},
    {name:'veetr-0.0.32-rlcd.bin',browser_download_url:'rlcd',size:200},
  ]};
  expect((await getFirmwareAsset(release, 'esp32s3-rlcd')).downloadUrl).toBe('rlcd');
  expect((await getFirmwareAsset({...release,assets:[...release.assets].reverse()}, 'esp32dev')).downloadUrl).toBe('standard');
  expect(await getFirmwareAsset({...release,assets:release.assets.slice(0,1)}, 'esp32s3-rlcd')).toBeNull();
});
