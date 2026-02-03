// Version configuration - single source of truth
// This version is synced from app/package.json
const VERSION = '0.0.28'
export const APP_VERSION = `${VERSION}`

// Helper function to get version for different contexts
export function getVersionString(includeAppName = true): string {
  return includeAppName ? APP_VERSION : VERSION
}

export { VERSION }
