import type { TrackingSession } from "./model";
export function raceTrackingStatus(
  session: TrackingSession | null,
  now = Date.now(),
) {
  if (!session || session.mode !== "race")
    return {
      label: "Join your boat",
      detail: "Open your invitation to get ready for the race.",
      live: false,
    };
  if (session.phase === "stopping" || Date.parse(session.expiresAt) <= now)
    return {
      label: "Race tracking stopped",
      detail: session.error || "Your phone is no longer sharing its position.",
      live: false,
    };
  if (session.error || session.lastTaskError)
    return {
      label: "Tracking needs attention",
      detail: session.error || session.lastTaskError!,
      live: false,
    };
  if (
    !session.raceCheckedAt ||
    !Number.isFinite(Date.parse(session.raceCheckedAt)) ||
    now - Date.parse(session.raceCheckedAt) >= 60000
  )
    return {
      label: "Race connection lost",
      detail: session.raceActive
        ? "GPS positions are saved on this phone when available and sent when the connection returns."
        : "Waiting for race control before recording starts.",
      live: false,
    };
  if (!session.raceActive)
    return {
      label: "Ready · waiting for the start",
      detail:
        "Keep the app available. The referee starts sharing for ready boats.",
      live: false,
    };
  if (
    !session.lastRecordedAt ||
    now - Date.parse(session.lastRecordedAt) > 60000
  )
    return {
      label: "Waiting for GPS",
      detail: "The race is active. Keep your phone where it can receive GPS.",
      live: false,
    };
  return {
    label: "Sharing race location",
    detail: "Your boat’s position is public on the race map.",
    live: true,
  };
}
