import { sharedDistance, tripPlot, boatOrientation } from "./sharedTripData";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type * as Leaflet from "leaflet";
import { supabase } from "./api";
import "leaflet/dist/leaflet.css";
import "./shared-trip.css";
type Instruments = {
  aws?: number | null;
  tws?: number | null;
  awa?: number | null;
  twa?: number | null;
  heading?: number | null;
};
type Point = {
  seq: number;
  recordedAt: string;
  latitude: number;
  longitude: number;
  sogMps: number | null;
  cogDeg: number | null;
  instruments?: Instruments;
};
type Shared = {
  title: string;
  boat: string;
  color: string;
  live: boolean;
  startedAt: string;
  stoppedAt: string | null;
  latest: Point | null;
  points: Point[];
};
type Listing = { token: string; title: string; boat: string; live: boolean };
async function rpc<T>(name: string, args: Record<string, unknown> = {}) {
  if (!supabase) throw new Error("Trip sharing is not configured.");
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
}
function Map({
  points,
  color,
  selected,
}: {
  points: Point[];
  color: string;
  selected?: Point;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<Leaflet.Map | null>(null),
    layer = useRef<Leaflet.LayerGroup | null>(null),
    leaflet = useRef<typeof Leaflet | null>(null),
    fitted = useRef(false);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void import("leaflet")
      .then((mod) => {
        if (!alive || !element.current) return;
        const L = mod.default ?? mod;
        leaflet.current = L;
        map.current = L.map(element.current).setView([49.7, 14.2], 6);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
        setReady(true);
      })
      .catch((error) => {
        console.error("Shared trip map initialization failed", error);
        setError("Map unavailable. Trip data remains available below.");
      });
    return () => {
      alive = false;
      map.current?.remove();
    };
  }, []);
  useEffect(() => {
    const L = leaflet.current,
      m = map.current,
      g = layer.current;
    if (!ready || !L || !m || !g) return;
    g.clearLayers();
    const lines: Leaflet.LatLngTuple[][] = [];
    let previous: Point | undefined;
    for (const p of points) {
      if (
        !previous ||
        Date.parse(p.recordedAt) - Date.parse(previous.recordedAt) > 60000
      )
        lines.push([]);
      lines.at(-1)!.push([p.latitude, p.longitude]);
      previous = p;
    }
    for (const line of lines) L.polyline(line, { color, weight: 3 }).addTo(g);
    if (selected) {
      const { heading, windFrom, courseOnly } = boatOrientation(selected);
      const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : "#008c83";
      const wind =
        windFrom === null
          ? ""
          : `<g transform="rotate(${windFrom} 64 64)" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M64 8V40M56 31L64 40L72 31"/></g>`;
      const hull =
        heading === null
          ? `<path d="M64 52L76 64L64 76L52 64Z" fill="${safeColor}" stroke="white" stroke-width="2"/>`
          : `<g transform="rotate(${heading} 64 64)" fill="${safeColor}" stroke="white" stroke-width="2" stroke-linejoin="round"><path d="M64 44Q78 59 74 79L54 79Q50 59 64 44Z"/><path d="M64 54V71M59 72H69" fill="none"/></g>`;
      L.marker([selected.latitude, selected.longitude], {
        icon: L.divIcon({
          className: "trip-boat-marker",
          html: `<svg viewBox="0 0 128 128" aria-hidden="true">${wind}${hull}</svg>`,
          iconSize: [128, 128],
          iconAnchor: [64, 64],
        }),
        title:
          heading === null
            ? "Boat · heading unavailable"
            : `${courseOnly ? "Course over ground" : "Heading"}: ${heading.toFixed(0)}°${windFrom === null ? "" : ` · TWA ${selected.instruments!.twa}°`}`,
      }).addTo(g);
    }
    if (!fitted.current && points.length) {
      m.fitBounds(
        L.latLngBounds(points.map((p) => [p.latitude, p.longitude])),
        { padding: [30, 30], maxZoom: 15 },
      );
      fitted.current = true;
    }
  }, [points, color, selected, ready]);
  return (
    <>
      <div ref={element} className="trip-map" aria-label="Trip route map" />
      {error && <p role="alert">{error}</p>}
      <button
        onClick={() => {
          if (points.length && map.current && leaflet.current)
            map.current.fitBounds(
              leaflet.current.latLngBounds(
                points.map((p) => [p.latitude, p.longitude]),
              ),
              { padding: [30, 30], maxZoom: 15 },
            );
        }}
      >
        Fit route
      </button>
    </>
  );
}
export default function SharedTrips() {
  const [token, setToken] = useState(
      () => new URLSearchParams(location.hash.slice(1)).get("trip") ?? "",
    ),
    [trip, setTrip] = useState<Shared | null>(null),
    [list, setList] = useState<Listing[]>([]),
    [offset, setOffset] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [index, setIndex] = useState<number | null>(null),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const change = () => {
      setToken(new URLSearchParams(location.hash.slice(1)).get("trip") ?? "");
      setIndex(null);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    let alive = true,
      busy = false;
    let points: Point[] = [];
    setTrip(null);
    setError("");
    setLoading(true);
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        if (!token) {
          const rows = await rpc<Listing[]>("public_trips", {
            p_offset: offset,
          });
          if (alive) setList(rows);
          return;
        }
        let more = true;
        while (alive && more) {
          const result = await rpc<Shared | null>("shared_trip", {
            p_token: token,
            p_after: points.at(-1)?.seq ?? 0,
          });
          if (!result) {
            points = [];
            setTrip(null);
            throw new Error(
              "This trip is private or its sharing link has been disabled.",
            );
          }
          points = [...points, ...result.points];
          if (alive) setTrip({ ...result, points });
          more = result.points.length === 2000;
        }
        if (alive) setError("");
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : String(e));
          setTrip(null);
          points = [];
        }
      } finally {
        busy = false;
        if (alive) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [token, offset]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const p = trip?.points[index ?? Math.max(0, trip.points.length - 1)],
    age = trip?.latest
      ? Math.max(
          0,
          Math.floor((now - Date.parse(trip.latest.recordedAt)) / 1000),
        )
      : null;
  const format = (n: number | null | undefined, unit: string) =>
    n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(1)} ${unit}`;
  const metrics = p
    ? [
        ["SOG", format(p.sogMps == null ? null : p.sogMps * 1.94384449, "kn")],
        ["COG", format(p.cogDeg, "°")],
        ["Heading", format(p.instruments?.heading, "°")],
        ["TWA", format(p.instruments?.twa, "°")],
        ["AWA", format(p.instruments?.awa, "°")],
        ["TWS", format(p.instruments?.tws, "kn")],
        ["AWS", format(p.instruments?.aws, "kn")],
      ]
    : [];
  const speedSeries = [
    { key: "sog", label: "Boat speed · SOG", color: "#38bdf8" },
    { key: "tws", label: "True wind · TWS", color: "#f59e0b" },
    { key: "aws", label: "Apparent wind · AWS", color: "#c084fc" },
  ] as const;
  const speedMax = trip
    ? Math.ceil(1.1 * Math.max(1, ...speedSeries.map((s) => tripPlot(trip.points, s.key).max)))
    : 1;
  const plots = trip
    ? speedSeries.map((s) => ({
        ...s,
        plot: tripPlot(trip.points, s.key, speedMax),
      }))
    : [];
  const startTime = Date.parse(trip?.points[0]?.recordedAt ?? "");
  const duration = Math.max(
    1,
    Date.parse(trip?.points.at(-1)?.recordedAt ?? "") - startTime,
  );
  const cursor = p
    ? (600 * (Date.parse(p.recordedAt) - startTime)) / duration
    : 0;
  return (
    <main id="trip-content" className="shared-trip">
      <a href="/">Veetr</a>
      {token ? <a href="/trips/">Explore trips</a> : null}
      <h1>{trip?.title ?? "Sailing adventures"}</h1>
      {loading && <p role="status">Loading trip…</p>}
      {error && <p role="alert">{error}</p>}
      {!token && !loading && (
        <>
          <p>Trips their recorders have chosen to share publicly.</p>
          <ul>
            {list.map((t) => (
              <li key={t.token}>
                <a href={`#trip=${t.token}`}>{t.title}</a>
                <span>
                  {t.boat}
                  {t.live ? " · Live" : ""}
                </span>
              </li>
            ))}
          </ul>
          {!list.length && <p>No public trips yet.</p>}
          <nav>
            <button
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              Previous
            </button>
            <button
              disabled={list.length < 50}
              onClick={() => setOffset(offset + 50)}
            >
              Next
            </button>
          </nav>
        </>
      )}
      {trip && (
        <>
          <p>
            {trip.boat} · {new Date(trip.startedAt).toLocaleString()}
          </p>
          <p role="status">
            {trip.live
              ? age === null
                ? "Live · waiting for a position"
                : age > 60
                  ? `Signal delayed · last position ${age}s ago`
                  : `● Live · last position ${age}s ago`
              : "Finished trip"}
          </p>
          <p>
            {sharedDistance(trip.points).toFixed(2)} nm ·{" "}
            {Math.max(
              0,
              Math.round(
                (Date.parse(
                  trip.stoppedAt ?? trip.latest?.recordedAt ?? trip.startedAt,
                ) -
                  Date.parse(trip.startedAt)) /
                  60000,
              ),
            )}{" "}
            min
          </p>
          <Map points={trip.points} color={trip.color} selected={p} />
          <p className="trip-map-key">
            Boat points along heading; amber arrow shows true wind blowing
            toward it. Without heading, the boat uses COG and the wind arrow is
            hidden. Heading is magnetic; COG is true.
          </p>
          {trip.points.length > 0 && (
            <figure className="trip-chart">
              <figcaption>Speed · knots</figcaption>
              <div className="trip-chart-legend">
                {plots.map((s) => (
                  <span key={s.key}>
                    <i style={{ background: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
              <div className="trip-chart-scale">
                <span>{speedMax.toFixed(1)} kn</span>
                <span>0</span>
              </div>
              <svg
                viewBox="0 0 600 140"
                role="img"
                aria-label="Boat speed, true wind speed and apparent wind speed over the trip, in knots"
                preserveAspectRatio="none"
              >
                {[0, 70, 140].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="600"
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    opacity=".12"
                  />
                ))}
                {plots.map((s) => (
                  <path
                    key={s.key}
                    d={s.plot.d}
                    stroke={s.color}
                    strokeWidth="2"
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <line
                  x1={cursor}
                  x2={cursor}
                  y1="0"
                  y2="140"
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  opacity=".7"
                />
              </svg>
              <div className="trip-chart-times">
                <span>{new Date(startTime).toLocaleTimeString()}</span>
                <span>
                  {new Date(startTime + duration).toLocaleTimeString()}
                </span>
              </div>
              {!plots.some((s) => s.plot.d) && (
                <p>No speed readings recorded.</p>
              )}
            </figure>
          )}
          {trip.points.length > 0 && (
            <>
              <label className="trip-timeline">
                {p ? new Date(p.recordedAt).toLocaleString() : ""}
                <input
                  aria-label="Explore trip timeline"
                  type="range"
                  min="0"
                  max={trip.points.length - 1}
                  value={index ?? trip.points.length - 1}
                  onChange={(e) => setIndex(Number(e.target.value))}
                />
              </label>
              {trip.live && index !== null && (
                <button onClick={() => setIndex(null)}>Back to live</button>
              )}
              <dl className="trip-instruments">
                {metrics.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Wind angles are signed: port is negative, starboard is positive.
                Missing readings are shown as —.
              </p>
            </>
          )}
        </>
      )}
    </main>
  );
}
const root = document.getElementById("shared-trips");
if (root) createRoot(root).render(<SharedTrips />);
