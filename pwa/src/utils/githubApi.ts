import { FirmwareAsset } from '@veetr/shared/types'

export { getFirmwareAsset, compareVersions } from '@veetr/shared/utils/githubApi'

export async function getLatestRelease(): Promise<import('@veetr/shared/types').GitHubRelease | null> {
  const response = await fetch('/assets/firmware/latest.json', { cache: 'no-store' })
  if (!response.ok) throw new Error(`Firmware information unavailable: ${response.status}`)
  return response.json()
}

export async function downloadFirmware(asset: FirmwareAsset): Promise<ArrayBuffer> {
  if (!/^\d+\.\d+\.\d+$/.test(asset.version)) throw new Error('Unsupported firmware version')
  const proxyUrl = `/assets/firmware/veetr-${encodeURIComponent(asset.version)}.bin`

  const response = await fetch(proxyUrl)
  if (response.ok) {
    const data = await response.arrayBuffer()
    return data
  } else {
    throw new Error(`Firmware download failed with status: ${response.status}`)
  }
}
