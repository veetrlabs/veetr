export interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  assets: Array<{
    name: string
    browser_download_url: string
    size: number
  }>
}

export interface FirmwareAsset {
  version: string
  downloadUrl: string
  size: number
  filename: string
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

export async function getFirmwareAsset(release: GitHubRelease): Promise<FirmwareAsset | null> {
  const firmwareAsset = release.assets.find(asset =>
    asset.name.endsWith('.bin') && !asset.name.includes('info')
  ) || release.assets.find(asset =>
    asset.name.includes('firmware') && asset.name.endsWith('.bin')
  ) || release.assets.find(asset =>
    asset.name.includes('esp32') && asset.name.endsWith('.bin')
  )

  if (!firmwareAsset) return null

  return {
    version: release.tag_name,
    downloadUrl: firmwareAsset.browser_download_url,
    size: firmwareAsset.size,
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
      return await response.arrayBuffer()
    } else {
      throw new Error(`Failed to download firmware: ${response.status}`)
    }
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
}
