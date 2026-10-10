import { Scan, Focus, MapPin } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import {
  coursePoints,
  startGeometry,
  type CoursePoint,
  type RaceCourse,
} from "./course";
import { t } from "./i18n";

import { drawCourse, coordinates, type CourseTarget } from "./courseLayer";
export type { CourseTarget } from "./courseLayer";
const point = (p: Leaflet.LatLng): CoursePoint => ({
  latitude: Number(p.lat.toFixed(6)),
  longitude: Number(p.wrap().lng.toFixed(6)),
});
export function CourseMap({
  course,
  startDraft,
  onPick,
  onMove,
  picking = false,
  actions,
}: {
  course: RaceCourse;
  startDraft?: [CoursePoint | undefined, CoursePoint | undefined];
  onPick?: (point: CoursePoint) => void;
  onMove?: (target: CourseTarget, point: CoursePoint) => void;
  picking?: boolean;
  actions?: React.ReactNode;
}) {
  const language = t("Leave to port (left)");
  const element = useRef<HTMLDivElement>(null),
    map = useRef<Leaflet.Map | null>(null),
    layer = useRef<Leaflet.LayerGroup | null>(null),
    leaflet = useRef<typeof Leaflet | null>(null);
  const callbacks = useRef({ onPick, onMove });
  callbacks.current = { onPick, onMove };
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const fitted = useRef(false);
  const markerGesture = useRef(false);
  useEffect(() => {
    let alive = true;
    let observer: ResizeObserver | undefined;
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;
    const releaseMarker = () => {
      releaseTimer = setTimeout(() => { markerGesture.current = false; }, 0);
    };
    document.addEventListener("mouseup", releaseMarker);
    document.addEventListener("touchend", releaseMarker);
    document.addEventListener("touchcancel", releaseMarker);
    void import("leaflet")
      .then((module) => {
        if (!alive || !element.current) return;
        const L = module.default ?? module;
        leaflet.current = L;
        const m = L.map(element.current, { scrollWheelZoom: false }).setView(
          [49.7, 14.2],
          6,
        );
        map.current = m;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
          .on("tileerror", () => {
            if (alive)
              setError(
                "Map tiles could not load. Course positions are still shown.",
              );
          })
          .addTo(m);
        L.control.scale({ imperial: false }).addTo(m);
        layer.current = L.layerGroup().addTo(m);
        m.on("click", (event: Leaflet.LeafletMouseEvent) =>
          !markerGesture.current && callbacks.current.onPick?.(point(event.latlng)),
        );
        m.on("locationfound", (event: Leaflet.LocationEvent) => {
          m.setView(event.latlng, 15);
          setError("");
        });
        m.on("locationerror", () =>
          setError(
            "Location unavailable. Pan and zoom the map to your sailing area.",
          ),
        );
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => m.invalidateSize());
          observer.observe(element.current);
        }
        setReady(true);
      })
      .catch(() => {
        if (alive)
          setError(
            "The course map could not load. The mark list is still available.",
          );
      });
    return () => {
      alive = false;
      observer?.disconnect();
      clearTimeout(releaseTimer);
      document.removeEventListener("mouseup", releaseMarker);
      document.removeEventListener("touchend", releaseMarker);
      document.removeEventListener("touchcancel", releaseMarker);
      map.current?.stopLocate();
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);
  const fit = () => {
    const L = leaflet.current,
      m = map.current;
    const endpoints: (CoursePoint | undefined)[] =
      startDraft ?? startGeometry(course);
    const points: CoursePoint[] = [
      ...course.marks,
      ...endpoints.filter((p): p is CoursePoint => !!p),
    ];
    if (!L || !m || !points.length) return;
    m.fitBounds(
      L.latLngBounds(points.map((p) => coordinates(p, points[0].longitude))),
      { padding: [45, 45], maxZoom: 16 },
    );
  };
  useEffect(() => {
    const L = leaflet.current,
      m = map.current,
      group = layer.current;
    if (!L || !m || !group) return;
    group.clearLayers();
    drawCourse(L, m, group, course, {startDraft, onMove: onMove ? (target, point) => callbacks.current.onMove?.(target, point) : undefined, onGesture: () => {markerGesture.current = true;}});
    const all = [...course.marks, ...(startDraft ?? startGeometry(course)).filter(Boolean)];
    if (!fitted.current && all.length) {
      fit();
      fitted.current = true;
    }
  }, [course, startDraft, ready, language, !!onMove]);
  return (
    <div className={`course-map-shell${picking ? " course-map-picking" : ""}`}>
      <p className="course-map-legend">
        <strong>{t("A–B: start line")}</strong>{" · "}
        {t("A: referee · B: buoy · 1, 2…: turning marks")}
      </p>
      <div className="course-map-viewport">
      <div className="course-map-actions" role="group" aria-label={t("Course map tools")}>
        <button
          type="button"
          disabled={
            !ready ||
            !(coursePoints(course).length || startDraft?.some(Boolean))
          }
          title={t("Show whole course")}
          aria-label={t("Show whole course")}
          onClick={fit}
        >
          <Scan size={19} aria-hidden="true" />
        </button>
        {(startDraft?.[0] || course.startLine || course.startBearing) && (
          <button type="button" title={t("Zoom to start line")} aria-label={t("Zoom to start line")} disabled={!ready} onClick={() => {
            const candidates: (CoursePoint | undefined)[] = startDraft ?? startGeometry(course);
            const ends = candidates.filter((p): p is CoursePoint => !!p);
            if (leaflet.current && map.current && ends.length)
              map.current.fitBounds(leaflet.current.latLngBounds(ends.map(p => coordinates(p, ends[0].longitude))), {padding: [65, 65], maxZoom: 18});
          }}><Focus size={19} aria-hidden="true" /></button>
        )}
        {actions}
        {onPick && picking && (
          <button type="button" title={t("Place at map centre")} aria-label={t("Place at map centre")} disabled={!ready} onClick={() => {
            if (map.current) onPick(point(map.current.getCenter()));
          }}><MapPin size={19} aria-hidden="true" /></button>
        )}
      </div>
      <div
        ref={element}
        className="course-map"
        aria-label={t("Race course map")}
      />
      </div>
      {error && <p role="status">{t(error)}</p>}
    </div>
  );
}
