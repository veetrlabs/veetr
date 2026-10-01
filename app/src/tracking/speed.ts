// Match the tracking API's accepted range. Keep the position when speed is invalid.
export function validSpeedMps(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
