import { ChevronDown } from "lucide-react";
import RacePhones from "./RacePhones";
import { useEffect, useLayoutEffect, useRef, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t } from "./i18n";
import { appHref } from "./routes";
import type { Series } from "./domain";
import { listRemote } from "./api";
import {
  acceptInvitation,
  getMyBoats,
  getTrackingWindow,
  previewInvitation,
  setTrackingWindow,
  type MyBoat,
} from "./boatAccessApi";

export function BoatProfileInvitations({ boatId, userId, accessOnly = false }: { boatId: string; userId: string; accessOnly?: boolean }) {
  const [series, setSeries] = useState<Series[]>([]);
  const [selected, setSelected] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("accessSeries") ?? "");
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!userId) return;
    let live = true;
    const load = async () => {
      try {
        // RLS returns only series this account is allowed to officiate.
        const rows = await listRemote();
        if (live) {
          setSeries(rows.map(r => r.document).filter(s => s.boats.some(b => b.id === boatId)));
          setError("");
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    };
    void load();
    window.addEventListener("focus", load);
    return () => { live = false; window.removeEventListener("focus", load); };
  }, [boatId, userId]);
  const current = series.find(s => s.id === selected) ?? series[0];
  return <div className="boat-invitation-editor">

    {!userId ? <p><a href={appHref("?account")}>{t("Sign in to invite a skipper for a series you manage.")}</a></p>
      : loading ? <p role="status">{t("Loading your series…")}</p>
      : error ? <p role="alert">{error}</p>
      : !current ? <p>{t("To invite a skipper, this boat must be in a series you manage. Open your series and add it in Fleet.")} <a href={appHref("?account")}>{t("My series")}</a></p>
      : <>
        <label>{t("Series")}<select value={current.id} onChange={e => setSelected(e.target.value)}>
          {series.map(s => <option key={s.id} value={s.id}>{s.name} · {s.year}</option>)}
        </select></label>
        {accessOnly ? <BoatInvitations key={current.id} series={{...current, boats: current.boats.filter(b => b.id === boatId)}} /> : <RacePhones key={current.id} series={{ ...current, boats: current.boats.filter(b => b.id === boatId) }} />}
      </>}
  </div>;
}

export function FleetBoatActions({name, children}: {name: string; children: ReactNode}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({top: 0, left: 0});
  const close = () => {setOpen(false); trigger.current?.focus();};
  useLayoutEffect(() => {
    if (!open) return;
    const panel = menu.current!;
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const height = panel.offsetHeight;
      const top = rect.bottom + 4 + height <= window.innerHeight - 8 ? rect.bottom + 4 : Math.max(8, rect.top - height - 4);
      setPosition({top, left: Math.max(8, Math.min(rect.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - 8))});
    };
    place();
    const items = panel.querySelectorAll<HTMLElement>('a, button');
    items.forEach(item => {item.setAttribute('role', 'menuitem'); item.tabIndex = -1;});
    panel.querySelector<HTMLElement>('a, button:not(:disabled)')?.focus({preventScroll: true});
    const outside = (e: PointerEvent) => {
      if (!panel.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);
  return <>
    <button ref={trigger} className="fleet-menu-trigger" type="button" aria-label={t("Actions for {name}", {name})} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(!open)} onKeyDown={e => {if (e.key === 'ArrowDown') {e.preventDefault(); setOpen(true);}}}><ChevronDown size={22} strokeWidth={2} aria-hidden="true" /></button>
    {open && createPortal(<div className="race-app"><div ref={menu} id={id} role="menu" aria-label={t("Actions for {name}", {name})} className="fleet-context-menu" style={position}
      onClick={e => {if ((e.target as HTMLElement).closest('a, button:not(:disabled)')) close();}}
      onKeyDown={e => {
        if (e.key === 'Escape') {e.preventDefault(); close();}
        if (e.key === 'Tab') {e.preventDefault(); close();}
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          const items = Array.from(menu.current!.querySelectorAll<HTMLElement>('a, button:not(:disabled)'));
          const index = items.indexOf(document.activeElement as HTMLElement);
          const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          items[next]?.focus();
        }
      }}>{children}</div></div>, document.body)}
  </>;
}

