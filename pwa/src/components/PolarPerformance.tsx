import { useEffect, useMemo, useState } from "react";
import {
  PolarRepository,
  importPolar,
  performanceSmoother,
  polarCurve,
  polarXY,
  type BoatPolars,
  type PolarBoat,
} from "@veetr/shared";
import { useBLE } from "../context/BLEContext";
const repository = new PolarRepository({
  getItem: async (key) => localStorage.getItem(key),
  setItem: async (key, value) => localStorage.setItem(key, value),
});
const profileKey = "veetr:polar-boats:v1";
export default function PolarPerformance() {
  const { state } = useBLE(),
    [boats, setBoats] = useState<PolarBoat[]>([]),
    [boatId, setBoatId] = useState(""),
    [boatName, setBoatName] = useState("");
  const [library, setLibrary] = useState<BoatPolars>({
      polars: [],
      observationSets: [],
    }),
    [text, setText] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [wind, setWind] = useState(8),
    [result, setResult] =
      useState<ReturnType<ReturnType<typeof performanceSmoother>>>(null);
  const smooth = useMemo(() => performanceSmoother(), []),
    polar = library.polars.find((p) => p.id === library.selectedId);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(profileKey) ?? "[]",
      ) as PolarBoat[];
      setBoats(saved);
      setBoatId(saved[0]?.id ?? "");
    } catch {
      setError("Could not read saved boats.");
    }
  }, []);
  useEffect(() => {
    let alive = true;
    setLibrary({ polars: [], observationSets: [] });
    void repository
      .read(boatId)
      .then((v) => {
        if (alive) setLibrary(v);
      })
      .catch((e) => setError(e.message));
    return () => {
      alive = false;
    };
  }, [boatId]);
  useEffect(() => {
    const update = () => {
      const d = state.sailingData,
        now = Date.now(),
        valid =
          state.isConnected &&
          state.lastMessageTime !== null &&
          now - state.lastMessageTime <= 15000 &&
          d.polarReadingValid;
      setResult(
        smooth(
          valid ? polar : undefined,
          d.trueWindSpeed,
          d.trueWindAngle,
          d.gpsSpeed,
          now,
          boatId,
        ),
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [
    state.sailingData,
    state.isConnected,
    state.lastMessageTime,
    polar,
    boatId,
    smooth,
  ]);
  async function act(action: () => Promise<BoatPolars>) {
    setBusy(true);
    setError("");
    try {
      setLibrary(await action());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const winds = polar
      ? [...new Set(polar.points.map((p) => p.tws))].sort((a, b) => a - b)
      : [],
    tws = result?.tws ?? (winds.includes(wind) ? wind : (winds[0] ?? 8));
  const max = polar
      ? Math.ceil(
          Math.max(
            1,
            ...polar.points.map((p) => p.speed),
            result?.actualSpeed ?? 0,
          ),
        )
      : 1,
    scale = 130 / max;
  const point = result ? polarXY(result.twa, result.actualSpeed, scale) : null;
  return (
    <details className="polar-performance">
      <summary>
        Polar performance{" "}
        {result ? `${Math.round(result.performancePercent)}%` : ""}
      </summary>
      <div className="polar-content">
        <h2>Polar performance</h2>
        <label>
          Boat
          <select
            value={boatId}
            disabled={busy}
            onChange={(e) => setBoatId(e.target.value)}
          >
            {boats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          New boat name
          <input
            value={boatName}
            onChange={(e) => setBoatName(e.target.value)}
            maxLength={120}
          />
        </label>
        <button
          disabled={busy || !boatName.trim()}
          onClick={() => {
            try {
              const b = { id: crypto.randomUUID(), name: boatName.trim() },
                next = [...boats, b];
              localStorage.setItem(profileKey, JSON.stringify(next));
              setBoats(next);
              setBoatId(b.id);
              setBoatName("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Add boat
        </button>
        {boatId && (
          <>
            <label>
              Performance benchmark
              <select
                value={library.selectedId ?? ""}
                disabled={busy}
                onChange={(e) =>
                  void act(() =>
                    repository.select(boatId, e.target.value || undefined),
                  )
                }
              >
                <option value="">No polar selected</option>
                {library.polars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.source}
                  </option>
                ))}
              </select>
            </label>
            <strong style={{ fontSize: 48 }}>
              {result ? `${Math.round(result.performancePercent)}%` : "—"}
            </strong>
            <p>
              Target {result?.targetSpeed.toFixed(1) ?? "—"} kn · Actual{" "}
              {result?.actualSpeed.toFixed(1) ?? "—"} kn
            </p>
            <p>
              TWS {result?.tws.toFixed(1) ?? "—"} kn · TWA{" "}
              {result?.twa.toFixed(0) ?? "—"}°
            </p>
            {!result && (
              <p>
                Choose a polar and connect fresh GPS and wind readings within
                its range.
              </p>
            )}
            <p>
              Actual speed uses GPS (SOG). Currents can affect the comparison.
            </p>
            {polar && (
              <>
                {!result && (
                  <label>
                    Diagram wind speed
                    <select
                      value={tws}
                      onChange={(e) => setWind(Number(e.target.value))}
                    >
                      {winds.map((w) => (
                        <option value={w} key={w}>
                          {w} kn
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <svg
                  role="img"
                  aria-label={`Polar diagram at ${tws.toFixed(1)} knots of wind`}
                  viewBox="0 0 320 320"
                  style={{ width: "100%", maxWidth: 360, alignSelf: "center" }}
                >
                  {[0.25, 0.5, 0.75, 1].map((f) => (
                    <g key={f}>
                      <circle
                        cx={160}
                        cy={160}
                        r={130 * f}
                        fill="none"
                        stroke="currentColor"
                        opacity={0.2}
                      />
                      <text
                        x={164}
                        y={160 - 130 * f}
                        fill="currentColor"
                        fontSize={10}
                      >
                        {(max * f).toFixed(1)} kn
                      </text>
                    </g>
                  ))}
                  <path
                    d="M160 30V290M30 160H290"
                    stroke="currentColor"
                    opacity={0.2}
                  />
                  <text x={160} y={15} textAnchor="middle" fill="currentColor">
                    0°
                  </text>
                  <text x={160} y={310} textAnchor="middle" fill="currentColor">
                    180°
                  </text>
                  <path
                    d={polarCurve(polar, tws, scale)}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth={3}
                  />
                  {point && (
                    <circle cx={point.x} cy={point.y} r={5} fill="#f59e0b" />
                  )}
                </svg>
                <p>
                  Target curve · orange dot is actual speed · {tws.toFixed(1)}{" "}
                  kn TWS
                </p>
              </>
            )}
            <label>
              Polar name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </label>
            <label>
              Import CSV, POL or JSON
              <input
                type="file"
                accept=".csv,.pol,.json,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2000000) {
                    setError("Polar file is too large.");
                    return;
                  }
                  void file
                    .text()
                    .then(setText)
                    .catch((e) => setError(e.message));
                  if (!name) setName(file.name);
                }}
              />
            </label>
            <label>
              Polar table
              <textarea
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  "TWS,TWA,speed\n6,45,4.2\n6,90,5.1\n8,45,4.8\n8,90,5.8"
                }
              />
            </label>
            <button
              disabled={busy || !name.trim() || !text.trim()}
              onClick={() =>
                void act(async () => {
                  const p = importPolar(text, {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    source: "upload",
                    version: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                  });
                  const next = await repository.add(boatId, p);
                  setText("");
                  setName("");
                  return next;
                })
              }
            >
              Import polar
            </button>
            <p>Saved on this browser for offline use.</p>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
