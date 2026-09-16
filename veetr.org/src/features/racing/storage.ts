import { id, validateSeries, type Series } from "./domain";
export interface LocalRecord {
  series: Series;
  revision: number;
  pending: boolean;
  mutationId: string;
  owner: string;
  savedAt: string;
}
const db = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open("veetr-race-control", 1);
  request.onupgradeneeded = () =>
    request.result.createObjectStore("series", { keyPath: "series.id" });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await db;
  return new Promise((resolve, reject) => {
    const tx = database.transaction("series", mode);
    const request = operation(tx.objectStore("series"));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Local storage transaction aborted"));
  });
}
export const loadLocal = () =>
  transaction("readonly", (s) => s.getAll()) as Promise<LocalRecord[]>;
export async function saveLocal(
  record: LocalRecord,
  expectedMutationId?: string,
): Promise<void> {
  const database = await db;
  return new Promise((resolve, reject) => {
    const tx = database.transaction("series", "readwrite"),
      store = tx.objectStore("series");
    const request = store.get(record.series.id);
    let conflict = false;
    request.onsuccess = () => {
      if (request.result?.mutationId !== expectedMutationId) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put(record);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        new Error(
          conflict
            ? "LOCAL_CONFLICT: another tab changed this series. Reload before editing."
            : "Local save failed; keep this tab open and export a backup.",
        ),
      );
    tx.onerror = () => reject(tx.error);
  });
}
// A finish recorded during an upload must remain pending after that upload succeeds.
export function acknowledge(
  latest: LocalRecord,
  uploaded: LocalRecord,
  revision: number,
): LocalRecord {
  return {
    ...latest,
    revision,
    pending: latest.mutationId !== uploaded.mutationId,
  };
}

export function stageChange(old: LocalRecord, next: Series): LocalRecord {
  validateSeries(next);
  return {
    ...old,
    series: next,
    pending: true,
    mutationId: id(),
    savedAt: new Date().toISOString(),
  };
}

export const removeLocal = (id: string) => transaction("readwrite", (store) => store.delete(id));
