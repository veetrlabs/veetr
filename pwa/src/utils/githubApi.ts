import { FirmwareAsset } from '@veetr/shared/types'

export { getLatestRelease, getFirmwareAsset, compareVersions } from '@veetr/shared/utils/githubApi'

export async function downloadFirmware(asset: FirmwareAsset): Promise<ArrayBuffer> {
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(asset.downloadUrl)}`

  const response = await fetch(proxyUrl)
  if (response.ok) {
    const data = await response.arrayBuffer()
    return data
  } else {
    throw new Error(`Proxy failed with status: ${response.status}`)
  }
}
