import {
  MAX_PENDING_POINTS,
  SAMPLE_INTERVAL_MS,
  type TrackingPoint,
  type TrackingSession,
} from "./model";
// The adapter is Expo SQLite on-device and real SQLite in persistence tests.
export interface TrackingDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...args: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(
    sql: string,
    ...args: (string | number | null)[]
  ): Promise<T | null>;
  getAllAsync<T>(
    sql: string,
    ...args: (string | number | null)[]
  ): Promise<T[]>;
}
export class TrackingStore {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private db: TrackingDatabase) {}
  async init() {
    await this.db.execAsync(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS tracking_state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tracking_outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, body TEXT NOT NULL);`);
  }
  private exclusive<T>(action: () => Promise<T>): Promise<T> {
    const result = this.tail.then(action);
    this.tail = result.catch(() => {});
    return result;
  }
  private async transaction<T>(action: () => Promise<T>): Promise<T> {
    await this.db.execAsync("BEGIN IMMEDIATE");
    try {
      const result = await action();
      await this.db.execAsync("COMMIT");
      return result;
    } catch (error) {
      await this.db.execAsync("ROLLBACK");
      throw error;
    }
  }
  private async read() {
    const row = await this.db.getFirstAsync<{ body: string }>(
      "SELECT body FROM tracking_state WHERE id=1",
    );
    return row ? (JSON.parse(row.body) as TrackingSession) : null;
  }
  get() {
    return this.exclusive(() => this.read());
  }
  create(session: TrackingSession) {
    return this.exclusive(() =>
      this.transaction(async () => {
        if (await this.read())
          throw new Error("Finish the previous tracking session first.");
        await this.db.runAsync(
          "INSERT INTO tracking_state(id,body) VALUES(1,?)",
          JSON.stringify(session),
        );
      }),
    );
  }
  patch(id: string, patch: Partial<TrackingSession>) {
    return this.exclusive(() =>
      this.transaction(async () => {
        const session = await this.read();
        if (session?.id !== id) return;
        await this.db.runAsync(
          "UPDATE tracking_state SET body=? WHERE id=1",
          JSON.stringify({ ...session, ...patch }),
        );
      }),
    );
  }
  append(id: string, points: TrackingPoint[]) {
    return this.exclusive(() =>
      this.transaction(async () => {
        const session = await this.read();
        if (!session || session.id !== id || session.phase !== "recording")
          return;
        const count = (await this.db.getFirstAsync<{ n: number }>(
          "SELECT count(*) n FROM tracking_outbox",
        ))!.n;
        let queued = count;
        for (const point of [...points].sort((a, b) =>
          a.recordedAt.localeCompare(b.recordedAt),
        )) {
          const stamp = Date.parse(point.recordedAt);
          if (
            stamp < Date.parse(session.startedAt) - 60_000 ||
            stamp > Date.parse(session.expiresAt) ||
            (session.lastRecordedAt &&
              stamp - Date.parse(session.lastRecordedAt) < SAMPLE_INTERVAL_MS)
          )
            continue;
          if (queued >= MAX_PENDING_POINTS)
            throw new Error(
              "Tracking storage is full. Reconnect to upload saved positions.",
            );
          await this.db.runAsync(
            "INSERT INTO tracking_outbox(session_id,body) VALUES(?,?)",
            session.id,
            JSON.stringify(point),
          );
          session.lastRecordedAt = point.recordedAt;
          if (session.error?.startsWith("Waiting for an accurate GPS fix"))
            session.error = undefined;
          session.recentPoints = [...(session.recentPoints ?? []), point].slice(
            -120,
          );
          queued++;
        }
        await this.db.runAsync(
          "UPDATE tracking_state SET body=? WHERE id=1",
          JSON.stringify(session),
        );
      }),
    );
  }
  batch(id: string) {
    return this.exclusive(async () =>
      (
        await this.db.getAllAsync<{ seq: number; body: string }>(
          "SELECT seq,body FROM tracking_outbox WHERE session_id=? ORDER BY seq LIMIT 120",
          id,
        )
      ).map((row) => ({
        ...(JSON.parse(row.body) as TrackingPoint),
        seq: row.seq,
      })),
    );
  }
  exportLocal(id: string) {
    return this.exclusive(async () => {
      const session = await this.read();
      if (
        session?.id !== id ||
        session.mode !== "local" ||
        session.phase !== "stopping"
      )
        throw new Error("Stop the local recording before exporting.");
      const rows = await this.db.getAllAsync<{ body: string }>(
        "SELECT body FROM tracking_outbox WHERE session_id=? ORDER BY seq",
        id,
      );
      return {
        session,
        points: rows.map((row) => JSON.parse(row.body) as TrackingPoint),
      };
    });
  }
  acknowledge(id: string, seqs: number[]) {
    return this.exclusive(async () => {
      // Only delete exactly the acknowledged batch; fixes arriving during upload remain queued.
      if (seqs.length)
        await this.db.runAsync(
          `DELETE FROM tracking_outbox WHERE session_id=? AND seq IN (${seqs.map(() => "?").join(",")})`,
          id,
          ...seqs,
        );
    });
  }
  count() {
    return this.exclusive(
      async () =>
        (await this.db.getFirstAsync<{ n: number }>(
          "SELECT count(*) n FROM tracking_outbox",
        ))!.n,
    );
  }
  clear(id: string) {
    return this.exclusive(() =>
      this.transaction(async () => {
        if ((await this.read())?.id !== id) return;
        await this.db.runAsync(
          "DELETE FROM tracking_outbox WHERE session_id=?",
          id,
        );
        await this.db.execAsync("DELETE FROM tracking_state WHERE id=1");
      }),
    );
  }
}
