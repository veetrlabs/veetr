import RacePhones from "./RacePhones";
import { useEffect, useState, type ReactNode } from "react";
import { t } from "./i18n";
import { appHref } from "./routes";
import type { Series } from "./domain";
import { listRemote } from "./api";
import {
  acceptInvitation,
  emailInvitation,
  getBoatRoster,
  getMyBoats,
  getTrackingWindow,
  invitationHref,
  inviteSkipper,
  previewInvitation,
  removeBoatMember,
  revokeInvitation,
  setTrackingWindow,
  type BoatRoster,
  type MyBoat,
} from "./boatAccessApi";

export function BoatProfileInvitations({ boatId, userId }: { boatId: string; userId: string }) {
  const [series, setSeries] = useState<Series[]>([]);
  const [selected, setSelected] = useState("");
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
  return <section className="boat-access">
    <h2>{t("Invite skipper")}</h2>
    {!userId ? <p><a href={appHref("?account")}>{t("Sign in to invite a skipper for a series you manage.")}</a></p>
      : loading ? <p role="status">{t("Loading your series…")}</p>
      : error ? <p role="alert">{error}</p>
      : !current ? <p>{t("To invite a skipper, this boat must be in a series you manage. Open your series and add it in Fleet.")} <a href={appHref("?account")}>{t("My series")}</a></p>
      : <>
        <label>{t("Series")}<select value={current.id} onChange={e => setSelected(e.target.value)}>
          {series.map(s => <option key={s.id} value={s.id}>{s.name} · {s.year}</option>)}
        </select></label>
        <BoatInvitations key={current.id} series={{ ...current, boats: current.boats.filter(b => b.id === boatId) }} />
      </>}
  </section>;
}

