/** All polar speeds are knots, angles degrees from the bow, timestamps epoch ms. */
export type PolarSource =
  "manufacturer" | "orc" | "upload" | "manual" | "learned" | "community";
export interface PolarConfidence {
  level: "unknown" | "low" | "medium" | "high";
  samples: number;
  seconds: number;
  spread: number;
  lastObservedAt: number;
}
export interface PolarPoint {
  tws: number;
  twa: number;
  speed: number;
  confidence?: PolarConfidence;
}
export interface Polar {
  id: string;
  name: string;
  version: string;
  source: PolarSource;
  sourceUrl?: string;
  sourceVersion?: string;
  createdAt: string;
  points: PolarPoint[];
  speedBasis?: "water" | "ground";
  learning?: LearningOptions;
}
export interface PolarBoat {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  variant?: string;
  lengthM?: number;
  className?: string;
  userId?: string;
  selectedPolarId?: string;
}
export interface SailingObservation {
  id: string;
  boatId: string;
  timestamp: number;
  tws: number;
  twa: number;
  speed: number;
  heading?: number | null;
  heel?: number | null;
  accuracyM?: number | null;
  gpsValid: boolean;
  windValid: boolean;
  engine?: boolean;
  sessionId?: string;
}
export interface LearningOptions {
  twsStep: number;
  twaStep: number;
  percentile: number;
  minSamples: number;
  minSeconds: number;
  stableSeconds: number;
  maxGapSeconds: number;
}
export const defaultLearning: LearningOptions = {
  twsStep: 2,
  twaStep: 10,
  percentile: 0.93,
  minSamples: 30,
  minSeconds: 180,
  stableSeconds: 30,
  maxGapSeconds: 15,
};
export function windAngle(angle: number) {
  return Math.abs(((((angle + 180) % 360) + 360) % 360) - 180);
}
export function validatePolar(polar: Polar): Polar {
  if (
    !polar ||
    typeof polar.id !== "string" ||
    !polar.id.trim() ||
    typeof polar.name !== "string" ||
    !polar.name.trim() ||
    typeof polar.version !== "string" ||
    !polar.version.trim() ||
    ![
      "manufacturer",
      "orc",
      "upload",
      "manual",
      "learned",
      "community",
    ].includes(polar.source) ||
    !Number.isFinite(Date.parse(polar.createdAt)) ||
    !Array.isArray(polar.points) ||
    !polar.points.length ||
    polar.points.length > 20000
  )
    throw new Error("Invalid polar data.");
  if (
    polar.learning &&
    (!Object.values(polar.learning).every(Number.isFinite) ||
      polar.learning.twsStep <= 0 ||
      polar.learning.twaStep <= 0)
  )
    throw new Error("Invalid polar data.");
  const keys = new Set<string>();
  for (const p of polar.points) {
    if (
      !p ||
      ![p.tws, p.twa, p.speed].every(Number.isFinite) ||
      p.tws < 0 ||
      p.tws > 150 ||
      p.twa < 0 ||
      p.twa > 180 ||
      p.speed < 0 ||
      p.speed > 100
    )
      throw new Error(
        "Polar values must be knots and angles from 0 to 180 degrees.",
      );
    if (
      p.confidence &&
      (!["unknown", "low", "medium", "high"].includes(p.confidence.level) ||
        ![
          p.confidence.samples,
          p.confidence.seconds,
          p.confidence.spread,
          p.confidence.lastObservedAt,
        ].every(Number.isFinite))
    )
      throw new Error("Invalid polar data.");
    const key = `${p.tws}/${p.twa}`;
    if (keys.has(key)) throw new Error("Duplicate wind speed and angle.");
    keys.add(key);
  }
  return {
    ...polar,
    points: [...polar.points].sort((a, b) => a.tws - b.tws || a.twa - b.twa),
  };
}
