import { EditEntityButton } from "./EditEntityButton";
import { DeleteSection } from "./DeleteAction";
import { t } from "./i18n";
import React, { useRef, useState } from "react";
import {
  type Series,
  type RaceEvent,
  type ControlRace,
  id,
  eventsFor,
  materializeEvents,
  eventEntries,
  validateDiscardRules,
} from "./domain";
import { Discards } from "./EventScoring";
export interface Location {
  seriesId?: string;
  eventId?: string;
  heatId?: string;
  newRace?: boolean;
  newHeat?: boolean;
}
export function Breadcrumbs({
  location,
  series,
  navigate,
}: {
  location: Location;
  series?: Series;
  navigate: (l: Location) => void;
}) {
  const event =
    series && eventsFor(series).find((e) => e.id === location.eventId);
  const heat = series?.races.find((r) => r.id === location.heatId);
  return (
    <nav aria-label={t("Breadcrumb")} className="breadcrumbs">
      <button onClick={() => navigate({})}>{t("Series")}</button>
      {series && (
        <>
          <span>›</span>
          <button onClick={() => navigate({ seriesId: series.id })}>
            {series.name}
          </button>
        </>
      )}
      {event && (
        <>
          <span>›</span>
          <button
            onClick={() =>
              navigate({ seriesId: series!.id, eventId: event.id })
            }
          >
            {event.name}
          </button>
        </>
      )}
      {heat && (
        <>
          <span>›</span>
          <span aria-current="page">{heat.name}</span>
        </>
      )}
    </nav>
  );
}
function raceDate(series: Series, event: RaceEvent): string {
  if (event.scheduledStart) {
    const start = new Date(event.scheduledStart);
    if (Number.isFinite(start.getTime())) {
      return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    }
  }
  return series.races
    .filter(heat => (heat.eventId ?? heat.id) === event.id && heat.date)
    .map(heat => heat.date)
    .sort()[0] ?? "";
}