export function BoatInvitations({ series, fleet }: {
  series: Series;
  fleet?: {
    category: (boat: Series["boats"][number]) => ReactNode;
    actions: (boat: Series["boats"][number]) => ReactNode;
  };
}) {
  const [roster, setRoster] = useState<BoatRoster | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [copied, setCopied] = useState("");
  const [emailError, setEmailError] = useState<{ boatId: string; message: string } | null>(null);
  const [sendingBoat, setSendingBoat] = useState("");
  const refresh = async () => setRoster(await getBoatRoster(series.id));
  useEffect(() => {
    let live = true;
    const load = () =>
      getBoatRoster(series.id)
        .then((r) => {
          if (live) setRoster(r);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    void load();
    const timer = setInterval(load, 10000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [series.id]);
  async function run(fn: () => Promise<void>, emailBoatId?: string) {
    setBusy(true);
    setError("");
    if (emailBoatId) { setEmailError(null); setSendingBoat(emailBoatId); }
    try {
      await fn();
    } catch (e) {
      if (emailBoatId) setEmailError({ boatId: emailBoatId, message: (e as Error).message });
      else setError((e as Error).message);
    } finally {
      try {
        await refresh();
      } catch (e) {
        setError((e as Error).message);
      }
      setBusy(false);
      setSendingBoat("");
    }
  }
  return (
    <section className="boat-access">
      <RacePhones series={series} />
      {!fleet && <h2>{t("Skipper access")}</h2>}
      <p>
        {t(
          "Invite a skipper for this series. Boat profile management and race results remain separate.",
        )}
      </p>
      {!roster && !error && <p role="status">{t("Loading team…")}</p>}
      <div className="table-scroll">
        <table className={fleet ? "fleet-table" : undefined}>
          <thead>
            <tr>
              <th>{t("Boat")}</th>
              {fleet && <th scope="col">{t("Category")}</th>}
              <th>{t("Connection")}</th>
              <th>{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {series.boats.map((boat) => {
              const members = (roster?.members ?? []).filter(
                  (m) => m.boatId === boat.id,
                ),
                invitations = (roster?.invitations ?? []).filter(
                  (i) => i.boatId === boat.id && i.status !== "accepted",
                );
              return (
                <tr key={boat.id}>
                  <th scope="row"><a href={appHref(`?boat=${boat.id}`)}>{boat.name}</a></th>
                  {fleet && <td>{fleet.category(boat)}</td>}
                  <td>
                    {roster &&
                      !members.length &&
                      !invitations.length &&
                      t("Not invited")}
                    {members.map((m) => (
                      <div key={m.userId}>
                        {t("Connected")} · {m.email}{" "}
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(() =>
                              removeBoatMember(series.id, boat.id, m.userId),
                            )
                          }
                        >
                          {t("Remove access")}
                        </button>
                      </div>
                    ))}
                    {invitations.map((i) => (
                      <div className="invitation-row" key={i.id}>
                        <span>
                          {t(
                            i.status === "expired"
                              ? "Invitation expired"
                              : "Invitation pending",
                          )}{" "}
                          · {i.email}
                        </span>
                        {i.status === "pending" && (
                          <>
                            <small>
                              {t(i.sent ? "Invitation email sent" : "Invitation saved; email sending has not been confirmed. You can share the link.")}
                            </small>
                            <small>
                              {t("Expires")}:{" "}
                              {new Date(i.expiresAt).toLocaleDateString()}
                            </small>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  await navigator.clipboard.writeText(
                                    invitationHref(i.token!),
                                  );
                                  setCopied(i.id);
                                })
                              }
                            >
                              {t(
                                copied === i.id
                                  ? "Link copied"
                                  : "Copy invitation link",
                              )}
                            </button>
                          </>
                        )}
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              if (i.status === "pending" && !i.sent) {
                                await emailInvitation(i.id);
                              } else {
                                const next = await inviteSkipper(series.id, boat.id, i.email);
                                await emailInvitation(next.id);
                              }
                            }, boat.id)
                          }
                        >
                          {t(sendingBoat === boat.id ? "Sending invitation…" : i.status === "pending" && !i.sent ? "Retry sending invitation" : "Resend invitation")}
                        </button>
                        <details>
                          <summary>{t("More")}</summary>
                          <button
                            disabled={busy}
                            onClick={() => void run(() => revokeInvitation(series.id, i.id))}
                          >
                            {t("Revoke invitation")}
                          </button>
                        </details>
                      </div>
                    ))}
                    {emailError?.boatId === boat.id && <p className="invitation-error" role="alert">{t(emailError.message)}</p>}
                  </td>
                  <td>
                    {fleet?.actions(boat)}
                    <button
                      disabled={busy}
                      aria-expanded={selected === boat.id}
                      onClick={() =>
                        setSelected(selected === boat.id ? "" : boat.id)
                      }
                    >
                      {t("Invite skipper")}
                    </button>
                    {selected === boat.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const email = String(
                            new FormData(e.currentTarget).get("email"),
                          );
                          void run(async () => {
                            const invite = await inviteSkipper(
                              series.id,
                              boat.id,
                              email,
                            );
                            setSelected("");
                            await refresh();
                            await emailInvitation(invite.id);
                          }, boat.id);
                        }}
                      >
                        <label>
                          {t("Email address")}
                          <input
                            type="email"
                            name="email"
                            required
                            maxLength={254}
                            disabled={busy}
                          />
                        </label>
                        <button disabled={busy}>{t("Send invitation")}</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p role="alert">{t(error)}</p>}
    </section>
  );
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
      <h2>{t("Skipper invitation")}</h2>
      {accepted ? (
        <p role="status">
          {t("Invitation accepted. Your boat is now in My boats.")}
        </p>
      ) : preview === undefined && !error ? (
        <p>{t("Loading invitation…")}</p>
      ) : !preview ? (
        <p>{t("Invitation unavailable")}</p>
      ) : (
        <>
          <p>
            {t("You have been invited to skipper {boat} in {series}.", {
              boat: preview.boat,
              series: preview.series,
            })}
          </p>
          {preview.status === "pending" || preview.status === "accepted" ? (
            <>
              <p>
                {t(
                  "Sign in or create an account with the invited email address, then accept. This grants access for this series without transferring the boat profile.",
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
                  {t("Accept invitation")}
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
            "No connected boats yet. Accept a skipper invitation from your referee.",
          )}
        </p>
      )}
      <p>
        {t(
          "Open the Veetr app, sign in with this account, and refresh your regattas. Start sharing only when you are ready to make your boat’s location public.",
        )}
      </p>
      {boats.map((b) => (
        <article key={`${b.seriesId}/${b.boatId}`}>
          <h3>
            <a href={appHref(`?boat=${b.boatId}`)}>{b.boat}</a> · {b.series}
          </h3>
          <p>
            {t(
              b.open && b.eligible
                ? "Tracking is available in the Veetr app."
                : "Waiting for the referee to open tracking and register a published heat.",
            )}
          </p>
          {!b.races.length && <p>{t("No races entered yet.")}</p>}
          {b.races.map((r) => (
            <div className="tracking-race" key={r.id}>
              <strong>{r.name}</strong>
              <span>{r.date}</span>
            </div>
          ))}
        </article>
      ))}
      {error && <p role="alert">{t(error)}</p>}
    </section>
  );
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
      <p>{t("To test live tracking: invite the skipper from Fleet, enter the boat in a heat, publish that heat, and open tracking here. The skipper accepts the invitation, signs in to the app, and chooses Track → Refresh regattas → Start sharing.")}</p>
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
