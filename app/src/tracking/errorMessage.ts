import { t, translateMessage, locale } from '../i18n';
import { backgroundStartError } from "./errorHistory";
export function isTrackingUploadError(error?: string): boolean {
  return !!error && /race_phone_points|tracking_points|check constraint|network request|failed to fetch/i.test(error);
}
/** Keep native diagnostics in storage; present actionable language in the UI. */
export function trackingErrorMessage(error?: string, occurredAt?: string): { text: string; settings: boolean } | null {
  if (!error) return null;
  const at = occurredAt && Number.isFinite(Date.parse(occurredAt))
    ? t(" at {{v0}}", { v0: new Date(occurredAt).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) }) : "";
  if (/sog_mps_check/i.test(error))
    return { text: t("An invalid speed reading blocked uploads{{v0}}. Your recorded positions remain saved on this phone. Update Veetr to retry the upload.", { v0: at }), settings: false };
  if (isTrackingUploadError(error))
    return { text: t("Positions could not be uploaded{{v0}}. Saved positions remain on this phone; Veetr will retry.", { v0: at }), settings: false };
  if (backgroundStartError(error))
    return { text: t("Background recording couldn't start{{v0}}. Keep Veetr open and retry from tracking settings.", { v0: at }), settings: true };
  if (/java\.|Exception|SharedPreferences|Call to function|has been rejected/i.test(error))
    return { text: t("Location tracking encountered a problem{{v0}}. Check tracking settings and restart GPS.", { v0: at }), settings: true };
  const nativeCode = error.match(/kCLErrorDomain Code=(\d+)\b/)?.[1];
  if (nativeCode === "0" || error.startsWith("Waiting for an accurate GPS fix"))
    return { text: t("Waiting for GPS. Move to an open area with a clear view of the sky."), settings: false };
  if (nativeCode === "1")
    return { text: t("Location access is off. Allow location access to record your route."), settings: true };
  if (nativeCode === "2")
    return { text: t("Location is temporarily unavailable. Check your connection and try again."), settings: false };
  if (nativeCode !== undefined || /Error Domain=|\bE_[A-Z_]+\b/.test(error))
    return { text: t("Location tracking is temporarily unavailable. Try restarting recording."), settings: false };
  return { text: translateMessage(error), settings: true };
}
