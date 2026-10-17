import { validatePolar, type Polar, type PolarPoint } from "./model";
/** Adapter boundary: ORC/other source adapters return these same normalized points. */
export function importPolar(
  text: string,
  metadata: Omit<Polar, "points">,
): Polar {
  if (text.length > 2000000) throw new Error("Polar file is too large.");
  let points: PolarPoint[];
  let sourceMetadata: Partial<Polar> = {};
  if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
    const json = JSON.parse(text);
    points = Array.isArray(json) ? json : json.points;
    if (!Array.isArray(json)) {
      if (typeof json.sourceUrl === "string")
        sourceMetadata.sourceUrl = json.sourceUrl;
      if (typeof (json.sourceVersion ?? json.version) === "string")
        sourceMetadata.sourceVersion = json.sourceVersion ?? json.version;
      if (json.speedBasis === "water" || json.speedBasis === "ground")
        sourceMetadata.speedBasis = json.speedBasis;
    }
  } else {
    const rows = text
      .trim()
      .split(/\r?\n/)
      .filter((r) => r.trim() && !r.trim().startsWith("#"))
      .map((r) => r.trim().split(/[;,\t ]+/));
    const header = rows.shift()?.map((s) => s.toLowerCase());
    if (!header) throw new Error("Enter a polar table.");
    const number = (s: string) => (s?.trim() ? Number(s) : NaN);
    if (
      header.join(",") === "tws,twa,target" ||
      header.join(",") === "tws,twa,speed"
    ) {
      points = rows.map((r) => {
        if (r.length !== 3)
          throw new Error("Expected TWS, TWA, speed columns.");
        return { tws: number(r[0]), twa: number(r[1]), speed: number(r[2]) };
      });
    } else if (["twa/tws", "twa\\tws", "twa"].includes(header[0])) {
      const winds = header.slice(1).map(number);
      points = rows.flatMap((r) => {
        if (r.length !== winds.length + 1)
          throw new Error("Polar row has missing columns.");
        return winds.flatMap((tws, i) =>
          r[i + 1] === "-"
            ? []
            : [{ tws, twa: number(r[0]), speed: number(r[i + 1]) }],
        );
      });
    } else throw new Error("Use TWS,TWA,speed columns or a TWA/TWS matrix.");
  }
  return validatePolar({ ...sourceMetadata, ...metadata, points });
}
