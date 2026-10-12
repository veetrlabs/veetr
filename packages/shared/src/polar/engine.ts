import { windAngle, type Polar } from "./model";
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** No extrapolation. Learned grids cannot bridge more than two bucket widths. */
export function targetSpeed(
  polar: Polar,
  tws: number,
  twa: number,
): number | null {
  if (!Number.isFinite(tws) || tws < 0 || !Number.isFinite(twa)) return null;
  const angle = windAngle(twa);
  const winds = [...new Set(polar.points.map((p) => p.tws))].sort(
    (a, b) => a - b,
  );
  const lo = winds.filter((w) => w <= tws).pop(),
    hi = winds.find((w) => w >= tws);
  if (
    lo === undefined ||
    hi === undefined ||
    (polar.learning && hi - lo > polar.learning.twsStep * 2)
  )
    return null;
  const atWind = (wind: number) => {
    const points = polar.points
      .filter((p) => p.tws === wind && p.confidence?.level !== "unknown")
      .sort((a, b) => a.twa - b.twa);
    const a = points.filter((p) => p.twa <= angle).pop(),
      b = points.find((p) => p.twa >= angle);
    if (
      !a ||
      !b ||
      (polar.learning && b.twa - a.twa > polar.learning.twaStep * 2)
    )
      return null;
    return a.twa === b.twa
      ? a.speed
      : lerp(a.speed, b.speed, (angle - a.twa) / (b.twa - a.twa));
  };
  const a = atWind(lo),
    b = atWind(hi);
  return a === null || b === null
    ? null
    : lo === hi
      ? a
      : lerp(a, b, (tws - lo) / (hi - lo));
}
export function performance(
  polar: Polar,
  tws: number,
  twa: number,
  actualSpeed: number,
) {
  const target = targetSpeed(polar, tws, twa);
  return target === null ||
    target <= 0 ||
    !Number.isFinite(actualSpeed) ||
    actualSpeed < 0
    ? null
    : {
        performancePercent: (actualSpeed / target) * 100,
        targetSpeed: target,
        actualSpeed,
        tws,
        twa: ((((twa + 180) % 360) + 360) % 360) - 180,
      };
}
/** Time-based smoothing; reset after missing readings, boat/polar changes or long gaps. */
export function performanceSmoother(seconds = 8) {
  let last: ReturnType<typeof performance> = null,
    at = 0,
    key = "";
  return (
    polar: Polar | undefined,
    tws: number,
    twa: number,
    speed: number,
    now: number,
    boatId = "",
  ) => {
    const next = polar ? performance(polar, tws, twa, speed) : null;
    const nextKey = `${boatId}/${polar?.id}/${polar?.version}`;
    if (!next) {
      last = null;
      at = 0;
      return null;
    }
    if (last && key === nextKey && now <= at) return last;
    if (!last || key !== nextKey || now - at > 15000) last = next;
    else {
      const alpha = 1 - Math.exp(-(now - at) / (seconds * 1000));
      const actualSpeed = lerp(last.actualSpeed, next.actualSpeed, alpha),
        target = lerp(last.targetSpeed, next.targetSpeed, alpha);
      last = {
        ...next,
        actualSpeed,
        targetSpeed: target,
        performancePercent: (actualSpeed / target) * 100,
      };
    }
    key = nextKey;
    at = now;
    return last;
  };
}
