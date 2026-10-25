import { routeGeometry } from "./routeGeometry";
import { MapChartPanel, TripMapFrame } from "./MapChartPanel";
import { mapChartWindow, type MapViewport } from "./mapChartWindow";
import { t as tr } from "./i18n";
import { localizedPath, siteLanguage } from "../../i18n/site";
const language = siteLanguage(location.pathname);
const locale = language === "cs" ? "cs-CZ" : "en";
const href = (path: string) => localizedPath(path, language);
import { countryLabel } from "./tripCountryLabels";
import { startCountry } from "./tripCountry";
import { sharedDistance, tripPlot, boatOrientation, tripIndexAtFraction } from "./sharedTripData";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  accuracyM?: number | null;
  seq: number;
  recordedAt: string;
  latitude: number;
  longitude: number;
  sogMps: number | null;
  cogDeg: number | null;
  instruments?: Instruments;
};
type Shared = {
  boatSlug: string | null;
  title: string;
  boat: string;
  color: string;
  live: boolean;
  startedAt: string;
  stoppedAt: string | null;
  latest: Point | null;
  points: Point[];
};
type Listing = { token: string; title: string; boat: string; live: boolean; startedAt: string; stoppedAt: string | null; color: string; distanceNm: number; startLatitude: number | null; startLongitude: number | null };
async function rpc<T>(name: string, args: Record<string, unknown> = {}) {
  if (!supabase) throw new Error(tr("Trip sharing is not configured."));
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
}
function Map({
  points,
  color,
  selected,
  onViewport,
}: {
  points: Point[];
  color: string;
  selected?: Point;
  onViewport: (viewport: MapViewport) => void;
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
        map.current = L.map(element.current, {zoomControl:false}).setView([49.7, 14.2], 6);
        map.current.on("moveend", () => {
          const bounds = map.current?.getBounds();
          if (alive && bounds) onViewport({south: bounds.getSouth(), north: bounds.getNorth(), west: bounds.getWest(), east: bounds.getEast()});
        });
        L.control.zoom({zoomInTitle:tr("Zoom in"),zoomOutTitle:tr("Zoom out")}).addTo(map.current);
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
        setError(tr("Map unavailable. Trip data remains available below."));
      });
    return () => {
      alive = false;
      map.current?.remove();
    };
  }, []);
  useEffect(() => {
    if (!element.current) return;
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const L = leaflet.current,
      m = map.current,
      g = layer.current;
    if (!ready || !L || !m || !g) return;
    g.clearLayers();
    for (const section of routeGeometry(points)) {
      L.polyline(section.points.map(p => [p.latitude, p.longitude] as Leaflet.LatLngTuple), {color, weight:3, dashArray:section.estimated ? "6 6" : undefined}).addTo(g);
    }
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
            ? tr("Boat · heading unavailable")
            : `${courseOnly ? tr("Course over ground") : tr("Heading")}: ${heading.toFixed(0)}°${windFrom === null ? "" : ` · TWA ${selected.instruments!.twa}°`}`,
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
      <div ref={element} className="trip-map" aria-label={tr("Trip route map")} />
      {error && <p role="alert">{error}</p>}
      <button className="trip-map-fit"
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
        {tr("Fit route")}
      </button>
    </>
  );
}
export default function SharedTrips() {
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [token, setToken] = useState(
      () => new URLSearchParams(location.hash.slice(1)).get("trip") ?? "",
    ),
    [trip, setTrip] = useState<Shared | null>(null),
    [list, setList] = useState<Listing[]>([]),
    [offset, setOffset] = useState(0),
    [hasNext, setHasNext] = useState(false),
    [countries, setCountries] = useState<Record<string, string>>({}),
    [status, setStatus] = useState("all"),
    [order, setOrder] = useState("newest"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [index, setIndex] = useState<number | null>(null),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const change = () => {
      setToken(new URLSearchParams(location.hash.slice(1)).get("trip") ?? "");
      setIndex(null);
      setViewport(null);
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
            p_offset: offset, p_status: status, p_order: order,
          });
          if (alive) {
            setList(rows.slice(0, 20)); setHasNext(rows.length > 20); setError("");
            const data = (await import("./countries.json")).default;
            if (alive) setCountries(Object.fromEntries(rows.map(row => [row.token, startCountry(data, row.startLatitude, row.startLongitude)])));
          }
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
              tr("This trip is private or its sharing link has been disabled."),
            );
          }
          points = [...points, ...result.points];
          // Pagination follows stable upload sequence; the route follows fix time.
          if (alive) setTrip({ ...result, points: [...points].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)) });
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
  }, [token, offset, status, order]);
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
        [tr("Heading"), format(p.instruments?.heading, "°")],
        ["TWA", format(p.instruments?.twa, "°")],
        ["AWA", format(p.instruments?.awa, "°")],
        ["TWS", format(p.instruments?.tws, "kn")],
        ["AWS", format(p.instruments?.aws, "kn")],
      ]
    : [];
  const chartRange = useMemo(() => {
    const points = trip?.points ?? [];
    const window = mapChartWindow(points, viewport);
    if (!window) return { points: [], offset: 0 };
    const offset = points.findIndex(p => Date.parse(p.recordedAt) >= window.start);
    let end = points.length - 1;
    while (end >= offset && Date.parse(points[end].recordedAt) > window.end) end--;
    return { points: points.slice(offset, end + 1), offset };
  }, [trip?.points, viewport]);
  const chartPoints = chartRange.points;
  const chartEnd = chartRange.offset + chartPoints.length - 1;
  const speedSeries = [
    { key: "sog", label: tr("Boat speed · SOG"), color: "#38bdf8" },
    { key: "tws", label: tr("True wind · TWS"), color: "#f59e0b" },
    { key: "aws", label: tr("Apparent wind · AWS"), color: "#c084fc" },
  ] as const;
  const speedMax = trip
    ? Math.ceil(1.1 * Math.max(1, ...speedSeries.map((s) => tripPlot(chartPoints, s.key, undefined, viewport).max)))
    : 1;
  const plots = trip
    ? speedSeries.map((s) => ({
        ...s,
        plot: tripPlot(chartPoints, s.key, speedMax, viewport),
      }))
    : [];
  const startTime = Date.parse(chartPoints[0]?.recordedAt ?? "");
  const duration = Math.max(
    1,
    Date.parse(chartPoints.at(-1)?.recordedAt ?? "") - startTime,
  );
  const cursor = p
    ? (600 * (Date.parse(p.recordedAt) - startTime)) / duration
    : 0;
  return (
    <main id="trip-content" className="shared-trip">

      {token ? <a href={href("/trips/")}>{tr("Explore trips")}</a> : null}
      <h1>{trip?.title ?? tr("Sailing adventures")}</h1>
      {loading && <p role="status">{tr("Loading trip\u2026")}</p>}
      {error && <p role="alert">{error}</p>}
      {!token && (
        <>
          <p className="trip-directory-intro">{tr("Follow a voyage live or explore where others have sailed.")} <a href={href("/docs/share-your-trip/")}>{tr("How to share your trip \u2192")}</a></p>
          <div className="trip-directory-tools">
            <div className="trip-filters" role="group" aria-label={tr("Filter trips")}>
              {[["all", tr("All trips")], ["active", tr("Active")], ["past", tr("Past")]].map(([value, label]) =>
                <button key={value} aria-pressed={status === value} onClick={() => { setStatus(value); setOffset(0); }}>{label}</button>
              )}
            </div>
            <label className="trip-sort">{tr("Date")}
              <select aria-label={tr("Sort trips by date")} value={order} onChange={e => { setOrder(e.target.value); setOffset(0); }}>
                <option value="newest">{tr("Newest first")}</option>
                <option value="oldest">{tr("Oldest first")}</option>
              </select>
            </label>
          </div>
          {!loading && !error && <>
            <ul className="trip-cards">
              {list.map(t => <li key={t.token}>
                <a className="trip-card" href={`#trip=${t.token}`}>
                  <span className={`trip-badge ${t.live ? "is-live" : ""}`}>{t.live ? tr("● Active · Live") : tr("Past trip")}</span>
                  <h2>{t.title}</h2>
                  <p className="trip-card-boat">{t.boat}</p>
                  <time dateTime={t.startedAt}>{new Date(t.startedAt).toLocaleDateString(locale, {day:"numeric",month:"short",year:"numeric"})} · {new Date(t.startedAt).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"})}</time>
                  <p className="trip-card-details"><span title={tr("Approximate country at the first recorded position")}>{tr("Start: {country}", {country: countryLabel(countries[t.token])})}</span><span>{tr("{distance} nm recorded", {distance: t.distanceNm.toLocaleString(locale, {minimumFractionDigits:2,maximumFractionDigits:2})})}</span></p>
                </a>
              </li>)}
            </ul>
            {!list.length && <p className="trip-empty">{status === "active" ? tr("No public trips are active right now.") : status === "past" ? tr("No past public trips yet.") : tr("No public trips yet.")}</p>}
            {(offset > 0 || hasNext) && <nav aria-label={tr("Trip pages")}><span>{tr("Page {page} · 20 trips per page", {page: Math.floor(offset / 20) + 1})}</span>
              <button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 20))}>{tr("Previous")}</button>
              <button disabled={!hasNext} onClick={() => setOffset(offset + 20)}>{tr("Next")}</button>
            </nav>}
          </>}
        </>
      )}
      {trip && (
        <>
          <p>
            {trip.boatSlug ? <a href={href(`/boats/${encodeURIComponent(trip.boatSlug)}/`)}>{trip.boat}</a> : trip.boat} · {new Date(trip.startedAt).toLocaleString(locale)}
          </p>
          <p role="status">
            {trip.live
              ? age === null
                ? tr("Live · waiting for a position")
                : age > 60
                  ? tr("Signal delayed · last position {seconds}s ago", {seconds:age})
                  : tr("● Live · last position {seconds}s ago", {seconds:age})
              : tr("Finished trip")}
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
          <TripMapFrame key={token}>
          <Map key={token} points={trip.points} color={trip.color} selected={p} onViewport={setViewport} />
          <MapChartPanel>
          {trip.points.length > 0 && !chartPoints.length && <p>{tr("No recorded positions in this map area. Zoom out to see the route.")}</p>}
          {chartPoints.length > 0 && (
            <figure className="trip-chart">
              <figcaption>{tr("Speed \u00b7 knots")}</figcaption>
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
                role="slider"
                tabIndex={0}
                aria-label={tr("Explore trip timeline")}
                aria-valuemin={chartRange.offset}
                aria-valuemax={chartEnd}
                aria-valuenow={Math.max(chartRange.offset, Math.min(chartEnd, index ?? chartEnd))}
                aria-valuetext={new Date(trip.points[Math.max(chartRange.offset, Math.min(chartEnd, index ?? chartEnd))].recordedAt).toLocaleString(locale)}
                aria-describedby="trip-chart-help"
                onPointerDown={e => {
                  if (e.button !== 0) return;
                  e.currentTarget.focus();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setIndex(chartRange.offset + tripIndexAtFraction(chartPoints, (e.clientX - rect.left) / rect.width));
                }}
                onPointerMove={e => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  setIndex(chartRange.offset + tripIndexAtFraction(chartPoints, (e.clientX - rect.left) / rect.width));
                }}
                onPointerUp={e => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                }}
                onKeyDown={e => {
                  const current = Math.max(chartRange.offset, Math.min(chartEnd, index ?? chartEnd));
                  const next = e.key === "Home" ? chartRange.offset : e.key === "End" ? chartEnd :
                    ["ArrowLeft", "ArrowDown"].includes(e.key) ? current - 1 :
                    ["ArrowRight", "ArrowUp"].includes(e.key) ? current + 1 :
                    e.key === "PageDown" ? current - 10 : e.key === "PageUp" ? current + 10 : null;
                  if (next !== null) { e.preventDefault(); setIndex(Math.max(chartRange.offset, Math.min(chartEnd, next))); }
                }}
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
                {cursor >= 0 && cursor <= 600 && <><line
                  x1={cursor}
                  x2={cursor}
                  y1="0"
                  y2="140"
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  opacity=".7"
                />
              <circle cx={Math.max(5, Math.min(595, cursor))} cy="132" r="5" fill="currentColor" /></>}
              </svg>
              <div className="trip-chart-times">
                <span>{new Date(startTime).toLocaleTimeString(locale)}</span>
                <span>
                  {new Date(startTime + duration).toLocaleTimeString(locale)}
                </span>
              </div>
              {!plots.some((s) => s.plot.d) && (
                <p>{tr("No speed readings recorded.")}</p>
              )}
            </figure>
          )}
          </MapChartPanel>
          </TripMapFrame>
      <p>{tr("Dashed route sections are estimates across unreliable or missing GPS fixes.")}</p>
          <p className="trip-map-key">
            {tr("Boat points along heading; amber arrow shows true wind blowing toward it. Without heading, the boat uses COG and the wind arrow is hidden. Heading is magnetic; COG is true.")}
          </p>
          {trip.points.length > 0 && (
            <>
              <p id="trip-chart-help" className="trip-map-key">{tr("Zoom or pan the map to focus the chart. Drag across the chart to explore the route. Use arrow keys when focused.")}</p>
              <p className="trip-selected-time">{p ? new Date(p.recordedAt).toLocaleString(locale) : ""}</p>
              {trip.live && index !== null && (
                <button onClick={() => setIndex(null)}>{tr("Back to live")}</button>
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
                {tr("Wind angles are signed: port is negative, starboard is positive. Missing readings are shown as \u2014.")}
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
