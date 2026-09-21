import { DeleteAction } from "./DeleteAction";
import { t } from "./i18n";
import React, { useState } from "react";
import {
  type Series,
  type RaceEvent,
  type ControlRace,
  id,
  eventsFor,
  materializeEvents,
  eventEntries,
} from "./domain";
import { Discards } from "./EventScoring";
export interface Location {
  seriesId?: string;
  eventId?: string;
  heatId?: string;
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
          detail: String(e.order),
          status: e.completed ? t("Completed") : t(e.scheduleStatus ?? "In progress"),
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
    .filter((r) =>
      !canFilter || `${r.name} ${r.detail} ${r.status}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) => {
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
        {(series ? edit : create) && <button
          onClick={() => {
            if (!series) {
              create?.();
              return;
            }
            edit?.((s) => {
              materializeEvents(s);
              if (event) {
                s.races.push({
                  id: id(),
                  eventId: event.id,
                  name: `Heat ${s.races.filter((r) => r.eventId === event.id).length + 1}`,
                  date: new Date().toISOString().slice(0, 10),
                  order: Math.max(0, ...s.races.map((r) => r.order)) + 1,
                  weight: 1,
                  status: "published",
                  entries: eventEntries(s, event.id),
                  results: [],
                });
              } else {
                s.events!.push({
                  id: id(),
                  name: `Race ${s.events!.length + 1}`,
                  order: Math.max(0, ...s.events!.map((e) => e.order)) + 1,
                  weight: 1,
                  completed: false,
                  discards: [],
                  entries: s.boats.map((b) => b.id),
                });
              }
            });
          }}
        >
          {t(event ? "New heat" : series ? "New race" : "New series")}
        </button>}
      </div>
      {canFilter && <div className="inline">
        <label>
          {t(event ? "Filter heats" : "Filter series")}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Name, date or status")}
          />
        </label>
      </div>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                ["name", "Name"],
                ["detail", event ? t("Date") : series ? t("Order") : t("Year")],
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
                <td>{r.detail}</td>
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
  series,
  location,
  edit,
  onDelete,
}: {
  onEditingChange?: (value: boolean) => void;
  onDelete?: () => Promise<void>;
  series: Series;
  location: Location;
  edit?: (fn: (s: Series) => void, seriesId?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const changeEditing = (value: boolean) => { setEditing(value); onEditingChange?.(value); };
  const event = eventsFor(series).find((e) => e.id === location.eventId);
  const heat = series.races.find((r) => r.id === location.heatId);
  const entity = heat ?? event ?? series;
  return (
    <section className="entity-details">

      <div className="section-title entity-header">
        <h1>{entity.name}</h1>
        {edit && !editing && (
          <button onClick={() => changeEditing(true)}>
            {t(heat ? "Edit heat" : event ? "Edit race" : "Edit series")}
          </button>
        )}
      {onDelete && !editing && <DeleteAction onDelete={onDelete} description={t(heat ? "Delete this heat and all its results?" : event ? "Delete this race, all its heats and results? Boat profiles will remain." : "Delete this series, all its races, heats and results? Boat profiles will remain.")} />}
      </div>
      {!editing && !event && !heat && series.description && <p>{series.description}</p>}
      {edit && editing && (
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
      )}
    </section>
  );
}
function Editor({
  series,
  event,
  heat,
  onCancel,
  save,
}: {
  series: Series;
  event?: RaceEvent;
  heat?: ControlRace;
  onCancel: () => void;
  save: (fn: (s: Series) => void) => void;
}) {
  const [rules, setRules] = useState(event?.discards ?? series.discards ?? []);
  const [categories, setCategories] = useState(series.categories);
  const target = heat ?? event ?? series;
  return (
    <form
      className="race-edit"
      aria-label={t("Edit {name}", { name: target.name })}
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        save((s) => {
          materializeEvents(s);
          if (heat) {
            const r = s.races.find((r) => r.id === heat.id)!;
            r.name = String(d.get("name"));
            r.eventId = String(d.get("event"));
            r.date = String(d.get("date"));
            r.weight = Number(d.get("weight"));
            r.status = d.get("shared") === "on" ? "published" : "draft";
            const entries = eventEntries(s, r.eventId!);
            if (r.results.some((v) => !entries.includes(v.boatId))) throw new Error("The destination race must include all boats with recorded results");
            r.entries = entries;
          } else if (event) {
            Object.assign(
              s.events!.find((v) => v.id === event.id)!,
              {
                scheduledStart: d.get("scheduledStart") ? new Date(String(d.get("scheduledStart"))).toISOString() : undefined,
                name: String(d.get("name")),
                weight: Number(d.get("weight")),
                completed: d.get("completed") === "on",
                discards: rules,
              },
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
      }}
    >
      <h2>{t(heat ? "Edit heat" : event ? "Edit race" : "Edit series")}</h2>
      <label>
        {t("Name")}
        <input name="name" required defaultValue={target.name} />
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
      {event && <label>{t("Race start (your local time)")}
        <input name="scheduledStart" type="datetime-local" defaultValue={event.scheduledStart ? new Date(Date.parse(event.scheduledStart) - new Date(event.scheduledStart).getTimezoneOffset() * 60000).toISOString().slice(0,16) : ""} />
        <small>{t("Invitations use this start time. Change it here if the race is postponed.")}</small>
      </label>}
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
              setCategories([...categories, { id: id(), name: "New category" }])
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
      <div className="form-actions">
        <button type="submit" className="primary">{t("Save")}</button>
        <button type="button" onClick={onCancel}>
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}
