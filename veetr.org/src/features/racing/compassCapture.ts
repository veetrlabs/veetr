import { trueBearing } from "./startSensors";
export type CompassSample = { degrees: number; at: number };

/** Preserve the valid reading the user touched, even if a sensor update arrives before click. */
export function createCompassCapture() {
  let held: number | null = null;
  const current = (sample: CompassSample | null, correction: number | null, now: number) =>
    sample && correction !== null && Number.isFinite(correction) && Number.isFinite(sample.degrees) &&
    now >= sample.at && now - sample.at <= 3000
      ? trueBearing(sample.degrees, correction) : null;
  return {
    get holding() { return held !== null; },
    begin(sample: CompassSample | null, correction: number | null, now: number) {
      held = current(sample, correction, now);
      return held !== null;
    },
    cancel() { held = null; },
    take(sample: CompassSample | null, correction: number | null, now: number, requireHeld = false) {
      const result = held ?? (requireHeld ? null : current(sample, correction, now));
      held = null;
      return result;
    },
  };
}
