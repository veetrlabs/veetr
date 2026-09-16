import { TrackingStore, type TrackingDatabase } from "./store";

// Browser preview has no device recordings. Never write or upload simulated GPS.
const unavailable = async (): Promise<never> => {
  throw new Error("Recording is available in the iPhone app. This is a UI preview.");
};
const database: TrackingDatabase = {
  execAsync: unavailable,
  runAsync: unavailable,
  getFirstAsync: async <T>(sql: string): Promise<T | null> => sql === "SELECT count(*) n FROM tracking_outbox" ? { n: 0 } as T : null,
  getAllAsync: async () => [],
};
const previewStore = new TrackingStore(database);
export async function trackingStore() {
  return previewStore;
}
