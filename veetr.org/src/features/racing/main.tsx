import {PublicRace} from "./PublicRace";
import { t, useLanguage, LanguageSelector } from "./i18n";
import {
  SeriesBrowser,
  Breadcrumbs,
  EntityDetails,
  type Location,
} from "./SeriesBrowser";
import { EventStandings } from "./EventScoring";
import { Boats, SeriesFleet, RaceFleet } from "./Boats";
import { PublicDirectory } from "./PublicDirectory";
import { WorkspaceAccess, requireAccount } from "./WorkspaceAccess";
import { AccountPanel } from "./AccountPanel";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flag, Cloud, Undo2 } from "lucide-react";
import { statuses } from "@veetr/scoring";
import {
  id,
  newSeries,
  normalize,
  setFinish,
  recordFinish,
  undoLastResult,
  type Series,
  type ControlRace,
  validateSeries,
} from "./domain";
import {
  loadLocal,
  removeLocal,
  saveLocal,
  acknowledge,
  stageChange,
  type LocalRecord,
} from "./storage";
import { listRemote, publicSeries, pushRemote, supabase, passwordRecoveryRequested, deleteRaceEntity } from "./api";
import { appHref, integrated, entityId } from "./routes";
const publicId = entityId("series", new URLSearchParams(window.location.search).get("public") || (integrated && location.pathname === "/races/" ? new URLSearchParams(window.location.search).get("series") : null));
const boatId = entityId("boats", new URLSearchParams(window.location.search).get("boat"));
const boatsPage =
  Boolean(boatId) || new URLSearchParams(window.location.search).has("boats") || location.pathname.startsWith("/boats/");
