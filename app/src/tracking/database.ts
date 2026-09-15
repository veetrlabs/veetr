import * as SQLite from "expo-sqlite";
import { TrackingStore } from "./store";
let store: Promise<TrackingStore> | undefined;
export function trackingStore() {
  return (store ??= SQLite.openDatabaseAsync("veetr-tracking.db")
    .then(async (db) => {
      const result = new TrackingStore(db);
      await result.init();
      return result;
    })
    .catch((error) => {
      store = undefined;
      throw error;
    }));
}
