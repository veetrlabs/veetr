import { compareVersions, getFirmwareAsset } from '../githubApi'
import type { GitHubRelease } from '../../types'

describe('compareVersions', () => {
  describe('major version comparison', () => {
    it('returns true when latest major is greater', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(true)
    })

    it('returns false when current major is greater', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(false)
    })
  })

  describe('minor version comparison', () => {
    it('returns true when latest minor is greater', () => {
      expect(compareVersions('1.0.0', '1.1.0')).toBe(true)
    })

    it('returns false when current minor is greater', () => {
      expect(compareVersions('1.2.0', '1.1.0')).toBe(false)
    })
  })

  describe('patch version comparison', () => {
    it('returns true when latest patch is greater', () => {
      expect(compareVersions('1.0.0', '1.0.1')).toBe(true)
    })

    it('returns false when current patch is greater', () => {
      expect(compareVersions('1.0.2', '1.0.1')).toBe(false)
    })
  })

  describe('pre-release versions', () => {
    it('returns false when both are the same pre-release', () => {
      expect(compareVersions('1.0.0-alpha', '1.0.0-alpha')).toBe(false)
    })

    it('returns false when current is stable and latest is pre-release', () => {
      expect(compareVersions('1.0.0', '1.0.0-alpha')).toBe(false)
    })

    it('returns true when current is pre-release and latest is stable', () => {
      expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(true)
    })
  })

  describe('equal versions', () => {
    it('returns false when versions are equal', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(false)
    })
  })

  it('handles versions with fewer than 3 parts', () => {
    expect(compareVersions('1', '2')).toBe(true)
    expect(compareVersions('1.0', '1.1')).toBe(true)
  })
})

describe('getFirmwareAsset', () => {
  const createRelease = (assets: Array<{ name: string; size: number; browser_download_url: string }>): GitHubRelease => ({
    tag_name: 'v1.0.0',
    name: 'Release v1.0.0',
    body: 'Release notes',
    published_at: '2024-01-01T00:00:00Z',
    assets: assets.map(a => ({ ...a, download_url: a.browser_download_url })),
  })

  it('returns first .bin asset that does not contain "info"', async () => {
    const release = createRelease([
      { name: 'firmware.bin', size: 1234, browser_download_url: 'https://example.com/firmware.bin' },
    ])
    const result = await getFirmwareAsset(release)
    expect(result).toEqual({
      version: 'v1.0.0',
      downloadUrl: 'https://example.com/firmware.bin',
      size: 1234,
      filename: 'firmware.bin',
    })
  })

  it('prefers .bin without "info" over ones with "info"', async () => {
    const release = createRelease([
      { name: 'firmware-info.bin', size: 100, browser_download_url: 'https://example.com/info.bin' },
      { name: 'firmware.bin', size: 200, browser_download_url: 'https://example.com/firmware.bin' },
    ])
    const result = await getFirmwareAsset(release)
    expect(result!.filename).toBe('firmware.bin')
  })

  it('falls back to asset containing "firmware" in name', async () => {
    const release = createRelease([
      { name: 'install-info.bin', size: 100, browser_download_url: 'https://example.com/i.bin' },
      { name: 'firmware-info.bin', size: 200, browser_download_url: 'https://example.com/fw.bin' },
    ])
    const result = await getFirmwareAsset(release)
    expect(result!.filename).toBe('firmware-info.bin')
  })

  it('falls back to asset containing "esp32" in name', async () => {
    const release = createRelease([
      { name: 'install-info.bin', size: 100, browser_download_url: 'https://example.com/i.bin' },
      { name: 'esp32-app-info.bin', size: 300, browser_download_url: 'https://example.com/esp.bin' },
    ])
    const result = await getFirmwareAsset(release)
    expect(result!.filename).toBe('esp32-app-info.bin')
  })

  it('returns null when no .bin asset found', async () => {
    const release = createRelease([
      { name: 'firmware.hex', size: 100, browser_download_url: 'https://example.com/fw.hex' },
    ])
    const result = await getFirmwareAsset(release)
    expect(result).toBeNull()
  })

  it('returns null when no assets at all', async () => {
    const release = createRelease([])
    const result = await getFirmwareAsset(release)
    expect(result).toBeNull()
  })
})
