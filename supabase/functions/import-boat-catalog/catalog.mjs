// Upstream ALL*.json is a Python literal, not JSON. Parse data only; never eval it.
export function* parseCatalogRecords(text) {
  let i = 0;
  const ws = () => {
    while (/\s/.test(text[i] ?? "") && i < text.length) i++;
  };
  function value(depth = 0) {
    if (depth > 20) throw new Error("Catalog nesting is too deep");
    ws();
    const c = text[i++];
    if (c === "'" || c === '"') {
      let s = "";
      while (i < text.length) {
        const ch = text[i++];
        if (ch === c) return s;
        if (ch !== "\\") {
          s += ch;
          continue;
        }
        const esc = text[i++];
        const map = {
          n: "\n",
          r: "\r",
          t: "\t",
          b: "\b",
          f: "\f",
          "\\": "\\",
          "'": "'",
          '"': '"',
        };
        if (esc in map) s += map[esc];
        else if (esc === "u" || esc === "x") {
          const n = esc === "u" ? 4 : 2,
            hex = text.slice(i, i + n);
          if (!new RegExp(`^[0-9a-fA-F]{${n}}$`).test(hex))
            throw new Error("Invalid escape");
          s += String.fromCharCode(parseInt(hex, 16));
          i += n;
        } else throw new Error("Unsupported escape");
      }
      throw new Error("Unterminated string");
    }
    if (c === "[" || c === "{") {
      const result = c === "[" ? [] : Object.create(null),
        end = c === "[" ? "]" : "}";
      ws();
      if (text[i] === end) {
        i++;
        return result;
      }
      while (i < text.length) {
        const entry = value(depth + 1);
        ws();
        if (c === "[") result.push(entry);
        else {
          if (!["string", "number"].includes(typeof entry) || text[i++] !== ":")
            throw new Error("Invalid key");
          if (Object.hasOwn(result, entry)) throw new Error("Duplicate key");
          result[entry] = value(depth + 1);
          ws();
        }
        if (text[i] === end) {
          i++;
          return result;
        }
        if (text[i++] !== ",") throw new Error("Invalid separator");
        ws();
        if (text[i] === end) {
          i++;
          return result;
        }
      }
      throw new Error("Unterminated container");
    }
    i--;
    for (const [word, result] of [
      ["None", null],
      ["True", true],
      ["False", false],
      ["null", null],
      ["true", true],
      ["false", false],
    ]) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return result;
      }
    }
    const match = text.slice(i).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!match) throw new Error("Invalid literal");
    i += match[0].length;
    const number = Number(match[0]);
    if (!Number.isFinite(number)) throw new Error("Invalid number");
    return number;
  }
  ws();
  if (text[i++] !== "[") throw new Error("Invalid catalog");
  ws();
  while (text[i] !== "]") {
    yield value();
    ws();
    if (text[i] === "]") break;
    if (text[i++] !== ",") throw new Error("Invalid separator");
    ws();
  }
  i++;
  ws();
  if (i !== text.length) throw new Error("Invalid catalog");
}
export const parseCatalogLiteral = (text) => [...parseCatalogRecords(text)];
const label = (v) => (typeof v === "string" ? v.trim().slice(0, 160) : "");
const dimension = (v, max) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : null;
export function normalizeCatalog(
  raw,
  year,
  { partial = false, offset = 0 } = {},
) {
  if (!Array.isArray(raw) || raw.length > 30000)
    throw new Error("Invalid catalog size");
  const rows = [],
    countries = new Set();
  let skipped = 0;
  for (const [index, r] of raw.entries()) {
    const b = r?.boat,
      s = b?.sizes,
      model = label(b?.type),
      v = r?.vpp;
    if (
      !model ||
      !s ||
      !v ||
      !Array.isArray(v.angles) ||
      !Array.isArray(v.speeds)
    ) {
      skipped++;
      continue;
    }
    const loa = dimension(s.loa, 200),
      draft = dimension(s.draft, 30),
      beam = dimension(s.beam, 100);
    if (!loa || !draft || !beam) {
      skipped++;
      continue;
    }
    const points = [],
      keys = new Set();
    const add = (tws, twa, speed) => {
      if (
        ![tws, twa, speed].every(
          (n) => typeof n === "number" && Number.isFinite(n),
        ) ||
        tws <= 0 ||
        tws > 150 ||
        twa < 0 ||
        twa > 180 ||
        speed <= 0 ||
        speed > 100
      )
        return;
      const key = `${tws}/${twa}`;
      if (!keys.has(key)) {
        points.push({ tws, twa, speed });
        keys.add(key);
      }
    };
    v.speeds.forEach((tws, j) => {
      v.angles.forEach((twa) => add(tws, twa, v[twa]?.[j]));
      // The converted upstream matrix is already knots. VMG needs angle conversion.
      for (const mode of ["beat", "run"]) {
        const angle = v[`${mode}_angle`]?.[j],
          vmg = v[`${mode}_vmg`]?.[j];
        if (
          typeof angle === "number" &&
          Math.abs(Math.cos((angle * Math.PI) / 180)) > 0.1
        )
          add(tws, angle, vmg / Math.abs(Math.cos((angle * Math.PI) / 180)));
      }
    });
    if (points.length < 16 || v.speeds.length < 2) {
      skipped++;
      continue;
    }
    const country = label(r.country);
    if (country) countries.add(country);
    rows.push({
      id: `${year}:${offset + index}`,
      model_key: model.toLowerCase().replace(/[^a-z0-9]/g, ""),
      model,
      manufacturer: label(b.builder),
      configuration: label(r.sailnumber),
      year: Number.isInteger(b.year) ? b.year : null,
      length_m: loa,
      draft_m: draft,
      beam_m: beam,
      displacement_kg: dimension(s.displacement, 10000000),
      main_m2: dimension(s.main, 10000),
      genoa_m2: dimension(s.genoa, 10000),
      spinnaker_m2: dimension(s.spinnaker, 10000),
      asymmetric_m2: dimension(s.spinnaker_asym, 10000),
      points,
    });
  }
  if (
    !partial &&
    (rows.length < 1000 || countries.size < 10 || skipped > raw.length * 0.1)
  )
    throw new Error("Incomplete catalog; existing catalog was not changed");
  return {
    rows,
    skipped,
    countries: countries.size,
    countryNames: [...countries],
  };
}
