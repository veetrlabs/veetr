import { createElement, useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import type { TrackingPosition } from "./positions";
import "leaflet/dist/leaflet.css";
export default function FleetMap({
  positions,
  at,
  ownBoatId,
}: {
  positions: TrackingPosition[];
  at: number;
  ownBoatId?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const latest = useRef({ positions, at, ownBoatId });
  latest.current = { positions, at, ownBoatId };
  const render = useRef<(() => void) | null>(null);
  useEffect(() => {
    let alive = true;
    void import("leaflet").then((L) => {
      if (!alive || !element.current) return;
      const m = L.map(element.current).setView([49.7, 14.2], 6);
      map.current = m;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(m);
      L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
        maxNativeZoom: 18,
        maxZoom: 19,
        attribution: "© OpenSeaMap contributors",
      }).addTo(m);
      const group = L.layerGroup().addTo(m);
      let fitted = false;
      render.current = () => {
        group.clearLayers();
        const { positions, at, ownBoatId } = latest.current;
        for (const p of positions) {
          const color =
            at - Date.parse(p.recordedAt) > 60000
              ? "#64748b"
              : p.boatId === ownBoatId
                ? "#008c80"
                : "#2563eb";
          for (const segment of p.trailSegments ?? [p.trail]) {
            if (segment.length > 1) L.polyline(segment, { color }).addTo(group);
          }
          const label = document.createElement("span");
          label.textContent = p.boatName;
          L.circleMarker([p.latitude, p.longitude], { color, radius: 7 })
            .bindTooltip(label, { permanent: true })
            .addTo(group);
        }
        if (positions.length && !fitted) {
          m.fitBounds(
            positions.map((p) => [p.latitude, p.longitude]),
            { padding: [45, 45], maxZoom: 15 },
          );
          fitted = true;
        }
      };
      render.current();
      const observer = new ResizeObserver(() => m.invalidateSize());
      observer.observe(element.current);
      (m as any)._veetrObserver = observer;
    });
    return () => {
      alive = false;
      (map.current as any)?._veetrObserver?.disconnect();
      map.current?.remove();
      map.current = null;
      render.current = null;
    };
  }, []);
  useEffect(() => {
    render.current?.();
  }, [positions, at, ownBoatId]);
  return createElement("div", {
    ref: element,
    style: { flex: 1, minHeight: 250 },
    "aria-label": "Race map",
  });
}
