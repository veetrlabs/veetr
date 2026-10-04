import { routeSegments } from "../tracking/trip";
import type { TrackingPoint } from "../tracking/model";
import { distinctCourse } from "../maps/courseVector";
import { headingRay } from "../maps/headingRay";
import { boatBearings } from "../maps/boatSymbol";
import { boatSymbol } from "../maps/boatSymbol";
import { t, useLanguageRefresh } from '../i18n';
import { createElement, useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import type { TrackingPosition } from "./positions";
import "leaflet/dist/leaflet.css";
export default function FleetMap({
  positions,
  at,
  ownBoatId,
  onViewportChange,
  fitRequest = 0,
  route = [],
}: {
  positions: TrackingPosition[];
  at: number;
  ownBoatId?: string;
  onViewportChange?: (region: import("../maps/headingRay").MapRegion) => void;
  fitRequest?: number;
  route?: TrackingPoint[];
}) {
  useLanguageRefresh();
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const latest = useRef({ positions, at, ownBoatId, route, fitRequest, onViewportChange });
  latest.current = { positions, at, ownBoatId, route, fitRequest, onViewportChange };
  const render = useRef<(() => void) | null>(null);
  useEffect(() => {
    let alive = true;
    void import("leaflet").then((L) => {
      if (!alive || !element.current) return;
      const m = L.map(element.current).setView([49.7, 14.2], 6);
      map.current = m;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: t("© OpenStreetMap contributors"),
      }).addTo(m);
      L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
        maxNativeZoom: 18,
        maxZoom: 19,
        attribution: t("© OpenSeaMap contributors"),
      }).addTo(m);
      const group = L.layerGroup().addTo(m);
      let fitted = false;
      let lastFit = -1, lastRouteLength = -1;
      render.current = () => {
        group.clearLayers();
        if (lastFit !== latest.current.fitRequest || lastRouteLength !== latest.current.route.length) { fitted = false; lastFit = latest.current.fitRequest; lastRouteLength = latest.current.route.length; }
        const { positions, at, ownBoatId, route, fitRequest, onViewportChange } = latest.current;
        for (const segment of routeSegments(route)) {
          if (segment.length > 1) L.polyline(segment.map(p => [p.latitude, p.longitude] as [number, number]), { color: '#3b82f6', opacity: 0.3, weight: 2, interactive: false }).addTo(group);
        }
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
          const bounds = m.getBounds(), center = m.getCenter();
          const ray = headingRay(p, p, { latitude: center.lat, longitude: center.lng, latitudeDelta: bounds.getNorth() - bounds.getSouth(), longitudeDelta: bounds.getEast() - bounds.getWest() });
          if (ray.length) {
            const points: [number, number][] = ray.map(c => [c.latitude, c.longitude]);
            L.polyline(points, { color: 'black', weight: 1, dashArray: boatBearings(p).courseOnly ? '6 5' : undefined, interactive: false }).addTo(group);
          }
          const course = distinctCourse(p);
          if (course !== null) {
            const coordinates = headingRay(p, { cogDeg: course }, { latitude: center.lat, longitude: center.lng, latitudeDelta: bounds.getNorth() - bounds.getSouth(), longitudeDelta: bounds.getEast() - bounds.getWest() });
            const line: [number, number][] = coordinates.map(c => [c.latitude, c.longitude]);
            L.polyline(line, { color: '#2563eb', weight: 1, dashArray: '8 6', interactive: false }).addTo(group);
          }
          const label = document.createElement("span");
          label.textContent = p.boatName;
          L.marker([p.latitude, p.longitude], { icon: L.divIcon({ className: "veetr-boat", html: boatSymbol(p, color), iconSize: [112,112], iconAnchor: [56,56] }) })
            .bindTooltip(label, { permanent: true })
            .addTo(group);
        }
        if (positions.length && !fitted) {
          fitted = true;
          m.fitBounds(
            (route.length ? route : positions).map((p) => [p.latitude, p.longitude]),
            { padding: [45, 45], maxZoom: 15 },
          );
          fitted = true;
        }
      };
      render.current();
      m.on("moveend zoomend", () => {
        render.current?.();
        const b = m.getBounds(), c = m.getCenter();
        latest.current.onViewportChange?.({ latitude: c.lat, longitude: c.lng, latitudeDelta: b.getNorth() - b.getSouth(), longitudeDelta: b.getEast() - b.getWest() });
      });
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
  }, [positions, at, ownBoatId, route, fitRequest]);
  return createElement("div", {
    ref: element,
    style: { flex: 1, minHeight: 250 },
    "aria-label": t("Race map"),
  });
}
