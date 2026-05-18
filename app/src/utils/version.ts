import { version } from '../../package.json'

export const VERSION = version
export const APP_VERSION = version

export function getVersionString(includeAppName = true): string {
  return includeAppName ? APP_VERSION : VERSION
}