export function BoatInvitations({ series, fleet }: {
  series: Series;
  fleet?: {
    category: (boat: Series["boats"][number]) => ReactNode;
    actions: (boat: Series["boats"][number]) => ReactNode;
  };
}) {
  if (fleet) return <div className="table-scroll">
    <table className="fleet-table">
      <thead><tr><th scope="col">{t("Boat")}</th><th scope="col">{t("Category")}</th><th scope="col">{t("Actions")}</th></tr></thead>
      <tbody>{series.boats.map(boat => <tr key={boat.id}>
        <th scope="row"><a href={appHref(`?boat=${boat.id}`)}>{boat.name}</a></th>
        <td>{fleet.category(boat)}</td>
        <td><FleetBoatActions name={boat.name}>
          <a href={appHref(`?boat=${boat.id}`)}>{t("Boat details")}</a>
          <a href={`${appHref(`?boat=${boat.id}`)}?accessBoat=1`}>{t("Manage boat access")}</a>
          {fleet.actions(boat)}
        </FleetBoatActions></td>
      </tr>)}</tbody>
    </table>
  </div>;
  return <div className="boat-access-list">{series.boats.map(boat => <a key={boat.id} href={`${appHref(`?boat=${boat.id}`)}?accessBoat=1`}>{t("Manage boat access")} · {boat.name}</a>)}</div>;
}
export function InvitationAcceptance({
  userId,
  onAccepted,
}: {
  userId: string;
  onAccepted: () => void;
}) {
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.search).get("invite");
    if (value) {
      try {
        sessionStorage.setItem("veetr.boat-invite", value);
      } catch {}
      return value;
    }
    try {
      return sessionStorage.getItem("veetr.boat-invite");
    } catch {
      return null;
    }
  });
  const [preview, setPreview] =
      useState<Awaited<ReturnType<typeof previewInvitation>>>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false);
  useEffect(() => {
    if (!token) return;
    let live = true;
    void previewInvitation(token)
      .then((p) => {
        if (live) setPreview(p);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [token]);
  if (!token) return null;
  return (
    <section className="boat-invitation notice">
      <h2>{t(preview?.handover ? "Boat handover" : "Boat access invitation")}</h2>
      {accepted ? (
        <p role="status">
          {t("Invitation accepted. Your access is ready.")}
        </p>
      ) : preview === undefined && !error ? (
        <p>{t("Loading invitation…")}</p>
      ) : !preview ? (
        <p>{t("Invitation unavailable")}</p>
      ) : (
        <>
          <p>
            {preview.handover ? t("You have been invited to take responsibility for {boat} in Veetr. Accepting gives you control of its profile and crew and removes the previous custodian’s boat access. This does not transfer legal ownership of the vessel.", {boat:preview.boat}) : preview.series ? t("You have been invited to skipper {boat} in {series}.", {
              boat: preview.boat,
              series: preview.series,
            }) : t("You have been invited as {role} for {boat}.", {boat: preview.boat, role: t(preview.role === "manager" ? "Skipper" : "Crew")})}
          </p>
          {preview.status === "pending" || preview.status === "accepted" ? (
            <>
              <p>
                {t(
                  "Sign in or create an account with the invited email address, verify your email, then accept the access shown above.",
                )}
              </p>
              {userId && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await acceptInvitation(token);
                      setAccepted(true);
                      try {
                        sessionStorage.removeItem("veetr.boat-invite");
                      } catch {}
                      const url = new URL(window.location.href);
                      url.searchParams.delete("invite");
                      history.replaceState(null, "", url);
                      onAccepted();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t(preview.handover ? "Accept responsibility for this boat" : "Accept invitation")}
                </button>
              )}
            </>
          ) : (
            <p>
              {t(
                "This invitation has expired or was revoked. Ask the referee for a new invitation.",
              )}
            </p>
          )}
        </>
      )}
      {error && <p role="alert">{t(error)}</p>}
    </section>
  );
}
export function MyBoats({ refreshKey = 0 }: { refreshKey?: number }) {
  const [boats, setBoats] = useState<MyBoat[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    const load = () =>
      getMyBoats()
        .then((b) => {
          if (live) {
            setBoats(b);
            setError("");
            setLoading(false);
          }
        })
        .catch((e) => {
          if (live) {
            setError(e.message);
            setLoading(false);
          }
        });
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [refreshKey]);
  return (
    <section className="my-boats" id="my-boats">
      <h2>{t("My boats")}</h2>
      {loading && <p>{t("Loading boats…")}</p>}
      {!loading && !boats.length && !error && (
        <p>
          {t(
            "No connected boats yet. Accept an invitation to join a boat.",
          )}
        </p>
      )}
      <ul className="team-list">
        {Array.from(new Map(boats.map(boat => [boat.boatId, boat])).values()).map(boat => (
          <li key={boat.boatId}><a href={appHref(`?boat=${boat.boatId}`)}>{boat.boat}</a></li>
        ))}
      </ul>
      {error && <p role="alert">{t(error)}</p>}
    </section>
  );
}
export function BoatParticipation({boatId}: {boatId:string}) {
  const [entries,setEntries]=useState<MyBoat[]>([]);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    void getMyBoats().then(rows=>{if(active){setEntries(rows.filter(row=>row.boatId===boatId));setError("");}}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[boatId]);
  if(!entries.length&&!error)return null;
  return <section className="boat-participation">
    <h2>{t("Series participation")}</h2>
    <ul className="team-list">{entries.map(entry=><li key={entry.seriesId}><div><strong>{entry.series}</strong><small>{t(entry.open&&entry.eligible?"Tracking is available in the Veetr app.":"Waiting for the referee to open tracking and register a published heat.")}</small></div></li>)}</ul>
    {error&&<p role="alert">{t(error)}</p>}
  </section>;
}
export function TrackingWindow({ seriesId }: { seriesId: string }) {
  const [state, setState] = useState<{ open: boolean; until: string | null }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const load = () =>
      getTrackingWindow(seriesId)
        .then((s) => {
          if (live) setState(s);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [seriesId]);
  return (
    <section className="tracking-window">
      <h3>{t("Race tracking")}</h3>
      <p>{t("To test live tracking: invite the skipper from Fleet, enter the boat in a heat, publish that heat, and open tracking here. The skipper accepts the invitation, signs in to the app, and chooses Track → Refresh races → Start sharing.")}</p>
      <p>
        {t(
          "Open tracking before the start so crews can check their GPS. The window closes automatically after 12 hours.",
        )}
      </p>
      {state && (
        <>
          <p role="status">
            {t(state.open ? "Tracking open" : "Tracking closed")}
            {state.open && state.until
              ? ` · ${new Date(state.until).toLocaleString()}`
              : ""}
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await setTrackingWindow(seriesId, !state.open);
                setState(await getTrackingWindow(seriesId));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t(state.open ? "Close tracking" : "Open tracking")}
          </button>
        </>
      )}
      {error && <p role="alert">{t(error)}</p>}
    </section>
  );
}
