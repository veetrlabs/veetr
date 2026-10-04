type Country = { name: string; polygons: number[][][][] };
function inRing(ring: number[][], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Approximate start country from Natural Earth land boundaries, not maritime borders. */
export function startCountry(countries: Country[], lat: number | null, lon: number | null) {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return "Unknown";
  return countries.find(c => c.polygons.some(p => inRing(p[0], lon, lat) &&
    !p.slice(1).some(hole => inRing(hole, lon, lat))))?.name ?? "At sea / unknown";
}
