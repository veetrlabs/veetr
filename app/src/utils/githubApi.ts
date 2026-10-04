import { digest, CryptoDigestAlgorithm } from 'expo-crypto'
export interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  assets: Array<{
    name: string
    browser_download_url: string
    size: number
    digest?: string
  }>
}

export interface FirmwareAsset {
  version: string
  downloadUrl: string
  size: number
  filename: string
  sha256?: string
}

const GITHUB_REPO = 'veetrlabs/veetr'
const GITHUB_API_BASE = 'https://api.github.com'

const FETCH_TIMEOUT_MS = 10000

export async function getLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const response = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/latest`, {
      signal: controller.signal
    })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch latest release:', error)
    return null
  }
}

export type FirmwareBoard = 'esp32dev' | 'esp32s3-rlcd'

export async function getFirmwareAsset(release: GitHubRelease, board: FirmwareBoard): Promise<FirmwareAsset | null> {
  const version = release.tag_name.replace(/^v/, '')
  const name = board === 'esp32s3-rlcd' ? `veetr-${version}-rlcd.bin` : `veetr-${version}.bin`
  const firmwareAsset = release.assets.find(asset => asset.name === name)

  if (!firmwareAsset) return null

  return {
    version: release.tag_name,
    downloadUrl: firmwareAsset.browser_download_url,
    size: firmwareAsset.size,
    sha256: firmwareAsset.digest?.startsWith("sha256:") ? firmwareAsset.digest.slice(7) : undefined,
    filename: firmwareAsset.name
  }
}

export function compareVersions(current: string, latest: string): boolean {
  const parseVersion = (version: string) => {
    const [versionPart] = version.split('-', 2)
    const stripped = versionPart.replace(/^v/, '')
    if (!/^\d+(\.\d+){0,2}$/.test(stripped)) {
      return { major: 0, minor: 0, patch: 0 }
    }
    const parts = stripped.split('.').map(Number)
    while (parts.length < 3) parts.push(0)
    return { major: parts[0], minor: parts[1], patch: parts[2] }
  }

  try {
    const cv = parseVersion(current)
    const lv = parseVersion(latest)
    if (lv.major !== cv.major) return lv.major > cv.major
    if (lv.minor !== cv.minor) return lv.minor > cv.minor
    if (lv.patch !== cv.patch) return lv.patch > cv.patch
    return false
  } catch {
    return false
  }
}

export async function downloadFirmware(asset: FirmwareAsset): Promise<ArrayBuffer> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(asset.downloadUrl, { signal: controller.signal })
    clearTimeout(timeout)
    if (response.ok) {
      const data = await response.arrayBuffer()
      if (data.byteLength !== asset.size) throw new Error(`Firmware download size mismatch: expected ${asset.size}, received ${data.byteLength}`)
      const bytes = new Uint8Array(data)
      if (bytes[0] !== 0xe9) throw new Error(`Invalid ESP32 firmware header: ${bytes[0]?.toString(16) ?? 'empty'}`)
      if (asset.sha256) {
        const hash = Array.from(new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, bytes)), b => b.toString(16).padStart(2, '0')).join('')
        if (hash !== asset.sha256.toLowerCase()) throw new Error('Firmware checksum mismatch; update not started')
      }
      return data
    } else {
      throw new Error(`Failed to download firmware: ${response.status}`)
    }
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
}
