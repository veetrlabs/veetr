import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TrackingStore, type TrackingDatabase } from "../src/tracking/store";
import type { TrackingSession, TrackingPoint } from "../src/tracking/model";
const session: TrackingSession = {
  id: "session-1",
  userId: "alice",
  seriesId: "series",
  seriesName: "Regatta",
  boatId: "boat",
  boatName: "Boat",
  phase: "recording",
  startedAt: "2026-09-13T10:00:00.000Z",
  expiresAt: "2026-09-13T22:00:00.000Z",
};
const point = (second: number): TrackingPoint => ({
  recordedAt: new Date(
    Date.parse(session.startedAt) + second * 1000,
  ).toISOString(),
  latitude: 49,
  longitude: 14,
  accuracyM: 5,
  sogMps: 2,
  cogDeg: 180,
  source: "phone",
});
function store(db: DatabaseSync) {
  const adapter: TrackingDatabase = {
    execAsync: async (sql) => {
      db.exec(sql);
    },
    runAsync: async (sql, ...args) => db.prepare(sql).run(...args),
    getFirstAsync: async <T>(
      sql: string,
      ...args: (string | number | null)[]
    ) => (db.prepare(sql).get(...args) as T) ?? null,
    getAllAsync: async <T>(sql: string, ...args: (string | number | null)[]) =>
      db.prepare(sql).all(...args) as T[],
  };
  return new TrackingStore(adapter);
}
test("SQLite outbox survives restart and only acknowledges the submitted batch", async () => {
  const dir = await mkdtemp(join(tmpdir(), "veetr-tracking-test-")),
    path = join(dir, "track.db");
  let db = new DatabaseSync(path);
  try {
    let s = store(db);
    await s.init();
    await s.create(session);
    await assert.rejects(
      s.create({ ...session, id: "another" }),
      /previous tracking/,
    );
    await Promise.all([
      s.append(session.id, [point(0), point(2), point(5)]),
      s.append(session.id, [point(10), point(5)]),
    ]);
    assert.equal(
      await s.count(),
      3,
      "duplicates and fixes less than five seconds apart are thinned",
    );
    const batch = await s.batch(session.id);
    db.close();
    db = new DatabaseSync(path);
    s = store(db);
    await s.init();
    assert.equal((await s.get())?.lastRecordedAt, point(10).recordedAt);
    assert.deepEqual(await s.batch(session.id), batch);
    await s.append("old-session", [point(15)]);
    assert.equal(
      await s.count(),
      3,
      "late callback cannot cross session boundaries",
    );
    await s.append(session.id, [point(15)]);
    await s.acknowledge(
      "wrong-session",
      batch.map((p) => p.seq),
    );
    assert.equal(await s.count(), 4);
    await s.acknowledge(
      session.id,
      batch.map((p) => p.seq),
    );
    assert.equal(await s.count(), 1);
    await s.patch(session.id, {
      phase: "stopping",
      stoppedAt: point(20).recordedAt,
    });
    await s.append(session.id, [point(25)]);
    assert.equal(
      await s.count(),
      1,
      "late GPS callback after stop cannot append",
    );
    await s.patch("wrong-session", { phase: "recording" });
    assert.equal((await s.get())?.phase, "stopping");
    await s.clear(session.id);
    assert.equal(await s.get(), null);
    assert.equal(await s.count(), 0);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("a failed SQLite transaction neither loses earlier points nor advances capture time", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const s = store(db);
    await s.init();
    await s.create(session);
    await s.append(session.id, [point(0)]);
    db.exec(
      "CREATE TRIGGER fail_write BEFORE INSERT ON tracking_outbox BEGIN SELECT RAISE(ABORT,'disk full'); END",
    );
    await assert.rejects(
      s.append(session.id, [point(5), point(10)]),
      /disk full/,
    );
    assert.equal(await s.count(), 1);
    assert.equal((await s.get())?.lastRecordedAt, point(0).recordedAt);
    db.exec("DROP TRIGGER fail_write");
    await s.append(session.id, [point(5)]);
    assert.equal(await s.count(), 2);
  } finally {
    db.close();
  }
});

test("local export retains every point and cannot expose a live session", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const s = store(db);
    await s.init();
    await s.create(session);
    await assert.rejects(s.exportLocal(session.id), /Stop the local recording/);
    await s.clear(session.id);
    await s.create({ ...session, mode: "local" });
    const points = Array.from({ length: 150 }, (_, i) => point(i * 5));
    await s.append(session.id, points);
    await assert.rejects(s.exportLocal(session.id), /Stop the local recording/);
    await s.patch(session.id, { phase: "stopping" });
    assert.deepEqual((await s.exportLocal(session.id)).points, points);
    assert.equal(await s.count(), 150);
  } finally {
    db.close();
  }
});

test("old recordings without a trail cache remain readable and survive archiving", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const s = store(db);
    await s.init();
    await s.create({ ...session, mode: "local" });
    await s.append(session.id, [point(0), point(5)]);
    await s.patch(session.id, { recentPoints: undefined, phase: "stopping" });
    assert.equal((await s.points(session.id)).length, 2);
    await s.archiveLocal();
    assert.equal(await s.get(), null);
    assert.equal(await s.count(), 0);
    await s.create({ ...session, id: "new-session", mode: "local" });
    await s.append("new-session", [point(0)]);
    const recordings = await s.localRecordings();
    assert.equal(recordings.length, 2);
    assert.equal(recordings[0].points.length, 1);
    assert.equal(recordings[1].points.length, 2);
    await s.clear("new-session");
    assert.equal((await s.localRecordings()).length, 1);
    await s.deleteArchivedLocal(session.id);
    assert.equal((await s.localRecordings()).length, 0);
  } finally {
    db.close();
  }
});
