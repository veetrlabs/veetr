export const APP_VERSION = '0.0.28'

export function getVersionString(includeAppName = true): string {
  return includeAppName ? `Veetr ${APP_VERSION}` : APP_VERSION
}
