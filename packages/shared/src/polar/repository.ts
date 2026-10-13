import { validatePolar, type Polar, type SailingObservation } from "./model";
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export interface BoatPolars {
  polars: Polar[];
  selectedId?: string;
  observationSets: string[];
}
/** One reference curve and one measured curve, both scoped to this boat. */
export function boatPolarCurves(state: BoatPolars) {
  const latest = (items: Polar[]) =>
    [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const selected = state.polars.find((p) => p.id === state.selectedId);
  const measured = latest(state.polars.filter((p) => p.source === "learned"));
  const reference =
    selected?.source !== "learned" && selected
      ? selected
      : latest(state.polars.filter((p) => p.source !== "learned"));
  return { reference, measured, benchmark: reference ?? measured };
}
/** Serialized read/modify/write operations; storage failures never update the visible cache. */
export class PolarRepository {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private storage: KeyValueStorage) {}
  private key(boatId: string) {
    return `veetr:polars:v1:${encodeURIComponent(boatId)}`;
  }
  async read(boatId: string): Promise<BoatPolars> {
    const raw = await this.storage.getItem(this.key(boatId));
    if (!raw) return { polars: [], observationSets: [] };
    const value = JSON.parse(raw) as BoatPolars;
    return {
      ...value,
      polars: value.polars.map(validatePolar),
      observationSets: value.observationSets ?? [],
    };
  }
  private update(
    boatId: string,
    change: (state: BoatPolars) => Promise<BoatPolars> | BoatPolars,
  ) {
    const result = this.tail.then(async () => {
      const next = await change(await this.read(boatId));
      await this.storage.setItem(this.key(boatId), JSON.stringify(next));
      return next;
    });
    this.tail = result.catch(() => {});
    return result;
  }
  add(boatId: string, polar: Polar) {
    const valid = validatePolar(polar);
    return this.update(boatId, (state) => {
      if (state.polars.some((p) => p.id === valid.id))
        throw new Error("This polar already exists.");
      return {
        ...state,
        polars: [...state.polars, valid],
        selectedId: state.selectedId ?? valid.id,
      };
    });
  }
  /** Replace this boat's reference, or update its measured curve without replacing the reference. */
  setPolar(boatId: string, polar: Polar) {
    const valid = validatePolar(polar);
    return this.update(boatId, (state) => {
      const { reference, measured } = boatPolarCurves(state);
      const nextReference = valid.source === "learned" ? reference : valid;
      const nextMeasured = valid.source === "learned" ? valid : measured;
      return {
        ...state,
        polars: [nextReference, nextMeasured].filter((p): p is Polar => !!p),
        selectedId: (nextReference ?? nextMeasured)?.id,
      };
    });
  }
  clearReference(boatId: string) {
    return this.update(boatId, (state) => {
      const measured = boatPolarCurves(state).measured;
      return {
        ...state,
        polars: measured ? [measured] : [],
        selectedId: measured?.id,
      };
    });
  }
  clearMeasured(boatId: string) {
    return this.update(boatId, (state) => {
      const reference = boatPolarCurves(state).reference;
      return {
        ...state,
        polars: reference ? [reference] : [],
        selectedId: reference?.id,
      };
    });
  }
  restore(boatId: string, snapshot: BoatPolars) {
    return this.update(boatId, () => snapshot);
  }
  select(boatId: string, id?: string) {
    return this.update(boatId, (state) => {
      if (id && !state.polars.some((p) => p.id === id))
        throw new Error("Polar not found.");
      return { ...state, selectedId: id };
    });
  }
  saveObservations(
    boatId: string,
    setId: string,
    observations: SailingObservation[],
  ) {
    return this.update(boatId, async (state) => {
      if (observations.some((o) => o.boatId !== boatId))
        throw new Error("Wrong boat observations.");
      // Keep individual values small enough for native key/value storage.
      const prefix = `${setId}/chunk/`,
        ids: string[] = [];
      // Saved trips are immutable source snapshots. A rebuild reuses the originals.
      if (
        state.observationSets.some(
          (id) => id === setId || id.startsWith(prefix),
        )
      )
        return state;
      for (let offset = 0; offset < observations.length; offset += 500) {
        const id = `${prefix}${offset / 500}`;
        await this.storage.setItem(
          `${this.key(boatId)}:observations:${encodeURIComponent(id)}`,
          JSON.stringify(observations.slice(offset, offset + 500)),
        );
        ids.push(id);
      }
      return {
        ...state,
        observationSets: [
          ...state.observationSets.filter(
            (id) => id !== setId && !id.startsWith(prefix),
          ),
          ...ids,
        ],
      };
    });
  }
  async observations(boatId: string) {
    const state = await this.read(boatId);
    const sets = await Promise.all(
      state.observationSets.map(
        async (id) =>
          JSON.parse(
            (await this.storage.getItem(
              `${this.key(boatId)}:observations:${encodeURIComponent(id)}`,
            )) ?? "[]",
          ) as SailingObservation[],
      ),
    );
    return sets.flat();
  }
}
