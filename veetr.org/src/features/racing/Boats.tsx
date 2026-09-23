import { EditEntityButton } from "./EditEntityButton";
import { BoatShareDialog, phoneTrackingStatus, type RaceTrackingEvent } from "./RacePhones";
import { BoatParticipation, BoatInvitations, BoatProfileInvitations, FleetBoatActions } from "./BoatAccess";
import {BoatTeam} from "./BoatTeam";
import { appHref } from "./routes";
import { DeleteSection } from "./DeleteAction";
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
            ...(data.get("weight") ? {weightKg: Number(data.get("weight"))} : {}),
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
          <label>{t("Weight (kg)")}<input name="weight" type="number" min="0.01" max="999999999" step="0.01" /></label>
          <p>{t("A unique tracking color is assigned automatically.")}</p>
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
          trackingColor: String(data.get("color")),
          ...(data.get("weight") ? {weightKg: Number(data.get("weight"))} : {}),
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
        <label>{t("Weight (kg)")}<input name="weight" type="number" min="0.01" max="999999999" step="0.01" defaultValue={boat.weightKg} /></label>
        <label>{t("Tracking color")}<input name="color" type="color" defaultValue={boat.trackingColor || "#007f73"} /></label>
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
  const [accessOnly, setAccessOnly] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("accessBoat"));
  const [inviting, setInviting] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("inviteBoat"));
  const boat = boats.find((b) => b.id === boatId);
  if (boatId && (inviting || accessOnly) && boat) return <section className="entity-editor">
    <a href={appHref(`?boat=${boatId}`)}>{t("Back to boat")}</a>
    <h1>{boat.name}</h1>
    {accessOnly ? <BoatTeam key={`access/${boatId}/${userId}`} boatId={boatId} /> : <BoatProfileInvitations key={`invitations/${boatId}/${userId}`} boatId={boatId} userId={userId} />}
  </section>;
  if (boatId && userId && editing && editable) return <section className="entity-editor">
    <h1>{t("Edit boat")}: {editing.name}</h1>
    <EditBoat boat={editing} onCancel={() => setEditing(null)} onSaved={updated => { setBoats(old => old.map(b => b.id === updated.id ? updated : b)); setEditing(null); }} />
    {manager === userId && <DeleteSection description={t("Delete this boat profile? It must be removed from every series first.")} onDelete={async () => {await deleteBoat(editing.id); window.location.href=appHref("/");}} />}
  </section>;
  if (boatId)
    return (
      <section>
        <a href={appHref("/")}>{t("Back to series")}</a>
        {loading ? (
          <p>{t("Loading boat…")}</p>
        ) : !boat ? (
          <h1>{t("Boat not found")}</h1>
        ) : (
          <>
            <div className="section-title entity-header">
              <h1>{boat.name}</h1>
              {userId && editable && !editing && (
                <EditEntityButton label={t("Edit boat")} onClick={() => setEditing({ ...boat })} />
              )}
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
              {[boat.className, boat.length ? `${boat.length} m` : null, boat.weightKg ? `${boat.weightKg} kg` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <button onClick={() => setInviting(true)}>{t("Invite a boat to a race")}</button>
          {userId && <a className="directory-create" href={`${appHref(`?boat=${boatId}`)}?accessBoat=1`}>{t("Manage boat access")}</a>}
            {userId && <BoatParticipation key={`${boatId}/${userId}`} boatId={boatId} />}
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
                  publicLinks
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
  return null;
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
    <section className="series-fleet race-tab-content">
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
        onChange ? <BoatInvitations key={series.id} series={series} fleet={{
          category: (b) => <select
            aria-label={t("Category for {name}", { name: b.name })}
            value={b.categoryId}
            onChange={(e) => {
              const categoryId = e.target.value;
              onChange(s => { s.boats.find(v => v.id === b.id)!.categoryId = categoryId; });
            }}
          >
            {series.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>,
          actions: (b) => <button className="danger"
            aria-label={t("Remove {name}", { name: b.name })}
            disabled={hasResults(b.id)}
            aria-describedby={hasResults(b.id) ? "fleet-removal-help" : undefined}
            onClick={() => onChange(s => {
              s.boats = s.boats.filter(v => v.id !== b.id);
              s.events?.forEach(event => { if (event.entries) event.entries = event.entries.filter(id => id !== b.id); });
              s.races.forEach(r => { r.entries = r.entries.filter(v => v !== b.id); });
            })}
          >{t("Remove")}</button>,
        }} /> : <div className="table-scroll">
          <table className="fleet-table">
            <thead><tr><th scope="col">{t("Boat")}</th><th scope="col">{t("Category")}</th></tr></thead>
            <tbody>{series.boats.map(b => <tr key={b.id}>
              <th scope="row"><a href={appHref(`?boat=${b.id}`)}>{b.name}</a></th>
              <td>{series.categories.find(c => c.id === b.categoryId)?.name}</td>
            </tr>)}</tbody>
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
  const [sharingBoat, setSharingBoat] = useState("");
  const [tracking, setTracking] = useState<RaceTrackingEvent>();
  const [trackingError, setTrackingError] = useState("");
  const [trackingLoaded, setTrackingLoaded] = useState(false);
  const [revoking, setRevoking] = useState("");
  const [refreshTracking, setRefreshTracking] = useState(0);
  const canManage = Boolean(onChange);
  useEffect(() => {
    setTracking(undefined); setTrackingLoaded(false); setTrackingError("");
    if (!canManage || !supabase) return;
    let live = true;
    const load = async () => {
      const {data, error} = await supabase!.rpc("race_tracking_roster" as never, {sid: series.id} as never);
      if (!live) return;
      if (error) {setTrackingError(error.message); return;}
      setTracking((data as unknown as RaceTrackingEvent[]).find(e => e.eventId === eventId));
      setTrackingLoaded(true); setTrackingError("");
    };
    void load(); const timer = setInterval(load, 10000);
    return () => {live = false; clearInterval(timer);};
  }, [series.id, eventId, canManage, refreshTracking]);
  async function revokePhone(linkId: string) {
    setRevoking(linkId); setTrackingError("");
    try {
      const {error} = await supabase!.rpc("revoke_race_tracking_link" as never, {lid: linkId} as never);
      if (error) throw error;
      setRefreshTracking(v => v + 1);
    } catch (error) {setTrackingError((error as Error).message);}
    finally {setRevoking("");}
  }
  const [query, setQuery] = useState("");
  const entries = eventEntries(series, eventId);
  const boats = series.boats.filter(b => onChange || entries.includes(b.id)).filter((b) => b.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const sharing = series.boats.find(b => b.id === sharingBoat);
  return <section className="race-tab-content">
    {sharing && onChange && <BoatShareDialog series={series} boat={sharing} eventId={eventId} onClose={() => {setSharingBoat(""); setRefreshTracking(v => v + 1);}} />}
    <div className="section-title"><h2>{t("Race fleet")}</h2><span>{entries.length} {t("boats competing")}</span></div>
    {onChange && <p>{t("Select boats for this race. Registration applies to all its heats and saves automatically.")}</p>}
    <label className="fleet-search">{t("Find a boat")}<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Boat name")} /></label>
    <div className="table-scroll"><table className="fleet-table">
      <thead><tr><th scope="col">{t("Boat")}</th><th scope="col">{t("Category")}</th><th scope="col">{t("Competing")}</th>{onChange && <><th scope="col">{t("Tracking status")}</th><th scope="col">{t("Actions")}</th></>}</tr></thead>
      <tbody>{boats.map((b) => {
        const phone = tracking?.phones.find(p => p.boatId === b.id);
        const recorded = series.races.some((r) => (r.eventId ?? r.id) === eventId && r.results.some((v) => v.boatId === b.id));
        return <tr key={b.id}><th scope="row"><a className="directory-boat-link" href={appHref(`?boat=${b.id}`)}>{b.name}</a></th>
          <td>{series.categories.find((c) => c.id === b.categoryId)?.name}</td>
          <td>{onChange ? <input className="fleet-registration" type="checkbox" aria-label={t("Register {name}", {name: b.name})} checked={entries.includes(b.id)} disabled={recorded} aria-describedby={recorded ? "race-fleet-help" : undefined} onChange={(e) => {
            const checked = e.target.checked;
            onChange?.((s) => {
              const current = eventEntries(s, eventId);
              setEventEntries(s, eventId, checked ? [...current, b.id] : current.filter((v) => v !== b.id));
            });
          }} /> : "✓"}</td>{onChange && <>
            <td className="fleet-tracking-status">{trackingLoaded ? t(phoneTrackingStatus(phone, tracking)) : t(trackingError ? "Tracking status unavailable" : "Loading…")}{phone && !phone.eligible && <small>{t("Add boat to a published heat")}</small>}</td>
            <td><FleetBoatActions name={b.name}>
              <a href={appHref(`?boat=${b.id}`)}>{t("Boat details")}</a>
              <button onClick={() => setSharingBoat(b.id)}>{t("Share invitation")}</button>
              {phone && <button className="danger" disabled={Boolean(revoking)} onClick={() => void revokePhone(phone.id)}>{t("Revoke phone access")}</button>}
            </FleetBoatActions></td></>}</tr>;
      })}</tbody>
    </table></div>
    {trackingError && <p role="alert">{t(trackingError)}</p>}
    {!boats.length && <p>{t("No matching boats.")}</p>}
    {onChange && <><p className="help" id="race-fleet-help">{t("Boats with recorded results cannot be removed until their results are cleared.")}</p>
    <a href={appHref(`?series=${series.id}`)}>{t("Manage the series fleet to add boats or change categories.")}</a></>}
  </section>;
}
