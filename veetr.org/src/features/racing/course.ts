import type { Series } from "./domain";

export interface CoursePoint {
  latitude: number;
  longitude: number;
}
export interface CourseMark extends CoursePoint {
  id: string;
  name: string;
  rounding: "port" | "starboard";
}
export interface RaceCourse {
  marks: CourseMark[];
  startLine?: [CoursePoint, CoursePoint];
  startBearing?: {
    origin: CoursePoint;
    degrees: number;
    distanceMetres?: number;
  };
  startLive?: { updatedAt: string; accuracyMetres: number };
  notes?: string;
}
export const MAX_COURSE_MARKS = 40;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const onlyKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
export function validCoursePoint(value: unknown): value is CoursePoint {
  return (
    object(value) &&
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    Math.abs(value.latitude) <= 90 &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.longitude) <= 180
  );
}
export function longitudeDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}
export function midpoint(a: CoursePoint, b: CoursePoint): CoursePoint {
  const longitude = a.longitude + longitudeDelta(a.longitude, b.longitude) / 2;
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: ((longitude + 540) % 360) - 180,
  };
}
export function validateCourse(value: unknown): asserts value is RaceCourse {
  if (
    !object(value) ||
    !onlyKeys(value, [
      "marks",
      "startLine",
      "startBearing",
      "startLive",
      "notes",
    ]) ||
    !Array.isArray(value.marks) ||
    value.marks.length > MAX_COURSE_MARKS ||
    (value.notes !== undefined &&
      (typeof value.notes !== "string" || value.notes.length > 1000))
  )
    throw new Error("Invalid course map");
  if (value.startLive !== undefined) {
    const live = value.startLive;
    if (
      (!value.startLine && !value.startBearing) ||
      !object(live) ||
      !onlyKeys(live, ["updatedAt", "accuracyMetres"]) ||
      typeof live.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(live.updatedAt)) ||
      typeof live.accuracyMetres !== "number" ||
      !Number.isFinite(live.accuracyMetres) ||
      live.accuracyMetres < 0 ||
      live.accuracyMetres > 50
    )
      throw new Error("Invalid live start position");
  }
  if (value.startBearing !== undefined) {
    const b = value.startBearing;
    if (
      value.startLine !== undefined ||
      !object(b) ||
      !onlyKeys(b, ["origin", "degrees", "distanceMetres"]) ||
      !validCoursePoint(b.origin) ||
      !onlyKeys(b.origin as unknown as Record<string, unknown>, [
        "latitude",
        "longitude",
      ]) ||
      typeof b.degrees !== "number" ||
      !Number.isFinite(b.degrees) ||
      b.degrees < 0 ||
      b.degrees >= 360 ||
      (b.distanceMetres !== undefined &&
        (typeof b.distanceMetres !== "number" ||
          !Number.isFinite(b.distanceMetres) ||
          b.distanceMetres <= 0 ||
          b.distanceMetres > 10000))
    )
      throw new Error("Check the start position, bearing and distance");
  }
  const ids = new Set<string>();
  for (const mark of value.marks) {
    if (
      !object(mark) ||
      !validCoursePoint(mark) ||
      !onlyKeys(mark as unknown as Record<string, unknown>, [
        "id",
        "name",
        "rounding",
        "latitude",
        "longitude",
      ]) ||
      typeof mark.id !== "string" ||
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(mark.id) ||
      ids.has(mark.id) ||
      typeof mark.name !== "string" ||
      !mark.name.trim() ||
      mark.name.length > 80 ||
      !["port", "starboard"].includes(mark.rounding as string)
    )
      throw new Error("Check course marks, positions and rounding sides");
    ids.add(mark.id);
  }
  if (value.startLine !== undefined) {
    if (
      !Array.isArray(value.startLine) ||
      value.startLine.length !== 2 ||
      value.startLine.some(
        (p) =>
          !validCoursePoint(p) ||
          !onlyKeys(p as unknown as Record<string, unknown>, [
            "latitude",
            "longitude",
          ]),
      )
    )
      throw new Error("Place both ends of the start line");
    const [a, b] = value.startLine as [CoursePoint, CoursePoint];
    if (
      a.latitude === b.latitude &&
      longitudeDelta(a.longitude, b.longitude) === 0
    )
      throw new Error("The start line needs two different positions");
  }
}
export function courseFor(
  series: Series,
  eventId: string,
): RaceCourse | undefined {
  return series.courses?.[eventId];
}
export function coursePoints(course: RaceCourse): CoursePoint[] {
  return [...startGeometry(course), ...course.marks];
}
export const wrapBearing = (degrees: number) => ((degrees % 360) + 360) % 360;
export function destination(
  origin: CoursePoint,
  degrees: number,
  metres: number,
): CoursePoint {
  const rad = Math.PI / 180,
    d = metres / 6371008.8;
  const lat = origin.latitude * rad,
    lon = origin.longitude * rad,
    b = degrees * rad;
  const phi = Math.asin(
    Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(b),
  );
  const lambda =
    lon +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(lat),
      Math.cos(d) - Math.sin(lat) * Math.sin(phi),
    );
  return {
    latitude: phi / rad,
    longitude: wrapBearing(lambda / rad + 180) - 180,
  };
}
// The 250 m ray is a display length only; it is never stored as a buoy position.
export function startGeometry(course: RaceCourse): CoursePoint[] {
  const b = course.startBearing;
  return (
    course.startLine ??
    (b
      ? [b.origin, destination(b.origin, b.degrees, b.distanceMetres ?? 250)]
      : [])
  );
}
export function courseRoute(course: RaceCourse): CoursePoint[] {
  const ends = startGeometry(course);
  const hasLine = !!course.startLine || !!course.startBearing?.distanceMetres;
  return [
    ...(hasLine && ends[0] && ends[1] ? [midpoint(ends[0], ends[1])] : []),
    ...course.marks,
  ];
}
export function courseFingerprint(course?: RaceCourse) {
  return JSON.stringify(
    course
      ? [
          course.marks.map((m) => [
            m.id,
            m.name,
            m.latitude,
            m.longitude,
            m.rounding,
          ]),
          course.startLine?.map((p) => [p.latitude, p.longitude]),
          course.startBearing
            ? [
                course.startBearing.origin.latitude,
                course.startBearing.origin.longitude,
                course.startBearing.degrees,
                course.startBearing.distanceMetres,
              ]
            : null,
          course.startLive
            ? [course.startLive.updatedAt, course.startLive.accuracyMetres]
            : null,
          course.notes ?? "",
        ]
      : null,
  );
}
export function setCourse(
  series: Series,
  eventId: string,
  course: RaceCourse | undefined,
  expected?: string,
) {
  if (!(series.events ?? series.races).some((event) => event.id === eventId))
    throw new Error("Race not found");
  if (
    expected !== undefined &&
    courseFingerprint(courseFor(series, eventId)) !== expected
  )
    throw new Error(
      "The course changed elsewhere. Reopen the editor before saving.",
    );
  if (course) validateCourse(course);
  const courses = { ...series.courses };
  if (course) courses[eventId] = structuredClone(course);
  else delete courses[eventId];
  if (Object.keys(courses).length) series.courses = courses;
  else delete series.courses;
}
