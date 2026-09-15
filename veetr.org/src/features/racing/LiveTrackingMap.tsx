import React, { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { supabase } from "./api";
import { t } from "./i18n";
import {
  parseTrackingPositions,
  positionAge,
  type TrackingPosition,
} from "./tracking";

async function fetchPositions(seriesId: string) {
  if (!supabase) throw new Error("Tracking is not configured.");
  const { data, error } = await supabase.rpc("public_tracking_positions", {
    p_series: seriesId,
  });
  if (error) throw error;
  return parseTrackingPositions(data);
}
export function LiveTrackingMap({ seriesId }: { seriesId: string }) {
  const [positions, setPositions] = useState<TrackingPosition[]>([]),
    [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false),
    [seamarks, setSeamarks] = useState(true),
    [seamarkError, setSeamarkError] = useState(false);
  const nautical = useRef<Leaflet.TileLayer | null>(null);
  const element = useRef<HTMLDivElement>(null),
    map = useRef<Leaflet.Map | null>(null);
  const leaflet = useRef<typeof Leaflet | null>(null),
    layer = useRef<Leaflet.LayerGroup | null>(null),
    fitted = useRef(false);
  useEffect(() => {
    let alive = true,
      timer: ReturnType<typeof setTimeout>,
      fetching = false;
    setPositions([]);
    setLoading(true);
    setError("");
    fitted.current = false;
    const refresh = async () => {
      if (fetching) return;
      clearTimeout(timer);
      if (document.hidden) {
        timer = setTimeout(refresh, 5000);
        return;
      }
      fetching = true;
      try {
        const rows = await fetchPositions(seriesId);
        if (alive) {
          setPositions(rows);
          setError("");
        }
      } catch {
        if (alive) {
          setPositions([]);
          setError("Live positions are unavailable. Retrying…");
        }
      } finally {
        fetching = false;
        if (alive) {
          setLoading(false);
          setNow(Date.now());
          timer = setTimeout(refresh, 5000);
        }
      }
    };
    void refresh();
    const visibility = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", visibility);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [seriesId]);
  useEffect(() => {
    let alive = true;
    void import("leaflet")
      .then((L) => {
        if (!alive || !element.current) return;
        leaflet.current = L;
        map.current = L.map(element.current).setView([49.7, 14.2], 6);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
          .on("tileerror", () => {
            if (alive) setMapError(true);
          })
          .addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
        setMapReady(true);
      })
      .catch(() => {
        if (alive) setMapError(true);
      });
    return () => {
      alive = false;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);
  const staleIds = positions
    .filter((p) => positionAge(p, now) > 60)
    .map((p) => p.boatId)
    .join(",");
  useEffect(() => {
    const L = leaflet.current,
      m = map.current,
      group = layer.current;
    if (!L || !m || !group) return;
    group.clearLayers();
    for (const p of positions) {
      const stale = positionAge(p, now) > 60,
        color = stale ? "#64748b" : "#007f73";
      if (p.trail.length > 1)
        L.polyline(p.trail, { color, weight: 3, opacity: 0.5 }).addTo(group);
      const label = document.createElement("span");
      label.textContent =
        p.boatName +
        (p.sogMps === null
          ? ""
          : ` · ${(p.sogMps * 1.94384449).toFixed(1)} kn`);
      L.circleMarker([p.latitude, p.longitude], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(label, { permanent: true, direction: "top" })
        .addTo(group);
    }
    if (positions.length && !fitted.current) {
      m.fitBounds(
        L.latLngBounds(positions.map((p) => [p.latitude, p.longitude])),
        { padding: [45, 45], maxZoom: 15 },
      );
      fitted.current = true;
    }
  }, [positions, staleIds, mapReady]);
  useEffect(() => {
    if (!mapReady || !map.current || !leaflet.current) return;
    setSeamarkError(false);
    if (seamarks) {
      nautical.current = leaflet.current
        .tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
          maxNativeZoom: 18,
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openseamap.org/">OpenSeaMap</a> contributors',
        })
        .on("tileerror", () => setSeamarkError(true))
        .addTo(map.current);
    }
    return () => {
      nautical.current?.remove();
      nautical.current = null;
    };
  }, [mapReady, seamarks]);
  function fitFleet() {
    if (map.current && leaflet.current && positions.length)
      map.current.fitBounds(
        leaflet.current.latLngBounds(
          positions.map((p) => [p.latitude, p.longitude]),
        ),
        { padding: [45, 45], maxZoom: 15 },
      );
  }
  return (
    <section className="live-tracking" aria-labelledby="tracking-title">
      <div className="tracking-heading">
        <div>
          <h2 id="tracking-title">{t("Live boat tracking")}</h2>
          <p>
            {t(
              "Positions shared by participating boats across this series. Updates target every 20 seconds.",
            )}
          </p>
        </div>
        <button onClick={fitFleet} disabled={!positions.length}>
          {t("Fit fleet")}
        </button>
      </div>
      <label className="tracking-layer-toggle">
        <input
          type="checkbox"
          checked={seamarks}
          onChange={(e) => setSeamarks(e.target.checked)}
        />
        {t("Nautical seamarks (OpenSeaMap)")}
      </label>
      {seamarks && (
        <p>
          {t(
            "Seamarks are a community overlay, not a complete nautical chart. Depths are not included.",
          )}
        </p>
      )}
      {seamarkError && (
        <p role="status">
          {t(
            "The nautical layer is unavailable. Tracking continues on the base map.",
          )}
        </p>
      )}
      <p role="status">
        {error
          ? t(error)
          : loading
            ? t("Loading live positions…")
            : positions.length
              ? `${positions.filter((p) => positionAge(p, now) <= 60).length} ${t("live")} · ${positions.filter((p) => positionAge(p, now) > 60).length} ${t("stale")}`
              : t("No boats are sharing their location right now.")}
      </p>
      {mapError && (
        <p role="status">
          {t(
            "Map tiles are unavailable. Boat coordinates remain available below.",
          )}
        </p>
      )}
      <div
        ref={element}
        className="tracking-map"
        role="region"
        aria-label={t("Live boat positions map")}
      />
      <p>
        {t(
          "Grey markers have not reported for over 60 seconds. GPS tracks are not official finish results.",
        )}
      </p>
      <div className="table-scroll">
        <table>
          <caption>{t("Latest reported boat positions")}</caption>
          <thead>
            <tr>
              <th>{t("Boat")}</th>
              <th>{t("SOG (kn)")}</th>
              <th>{t("Course (°)")}</th>
              <th>{t("Last fix")}</th>
              <th>{t("Position")}</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.boatId}>
                <th>
                  <button
                    onClick={() =>
                      map.current?.setView([p.latitude, p.longitude], 16)
                    }
                  >
                    {p.boatName}
                  </button>
                </th>
                <td>
                  {p.sogMps === null ? "—" : (p.sogMps * 1.94384449).toFixed(1)}
                </td>
                <td>{p.cogDeg === null ? "—" : p.cogDeg.toFixed(0)}</td>
                <td>
                  {positionAge(p, now)} s {t("ago")}
                  {positionAge(p, now) > 60 ? ` · ${t("stale")}` : ""}
                </td>
                <td>
                  {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)} · ±
                  {p.accuracyM === null ? "unknown" : `${Math.round(p.accuracyM)} m`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
