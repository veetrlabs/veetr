import {BoatTeam} from "./BoatTeam";
import { appHref } from "./routes";
import { Sailboat, Search, Plus, ArrowUpRight } from "lucide-react";
import { DeleteAction } from "./DeleteAction";
import { t } from "./i18n";
import React, { useEffect, useState } from "react";
import {
  supabase,
  listBoats,
  boatResults,
  createBoat,
  canEditBoat,
  updateBoat,
  deleteBoat,
  type RegisteredBoat,
} from "./api";
import { type Series, id, eventEntries, setEventEntries } from "./domain";
import { EventStandings } from "./EventScoring";

export function NewBoat({
  onCreated,
  standalone = false,
}: {
  onCreated: (boat: RegisteredBoat) => void;
  standalone?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const form = (
      <form
        className="edit-row"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            data = new FormData(form);
          const boat: RegisteredBoat = {
            id: id(),
            name: String(data.get("name")),
            className: String(data.get("class")),
            ...(data.get("length")
              ? { length: Number(data.get("length")) }
              : {}),
          };
          setBusy(true);
          setError("");
          try {
            await createBoat(boat);
            form.reset();
            onCreated(boat);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : String((e as { message?: string }).message ?? e),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label>
            {t("Boat name")}
            <input name="name" required />
          </label>
          <label>
            {t("Class")}
            <input name="class" />
          </label>
          <label>
            {t("Length (m)")}
            <input name="length" type="number" min="0.1" step="0.01" />
          </label>
          <button>{t("Create boat")}</button>
        </fieldset>
        {error && <p role="alert">{t(error)}</p>}
      </form>
  );
  return standalone ? form : <details><summary>{t("Create a new boat")}</summary>{form}</details>;
}
function EditBoat({
  boat,
  onSaved,
  onCancel,
}: {
  boat: RegisteredBoat;
  onSaved: (b: RegisteredBoat) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="edit-row"
      aria-label={t("Edit boat")}
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const next: RegisteredBoat = {
          id: boat.id,
          name: String(data.get("name")).trim(),
          className: String(data.get("class")),
          ...(data.get("length") ? { length: Number(data.get("length")) } : {}),
        };
        setBusy(true);
        setError("");
        try {
          await updateBoat(next, boat);
          onSaved(next);
        } catch (e) {
          setError(String((e as Error).message));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <label>
          {t("Boat name")}
          <input name="name" required defaultValue={boat.name} />
        </label>
        <label>
          {t("Class")}
          <input name="class" defaultValue={boat.className} />
        </label>
        <label>
          {t("Length (m)")}
          <input
            type="number"
            name="length"
            min="0.1"
            step="0.01"
            defaultValue={boat.length}
          />
        </label>
        <button>{t("Save boat")}</button>
        <button type="button" onClick={onCancel}>
          {t("Cancel")}
        </button>
      </fieldset>
      {error && <p role="alert">{t(error)}</p>}
    </form>
  );
}
export function Boats({
  boatId,
  userId,
}: {
  boatId: string | null;
  userId: string;
}) {
  const [boats, setBoats] = useState<RegisteredBoat[]>([]),
    [series, setSeries] = useState<Series[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [b, s] = await Promise.all([
          listBoats(),
          boatId ? boatResults(boatId) : Promise.resolve([]),
        ]);
        if (active) {
          setBoats(b);
          setSeries(s);
          setError("");
        }
      } catch (e) {
        if (active) setError(String((e as Error).message));
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [boatId]);
  const [manager, setManager] = useState("");
  const [editable, setEditable] = useState(false),
    [editing, setEditing] = useState<RegisteredBoat | null>(null);
  useEffect(() => {
    let active = true;
    setEditable(false);
    setManager("");
    setEditing(null);
    const refresh = async () => {
      if (!boatId || !userId || !supabase) return;
      try {
        const [edit, {data: manage, error}] = await Promise.all([canEditBoat(boatId), supabase.rpc("can_manage_boat", {boat_id: boatId})]);
        if (error) throw error;
        if (active) {setEditable(edit); setManager(manage ? userId : "");}
      } catch (e) { if (active) {setEditable(false); setManager(""); setError((e as Error).message);} }
    };
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [boatId, userId]);
  const [creating, setCreating] = useState(false);
  const [sort, setSort] = useState<"name" | "className" | "length">("name");
  const [descending, setDescending] = useState(false);
  const visibleBoats = boats
    .filter(b => `${b.name} ${b.className ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      const x = a[sort], y = b[sort];
      if (x === undefined || x === "") return y === undefined || y === "" ? 0 : 1;
      if (y === undefined || y === "") return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, {numeric: true})) * (descending ? -1 : 1);
    });
  const boat = boats.find((b) => b.id === boatId);
  if (boatId)
    return (
      <section>
        <a href={appHref("?boats")}>{t("← All boats")}</a>
        {loading ? (
          <p>{t("Loading boat…")}</p>
        ) : !boat ? (
          <h1>{t("Boat not found")}</h1>
        ) : (
          <>
            <div className="section-title entity-header">
              <h1>{boat.name}</h1>
              {userId && editable && !editing && (
                <button onClick={() => setEditing({ ...boat })}>
                  {t("Edit boat")}
                </button>
              )}
            {userId && manager === userId && <DeleteAction description={t("Delete this boat profile? It must be removed from every series first.")} onDelete={async () => {await deleteBoat(boat.id); window.location.href=appHref("?boats");}} />}
            </div>

            {userId && editing && editable && (
              <EditBoat
                boat={editing}
                onCancel={() => setEditing(null)}
                onSaved={(updated) => {
                  setBoats((old) =>
                    old.map((b) => (b.id === updated.id ? updated : b)),
                  );
                  setEditing(null);
                }}
              />
            )}
            <p>
              {[boat.className, boat.length ? `${boat.length} m` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {userId && manager === userId && <BoatTeam key={`${boatId}/${userId}`} boatId={boatId} />}
            <h2>{t("Race results")}</h2>
            {!series.length && <p>{t("No shared race results yet.")}</p>}
            {series.map((s) => (
              <div key={s.id}>
                <h3>
                  <a href={appHref(`?public=${s.id}`)}>
                    {s.name} · {s.year}
                  </a>
                </h3>
                <EventStandings
                  series={s}
                  boatId={boatId}
                  categoryId={s.boats.find((b) => b.id === boatId)?.categoryId}
                />
              </div>
            ))}
            <p>
              {t(
                "Shared results update automatically. Standings are provisional while racing continues.",
              )}
            </p>
          </>
        )}
        {error && <p role="alert">{t(error)}</p>}
      </section>
    );
  return (
    <section className="boat-directory">
      <div className="directory-heading">
        <div>
          <p className="directory-eyebrow">{t("Boat directory")}</p>
          <h1>{t("Boats")} <span className="directory-count">{boats.length}</span></h1>
          <p className="directory-description">{t("Explore the fleet. Follow each boat’s racing history.")}</p>
        </div>
        {userId && <button className="directory-create" aria-expanded={creating} aria-controls="directory-new-boat" onClick={() => setCreating(!creating)}>
          <Plus size={18} aria-hidden="true" />{t(creating ? "Cancel" : "Create a new boat")}
        </button>}
      </div>
      {userId && creating && <div id="directory-new-boat" className="directory-new-boat">
        <h2>{t("Create a new boat")}</h2>
        <NewBoat standalone onCreated={boat => {setBoats(old => [...old, boat]);setCreating(false);}} />
      </div>}
      <div className="directory-toolbar">
        <label className="directory-search">
          <Search size={18} aria-hidden="true" />
          <input type="search" aria-label={t("Find a boat")} value={query} onChange={e => setQuery(e.target.value)} placeholder={t("Name or class")} />
        </label>
        <span className="directory-results">{t("{count} boats", {count: visibleBoats.length})}</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr>
            {([ ["name", "Boat"], ["className", "Class"], ["length", "Length (m)"] ] as const).map(([key, label]) => (
              <th key={key} scope="col" aria-sort={sort === key ? descending ? "descending" : "ascending" : "none"}>
                <button className="table-sort" aria-label={t("Sort by {name}", {name: t(label)})} onClick={() => {setDescending(sort === key ? !descending : false); setSort(key);}}>
                  {t(label)} <span aria-hidden="true">{sort === key ? descending ? "↓" : "↑" : "↕"}</span>
                </button>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {visibleBoats.map(b => (
              <tr key={b.id}>
                <th scope="row"><a className="directory-boat-link" href={appHref(`?boat=${b.id}`)}><span className="directory-boat-icon"><Sailboat size={20} aria-hidden="true" /></span><span>{b.name}</span><ArrowUpRight className="directory-link-arrow" size={16} aria-hidden="true" /></a></th>
                <td>{b.className || "—"}</td>
                <td>{b.length ?? "—"}</td>
              </tr>
            ))}
            {!loading && !visibleBoats.length && <tr><td colSpan={3}>{t("No matching boats.")}</td></tr>}
          </tbody>
        </table>
      </div>
      {loading && <p>{t("Loading boats…")}</p>}
      {!loading && !boats.length && !error && <p>{t("No boats yet.")}</p>}
      {error && <p role="alert">{t(error)}</p>}
    </section>
  );
}
export function SeriesFleet({
  series,
  onChange,
}: {
  series: Series;
  onChange?: (change: (s: Series) => void) => void;
}) {
  const [boats, setBoats] = useState<RegisteredBoat[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    listBoats()
      .then(setBoats)
      .catch((e) => setError(String(e.message)));
  }, []);
  const add = (b: RegisteredBoat) =>
    onChange?.((s) => {
      if (!s.boats.some((v) => v.id === b.id)) {
        s.boats.push({
          ...b,
          className: b.className ?? "",
          sailNumber: "",
          categoryId: s.categories[0].id,
        });

      }
    });
  const available = boats.filter(
    (b) =>
      !series.boats.some((v) => v.id === b.id) &&
      `${b.name} ${b.className ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const hasResults = (boatId: string) =>
    series.races.some((r) => r.results.some((v) => v.boatId === boatId));
  return (
    <section className="series-fleet">
      <div className="section-title">
        <h2>{t("Series fleet")}</h2>
        <span>
          {series.boats.length} {t("boats competing")}
        </span>
      </div>
      {onChange && <p>
        {t(
          "Choose the series fleet and categories. Register boats in each race’s Fleet tab.",
        )}
      </p>}
      {series.boats.length ? (
        <div className="table-scroll">
          <table className="fleet-table">
            <thead>
              <tr>
                <th scope="col">{t("Boat")}</th>
                <th scope="col">{t("Category")}</th>
                {onChange && <th scope="col">{t("Actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {series.boats.map((b) => (
                <tr key={b.id}>
                  <th scope="row">
                    <a href={appHref(`?boat=${b.id}`)}>{b.name}</a>
                  </th>
                  <td>
                    {onChange ? <select
                      aria-label={t("Category for {name}", { name: b.name })}
                      value={b.categoryId}
                      onChange={(e) => {
                        const categoryId = e.target.value;
                        onChange?.((s) => {
                          s.boats.find((v) => v.id === b.id)!.categoryId =
                            categoryId;
                        });
                      }}
                    >
                      {series.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select> : series.categories.find(c => c.id === b.categoryId)?.name}
                  </td>
                  {onChange && <td>
                    <button
                      aria-label={t("Remove {name}", { name: b.name })}
                      disabled={hasResults(b.id)}
                      aria-describedby={
                        hasResults(b.id) ? "fleet-removal-help" : undefined
                      }
                      onClick={() =>
                        onChange?.((s) => {
                          s.boats = s.boats.filter((v) => v.id !== b.id);
                          s.events?.forEach((event) => { if (event.entries) event.entries = event.entries.filter((id) => id !== b.id); });
                          s.races.forEach((r) => {
                            r.entries = r.entries.filter((v) => v !== b.id);
                          });
                        })
                      }
                    >
                      {t("Remove")}
                    </button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="notice">
          {t("No boats selected yet. Add boats from the directory below.")}
        </p>
      )}
      {series.boats.some((b) => hasResults(b.id)) && (
        <p className="help" id="fleet-removal-help">
          {t(
            "Boats with recorded results cannot be removed until their results are cleared.",
          )}
        </p>
      )}
      {onChange && <div className="fleet-add">
        <div className="section-title">
          <h2>{t("Add boats")}</h2>
          <span>
            {available.length} {t("available")}
          </span>
        </div>
        <label className="fleet-search">
          {t("Find boats to add")}
          <input
            type="search"
            placeholder={t("Search by boat name or class")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {available.length > 0 ? (
          <div className="table-scroll fleet-available">
            <table className="fleet-table">
              <thead>
                <tr>
                  <th scope="col">{t("Boat")}</th>
                  <th scope="col">{t("Class / length")}</th>
                  <th scope="col">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {available.map((b) => (
                  <tr key={b.id}>
                    <th scope="row">
                      <a href={appHref(`?boat=${b.id}`)}>{b.name}</a>
                    </th>
                    <td>
                      {[b.className, b.length ? `${b.length} m` : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td>
                      <button
                        aria-label={t("Add {name}", { name: b.name })}
                        onClick={() => add(b)}
                      >
                        {t("Add to series")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            {query
              ? t("No matching boats. Try another name or create a new boat.")
              : t("All available boats are already in this series.")}
          </p>
        )}
        <NewBoat
          onCreated={(b) => {
            setBoats((old) => [...old, b]);
            add(b);
          }}
        />
      </div>}
      {error && <p role="status">{t(error)}</p>}
    </section>
  );
}

export function RaceFleet({series, eventId, onChange}: {
  series: Series;
  eventId: string;
  onChange?: (change: (s: Series) => void) => void;
}) {
  const [query, setQuery] = useState("");
  const entries = eventEntries(series, eventId);
  const boats = series.boats.filter(b => onChange || entries.includes(b.id)).filter((b) => b.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <section>
    <div className="section-title"><h2>{t("Race fleet")}</h2><span>{entries.length} {t("boats competing")}</span></div>
    {onChange && <p>{t("Select boats for this race. Registration applies to all its heats and saves automatically.")}</p>}
    <label className="fleet-search">{t("Find a boat")}<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Boat name")} /></label>
    <div className="table-scroll"><table className="fleet-table">
      <thead><tr><th scope="col">{t("Boat")}</th><th scope="col">{t("Category")}</th><th scope="col">{t("Competing")}</th></tr></thead>
      <tbody>{boats.map((b) => {
        const recorded = series.races.some((r) => (r.eventId ?? r.id) === eventId && r.results.some((v) => v.boatId === b.id));
        return <tr key={b.id}><th scope="row"><a className="directory-boat-link" href={appHref(`?boat=${b.id}`)}><span className="directory-boat-icon"><Sailboat size={20} aria-hidden="true" /></span><span>{b.name}</span><ArrowUpRight className="directory-link-arrow" size={16} aria-hidden="true" /></a></th>
          <td>{series.categories.find((c) => c.id === b.categoryId)?.name}</td>
          <td>{onChange ? <input className="fleet-registration" type="checkbox" aria-label={t("Register {name}", {name: b.name})} checked={entries.includes(b.id)} disabled={recorded} aria-describedby={recorded ? "race-fleet-help" : undefined} onChange={(e) => {
            const checked = e.target.checked;
            onChange?.((s) => {
              const current = eventEntries(s, eventId);
              setEventEntries(s, eventId, checked ? [...current, b.id] : current.filter((v) => v !== b.id));
            });
          }} /> : "✓"}</td></tr>;
      })}</tbody>
    </table></div>
    {!boats.length && <p>{t("No matching boats.")}</p>}
    {onChange && <><p className="help" id="race-fleet-help">{t("Boats with recorded results cannot be removed until their results are cleared.")}</p>
    <a href={appHref(`?series=${series.id}`)}>{t("Manage the series fleet to add boats or change categories.")}</a></>}
  </section>;
}
