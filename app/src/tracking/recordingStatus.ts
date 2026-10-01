import { t } from '../i18n';
import type { TrackingSession } from "./model";

export function recordingStatus(session: TrackingSession, now = Date.now()) {
  if (session.phase !== "recording") return t("Stopped");
  if (!session.lastRecordedAt) return t("Waiting for GPS");
  if (now - Date.parse(session.lastRecordedAt) > 30000) return t("GPS updates stopped");
  return t("Recording");
}
