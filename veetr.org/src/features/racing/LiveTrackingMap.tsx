import React, { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { replayCoordinate } from "./replay";
import { useHeatReplay } from "./useHeatReplay";
import { t } from "./i18n";
import {
  positionsForHeat,
  positionAge,
} from "./tracking";

export function LiveTrackingMap({ seriesId, eventId, heatId, boatIds }: { seriesId: string; eventId: string; heatId?: string; boatIds: string[] }) {
  const replay = useHeatReplay(seriesId, eventId, heatId);
  const positions = useMemo(() => positionsForHeat(replay.positions, boatIds), [replay.positions, boatIds]);
  const displayTime = replay.shownAt;
  const formatTime = (stamp: number) => new Date(stamp).toLocaleString(document.documentElement.lang || undefined);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false),
    [seamarkError, setSeamarkError] = useState(false);
  const nautical = useRef<Leaflet.TileLayer | null>(null);
  const element = useRef<HTMLDivElement>(null),
    map = useRef<Leaflet.Map | null>(null);
  const leaflet = useRef<typeof Leaflet | null>(null),
    layer = useRef<Leaflet.LayerGroup | null>(null),
    fitted = useRef(false);
  useEffect(() => {
    let alive = true;
    void import("leaflet")
      .then((module) => {
        const L = module.default ?? module;
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
      .catch((error) => {
        console.error("Unable to initialize tracking map", error);
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
    .filter((p) => positionAge(p, displayTime) > 60)
    .map((p) => p.boatId)
    .join(",");
  useEffect(() => {
    const L = leaflet.current,
      m = map.current,
      group = layer.current;
    if (!L || !m || !group) return;
    group.clearLayers();
    const moving: {marker: Leaflet.CircleMarker; position: typeof positions[number]}[] = [];
    for (const p of positions) {
      const stale = positionAge(p, displayTime) > 60,
        color = stale ? "#64748b" : "#007f73";
      if (p.trail.length > 1)
        L.polyline(p.trail, { color, weight: 3, opacity: 0.5 }).addTo(group);
      const label = document.createElement("span");
      label.textContent =
        p.boatName +
        (p.sogMps === null
          ? ""
          : ` · ${(p.sogMps * 1.94384449).toFixed(1)} kn`);
      const marker = L.circleMarker(replayCoordinate(p, displayTime), {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(label, { permanent: true, direction: "top" })
        .addTo(group);
      moving.push({marker, position: p});
    }
    if (positions.length && !fitted.current) {
      m.fitBounds(
        L.latLngBounds(positions.map((p) => [p.latitude, p.longitude])),
        { padding: [45, 45], maxZoom: 15 },
      );
      fitted.current = true;
    }
    let animation = 0;
    const started = performance.now();
    if (replay.playing && !replay.following) {
      const animate = (now: number) => {
        const at = displayTime + Math.min(now - started, 100) * replay.speed;
        for (const {marker, position} of moving) marker.setLatLng(replayCoordinate(position, at));
        animation = requestAnimationFrame(animate);
      };
      animation = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animation);
  }, [positions, staleIds, mapReady, displayTime, replay.playing, replay.following, replay.speed]);
  useEffect(() => {
    if (!mapReady || !map.current || !leaflet.current) return;
    setSeamarkError(false);
    nautical.current = leaflet.current
      .tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
        maxNativeZoom: 18,
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openseamap.org/">OpenSeaMap</a> contributors',
      })
      .on("tileerror", () => setSeamarkError(true))
      .addTo(map.current);
    return () => {
      nautical.current?.remove();
      nautical.current = null;
    };
  }, [mapReady]);
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
          <h2 id="tracking-title">{t(heatId ? "Heat map" : "Race map")}</h2>
        </div>
        <button onClick={fitFleet} disabled={!positions.length}>
          {t("Fit fleet")}
        </button>
      </div>
      {seamarkError && (
        <p role="status">
          {t(
            "The nautical layer is unavailable. Tracking continues on the base map.",
          )}
        </p>
      )}
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
        aria-label={t("Recorded boat positions map")}
      />
      <div className="replay-controls">
        {heatId && replay.heats.find(h=>h.id===heatId)?.start === null && <p>{t("The referee has not set this heat’s start time yet.")}</p>}
        {replay.error ? <p role="alert">{t(replay.error)} <button onClick={replay.retry}>{t("Retry")}</button></p> : !replay.bounds && <p role="status">{t(replay.loading ? "Loading replay…" : "No recording is available for this selection.")}</p>}
        {replay.bounds && <>
          <div className="replay-toolbar">
            <button onClick={replay.togglePlay} disabled={!!replay.error || replay.bounds.start === replay.bounds.end}>{t(replay.playing ? "Pause replay" : "Play replay")}</button>
            <label>{t("Playback speed")} <select value={replay.speed} onChange={e => replay.setSpeed(Number(e.target.value))}>
              {[1, 10, 30, 60, 120].map(speed => <option key={speed} value={speed}>{speed}×</option>)}
            </select></label>
            <output>{formatTime(replay.at)}</output>
          </div>
          <label className="replay-timeline">{t("Replay time")}
            <input type="range" min={replay.bounds.start} max={replay.bounds.end} step="any" value={replay.at}
              aria-valuetext={formatTime(replay.at)} onChange={e => replay.seek(Number(e.target.value))} />
          </label>
        </>}
      </div>
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
                  {new Date(p.recordedAt).toLocaleTimeString()}
                  {positionAge(p, displayTime) > 60 ? ` · ${t("stale")}` : ""}
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
