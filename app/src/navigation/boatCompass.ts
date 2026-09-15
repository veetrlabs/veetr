// Clockwise angle on a boat-up dial. Never assume the bow points north.
export function boatRelativeBearing(bearing: number | null, heading: number | null): number | null {
  if (bearing === null || heading === null || !Number.isFinite(bearing) || !Number.isFinite(heading)) return null
  return ((bearing - heading) % 360 + 360) % 360
}