const browsePublic = new URLSearchParams(window.location.search).has("browse") || (integrated && location.pathname === "/races/" && !publicId);
function download(series: Series) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(series, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `veetr-${series.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function readRoute(): Location {
  const params = new URLSearchParams(window.location.search);
  return {
    seriesId: params.get("series") ?? undefined,
    eventId: params.get("event") ?? undefined,
    heatId: params.get("heat") ?? undefined,
  };
}
export default function App({ updateAvailable = false, updateServiceWorker = async (_reload?: boolean) => {} }: {updateAvailable?: boolean; updateServiceWorker?: (reload?: boolean) => Promise<void>}) {
  const language = useLanguage();
  const [records, setRecords] = useState<LocalRecord[]>([]),
    [active, setActive] = useState(readRoute().seriesId ?? ""),
    [page, setPage] = useState(readRoute().heatId ? "finish" : "manage"),
    [category, setCategory] = useState(""),
    [raceId, setRaceId] = useState(readRoute().heatId ?? "");
  const [location, setLocation] = useState<Location>(readRoute);
  const navigate = (next: Location) => {
    const params = new URLSearchParams();
    if (next.seriesId) params.set("series", next.seriesId);
    if (next.eventId) params.set("event", next.eventId);
    if (next.heatId) params.set("heat", next.heatId);
    window.history.pushState(
      null,
      "",
      window.location.pathname + (params.size ? `?${params}` : ""),
    );
    setLocation(next);
    setActive(next.seriesId ?? "");
    setRaceId(next.heatId ?? "");
    setPage(next.heatId ? "finish" : "manage");
  };
  useEffect(() => {
    const restore = () => {
      const next = readRoute();
      setLocation(next);
      setActive(next.seriesId ?? "");
      setRaceId(next.heatId ?? "");
      setPage(next.heatId ? "finish" : "manage");
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const [authReady, setAuthReady] = useState(!supabase);
  const [passwordRecovery, setPasswordRecovery] = useState(passwordRecoveryRequested);
  const [accountOpen, setAccountOpen] = useState(passwordRecoveryRequested || (integrated && window.location.pathname === "/account/"));
  const [clearResultId, setClearResultId] = useState("");
  const [user, setUser] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [publicData, setPublicData] = useState<Series>();
  const current = useRef(records);
  current.current = records;
  const identity = useRef(user);
  identity.current = user;
  const chain = useRef(Promise.resolve());
  const syncing = useRef(false);
  const updates = useRef<BroadcastChannel>();
  const serial = (work: () => Promise<void>) => {
    chain.current = chain.current.then(async () => {
      setBusy(true);
      try {
        await work();
      } catch (e) {
        setMessage(
          e instanceof Error
            ? e.message
            : String((e as { message?: string }).message ?? e),
        );
      } finally {
        setBusy(false);
      }
    });
    return chain.current;
  };
  const install = (rows: LocalRecord[]) => {
    current.current = rows;
    setRecords(rows);
  };
  const persist = async (record: LocalRecord) => {
    try {
      await saveLocal(
        record,
        current.current.find((r) => r.series.id === record.series.id)
          ?.mutationId,
      );
    } catch (error) {
      install(await loadLocal());
      throw error;
    }
    updates.current?.postMessage("saved");
    install([
      ...current.current.filter((r) => r.series.id !== record.series.id),
      record,
    ]);
  };
  const sync = async () => {
    if (!supabase || !identity.current || !navigator.onLine || syncing.current)
      return;
    syncing.current = true;
    const account = identity.current;
    try {
      await chain.current;
      for (const record of current.current.filter(
        (r) => r.pending && r.owner === account,
      )) {
        if (identity.current !== account) return;
        const revision = await pushRemote(record);
        await serial(async () => {
          const latest = current.current.find(
            (r) => r.series.id === record.series.id,
          );
          if (latest) await persist(acknowledge(latest, record, revision));
        });
      }
      const remoteRows = await listRemote();
      if (identity.current !== account) return;
      await serial(async () => {
        for (const local of current.current.filter((r) => r.owner === account && r.revision > 0 && !r.pending && !remoteRows.some((v) => v.document.id === r.series.id))) {
          await removeLocal(local.series.id);
          install(current.current.filter((r) => r.series.id !== local.series.id));
        }
        for (const remote of remoteRows) {
          const local = current.current.find(
            (r) => r.series.id === remote.document.id,
          );
          if (!local?.pending && (!local || local.revision !== remote.revision))
            await persist({
              series: remote.document,
              revision: remote.revision,
              owner: account,
              pending: false,
              mutationId: id(),
              savedAt: new Date().toISOString(),
            });
        }
      });
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : String((e as { message?: string }).message ?? e),
      );
    } finally {
      syncing.current = false;
    }
  };
  useEffect(() => {
    const channel = new BroadcastChannel("veetr-race-control-updates");
    updates.current = channel;
    channel.onmessage = () => {
      void serial(async () => install(await loadLocal()));
    };
    return () => {
      channel.close();
      updates.current = undefined;
    };
  }, []);
  useEffect(() => {
    if (publicId) {
      const refresh = () =>
        publicSeries(publicId)
          .then(setPublicData)
          .catch((e) => {
            setPublicData(undefined);
            setMessage(e.message);
          });
      void refresh();
      const timer = setInterval(refresh, 2000);
      return () => clearInterval(timer);
    }
    void serial(async () => {
      const rows = await loadLocal();
      install(rows);
      setActive((value) => value || rows[0]?.series.id || "");
    });
    const on = () => {
        setOnline(true);
        sync();
      },
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const sub = supabase?.auth.onAuthStateChange((_event, session) => {
      if (_event === "PASSWORD_RECOVERY") { setPasswordRecovery(true); setAccountOpen(true); }
      identity.current = session?.user.id ?? "";
      setUser(identity.current);
      setAuthReady(true);
    });
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      sub?.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (user) sync();
  }, [user]);
  useEffect(() => {
    if (publicId) return;
    const timer = setInterval(sync, 2000);
    return () => clearInterval(timer);
  }, []);
  const visible = user
    ? records.filter((r) => r.owner === "local" || r.owner === user)
    : [];
  const record = visible.find((r) => r.series.id === active) ?? visible[0];
  const [canDelete, setCanDelete] = useState(false);
  useEffect(() => {
    let alive = true;
    setCanDelete(false);
    if (user && location.seriesId && supabase) {
      void supabase.rpc("is_official", {sid: location.seriesId, admin_only: true}).then(({data}) => {if (alive) setCanDelete(data === true);});
    }
    return () => {alive = false;};
  }, [user, location.seriesId, record?.revision]);
  const source = publicId ? publicData : record?.series;
  const series = source
    ? { ...source, races: [...source.races].sort((a, b) => a.order - b.order) }
    : undefined;
  const cat = series?.categories.find((c) => c.id === category);
  const race = series?.races.find((r) => r.id === raceId) ?? series?.races[0];
  const edit = (change: (s: Series) => void, seriesId?: string) => {
    const sid = seriesId ?? record?.series.id;
    if (!sid) return;
    serial(async () => {
      requireAccount(identity.current, user);
      const old = current.current.find((r) => r.series.id === sid)!;
      const next = structuredClone(old.series);
      change(next);
      next.races.forEach((r) => normalize(r, next.boats));
      await persist(stageChange(old, next));
      setMessage("Saved on this device");
      void sync();
    });
  };
  const editRace = (change: (r: ControlRace, s: Series) => void) => {
    if (race)
      edit((s) =>
        change(
          s.races.find((r) => r.id === race.id)!,
          s,
        ),
      );
  };
  const create = () =>
    serial(async () => {
      requireAccount(identity.current, user);
      const s = newSeries();
      await persist({
        series: s,
        revision: 0,
        pending: true,
        owner: user,
        mutationId: id(),
        savedAt: new Date().toISOString(),
      });
      navigate({ seriesId: s.id });
    });
  const finishers = race?.results ?? [];
  const pending =
    series?.boats.filter(
      (b) =>
        race?.entries.includes(b.id) &&
        !race.results.some((r) => r.boatId === b.id),
    ) ?? [];
  const form = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return new FormData(event.currentTarget);
  };
  return (
    <>
      {integrated && document.getElementById("veetr-account-controls") && createPortal(<>
        <LanguageSelector />
        <button className="portal-account" onClick={() => setAccountOpen(true)}>{user ? t("Account") : t("Sign in")}</button>
      </>, document.getElementById("veetr-account-controls")!)}
      {!integrated && <header>
        <a className="brand" href="/">
          veetr<span>{t("RACE CONTROL")}</span>
        </a>
        <div className="connection">
          <LanguageSelector />
          <a
            className="public-results-link"
            href="?boats"
            aria-current={boatsPage ? "page" : undefined}
          >
            {t("Boats")}
          </a>
          {publicId ? (
            <a className="public-results-link" href="?browse">
              {t("All series")}
            </a>
          ) : user && !browsePublic ? (
            <a className="public-results-link" href="?browse">
              {t("Public results")}
            </a>
          ) : user && browsePublic ? (
            <a className="public-results-link" href="/">
              {t("Committee workspace")}
            </a>
          ) : null}
          {user &&
            !publicId &&
            !browsePublic &&
            (!online || records.some((r) => r.owner === user && r.pending)) && (
              <>
                <Cloud size={18} />
                <span>
                  {online
                    ? t("Changes waiting to sync")
                    : t("Offline · saved here")}
                </span>
              </>
            )}
          {user &&
            !publicId &&
            !browsePublic &&
            supabase &&
            records.some((r) => r.owner === user && r.pending) && (
              <button onClick={sync} disabled={busy || !online}>
                {t("Sync now")}
              </button>
            )}
          {!publicId && (
            <button
              className="account-trigger"
              onClick={() => setAccountOpen(true)}
            >
              {user ? t("Account") : t("Sign in")}
            </button>
          )}
        </div>
      </header>}
      <div className="race-main">
        {integrated && (!online || (user && records.some(r => r.owner === user && r.pending))) && <div className="portal-toolbar">
          {!online && <span role="status">{t("Offline · saved here")}</span>}
          {user && records.some(r => r.owner === user && r.pending) && <button onClick={sync} disabled={busy || !online}>{t("Sync now")}</button>}
        </div>}
        {updateAvailable && (
          <div className="notice">
            {t("An app update is ready. Reload between races.")}
            <button disabled={busy} onClick={() => updateServiceWorker(true)}>
              {t("Apply update")}
            </button>
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {t(message)}
            <button
              aria-label={t("Dismiss message")}
              onClick={() => setMessage("")}
            >
              {t("×")}
            </button>
          </div>
        )}
        {boatsPage ? (
          <Boats boatId={boatId} userId={user} />
        ) : (
          <WorkspaceAccess
            publicContent={<PublicDirectory />}
            userId={user}
            browsingPublic={browsePublic}
            authReady={authReady}
            isPublic={Boolean(publicId)}
          >
            {!publicId && (
              <Breadcrumbs
                location={location}
                series={
                  visible.find((r) => r.series.id === location.seriesId)?.series
                }
                navigate={navigate}
              />
            )}
            {!publicId && location.seriesId && series && (
              <EntityDetails
                key={`${location.seriesId}/${location.eventId ?? ""}/${location.heatId ?? ""}`}
                series={series}
                location={location}
                edit={edit}
                onDelete={canDelete ? async () => {
                  requireAccount(identity.current, user);
                  if (busy || syncing.current) throw new Error("Wait for synchronization to finish and try again.");
                  syncing.current = true;
                  setBusy(true);
                  try {
                  const target = current.current.find((r) => r.series.id === location.seriesId)!;
                  if (target.pending) throw new Error("Sync this series before deleting it or its races and heats.");
                  await deleteRaceEntity(target.series.id, target.revision, location.eventId, location.heatId);
                  if (!location.eventId && !location.heatId) {
                    await removeLocal(target.series.id);
                    install(current.current.filter((r) => r.series.id !== target.series.id));
                    navigate({});
                  } else {
                    const remote = (await listRemote()).find((r) => r.document.id === target.series.id)!;
                    await persist({...target, series: remote.document, revision: remote.revision, pending: false, mutationId: id()});
                    navigate({seriesId: target.series.id, eventId: location.heatId ? location.eventId : undefined});
                  }
                  updates.current?.postMessage("saved");
                  } finally { syncing.current = false; setBusy(false); }
                } : undefined}
              />
            )}
            {!publicId && location.seriesId && !location.heatId && (
              <nav aria-label={t("Series tools")}>
                <button
                  className={page === "manage" ? "selected" : ""}
                  aria-current={page === "manage" ? "page" : undefined}
                  onClick={() => navigate({ seriesId: location.seriesId, eventId: location.eventId })}
                >
                  {t(location.eventId ? "Heats" : "Races")}
                </button>
                {!location.eventId && (
                <button
                  className={page === "standings" ? "selected" : ""}
                  aria-current={page === "standings" ? "page" : undefined}
                  onClick={() => setPage("standings")}
                >
                  {t("Standings")}
                </button>
                )}
                <button
                  className={page === "fleet" ? "selected" : ""}
                  aria-current={page === "fleet" ? "page" : undefined}
                  onClick={() => setPage("fleet")}
                >
                  {t("Fleet")}
                </button>
              </nav>
            )}
            {!publicId && page === "manage" ? (
              <SeriesBrowser
                key={`${location.seriesId ?? ""}/${location.eventId ?? ""}`}
                seriesList={visible.map((r) => r.series)}
                location={location}
                navigate={navigate}
                edit={edit}
                create={() => create()}
              />
            ) : !series ? (
              <section className="welcome">
                <Flag size={44} />
                {publicId ? (
                  <>
                    <h1>{t("Published results")}</h1>
                    <p>
                      {message
                        ? t("Standings are currently unavailable.")
                        : t("Loading standings…")}
                    </p>
                  </>
                ) : (
                  <>
                    <h1>
                      {t("Good racing.")}
                      <br />
                      {t("Less paperwork.")}
                    </h1>
                    <p>
                      {t("Run the finish line. Keep the series in order.")}
                      <br />
                      {t(
                        "Your work stays on this device, even out on the reservoir.",
                      )}
                    </p>
                  </>
                )}
              </section>
            ) : publicId && new URLSearchParams(window.location.search).get("event") ? (
              <PublicRace series={series} eventId={new URLSearchParams(window.location.search).get("event")!}/>
            ) : (
              <>
                {publicId && (
                  <div className="title">
                    <div>
                      <p className="eyebrow">
                        {series.year} {t("SAILING SERIES")}{" "}
                        {publicId ? t("· PUBLISHED") : ""}
                      </p>
                      <h1>{series.name}</h1>
                      <p>
                        {series.description || t("Race committee workspace")}
                      </p>
                    </div>
                    <span className="badge">{t(series.status)}</span>
                  </div>
                )}
                {(publicId || page === "standings") && (
                  <div className="categories" aria-label={t("Race categories")}>
                    <button
                      className={!cat ? "active" : ""}
                      aria-pressed={!cat}
                      onClick={() => setCategory("")}
                    >
                      {t("All boats")}
                      <span>
                        {series.boats.length} {t("boats")}
                      </span>
                    </button>
                    {series.categories.map((c) => (
                      <button
                        className={cat?.id === c.id ? "active" : ""}
                        aria-pressed={cat?.id === c.id}
                        key={c.id}
                        onClick={() => setCategory(c.id)}
                      >
                        {c.name}
                        <span>
                          {
                            series.boats.filter((b) => b.categoryId === c.id)
                              .length
                          }{" "}
                          {t("boats")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {!publicId && page === "finish" && (
                  <>
                    <div className="racebar">
                      {race && (
                        <>
                          <span className="badge">
                            {race.date}
                            {t("· ×")}
                            {race.weight} {t("points")}
                          </span>
                          <button
                            disabled={!race.results.length}
                            onClick={() =>
                              editRace((r, s) => {
                                undoLastResult(r, s.boats);
                              })
                            }
                          >
                            <Undo2 size={18} />
                            {t("Undo last finish (all categories)")}
                          </button>
                        </>
                      )}
                    </div>
                    {!race ? (
                      <p>
                        {t(
                          "Create a race in Series & races to open the finish line.",
                        )}
                      </p>
                    ) : (
                      <>
                        <div className="finish-layout">
                          <section>
                            <div className="section-title">
                              <h2>{t("Tap as they finish")}</h2>
                              <span>
                                {pending.length} {t("to record")}
                              </span>
                            </div>
                            <p>
                              {t(
                                "All categories sail together. Places are scored within each category.",
                              )}
                            </p>
                            <div className="boat-grid">
                              {pending.map((b) => (
                                <button
                                  className="finish-boat"
                                  key={b.id}
                                  onClick={() =>
                                    editRace((r, s) =>
                                      recordFinish(r, s.boats, b.id),
                                    )
                                  }
                                >
                                  <span>
                                    {
                                      series.categories.find(
                                        (c) => c.id === b.categoryId,
                                      )?.name
                                    }
                                  </span>
                                  <strong>{b.name}</strong>
                                  <span className="record">
                                    {t("Record finish")}
                                    <span>↗</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                            {!pending.length && (
                              <div className="empty">
                                {t("All registered boats recorded.")}
                              </div>
                            )}
                          </section>
                          <section className="finish-log">
                            <div className="section-title">
                              <h2>{t("Finish order")}</h2>
                              <span>
                                {finishers.length} {t("recorded")}
                              </span>
                            </div>
                            {finishers.map((result, i) => {
                              const b = series.boats.find(
                                (b) => b.id === result.boatId,
                              )!;
                              return (
                                <div className="result" key={b.id}>
                                  <strong className="position">{result.points ?? i + 1}</strong>
                                  <div>
                                    <strong>{b.name}</strong>
                                    <small>
                                      {
                                        series.categories.find(
                                          (c) => c.id === b.categoryId,
                                        )?.name
                                      }
                                      {result.finishedAt
                                        ? " · " +
                                          new Date(
                                            result.finishedAt,
                                          ).toLocaleTimeString()
                                        : ""}
                                    </small>
                                  </div>
                                  {result.points !== undefined ? <label>{t("Imported points")}<input type="number" min="0" step="any" value={result.points} onChange={e => { const points = Number(e.target.value); if (Number.isFinite(points) && points >= 0) editRace(r => { r.results.find(v => v.boatId === b.id)!.points = points; }); }} /></label> : <select
                                    aria-label={t("Status for {name}", {
                                      name: b.name,
                                    })}
                                    value={result.status}
                                    onChange={(e) =>
                                      editRace((r, s) =>
                                        setFinish(
                                          r,
                                          s.boats,
                                          b.id,
                                          e.target
                                            .value as typeof result.status,
                                        ),
                                      )
                                    }
                                  >
                                    {statuses.filter(st => st !== "SCORED").map((st) => (
                                      <option key={st} value={st}>
                                        {t(st)}
                                      </option>
                                    ))}
                                  </select>}
                                  <button
                                    aria-label={t("Move {name} up", {
                                      name: b.name,
                                    })}
                                    disabled={i === 0 || result.points !== undefined}
                                    onClick={() =>
                                      editRace((r, s) => {
                                        const index = r.results.findIndex(
                                            (v) => v.boatId === b.id,
                                          ),
                                          previous = r.results.findIndex(
                                            (v) =>
                                              v.boatId ===
                                              finishers[i - 1].boatId,
                                          );
                                        [
                                          r.results[index],
                                          r.results[previous],
                                        ] = [
                                          r.results[previous],
                                          r.results[index],
                                        ];
                                        normalize(r, s.boats);
                                      })
                                    }
                                  >
                                    ↑
                                  </button>
                                  <button
                                    aria-label={t("Clear result for {name}", {
                                      name: b.name,
                                    })}
                                    onClick={() => {
                                      if (clearResultId === b.id)
                                        editRace((r, s) => {
                                          r.results = r.results.filter(
                                            (v) => v.boatId !== b.id,
                                          );
                                          normalize(r, s.boats);
                                          setClearResultId("");
                                        });
                                      else setClearResultId(b.id);
                                    }}
                                  >
                                    {clearResultId === b.id
                                      ? t("Clear?")
                                      : t("×")}
                                  </button>
                                  {clearResultId === b.id && (
                                    <button
                                      onClick={() => setClearResultId("")}
                                    >
                                      {t("Cancel")}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            {pending.length > 0 && (
                              <details>
                                <summary>
                                  {t("Record DNS, DNF or another status")}
                                </summary>
                                {pending.map((b) => (
                                  <label className="status-entry" key={b.id}>
                                    {b.name}
                                    <select
                                      aria-label={t(
                                        "Record status for {name}",
                                        { name: b.name },
                                      )}
                                      value=""
                                      onChange={(e) =>
                                        editRace((r, s) =>
                                          setFinish(
                                            r,
                                            s.boats,
                                            b.id,
                                            e.target.value as "DNS",
                                          ),
                                        )
                                      }
                                    >
                                      <option value="">
                                        {t("Choose status…")}
                                      </option>
                                      {statuses
                                        .filter((s) => s !== "FINISHED" && s !== "SCORED")
                                        .map((st) => (
                                          <option key={st} value={st}>
                                            {t(st)}
                                          </option>
                                        ))}
                                    </select>
                                  </label>
                                ))}
                              </details>
                            )}
                          </section>
                        </div>
                        <div className="actions">
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={race.status !== "draft"}
                              onChange={(e) => {
                                const shared = e.target.checked;
                                editRace((r) => {
                                  r.status = shared ? "published" : "draft";
                                });
                              }}
                            />
                            {t("Share live results")}
                          </label>
                          <p>
                            {t(
                              "Shared results update online as finishes are saved. You can keep editing.",
                            )}
                          </p>
                          <button
                            disabled={!race.results.length}
                            onClick={() => {
                              if (
                                confirm(
                                  t(
                                    "Reset every result in this race, across all categories?",
                                  ),
                                )
                              )
                                editRace((r) => {
                                  r.results = [];
                                });
                            }}
                          >
                            {t("Reset results")}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
                {(publicId || page === "standings") && (
                  <EventStandings
                    key={series.id}
                    publicLinks={Boolean(publicId)}
                    series={series}
                    categoryId={cat?.id}
                  />
                )}
                {!publicId && page === "fleet" && (
                  location.eventId ? <RaceFleet series={series} eventId={location.eventId} onChange={edit} /> : <SeriesFleet series={series} onChange={edit} />
                )}
                {!publicId && (
                  <footer>
                    <button onClick={() => download(series)}>
                      {t("Export local backup")}
                    </button>
                    <label className="import">
                      {t("Restore backup as new series")}
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          serial(async () => {
                            const restored = JSON.parse(
                              await file.text(),
                            ) as Series;
                            validateSeries(restored);
                            restored.id = id();
                            restored.name += " (restored)";
                            const cats = new Map(
                              restored.categories.map((c) => [c.id, id()]),
                            );
                            restored.categories.forEach(
                              (c) => (c.id = cats.get(c.id)!),
                            );
                            restored.boats.forEach(
                              (b) => (b.categoryId = cats.get(b.categoryId)!),
                            );
                            restored.races.forEach((r) => {
                              r.id = id();
                              r.status = "draft";
                            });
                            requireAccount(identity.current, user);
                            await persist({
                              series: restored,
                              revision: 0,
                              pending: true,
                              owner: user,
                              mutationId: id(),
                              savedAt: new Date().toISOString(),
                            });
                            setActive(restored.id);
                            setMessage("Backup restored as a new draft series");
                          });
                        }}
                      />
                    </label>
                    {record?.owner === "local" && user && (
                      <button
                        onClick={() =>
                          serial(async () => {
                            requireAccount(identity.current, user);
                            await persist({
                              ...record,
                              owner: user,
                              pending: true,
                            });
                            setMessage(
                              "Attached to your account. Sync to upload.",
                            );
                          })
                        }
                      >
                        {t("Attach local series to my account")}
                      </button>
                    )}
                    {user && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              t(
                                "Replace this device’s copy with the cloud version? Export a local backup first; unsynced changes will be replaced.",
                              ),
                            )
                          )
                            serial(async () => {
                              const remote = (await listRemote()).find(
                                (r) => r.document.id === series.id,
                              );
                              if (!remote)
                                throw new Error("No cloud copy exists");
                              requireAccount(identity.current, user);
                              await persist({
                                series: remote.document,
                                revision: remote.revision,
                                owner: user,
                                pending: false,
                                mutationId: id(),
                                savedAt: new Date().toISOString(),
                              });
                            });
                        }}
                      >
                        {t("Resolve conflict: reload cloud")}
                      </button>
                    )}
                    <small>
                      {t("Local save:")}{" "}
                      {record
                        ? new Date(record.savedAt).toLocaleString(language)
                        : ""}{" "}
                      · {busy ? t("Saving…") : t("Ready")}
                    </small>
                  </footer>
                )}
              </>
            )}
          </WorkspaceAccess>
        )}
        {accountOpen && (
          <AccountPanel
            recovery={passwordRecovery}
            onRecovered={() => {
              setPasswordRecovery(false);
              const url = new URL(window.location.href); url.searchParams.delete("auth");
              history.replaceState(null, "", url);
            }}
            userId={user}
            seriesId={series?.id}
            seriesName={series?.name}
            cloudSaved={Boolean(record?.revision)}
            localSeries={record?.owner === "local"}
            onClose={() => setAccountOpen(false)}
            onAttach={async () => {
              if (!record || !user) return;
              await serial(async () => {
                requireAccount(identity.current, user);
                await persist({ ...record, owner: user, pending: true });
              });
              await sync();
            }}
          />
        )}
      </div>
    </>
  );
}

