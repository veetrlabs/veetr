import { test } from "node:test";
import assert from "node:assert/strict";
import {
  magneticHeading,
  trueBearing,
  usableFix,
  watchStartPosition,
  watchStartCompass,
} from "./startSensors";
import {
  destination,
  startGeometry,
  courseRoute,
  validateCourse,
  type RaceCourse,
} from "./course";
import { createStartPublisher } from "./liveStart";
const flat = { alpha: 10, beta: 0, gamma: 0, absolute: true };
test("compass uses north-referenced, flat phone readings and corrects magnetic north", () => {
  assert.equal(magneticHeading(flat), 350);
  assert.equal(magneticHeading({ ...flat, absolute: false }), null);
  assert.equal(magneticHeading({ ...flat, beta: 90 }), null);
  assert.equal(magneticHeading({ ...flat, alpha: null }), null);
  assert.equal(
    magneticHeading({
      ...flat,
      absolute: false,
      webkitCompassHeading: 42,
      webkitCompassAccuracy: 5,
    }),
    42,
  );
  assert.equal(
    magneticHeading({
      ...flat,
      webkitCompassHeading: 42,
      webkitCompassAccuracy: -1,
    }),
    null,
  );
  assert.equal(
    magneticHeading({
      ...flat,
      webkitCompassHeading: 42,
      webkitCompassAccuracy: 30,
    }),
    null,
  );
  assert.equal(trueBearing(358, 5), 3);
  assert.equal(trueBearing(2, -5), 357);
});
test("GPS capture rejects stale, inaccurate, future and invalid coordinates", () => {
  const fix = { latitude: 49, longitude: 14, accuracy: 5, timestamp: 100000 };
  assert.ok(usableFix(fix, 100000));
  for (const f of [
    { ...fix, timestamp: 80000 },
    { ...fix, timestamp: 100001 },
    { ...fix, accuracy: 51 },
    { ...fix, accuracy: NaN },
    { ...fix, latitude: 91 },
  ])
    assert.ok(!usableFix(f, 100000));
});
test("bearing-only line does not invent a buoy or route start and handles date line", () => {
  const c: RaceCourse = {
    marks: [],
    startBearing: { origin: { latitude: 0, longitude: 179.999 }, degrees: 90 },
  };
  validateCourse(c);
  assert.equal(c.startLine, undefined);
  assert.deepEqual(courseRoute(c), []);
  const geometry = startGeometry(c);
  assert.equal(geometry.length, 2);
  assert.ok(geometry[1].longitude < 0);
  const north = destination({ latitude: 0, longitude: 0 }, 0, 1000);
  assert.ok(Math.abs(north.latitude - 0.0089932) < 0.000001);
  assert.equal(north.longitude, 0);
  for (const b of [
    { ...c.startBearing, degrees: 360 },
    { ...c.startBearing, degrees: NaN },
    { ...c.startBearing, distanceMetres: 0 },
    { ...c.startBearing, distanceMetres: 10001 },
    { ...c.startBearing, origin: { latitude: 49, longitude: 14, secret: "x" } },
  ])
    assert.throws(() => validateCourse({ ...c, startBearing: b }));
  assert.throws(() =>
    validateCourse({
      ...c,
      startLine: [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ],
    }),
  );
});
test("live publisher throttles updates and freezes after an in-flight position without starting again", async () => {
  let time = 100000;
  const initial: RaceCourse = {
    marks: [],
    startLine: [
      { latitude: 49, longitude: 14 },
      { latitude: 49, longitude: 15 },
    ],
  };
  let resolve!: (course: RaceCourse) => void;
  const calls: any[] = [];
  const updates: RaceCourse[] = [];
  const changed = {
    ...initial,
    startLive: { updatedAt: new Date(time).toISOString(), accuracyMetres: 5 },
  };
  const p = createStartPublisher(
    initial,
    async (expected, fix) => {
      calls.push({ expected, fix });
      if (fix) return await new Promise<RaceCourse>((r) => (resolve = r));
      return initial;
    },
    (c) => updates.push(c),
    (e) => {
      throw e;
    },
    () => time,
  );
  const fix = { latitude: 49, longitude: 14.1, accuracy: 5, timestamp: time };
  p.publish(fix);
  p.publish(fix);
  assert.equal(calls.length, 1);
  const stopped = p.stop();
  p.publish(fix);
  resolve(changed);
  await stopped;
  assert.equal(calls.length, 2);
  assert.equal(calls[1].fix, null);
  assert.deepEqual(calls[1].expected, changed);
  assert.equal(updates.length, 2);
  time += 10000;
  p.publish({ ...fix, timestamp: time });
  assert.equal(calls.length, 2);
});
test("a concurrent course edit stops live publishing without attempting to overwrite it", async () => {
  let errors = 0,
    calls = 0;
  const p = createStartPublisher(
    { marks: [] },
    async () => {
      calls++;
      throw new Error("changed elsewhere");
    },
    () => {},
    () => errors++,
    () => 100000,
  );
  p.publish({ latitude: 49, longitude: 14, accuracy: 5, timestamp: 100000 });
  await p.stop();
  assert.equal(calls, 1);
  assert.equal(errors, 1);
});
test("position watcher requests high accuracy and ignores queued callbacks after cleanup", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let success: any,
    cleared = 0,
    options: any;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: {
        watchPosition: (s: any, _e: any, o: any) => {
          success = s;
          options = o;
          return 7;
        },
        clearWatch: (id: number) => {
          assert.equal(id, 7);
          cleared++;
        },
      },
    },
  });
  try {
    let fixes = 0;
    const stop = watchStartPosition(
      () => fixes++,
      () => {},
    );
    const sample = {
      coords: { latitude: 49, longitude: 14, accuracy: 5 },
      timestamp: Date.now(),
    };
    success(sample);
    stop();
    success(sample);
    assert.equal(fixes, 1);
    assert.equal(cleared, 1);
    assert.equal(options.enableHighAccuracy, true);
    assert.equal(options.maximumAge, 0);
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
test("compass permission denial installs no listener; cleanup removes both browser event variants", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window"),
    originalSensor = Object.getOwnPropertyDescriptor(
      globalThis,
      "DeviceOrientationEvent",
    );
  const target = new EventTarget();
  let installs = 0,
    removes = 0;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: (...args: any[]) => {
        installs++;
        (target.addEventListener as any)(...args);
      },
      removeEventListener: (...args: any[]) => {
        removes++;
        (target.removeEventListener as any)(...args);
      },
    },
  });
  Object.defineProperty(globalThis, "DeviceOrientationEvent", {
    configurable: true,
    value: { requestPermission: async () => "denied" },
  });
  try {
    await assert.rejects(
      watchStartCompass(() => {}),
      /permission denied/,
    );
    assert.equal(installs, 0);
    Object.defineProperty(globalThis, "DeviceOrientationEvent", {
      configurable: true,
      value: { requestPermission: async () => "granted" },
    });
    const readings: any[] = [];
    const stop = await watchStartCompass((h) => readings.push(h));
    const absolute = Object.assign(
      new Event("deviceorientationabsolute"),
      flat,
    );
    target.dispatchEvent(absolute);
    target.dispatchEvent(
      Object.assign(new Event("deviceorientation"), {
        ...flat,
        absolute: false,
      }),
    );
    assert.deepEqual(readings, [350]);
    stop();
    target.dispatchEvent(absolute);
    assert.equal(readings.length, 1);
    assert.equal(removes, 2);
  } finally {
    for (const [key, descriptor] of [
      ["window", originalWindow],
      ["DeviceOrientationEvent", originalSensor],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
