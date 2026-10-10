import type * as Leaflet from "leaflet";
import { courseRoute, longitudeDelta, midpoint, startGeometry, type CoursePoint, type RaceCourse } from "./course";
import { t } from "./i18n";
export type CourseTarget = "startA" | "startB" | `mark:${string}`;
export const coordinates = (p: CoursePoint, anchor: number): [number, number] => [p.latitude, anchor + longitudeDelta(anchor, p.longitude)];
const point = (p: Leaflet.LatLng): CoursePoint => ({latitude: Number(p.lat.toFixed(6)), longitude: Number(p.wrap().lng.toFixed(6))});
// Shared by the editor and the race/heat tracking map.
export function drawCourse(L: typeof Leaflet, m: Leaflet.Map, group: Leaflet.LayerGroup, course: RaceCourse, options: {
  startDraft?: [CoursePoint | undefined, CoursePoint | undefined];
  onMove?: (target: CourseTarget, point: CoursePoint) => void;
  onGesture?: () => void;
} = {}) {
  const {startDraft} = options;
  group.clearLayers();
    const endpoints: (CoursePoint | undefined)[] =
      startDraft ?? startGeometry(course);
    const all = [
      ...course.marks,
      ...endpoints.filter((p): p is CoursePoint => !!p),
    ];
    const anchor = all[0]?.longitude ?? 0;
    const marker = (
      p: CoursePoint,
      label: string,
      title: string,
      className: string,
      target: CourseTarget,
    ) => {
      const icon = document.createElement("span");
      icon.className = `course-pin ${className}`;
      icon.textContent = label;
      const tooltip = document.createElement("span");
      tooltip.textContent = title;
      const mark = L.marker(coordinates(p, anchor), {
        icon: L.divIcon({
          html: icon,
          className: "course-marker",
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        title,
        alt: title,
        draggable: !!options.onMove && !(target === "startB" && course.startBearing),
        bubblingMouseEvents: false,
      })
        .bindTooltip(tooltip)
        .addTo(group);
      // A fixed estimate must not pass a drag gesture through to map panning.
      const markerElement = mark.getElement();
      if (markerElement) {
        L.DomEvent.disableClickPropagation(markerElement);
        L.DomEvent.on(markerElement, "mousedown touchstart", () => { options.onGesture?.(); });
      }
      if (options.onMove && !(target === "startB" && course.startBearing))
        mark.on("dragend", () =>
          options.onMove?.(target, point(mark.getLatLng())),
        );
    };
    const route = courseRoute(course);
    if (route.length > 1) {
      L.polyline(
        route.map((p) => coordinates(p, anchor)),
        { color: "#295b91", weight: 3, dashArray: "8 6", interactive: false },
      ).addTo(group);
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1],
          b = route[i];
        if (
          a.latitude === b.latitude &&
          longitudeDelta(a.longitude, b.longitude) === 0
        )
          continue;
        // Bearings are measured in the map projection so arrows follow the drawn legs.
        const from = m.project(coordinates(a, anchor)),
          to = m.project(coordinates(b, anchor));
        const angle =
          (Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI;
        const arrow = document.createElement("span");
        arrow.className = "course-leg-arrow";
        arrow.textContent = "▲";
        arrow.style.transform = `rotate(${angle}deg)`;
        L.marker(coordinates(midpoint(a, b), anchor), {
          icon: L.divIcon({
            html: arrow,
            className: "course-arrow",
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
          interactive: false,
          keyboard: false,
        }).addTo(group);
      }
    }
    if (endpoints[0] && endpoints[1])
      L.polyline(
        [coordinates(endpoints[0], anchor), coordinates(endpoints[1], anchor)],
        {
          color: "#79520d",
          weight: 5,
          dashArray: course.startBearing ? "10 7" : undefined,
          interactive: false,
        },
      ).addTo(group);
    if (
      course.startBearing &&
      !course.startBearing.distanceMetres &&
      endpoints[0] &&
      endpoints[1]
    ) {
      const from = m.project(coordinates(endpoints[0], anchor)),
        to = m.project(coordinates(endpoints[1], anchor));
      const arrow = document.createElement("span");
      arrow.className = "course-leg-arrow";
      arrow.textContent = "▲";
      arrow.style.transform = `rotate(${(Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI}deg)`;
      L.marker(coordinates(endpoints[1], anchor), {
        icon: L.divIcon({
          html: arrow,
          className: "course-arrow",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        keyboard: false,
        interactive: false,
        title: t("Direction only — buoy distance unknown"),
      }).addTo(group);
    }
    endpoints.forEach((p, i) => {
      if (
        p &&
        !(i === 1 && course.startBearing && !course.startBearing.distanceMetres)
      )
        marker(
          p,
          i === 0 ? "A" : "B",
          t(
            i === 0
              ? "Start line end A"
              : course.startBearing
                ? "Estimated buoy position B"
                : "Start line end B",
          ),
          "course-pin-start",
          i === 0 ? "startA" : "startB",
        );
    });
    course.marks.forEach((mark, i) =>
      marker(
        mark,
        `${i + 1} ${mark.rounding === "port" ? "↶" : "↷"}`,
        `${t("Mark {number}", { number: i + 1 })} · ${t(mark.rounding === "port" ? "Leave to port (left)" : "Leave to starboard (right)")}`,
        `course-pin-${mark.rounding}`,
        `mark:${mark.id}`,
      ),
    );
}
