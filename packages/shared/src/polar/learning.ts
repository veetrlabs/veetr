import {
  defaultLearning,
  windAngle,
  type LearningOptions,
  type PolarPoint,
  type SailingObservation,
} from "./model";
export function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b),
    index = (sorted.length - 1) * fraction;
  return sorted.length
    ? sorted[Math.floor(index)] +
        (sorted[Math.ceil(index)] - sorted[Math.floor(index)]) * (index % 1)
    : NaN;
}
export function observationRejection(
  o: SailingObservation,
  previous?: SailingObservation,
  maxGapSeconds = 15,
): string | null {
  if (
    ![o.timestamp, o.tws, o.twa, o.speed].every(Number.isFinite) ||
    o.tws <= 0 ||
    o.tws > 80 ||
    o.speed < 0.5 ||
    o.speed > 60
  )
    return "range";
  if (
    !o.gpsValid ||
    !o.windValid ||
    (o.accuracyM != null && (!Number.isFinite(o.accuracyM) || o.accuracyM > 20))
  )
    return "quality";
  if (o.engine) return "engine";
  if (!previous) return "start";
  const dt = (o.timestamp - previous.timestamp) / 1000;
  if (
    o.boatId !== previous.boatId ||
    o.sessionId !== previous.sessionId ||
    dt <= 0 ||
    dt > maxGapSeconds
  )
    return "gap";
  if (
    windAngle(o.twa - previous.twa) > 12 ||
    (o.heading != null &&
      previous.heading != null &&
      windAngle(o.heading - previous.heading) > 12)
  )
    return "turn";
  if (
    Math.abs(o.speed - previous.speed) / dt > 0.35 ||
    Math.abs(o.tws - previous.tws) > 3
  )
    return "spike";
  return null;
}
export function buildLearnedPoints(
  observations: SailingObservation[],
  boatId: string,
  options: Partial<LearningOptions> = {},
) {
  const config = { ...defaultLearning, ...options };
  if (
    !Object.values(config).every(Number.isFinite) ||
    config.twsStep <= 0 ||
    config.twaStep <= 0 ||
    config.percentile < 0.5 ||
    config.percentile >= 1 ||
    config.minSamples < 3 ||
    config.minSeconds <= 0 ||
    config.stableSeconds < 0 ||
    config.maxGapSeconds <= 0
  )
    throw new Error("Invalid learning configuration.");
  const buckets = new Map<
    string,
    { o: SailingObservation; seconds: number }[]
  >();
  let previous: SailingObservation | undefined,
    reference: SailingObservation | undefined,
    stable = 0;
  const seen = new Set<string>();
  for (const o of [...observations]
    .filter((o) => o.boatId === boatId)
    .sort((a, b) => a.timestamp - b.timestamp)) {
    const identity = `${o.sessionId}/${o.timestamp}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const reason = observationRejection(o, previous, config.maxGapSeconds);
    const dt = previous ? (o.timestamp - previous.timestamp) / 1000 : 0;
    // Small changes can add up to a tack; require a stable direction over the whole run.
    const turning =
      reference &&
      (windAngle(o.twa - reference.twa) > 12 ||
        (o.heading != null &&
          reference.heading != null &&
          windAngle(o.heading - reference.heading) > 12));
    if (reason || turning || !reference) {
      stable = 0;
      reference = o;
    } else stable += dt;
    previous = o;
    if (reason || stable < config.stableSeconds) continue;
    const tws = Math.round(o.tws / config.twsStep) * config.twsStep,
      twa = Math.min(
        180,
        Math.round(windAngle(o.twa) / config.twaStep) * config.twaStep,
      );
    const key = `${tws}/${twa}`,
      values = buckets.get(key) ?? [];
    values.push({ o, seconds: dt });
    buckets.set(key, values);
  }
  const points: PolarPoint[] = [];
  for (const [key, rows] of buckets) {
    const speeds = rows.map((r) => r.o.speed),
      median = percentile(speeds, 0.5),
      mad = percentile(
        speeds.map((s) => Math.abs(s - median)),
        0.5,
      );
    const clean = rows.filter(
      (r) => Math.abs(r.o.speed - median) <= Math.max(0.5, 4 * mad),
    );
    const seconds = clean.reduce((s, r) => s + r.seconds, 0),
      samples = clean.length;
    if (!samples) continue;
    const values = clean.map((r) => r.o.speed),
      spread = percentile(values, 0.9) - percentile(values, 0.1);
    const reliable =
      samples >= config.minSamples && seconds >= config.minSeconds;
    const level = !reliable
      ? "unknown"
      : seconds >= 7200 && samples >= 600 && spread < 1
        ? "high"
        : seconds >= 1800 && samples >= 150
          ? "medium"
          : "low";
    const [tws, twa] = key.split("/").map(Number);
    points.push({
      tws,
      twa,
      speed: percentile(values, config.percentile),
      confidence: {
        level,
        samples,
        seconds,
        spread,
        lastObservedAt: clean.reduce(
          (latest, r) => Math.max(latest, r.o.timestamp),
          0,
        ),
      },
    });
  }
  return {
    points: points.sort((a, b) => a.tws - b.tws || a.twa - b.twa),
    config,
  };
}
