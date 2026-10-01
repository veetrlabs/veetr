import { t } from '../i18n';
import { trackingErrorMessage, isTrackingUploadError } from "./errorMessage";
import { errorOccurredAt } from "./errorHistory";
import type { TrackingSession } from "./model";
export function raceTrackingStatus(
  session: TrackingSession | null,
  now = Date.now(),
) {
  if (!session || session.mode !== "race")
    return {
      label: t("Join your boat"),
      detail: t("Open your invitation to get ready for the race."),
      live: false,
    };
  if (session.phase === "stopping" || Date.parse(session.expiresAt) <= now)
    return {
      label: t("Race tracking stopped"),
      detail: t("Your phone is no longer sharing its position."),
      live: false,
    };
  if (session.error || session.lastTaskError)
    return {
      label: isTrackingUploadError(session.error || session.lastTaskError) ? t("Race uploads interrupted") : t("Tracking needs attention"),
      detail: trackingErrorMessage(session.error || session.lastTaskError, errorOccurredAt(session))!.text,
      live: false,
    };
  if (
    !session.raceCheckedAt ||
    !Number.isFinite(Date.parse(session.raceCheckedAt)) ||
    now - Date.parse(session.raceCheckedAt) >= 60000
  )
    return {
      label: t("Race connection lost"),
      detail: session.raceActive
        ? t("GPS positions are saved on this phone when available and sent when the connection returns.")
        : t("Waiting for race control before recording starts."),
      live: false,
    };
  if (!session.raceActive)
    return {
      label: t("Ready \u00b7 waiting for the start"),
      detail: t("Keep the app available. The referee starts sharing for ready boats."),
      live: false,
    };
  if (
    !session.lastRecordedAt ||
    now - Date.parse(session.lastRecordedAt) > 60000
  )
    return {
      label: t("Waiting for GPS"),
      detail: t("The race is active. Keep your phone where it can receive GPS."),
      live: false,
    };
  return {
    label: t("Sharing race location"),
    detail: t("Your boat\u2019s position is public on the race map."),
    live: true,
  };
}
