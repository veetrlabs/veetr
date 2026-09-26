import {
  MAX_PENDING_POINTS,
  SAMPLE_INTERVAL_MS,
  SAMPLE_TOLERANCE_MS,
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
      CREATE TABLE IF NOT EXISTS recording_history (session_id TEXT NOT NULL, recorded_at TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(session_id,recorded_at));
      CREATE INDEX IF NOT EXISTS recording_history_time ON recording_history(recorded_at);
      CREATE TABLE IF NOT EXISTS recording_sessions (id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS local_recordings (id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tracking_state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tracking_outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, body TEXT NOT NULL);`);
  }
  private async saveSession(session: TrackingSession) {
    await this.db.runAsync(
      "INSERT OR REPLACE INTO recording_sessions(id,body) VALUES(?,?)",
      session.id,
      JSON.stringify(session),
    );
  }
  private async savedPoints(id: string): Promise<TrackingPoint[]> {
    const rows = await this.db.getAllAsync<{ body: string }>(
      "SELECT body FROM recording_history WHERE session_id=? ORDER BY recorded_at",
      id,
    );
    return rows.map((row) => JSON.parse(row.body));
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
        await this.saveSession(session);
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
        await this.saveSession({ ...session, ...patch });
      }),
    );
  }
  updateTrip(id: string, patch: Pick<Partial<TrackingSession>, "boatId" | "boatName" | "userId" | "sharing" | "tripTitle">) {
    return this.exclusive(() => this.transaction(async () => {
      const current = await this.read();
      const row = await this.db.getFirstAsync<{body:string}>("SELECT body FROM recording_sessions WHERE id=?", id);
      const legacy = !row ? await this.db.getFirstAsync<{body:string}>("SELECT body FROM local_recordings WHERE id=?", id) : null;
      const old = current?.id === id ? current : row ? JSON.parse(row.body) : legacy ? JSON.parse(legacy.body).session : null;
      if (!old) throw new Error("Trip no longer available");
      const next = {...old, ...patch};
      if (legacy) {
        for (const point of JSON.parse(legacy.body).points) await this.db.runAsync("INSERT OR IGNORE INTO recording_history(session_id,recorded_at,body) VALUES(?,?,?)", id, point.recordedAt, JSON.stringify(point));
      }
      await this.saveSession(next);
      if (current?.id === id) await this.db.runAsync("UPDATE tracking_state SET body=? WHERE id=1", JSON.stringify(next));
    }));
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
              stamp - Date.parse(session.lastRecordedAt) < SAMPLE_INTERVAL_MS - SAMPLE_TOLERANCE_MS)
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
          await this.db.runAsync(
            "INSERT OR IGNORE INTO recording_history(session_id,recorded_at,body) VALUES(?,?,?)",
            session.id,
            point.recordedAt,
            JSON.stringify(point),
          );
          session.lastRecordedAt = point.recordedAt;
          // Core Location's temporary location-unknown error is resolved by a saved fix.
          const locationUnknown = (error?: string) =>
            /kCLErrorDomain Code=0\b/.test(error ?? "");
          if (session.error?.startsWith("Waiting for an accurate GPS fix") || locationUnknown(session.error))
            session.error = undefined;
          if (locationUnknown(session.lastTaskError))
            session.lastTaskError = undefined;
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
  points(id: string) {
    return this.exclusive(() => this.savedPoints(id));
  }
  historyPoints(start: string, end: string) {
    return this.exclusive(async () =>
      (
        await this.db.getAllAsync<{ body: string }>(
          "SELECT body FROM recording_history WHERE recorded_at>=? AND recorded_at<=? ORDER BY recorded_at",
          start,
          end,
        )
      ).map((row) => JSON.parse(row.body) as TrackingPoint),
    );
  }
  trip(id: string) {
    return this.exclusive(async () => {
      const current = await this.read();
      const row = await this.db.getFirstAsync<{body:string}>("SELECT body FROM recording_sessions WHERE id=?", id);
      const session: TrackingSession | undefined = current?.id === id ? current : row ? JSON.parse(row.body) : undefined;
      if (session) return {session, points: await this.savedPoints(id), archived:current?.id !== id};
      const legacy = await this.db.getFirstAsync<{body:string}>("SELECT body FROM local_recordings WHERE id=?", id);
      return legacy ? {...JSON.parse(legacy.body), archived:true} as {session:TrackingSession;points:TrackingPoint[];archived:boolean} : undefined;
    });
  }
  pendingShares() {
    return this.exclusive(async () => {
      const rows = await this.db.getAllAsync<{body:string}>("SELECT body FROM recording_sessions");
      const sessions = new Map<string,TrackingSession>();
      for (const row of rows) { const s:TrackingSession=JSON.parse(row.body); sessions.set(s.id,s); }
      const current=await this.read();if(current)sessions.set(current.id,current);
      return [...sessions.values()].filter(s=>s.sharing && (s.sharing.pendingVisibility || (s.phase === "stopping" && !s.sharing.finished))).map(s=>s.id);
    });
  }
  localRecordings() {
    return this.exclusive(async () => {
      // Read legacy local archives unchanged, then overlay normalized recordings.
      const legacy = await this.db.getAllAsync<{ body: string }>(
        "SELECT body FROM local_recordings ORDER BY rowid DESC",
      );
      const records = new Map<
        string,
        { session: TrackingSession; points: TrackingPoint[]; archived: boolean }
      >();
      for (const row of legacy) {
        const record = JSON.parse(row.body);
        records.set(record.session.id, { ...record, archived: true });
      }
      const rows = await this.db.getAllAsync<{ body: string }>(
        "SELECT body FROM recording_sessions",
      );
      const current = await this.read();
      const sessions: TrackingSession[] = rows.map((row) =>
        JSON.parse(row.body),
      );
      if (current) {
        // Backfill sessions started by an older app build.
        await this.saveSession(current);
        sessions.push(current);
      }
      for (const session of sessions) {
        const points = await this.savedPoints(session.id);
        if (session.phase === "starting" && !points.length) continue;
        const last = points.at(-1)?.recordedAt;
        records.set(session.id, {
          session: {
            ...session,
            lastRecordedAt: last ?? session.lastRecordedAt,
          },
          points,
          archived: session.id !== current?.id,
        });
      }
      return [...records.values()].sort(
        (a, b) =>
          b.session.startedAt.localeCompare(a.session.startedAt) ||
          Number(a.archived) - Number(b.archived),
      );
    });
  }
  archiveLocal() {
    return this.exclusive(() =>
      this.transaction(async () => {
        const session = await this.read();
        if (!session) return;
        if (session.mode !== "local" || session.phase !== "stopping")
          throw new Error("Stop the current recording first.");
        await this.saveSession(session);
        await this.db.runAsync(
          "DELETE FROM tracking_outbox WHERE session_id=?",
          session.id,
        );
        await this.db.execAsync("DELETE FROM tracking_state WHERE id=1");
      }),
    );
  }
  deleteArchivedLocal(id: string) {
    return this.exclusive(() =>
      this.transaction(async () => {
        if ((await this.read())?.id === id)
          throw new Error(
            "Finish the current recording and its uploads first.",
          );
        await this.db.runAsync(
          "DELETE FROM recording_history WHERE session_id=?",
          id,
        );
        await this.db.runAsync("DELETE FROM local_recordings WHERE id=?", id);
        await this.db.runAsync("DELETE FROM recording_sessions WHERE id=?", id);
      }),
    );
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
        const current = await this.read();
        if (current?.id !== id) return;
        if (current.mode !== "local")
          await this.saveSession({
            ...current,
            phase: "stopping",
            stoppedAt: current.stoppedAt ?? new Date().toISOString(),
          });
        else
          await this.db.runAsync(
            "DELETE FROM recording_sessions WHERE id=?",
            id,
          );
        if (current.mode === "local")
          await this.db.runAsync(
            "DELETE FROM recording_history WHERE session_id=?",
            id,
          );
        await this.db.runAsync(
          "DELETE FROM tracking_outbox WHERE session_id=?",
          id,
        );
        await this.db.execAsync("DELETE FROM tracking_state WHERE id=1");
      }),
    );
  }
}
