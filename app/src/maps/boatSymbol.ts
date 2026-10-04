export interface BoatReading {
  cogDeg?: number | null;
  sogMps?: number | null;
  instruments?: { heading?: number | null; awa?: number | null; twa?: number | null };
}
const bearing = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 360;
const angle = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 180;
export function boatBearings(p: BoatReading) {
  const h = p.instruments?.heading;
  const heading = bearing(h) ? h : null;
  return {
    direction: heading ?? (bearing(p.cogDeg) ? p.cogDeg : null),
    courseOnly: heading === null,
    apparentFrom: heading !== null && angle(p.instruments?.awa) ? (heading + p.instruments!.awa! + 360) % 360 : null,
    trueFrom: heading !== null && angle(p.instruments?.twa) ? (heading + p.instruments!.twa! + 360) % 360 : null,
  };
}
/** Fixed screen-size compass glyph. Positive angles are clockwise/starboard. */
export function boatSymbol(p: BoatReading, color = '#008c80', mapBearing = 0) {
  const b = boatBearings(p);
  const fill = /^#[0-9a-f]{6}$/i.test(color) ? color : '#008c80';
  const wedge = (from: number | null, color: string, radius: number) => from === null ? '' :
    `<g transform="rotate(${from} 56 56)"><path d="M${56-radius/18} ${56-radius}L56 56L${56+radius/18} ${56-radius}Z" fill="${color}" fill-opacity="0.95" stroke="white" stroke-width="0.7"/></g>`;
  const ring = `<circle cx="56" cy="56" r="42" fill="white" fill-opacity="0.12" stroke="#64748b" stroke-opacity="0.65" stroke-width="1"/>`;
  const hull = b.direction === null
    ? `<path d="M56 46L66 56L56 66L46 56Z" fill="${fill}" stroke="white" stroke-width="2"/>`
    : `<g transform="rotate(${b.direction} 56 56)"><path d="M56 7V43" stroke="black" stroke-width="1" ${b.courseOnly ? 'stroke-dasharray="4 3"' : ''}/><path d="M56 42Q63 56 59.5 70Q56 73.5 52.5 70Q49 56 56 42Z" fill="${fill}" stroke="#2d3748" stroke-width="1"/><circle cx="56" cy="56" r="2.5" fill="#2d3748" stroke="white" stroke-width="1"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 112 112">${ring}<g transform="rotate(${-((Number.isFinite(mapBearing) ? mapBearing : 0) % 360)} 56 56)">${hull}${wedge(b.trueFrom, '#d68b27', 42)}${wedge(b.apparentFrom, '#3182ce', 42)}</g></svg>`;
}
