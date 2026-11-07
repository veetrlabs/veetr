// Accept finite, nonnegative measurements without a vessel-specific ceiling. Keep the position when speed is invalid.
export function validSpeedMps(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
}
