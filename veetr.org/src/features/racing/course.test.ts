import { test } from "node:test";
import assert from "node:assert/strict";
import {
  courseFingerprint,
  courseFor,
  courseRoute,
  midpoint,
  setCourse,
  validateCourse,
  type RaceCourse,
} from "./course";
import { id, newSeries, validateSeries } from "./domain";
const course = (): RaceCourse => ({
  marks: [
    {
      id: id(),
      name: "Windward",
      latitude: 49.6,
      longitude: 14.2,
      rounding: "port",
    },
    {
      id: id(),
      name: "Turning point",
      latitude: 49.59,
      longitude: 14.21,
      rounding: "starboard",
    },
  ],
  startLine: [
    { latitude: 49.58, longitude: 14.2 },
    { latitude: 49.58, longitude: 14.201 },
  ],
  notes: "Two laps",
});
test("a race course preserves sailing order, start endpoints and rounding instructions", () => {
  const s = newSeries("Course series"),
    eventId = id();
  s.events = [
    {
      id: eventId,
      name: "Race",
      order: 1,
      weight: 1,
      completed: false,
      discards: [],
    },
  ];
  const c = course();
  setCourse(s, eventId, c);
  validateSeries(s);
  assert.deepEqual(courseFor(s, eventId), c);
  assert.deepEqual(courseRoute(c), [midpoint(...c.startLine!), ...c.marks]);
  c.marks[0].name = "Changed draft";
  assert.equal(courseFor(s, eventId)?.marks[0].name, "Windward");
  const expected = courseFingerprint(courseFor(s, eventId));
  setCourse(s, eventId, { marks: [] }, expected);
  assert.throws(() => setCourse(s, eventId, c, expected), /changed elsewhere/);
  setCourse(s, eventId, undefined);
  assert.equal(s.courses, undefined);
});
test("invalid positions, partial start lines and unexpected private fields cannot be saved", () => {
  const mutations: ((c: any) => void)[] = [
    (c) => (c.marks[0].latitude = 91),
    (c) => (c.marks[0].longitude = NaN),
    (c) => (c.marks[0].longitude = Infinity),
    (c) => (c.marks[0].rounding = "either"),
    (c) => (c.marks[0].name = " "),
    (c) => (c.marks[1].id = c.marks[0].id),
    (c) => c.startLine.pop(),
    (c) => (c.startLine[1] = c.startLine[0]),
    (c) => (c.notes = { private: true }),
    (c) => (c.privateToken = "secret"),
    (c) => (c.marks[0].phone = "private"),
    (c) => (c.startLine[0].phone = "private"),
    (c) => (c.marks = Array.from({ length: 41 }, () => c.marks[0])),
  ];
  for (const change of mutations) {
    const c = course();
    change(c);
    assert.throws(() => validateCourse(c));
  }
  validateCourse({ marks: [] });
  validateCourse({ marks: [], startLine: course().startLine });
});
test("courses are scoped to an existing race, including legacy single-heat races", () => {
  const s = newSeries();
  assert.throws(() => setCourse(s, id(), course()), /Race not found/);
  const eventId = id();
  s.races.push({
    id: eventId,
    name: "Legacy race",
    date: "2026-10-06",
    order: 1,
    weight: 1,
    status: "draft",
    entries: [],
    results: [],
  });
  setCourse(s, eventId, course());
  validateSeries(s);
  s.courses![id()] = course();
  assert.throws(() => validateSeries(s), /existing race/);
});
test("course legs use the short crossing at the date line", () => {
  assert.deepEqual(
    midpoint({ latitude: 1, longitude: 179 }, { latitude: 3, longitude: -179 }),
    { latitude: 2, longitude: -180 },
  );
  assert.throws(
    () =>
      validateCourse({
        marks: [],
        startLine: [
          { latitude: 0, longitude: 180 },
          { latitude: 0, longitude: -180 },
        ],
      }),
    /different positions/,
  );
});

test('bearing start lines connect their midpoint to mark one only when length is known', () => {
  const c = course();
  const origin = c.startLine![0];
  delete c.startLine;
  c.startBearing = { origin, degrees: 90, distanceMetres: 400 };
  const route = courseRoute(c);
  assert.equal(route.length, c.marks.length + 1);
  assert.deepEqual(route[1], c.marks[0]);
  assert.ok(route[0].longitude > origin.longitude);
  assert.ok(route[0].longitude < origin.longitude + 0.005);
  delete c.startBearing.distanceMetres;
  assert.deepEqual(courseRoute(c), c.marks);
});