export function SeriesBrowser({
  seriesList,
  location,
  navigate,
  edit,
  create,
}: {
  seriesList: Series[];
  location: Location;
  navigate: (l: Location) => void;
  edit?: (fn: (s: Series) => void, seriesId?: string) => void;
  create?: () => void;
}) {
  const series = seriesList.find((s) => s.id === location.seriesId),
    event = series && eventsFor(series).find((e) => e.id === location.eventId);
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("name"),
    [descending, setDescending] = useState(false);
  const rows = event
    ? series!.races
        .filter((r) => (r.eventId ?? r.id) === event.id)
        .map((r) => ({
          id: r.id,
          name: r.name,
          detail: r.date,
          status: r.status === "draft" ? t("Private") : t("Live"),
          count: r.results.length,
          kind: "heat",
        }))
    : series
      ? eventsFor(series).map((e) => ({
          id: e.id,
          name: e.name,
          detail: raceDate(series, e),
          status: e.completed
            ? t("Completed")
            : t(e.scheduleStatus ?? "In progress"),
          count: series.races.filter((r) => (r.eventId ?? r.id) === e.id)
            .length,
          kind: "event",
        }))
      : seriesList.map((s) => ({
          id: s.id,
          name: s.name,
          detail: String(s.year),
          status: t(s.status),
          count: eventsFor(s).length,
          kind: "series",
        }));
  const canFilter = !series || Boolean(event);
  const visible = rows
    .filter(
      (r) =>
        !canFilter ||
        `${r.name} ${r.detail} ${r.status}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "detail" && series && (!a.detail || !b.detail)) {
        return a.detail ? -1 : b.detail ? 1 : 0;
      }
      const x =
        sort === "count"
          ? a.count
          : sort === "detail"
            ? a.detail
            : sort === "status"
              ? a.status
              : a.name;
      const y =
        sort === "count"
          ? b.count
          : sort === "detail"
            ? b.detail
            : sort === "status"
              ? b.status
              : b.name;
      return (
        (typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), undefined, { numeric: true })) *
        (descending ? -1 : 1)
      );
    });
  const heading = event ? t("Heats") : series ? t("Races") : t("Series");
  return (
    <section>
      <div className="section-title">
        {series ? <h2>{heading}</h2> : <h1>{heading}</h1>}
        {(series ? edit : create) && (
          <button
            onClick={() => {
              if (!series) {
                create?.();
                return;
              }
              if (!event) {
                navigate({ seriesId: series.id, newRace: true });
                return;
              }
              navigate({
                seriesId: series.id,
                eventId: event.id,
                newHeat: true,
              });
            }}
          >
            {t(event ? "New heat" : series ? "New race" : "New series")}
          </button>
        )}
      </div>
      {canFilter && (
        <div className="inline">
          <label>
            {t(event ? "Filter heats" : "Filter series")}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Name, date or status")}
            />
          </label>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                ["name", "Name"],
                ["detail", series ? t("Date") : t("Year")],
                ["status", "Status"],
                [
                  "count",
                  event ? t("Results") : series ? t("Heats") : t("Races"),
                ],
              ].map(([key, label]) => (
                <th
                  key={key}
                  scope="col"
                  aria-sort={
                    sort === key
                      ? descending
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    className="table-sort"
                    aria-label={t("Sort by {name}", { name: t(label) })}
                    onClick={() => {
                      setDescending(sort === key ? !descending : false);
                      setSort(key);
                    }}
                  >
                    {t(label)}{" "}
                    <span aria-hidden="true">
                      {sort === key ? (descending ? "↓" : "↑") : "↕"}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <th>
                  <button
                    className="text-link"
                    onClick={() =>
                      navigate(
                        r.kind === "series"
                          ? { seriesId: r.id }
                          : r.kind === "event"
                            ? { seriesId: series!.id, eventId: r.id }
                            : {
                                seriesId: series!.id,
                                eventId: event!.id,
                                heatId: r.id,
                              },
                      )
                    }
                  >
                    {r.name}
                  </button>
                </th>
                <td>{r.detail || "—"}</td>
                <td>{r.status}</td>
                <td>{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <p>
          {t(
            event
              ? "No matching heats."
              : series
                ? "No matching races."
                : "No matching series.",
          )}
        </p>
      )}
    </section>
  );
}
export function EntityDetails({
  onEditingChange,
  team,
  series,
  location,
  edit,
  onDelete,
}: {
  onEditingChange?: (value: boolean) => void;
  team?: React.ReactNode;
  onDelete?: () => Promise<void>;
  series: Series;
  location: Location;
  edit?: (fn: (s: Series) => void, seriesId?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const changeEditing = (value: boolean) => {
    setEditing(value);
    onEditingChange?.(value);
  };
  const event = eventsFor(series).find((e) => e.id === location.eventId);
  const heat = series.races.find((r) => r.id === location.heatId);
  const entity = heat ?? event ?? series;
  return (
    <section className="entity-details">
      <div className="section-title entity-header">
        <h1>{entity.name}</h1>
        {edit && !editing && (
          <EditEntityButton label={t(heat ? "Edit heat" : event ? "Edit race" : "Edit series")} onClick={() => changeEditing(true)} />
        )}

      </div>
      {!editing && !event && !heat && series.description && (
        <p>{series.description}</p>
      )}
      {edit && editing && (
        <>
        <Editor
          series={series}
          event={heat ? undefined : event}
          heat={heat}
          onCancel={() => changeEditing(false)}
          save={(fn) => {
            edit(fn, series.id);
            changeEditing(false);
          }}
        />
        {!event && !heat && team}
        {onDelete && (
          <DeleteSection
            onDelete={onDelete}
            description={t(
              heat
                ? "Delete this heat and all its results?"
                : event
                  ? "Delete this race, all its heats and results? Boat profiles will remain."
                  : "Delete this series, all its races, heats and results? Boat profiles will remain.",
            )}
          />
        )}
        </>
      )}
    </section>
  );
}
export function Editor({
  creating = false,
  series,
  event,
  heat,
  onCancel,
  save,
}: {
  creating?: boolean;
  series: Series;
  event?: RaceEvent;
  heat?: ControlRace;
  onCancel: () => void;
  save: (fn: (s: Series) => void) => void | Promise<void>;
}) {
  const [rules, setRules] = useState(event?.discards ?? series.discards ?? []);
  const [categories, setCategories] = useState(series.categories);
  const target = heat ?? event ?? series;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submitting = useRef(false);
  return (
    <form
      className="race-edit"
      aria-label={
        creating
          ? t(heat ? "New heat" : "New race")
          : t("Edit {name}", { name: target.name })
      }
      onSubmit={async (e) => {
        e.preventDefault();
        if (submitting.current) return;
        const d = new FormData(e.currentTarget);
        submitting.current = true;
        setBusy(true);
        setError("");
        try {
          const heatDetails = heat ? heatDetailsFromForm(d) : undefined;
          const eventDetails = event ? raceEventDetails(d, rules) : undefined;
          await save((s) => {
            materializeEvents(s);
            if (heat) {
              const r = s.races.find((r) => r.id === heat.id)!;
              Object.assign(r, heatDetails);
              if (!eventsFor(s).some((event) => event.id === r.eventId))
                throw new Error("Select a race for this heat.");
              const entries = eventEntries(s, r.eventId!);
              if (r.results.some((v) => !entries.includes(v.boatId)))
                throw new Error(
                  "The destination race must include all boats with recorded results",
                );
              r.entries = entries;
            } else if (event) {
              Object.assign(
                s.events!.find((v) => v.id === event.id)!,
                eventDetails,
              );
            } else {
              Object.assign(s, {
                name: String(d.get("name")),
                year: Number(d.get("year")),
                description: String(d.get("description")),
                status: String(d.get("status")),
                discards: rules,
                categories,
              });
            }
          });
        } catch (error) {
          setError(error instanceof Error ? error.message : String(error));
        } finally {
          submitting.current = false;
          setBusy(false);
        }
      }}
    >
      {error && <p role="alert">{t(error)}</p>}
      <fieldset disabled={busy} className="entity-form-fields">
        {!creating && (
          <h2>{t(heat ? "Edit heat" : event ? "Edit race" : "Edit series")}</h2>
        )}
        <label>
          {t("Name")}
          <input
            name="name"
            required
            defaultValue={target.name}
            autoFocus={creating}
          />
        </label>
        {!heat && !event ? (
          <>
            <label>
              {t("Year")}
              <input
                name="year"
                type="number"
                min="1900"
                max="2200"
                defaultValue={series.year}
              />
            </label>
            <label>
              {t("Description")}
              <textarea name="description" defaultValue={series.description} />
            </label>
            <label>
              {t("Status")}
              <select name="status" defaultValue={series.status}>
                <option value="draft">{t("draft")}</option>
                <option value="active">{t("active")}</option>
                <option value="completed">{t("completed")}</option>
              </select>
            </label>
          </>
        ) : (
          <label>
            {t("Weight")}
            <input
              name="weight"
              type="number"
              min="0.1"
              max="100"
              required
              step="0.1"
              defaultValue={heat?.weight ?? event?.weight}
            />
          </label>
        )}
        {heat && (
          <>
            <label>
              {t("Race")}
              <select name="event" defaultValue={heat.eventId ?? heat.id}>
                {eventsFor(series).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Date")}
              <input name="date" type="date" defaultValue={heat.date} />
            </label>
            <label className="check">
              <input
                name="shared"
                type="checkbox"
                defaultChecked={heat.status !== "draft"}
              />
              {t("Share live results")}
            </label>
          </>
        )}
        {event && (
          <label>
            {t("Race start (your local time)")}
            <input
              name="scheduledStart"
              type="datetime-local"
              defaultValue={
                event.scheduledStart
                  ? new Date(
                      Date.parse(event.scheduledStart) -
                        new Date(event.scheduledStart).getTimezoneOffset() *
                          60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
            />
            <small>
              {t(
                "Invitations use this start time. Change it here if the race is postponed.",
              )}
            </small>
          </label>
        )}
        {event && (
          <label className="check">
            <input
              name="completed"
              type="checkbox"
              defaultChecked={event.completed}
            />
            {t("Race completed")}
          </label>
        )}
        {!heat && !event && (
          <div>
            <h3>{t("Categories")}</h3>
            {categories.map((c, i) => (
              <label key={c.id}>
                {t("Category name")}
                <input
                  value={c.name}
                  onChange={(e) =>
                    setCategories(
                      categories.map((v, j) =>
                        j === i ? { ...v, name: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() =>
                setCategories([
                  ...categories,
                  { id: id(), name: "New category" },
                ])
              }
            >
              {t("Add category")}
            </button>
          </div>
        )}
        {!heat && (
          <Discards
            value={rules}
            onChange={setRules}
            label={event ? t("Heat discards") : t("Series discards")}
          />
        )}
      </fieldset>
      <div className="form-actions">
        <button type="submit" className="primary" disabled={busy}>
          {t(
            busy
              ? "Saving…"
              : creating
                ? heat
                  ? "Create heat"
                  : "Create race"
                : "Save",
          )}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}

export function raceEventDetails(
  data: FormData,
  discards: RaceEvent["discards"],
) {
  const name = String(data.get("name") ?? "").trim();
  const weight = Number(data.get("weight"));
  const start = String(data.get("scheduledStart") ?? "");
  if (!name) throw new Error("Enter a race name.");
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100)
    throw new Error("Enter a weight between 0.1 and 100.");
  if (start && !Number.isFinite(Date.parse(start)))
    throw new Error("Enter a valid race start time.");
  validateDiscardRules(discards);
  return {
    name,
    weight,
    scheduledStart: start ? new Date(start).toISOString() : undefined,
    completed: data.get("completed") === "on",
    discards,
  };
}

export function heatDetailsFromForm(data: FormData) {
  const name = String(data.get("name") ?? "").trim();
  const date = String(data.get("date") ?? "");
  const weight = Number(data.get("weight"));
  const eventId = String(data.get("event") ?? "");
  if (!name) throw new Error("Enter a heat name.");
  if (!eventId) throw new Error("Select a race for this heat.");
  if (!Number.isFinite(weight) || weight < 0.1 || weight > 100)
    throw new Error("Enter a weight between 0.1 and 100.");
  if (
    date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date)
  )
    throw new Error("Enter a valid heat date.");
  return {
    name,
    date,
    weight,
    eventId,
    status: (data.get("shared") === "on"
      ? "published"
      : "draft") as ControlRace["status"],
  };
}
