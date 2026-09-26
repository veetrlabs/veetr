import type { TrackingSession } from "./model";

export function recordingStatus(session: TrackingSession, now = Date.now()) {
  if (session.phase !== "recording") return "Stopped";
  if (!session.lastRecordedAt) return "Waiting for GPS";
  if (now - Date.parse(session.lastRecordedAt) > 30000) return "GPS updates stopped";
  return "Recording";
}
