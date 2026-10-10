import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "./api";
import { eventsFor, type Series } from "./domain";
import { t, useLanguage } from "./i18n";
type Event = {
  id: string;
  eventId: string;
  scheduledStart: string;
  active: boolean;
  endedAt?: string;
  phones: {
    id: string;
    boatId: string;
    connected: boolean;
    ready: boolean;
    lastSeen: string | null;
    eligible: boolean;
  }[];
};
export type { Event as RaceTrackingEvent };
export function phoneTrackingStatus(phone: Event["phones"][number] | undefined, event: Event | undefined) {
  if (!phone) return "Not invited";
  if (event?.endedAt) return "Race tracking finished";
  if (!phone.connected) return "Invitation not opened";
  if (!phone.ready) return "Connected · not ready";
  if (!phone.lastSeen || Date.now() - Date.parse(phone.lastSeen) > 60000) return "Ready · phone not recently reachable";
  return event?.active && phone.eligible ? "Ready · live sharing enabled" : "Ready · waiting";
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error(t("Cloud is unavailable"));
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw error;
  return data as T;
}
function ConfirmationDialog({
  title,
  message,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {
      element.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="race-confirmation"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onCancel={onCancel}
    >
      <h2 id={`${id}-title`}>{t(title)}</h2>
      <p id={`${id}-message`}>{t(message)}</p>
      <div className="actions">
        <button type="button" autoFocus onClick={onCancel}>
          {t("Cancel")}
        </button>
        <button type="button" onClick={onConfirm}>
          {t(title)}
        </button>
      </div>
    </dialog>
  );
}
export function BoatShareDialog({
  series,
  boat,
  onClose,
}: {
  series: Series;
  boat: Series["boats"][number];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {
      element.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="race-confirmation race-share-dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
    >
      <div className="race-share-heading">
        <h2 id={titleId}>{boat.name}</h2>
        <button type="button" className="race-share-close" autoFocus aria-label={t("Close invitation")} title={t("Close invitation")} onClick={onClose}>
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <RacePhones
        series={{ ...series, boats: [boat] }}
        hideContext
      />
    </dialog>
  );
}
export default function RacePhones({
  series,
  eventId,
  hideContext = false,
}: {
  series: Series;
  eventId?: string;
  hideContext?: boolean;
}) {
  const raceControls = Boolean(eventId);
  useLanguage();
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
  } | null>(null);
  const [recipients, setRecipients] = useState<{ id: string; email: string }[]>(
    [],
  );
  const [recipientId, setRecipientId] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [recipientError, setRecipientError] = useState("");
  const races = eventsFor(series);
  const [bid, setBid] = useState("");
  const [seriesPhones, setSeriesPhones] = useState<{id: string; boatId: string; connected: boolean}[]>([]);
  const [events, setEvents] = useState<Event[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState(""),
    [copied, setCopied] = useState(false);
  const chosen =
    races.find((r) => r.id === eventId) ??
    races[0];
  const boat = series.boats.find((b) => b.id === bid) ?? series.boats[0];
  const current = events.find((e) => e.eventId === chosen?.id);
  const starts = chosen?.scheduledStart || current?.scheduledStart;
  const recipient =
    recipients.find((r) => r.id === recipientId) ?? recipients[0];
  useEffect(() => {
    setRecipients([]);
    setRecipientId("");
    setEmailSent(false);
    setRecipientError("");
    let alive = true;
    if (boat && !raceControls)
      void rpc<{ id: string; email: string }[]>("race_invitation_recipients", {
        sid: series.id,
        bid: boat.id,
      })
        .then((rows) => {
          if (alive) setRecipients(rows);
        })
        .catch(() => {
          if (alive)
            setRecipientError(
              "Could not load boat administrator emails. You can still copy the link.",
            );
        });
    return () => {
      alive = false;
    };
  }, [series.id, boat?.id, raceControls]);
  const ended =
    Boolean(current?.endedAt) ||
    Boolean(starts && Date.parse(starts) + 18 * 3600000 <= Date.now());
  const loadRosters = () => Promise.all([
    raceControls ? rpc<Event[]>("race_tracking_roster", { sid: series.id }) : Promise.resolve([] as Event[]),
    raceControls ? Promise.resolve([] as typeof seriesPhones) : rpc<typeof seriesPhones>("series_tracking_roster", { sid: series.id }),
  ]);
  const refresh = async () => {
    const [rows, phones] = await loadRosters();
    setEvents(rows);
    setSeriesPhones(phones);
  };
  useEffect(() => {
    let live = true;
    setRosterLoaded(false);
    const load = () =>
      loadRosters()
        .then(([rows, phones]) => {
          if (live) {
            setEvents(rows);
            setSeriesPhones(phones);
            setRosterLoaded(true);
            setError("");
          }
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
  }, [series.id, raceControls]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const cannotShare =
    busy || !rosterLoaded || !boat;
  const invitation = seriesPhones.find((p) => p.boatId === boat?.id);
  function withInvitation(send: (url: string) => Promise<void>) {
    if (cannotShare || (invitation && !link)) return;
    const action = async () => {
      let url = link;
      if (!url) {
        const result = await rpc<{ token: string }>(
          "create_series_tracking_link",
          { sid: series.id, bid: boat.id },
        );
        url = `${location.origin}/join/${result.token}/`;
        setLink(url);
        setCopied(false);
        setEmailSent(false);
      }
      await send(url);
    };
    void run(action);
  }
  return (
    <div className="race-invitation-form">
      {confirmation && (
        <ConfirmationDialog
          title={confirmation.title}
          message={confirmation.message}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const action = confirmation.action;
            setConfirmation(null);
            void run(action);
          }}
        />
      )}
      {!raceControls && (
        <>
          <h2>{t("Invite a boat to this series")}</h2>
          <p>
            {t(
              "Pair a phone once for this series. The sailor chooses a race and presses Ready to race in Veetr. No account is needed.",
            )}
          </p>
          {!hideContext && <p><strong>{series.name}</strong></p>}
          {series.boats.length === 1 ? (hideContext ? null : (
            <p>
              <strong>
                {t("Boat")}: {boat?.name}
              </strong>
            </p>
          )) : (
            <label>
              {t("Boat")}
              <select
                value={boat?.id ?? ""}
                onChange={(e) => {
                  setBid(e.target.value);
                  setLink("");
                }}
              >
                {series.boats.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {invitation && !link ? (
            <div className="invitation-result">
              <h3>{t("Invitation status")}</h3>
              <p role="status">{t(invitation.connected ? "Accepted — phone connected" : "Pending — not accepted yet")}</p>
              <p>{t("Cancel this invitation to disconnect its phone from every race in this series. You can then share a new invitation.")}</p>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => setConfirmation({
                  title: "Cancel invitation",
                  message: "Cancel this series invitation? Its phone will lose access to every race in this series.",
                  action: async () => {
                    await rpc("revoke_series_tracking_link", { lid: invitation.id });
                    setLink("");
                    setCopied(false);
                    setEmailSent(false);
                  },
                })}
              >{t("Cancel invitation")}</button>
            </div>
          ) : (
          <div className="invitation-result">
            <h3>{t("Share invitation")}</h3>
            <p role="status">
              {t(
                "Copy the link, share it through another app, or send it to a boat administrator.",
              )}
            </p>
            {link && (
              <input
                aria-label={t("Private series invitation")}
                readOnly
                value={link}
              />
            )}
            <div className="actions">
              <button
                disabled={cannotShare}
                onClick={() =>
                  withInvitation(async (url) => {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                  })
                }
              >
                {t(copied ? "Copied" : "Copy link")}
              </button>
              {typeof navigator !== "undefined" && Boolean(navigator.share) && (
                <button
                  disabled={cannotShare}
                  onClick={() =>
                    withInvitation(async (url) => {
                      await navigator.share({
                        title: t("Track your boat with Veetr"),
                        url,
                      });
                    })
                  }
                >
                  {t("Share link")}
                </button>
              )}
            </div>
            {recipient ? (
              <div className="invitation-email">
                <label>
                  {t("Boat administrator")}
                  <select
                    disabled={busy}
                    value={recipient.id}
                    onChange={(e) => {
                      setRecipientId(e.target.value);
                      setEmailSent(false);
                    }}
                  >
                    {recipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.email}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  {t(
                    "This sends the same private invitation link to the selected administrator.",
                  )}
                </p>
                <button
                  disabled={cannotShare}
                  onClick={() =>
                    withInvitation(async (url) => {
                      setEmailSent(false);
                      const { error } = await supabase!.functions.invoke(
                        "boat-invitation-email",
                        {
                          body: {
                            seriesToken: url
                              .split("/join/")[1]
                              .replace(/\/$/, ""),
                            recipientId: recipient.id,
                          },
                        },
                      );
                      if (error)
                        throw new Error(
                          "Email could not be sent. Copy the link or retry in a minute.",
                        );
                      setEmailSent(true);
                    })
                  }
                >
                  {t(emailSent ? "Send email again" : "Send invitation email")}
                </button>
                {emailSent && (
                  <p role="status">
                    {t("Invitation emailed to {email}", {
                      email: recipient.email,
                    })}
                  </p>
                )}
              </div>
            ) : (
              <p>
                {t(
                  recipientError ||
                    "No boat administrator email is configured. Copy the link or share it through another app.",
                )}
              </p>
            )}
          </div>
          )}
        </>
      )}
      {raceControls && !current && chosen && (
        <button disabled={busy || !starts || ended} onClick={() => void run(async () => {
          await rpc("configure_race_tracking", {sid: series.id, eid: chosen.id});
        })}>{t(starts ? "Prepare race tracking" : "Set the start time in Edit race first")}</button>
      )}
      {current && raceControls && (
        <details
          className="race-tracking-controls"
          open={raceControls || undefined}
        >
          <summary>{t("Race tracking")}</summary>
          {raceControls && (
            <>
              <p>
                {t(
                  "These controls start or pause sharing for ready phones. Creating an invitation does not start tracking.",
                )}
              </p>
              <p role="status">
                {t(
                  current.endedAt
                    ? "Race tracking finished"
                    : current.active
                      ? "Live tracking is open"
                      : "Waiting — no positions are being published",
                )}
              </p>
              <div className="actions">
                <button
                  disabled={busy || ended}
                  onClick={() =>
                    void run(async () => {
                      await rpc("set_race_tracking_active", {
                        eid: current.id,
                        enabled: !current.active,
                      });
                    })
                  }
                >
                  {t(
                    current.active
                      ? "Pause live tracking"
                      : "Start live tracking for ready phones",
                  )}
                </button>
                <button
                  disabled={busy || ended}
                  onClick={() =>
                    setConfirmation({
                      title: "Finish race tracking",
                      message:
                        "Finish tracking for this race? All ready phones will stop when they next connect.",
                      action: async () => {
                        await rpc("finish_race_tracking", { eid: current.id });
                      },
                    })
                  }
                >
                  {t("Finish race tracking")}
                </button>
              </div>
            </>
          )}
        </details>
      )}
      {error && <p role="alert">{t(error)}</p>}
    </div>
  );
}
