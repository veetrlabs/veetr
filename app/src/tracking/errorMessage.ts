/** Keep native diagnostics in storage; present actionable language in the UI. */
export function trackingErrorMessage(error?: string): { text: string; settings: boolean } | null {
  if (!error) return null;
  const nativeCode = error.match(/kCLErrorDomain Code=(\d+)\b/)?.[1];
  if (nativeCode === "0" || error.startsWith("Waiting for an accurate GPS fix"))
    return { text: "Waiting for GPS. Move to an open area with a clear view of the sky.", settings: false };
  if (nativeCode === "1")
    return { text: "Location access is off. Allow location access to record your route.", settings: true };
  if (nativeCode === "2")
    return { text: "Location is temporarily unavailable. Check your connection and try again.", settings: false };
  if (nativeCode !== undefined || /Error Domain=|\bE_[A-Z_]+\b/.test(error))
    return { text: "Location tracking is temporarily unavailable. Try restarting recording.", settings: false };
  return { text: error, settings: true };
}
