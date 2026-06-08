import { GitHubRelease, FirmwareAsset } from '../types'

const GITHUB_REPO = 'veetrlabs/veetr'
const GITHUB_API_BASE = 'https://api.github.com'

export async function getLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/latest`)
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }
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

  if (!firmwareAsset) {
    console.warn('No firmware binary (.bin) asset found in release')
    return null
  }

  return {
    version: release.tag_name,
    downloadUrl: firmwareAsset.browser_download_url,
    size: firmwareAsset.size,
    filename: firmwareAsset.name
  }
}

export function compareVersions(current: string, latest: string): boolean {
  const parseVersion = (version: string) => {
    const [versionPart, preRelease] = version.split('-', 2)
    const parts = versionPart.split('.').map(Number)
    while (parts.length < 3) {
      parts.push(0)
    }
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
      preRelease: preRelease || null
    }
  }

  try {
    const currentVersion = parseVersion(current)
    const latestVersion = parseVersion(latest)

    if (latestVersion.major !== currentVersion.major) {
      return latestVersion.major > currentVersion.major
    }
    if (latestVersion.minor !== currentVersion.minor) {
      return latestVersion.minor > currentVersion.minor
    }
    if (latestVersion.patch !== currentVersion.patch) {
      return latestVersion.patch > currentVersion.patch
    }

    if (!currentVersion.preRelease && !latestVersion.preRelease) {
      return false
    }
    if (!currentVersion.preRelease && latestVersion.preRelease) {
      return false
    }
    if (currentVersion.preRelease && !latestVersion.preRelease) {
      return true
    }
    if (currentVersion.preRelease && latestVersion.preRelease) {
      return latestVersion.preRelease > currentVersion.preRelease
    }

    return false
  } catch (error) {
    console.error('Version comparison error:', error)
    return false
  }
}
