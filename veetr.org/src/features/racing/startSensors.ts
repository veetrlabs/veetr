import { validCoursePoint, wrapBearing, type CoursePoint } from "./course";
export interface StartFix extends CoursePoint {
  accuracy: number;
  timestamp: number;
}
export function usableFix(
  fix: StartFix | null,
  now = Date.now(),
): fix is StartFix {
  return (
    !!fix &&
    validCoursePoint(fix) &&
    Number.isFinite(fix.accuracy) &&
    fix.accuracy >= 0 &&
    fix.accuracy <= 50 &&
    Number.isFinite(fix.timestamp) &&
    now >= fix.timestamp &&
    now - fix.timestamp <= 15000
  );
}
type Orientation = Pick<
  DeviceOrientationEvent,
  "alpha" | "beta" | "gamma" | "absolute"
> & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
// Safari supplies a native compass heading independently of the orientation angles.
// Only the absolute-alpha fallback requires a flat, face-up phone.
export function compassIssue(event: Orientation): string | null {
  if (typeof event.webkitCompassHeading === "number") {
    if (event.webkitCompassAccuracy !== undefined &&
        (!Number.isFinite(event.webkitCompassAccuracy) || event.webkitCompassAccuracy < 0 || event.webkitCompassAccuracy > 20))
      return "Compass needs calibration. Move the phone in a figure eight, away from metal or magnets.";
    if (!Number.isFinite(event.webkitCompassHeading) || event.webkitCompassHeading < 0 || event.webkitCompassHeading >= 360)
      return "No valid compass heading yet. Move the phone gently to refresh it.";
    return null;
  }
  if (!event.absolute || event.alpha === null || !Number.isFinite(event.alpha) || event.alpha < 0 || event.alpha >= 360)
    return "This browser is not providing a compass heading. Try Safari or enter a bearing manually.";
  if (event.beta === null || event.gamma === null || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma) ||
      Math.abs(event.beta) > 20 || Math.abs(event.gamma) > 20)
    return "Hold the phone flat, screen facing up, to read its compass.";
  return null;
}
export function magneticHeading(event: Orientation): number | null {
  if (compassIssue(event)) return null;
  return typeof event.webkitCompassHeading === "number"
    ? event.webkitCompassHeading
    : wrapBearing(360 - event.alpha!);
}
export function trueBearing(magnetic: number, correction: number) {
  return wrapBearing(magnetic + correction);
}
export function watchStartPosition(
  onFix: (fix: StartFix) => void,
  onError: (message: string) => void,
): () => void {
  if (!navigator.geolocation)
    throw new Error(
      "Location is unavailable. Set the point on the map instead.",
    );
  let alive = true;
  const id = navigator.geolocation.watchPosition(
    (p) => {
      if (alive)
        onFix({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          timestamp: p.timestamp,
        });
    },
    () => {
      if (alive)
        onError(
          "Location unavailable. Check permission or set the point on the map.",
        );
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  );
  return () => {
    alive = false;
    navigator.geolocation.clearWatch(id);
  };
}
export async function watchStartCompass(
  onHeading: (heading: number | null, issue?: string | null) => void,
): Promise<() => void> {
  if (typeof DeviceOrientationEvent === "undefined")
    throw new Error("Compass unavailable. Enter a bearing manually.");
  const sensor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: (absolute?: boolean) => Promise<string>;
  };
  if (
    sensor.requestPermission &&
    (await sensor.requestPermission(true)) !== "granted"
  )
    throw new Error("Compass permission denied. Enter a bearing manually.");
  const listener = (e: Event) => {
    const orientation = e as DeviceOrientationEvent & Orientation;
    if (!orientation.absolute && orientation.webkitCompassHeading === undefined)
      return;
    onHeading(magneticHeading(orientation), compassIssue(orientation));
  };
  window.addEventListener("deviceorientation", listener);
  window.addEventListener("deviceorientationabsolute", listener);
  return () => {
    window.removeEventListener("deviceorientation", listener);
    window.removeEventListener("deviceorientationabsolute", listener);
  };
}
