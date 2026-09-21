import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "./api";
import { eventsFor, type Series } from "./domain";
import { t, useLanguage } from "./i18n";
import { appHref } from "./routes";
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
  eventId,
  onClose,
}: {
  series: Series;
  boat: Series["boats"][number];
  eventId?: string;
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
      <button type="button" autoFocus onClick={onClose}>
        {t("Back to boats")}
      </button>
      <h2 id={titleId}>{boat.name}</h2>
      <RacePhones
        series={{ ...series, boats: [boat] }}
        invitationEventId={eventId}
      />
    </dialog>
  );
}
export default function RacePhones({
  series,
  eventId,
  invitationEventId,
}: {
  series: Series;
  eventId?: string;
  invitationEventId?: string;
}) {
  const raceControls = Boolean(eventId);
  const language = useLanguage();
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
  const [eid, setEid] = useState(""),
    [bid, setBid] = useState("");
  const [events, setEvents] = useState<Event[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState(""),
    [copied, setCopied] = useState(false);
  const chosen =
    races.find((r) => r.id === (eventId ?? invitationEventId ?? eid)) ??
    races[0];
  const boat = series.boats.find((b) => b.id === bid) ?? series.boats[0];
  const current = events.find((e) => e.eventId === chosen?.id);
  const starts = chosen?.scheduledStart || current?.scheduledStart;
  const needsDate = !starts || Date.parse(starts) < Date.now();
  const recipient =
    recipients.find((r) => r.id === recipientId) ?? recipients[0];
  useEffect(() => {
    setRecipients([]);
    setRecipientId("");
    setEmailSent(false);
    setRecipientError("");
    let alive = true;
    if (boat)
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
  }, [series.id, boat?.id]);
  const ended =
    Boolean(current?.endedAt) ||
    Boolean(starts && Date.parse(starts) + 18 * 3600000 <= Date.now());
  const refresh = async () =>
    setEvents(await rpc<Event[]>("race_tracking_roster", { sid: series.id }));
  useEffect(() => {
    let live = true;
    setRosterLoaded(false);
    const load = () =>
      rpc<Event[]>("race_tracking_roster", { sid: series.id })
        .then((rows) => {
          if (live) {
            setEvents(rows);
            setRosterLoaded(true);
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
  }, [series.id]);
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
    busy || !rosterLoaded || !chosen || !boat || !starts || ended;
  function withInvitation(send: (url: string) => Promise<void>) {
    if (cannotShare) return;
    const action = async () => {
      let url = link;
      if (!url) {
        const trackingId = await rpc<string>("configure_race_tracking", {
          sid: series.id,
          eid: chosen.id,
        });
        const result = await rpc<{ token: string }>(
          "create_race_tracking_link",
          { eid: trackingId, bid: boat.id },
        );
        url = `${location.origin}/join/${result.token}/`;
        setLink(url);
        setCopied(false);
        setEmailSent(false);
      }
      await send(url);
    };
    if (!link && current?.phones.some((p) => p.boatId === boat.id)) {
      setConfirmation({
        title: "Create a new invitation",
        message:
          "Replace this boat’s invitation? Its previous phone will lose tracking access.",
        action,
      });
    } else void run(action);
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
          <h2>{t("Invite a boat to a race")}</h2>
          <p>
            {t(
              "Share an invitation with the sailor. They open it in Veetr and press Ready to race. No account is needed.",
            )}
          </p>
          {races.length > 1 && !invitationEventId ? (
            <label>
              {t("Race")}
              <select
                value={chosen?.id ?? ""}
                onChange={(e) => {
                  setEid(e.target.value);
                  setLink("");
                }}
              >
                {races.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>
              <strong>
                {t("Race")}: {chosen?.name}
              </strong>
            </p>
          )}
          <p>
            {starts
              ? t("Expected start: {start}", {
                  start: new Date(starts).toLocaleString(language, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })
              : t("Set the start time in Edit race first")}
          </p>
          {chosen && needsDate && (
            <p>
              <a href={appHref(`?public=${series.id}&event=${chosen.id}`)}>
                {t("Edit race start time")}
              </a>
              <br />
              <small>
                {t(
                  "Invitations use this start time. Change it here if the race is postponed.",
                )}
              </small>
            </p>
          )}
          {series.boats.length === 1 ? (
            <p>
              <strong>
                {t("Boat")}: {boat?.name}
              </strong>
            </p>
          ) : (
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
          {ended && (
            <p role="status">
              {t("This race has ended. Update its start time in Edit race")}
            </p>
          )}
          {!link && current?.phones.some((p) => p.boatId === boat?.id) && (
            <p>
              {t(
                "An invitation already exists for this boat. Creating a new one disables the previous link and disconnects its phone. Use this only to replace the invitation or change phones.",
              )}
            </p>
          )}
          <div className="invitation-result">
            <h3>{t("Share invitation")}</h3>
            <p role="status">
              {t(
                "Copy the link, share it through another app, or send it to a boat administrator.",
              )}
            </p>
            {link && (
              <input
                aria-label={t("Private race invitation")}
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
                            raceToken: url
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
        </>
      )}
      {raceControls && !current && (
        <p>
          {t(
            "No boats have been invited to this race yet. Share invitations from this race’s Fleet tab.",
          )}
        </p>
      )}
      {current && (
        <details
          className="race-tracking-controls"
          open={raceControls || undefined}
        >
          <summary>
            {t(
              raceControls
                ? "Race tracking"
                : "This boat’s tracking access",
            )}
          </summary>
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
          {!raceControls && (
            <p>
              <a href={appHref(`?public=${series.id}&event=${chosen.id}`)}>
                {t("Open race tracking controls")}
              </a>
            </p>
          )}
          {!raceControls && <ul>
            {current.phones
              .filter((p) => raceControls || p.boatId === boat?.id)
              .map((p) => (
                <li key={p.id}>
                  {series.boats.find((b) => b.id === p.boatId)?.name}:{" "}
                  {t(
                    !p.connected
                      ? "Invitation not opened"
                      : !p.ready
                        ? "Connected · not ready"
                        : !p.lastSeen ||
                            Date.now() - Date.parse(p.lastSeen) > 60000
                          ? "Ready · phone not recently reachable"
                          : current.active && p.eligible
                            ? "Ready · live sharing enabled"
                            : "Ready · waiting",
                  )}
                  {!p.eligible && ` · ${t("Add boat to a published heat")}`}{" "}
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await rpc("revoke_race_tracking_link", { lid: p.id });
                        setLink("");
                      })
                    }
                  >
                    {t("Revoke phone access")}
                  </button>
                </li>
              ))}
          </ul>}
        </details>
      )}
      {error && <p role="alert">{t(error)}</p>}
    </div>
  );
}
