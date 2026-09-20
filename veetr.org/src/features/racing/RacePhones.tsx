import { useEffect, useState } from "react";
import { supabase } from "./api";
import type { Series } from "./domain";
type Event = {
  id: string;
  eventId: string;
  name: string;
  scheduledStart: string;
  expiresAt: string;
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
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error("Cloud is unavailable");
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw error;
  return data as T;
}
export default function RacePhones({ series }: { series: Series }) {
  const races = series.events ?? series.races;
  const [eid, setEid] = useState(""),
    [bid, setBid] = useState(""),
    [start, setStart] = useState("");
  const [events, setEvents] = useState<Event[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState(""),
    [copied, setCopied] = useState(false);
  const chosen = eid || races[0]?.id || "",
    boat = bid || series.boats[0]?.id || "";
  const current = events.find((e) => e.eventId === chosen);
  const refresh = async () =>
    setEvents(await rpc<Event[]>("race_tracking_roster", { sid: series.id }));
  useEffect(() => {
    let live = true;
    const load = () =>
      rpc<Event[]>("race_tracking_roster", { sid: series.id })
        .then((rows) => {
          if (live) setEvents(rows);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    void load();
    const t = setInterval(load, 10000);
    return () => {
      live = false;
      clearInterval(t);
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
  return (
    <section className="boat-access">
      <h2>Race phones · no account needed</h2>
      <p>
        Sailors open a private link and press Ready to race. Start live tracking
        here when you want ready phones to share; this does not change scoring
        or heat publication.
      </p>
      <label>
        Race
        <select
          value={chosen}
          onChange={(e) => {
            setEid(e.target.value);
            setStart("");
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await rpc("configure_race_tracking", {
              sid: series.id,
              eid: chosen,
              starts_at: new Date(start).toISOString(),
            });
            setStart("");
          });
        }}
      >
        {current && (
          <p>
            Expected start: {new Date(current.scheduledStart).toLocaleString()}{" "}
            · ends {new Date(current.expiresAt).toLocaleString()}
          </p>
        )}
        <label>
          Expected start (your local time)
          <input
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <button disabled={busy || !chosen}>
          {current ? "Update expected start" : "Set up race tracking"}
        </button>
      </form>
      {current && (
        <>
          <p role="status">
            {current.endedAt
              ? "Race tracking finished"
              : current.active
                ? "Live tracking is open"
                : "Waiting — no positions are being published"}
          </p>
          <button
            disabled={busy || Boolean(current.endedAt)}
            onClick={() =>
              void run(async () => {
                await rpc("set_race_tracking_active", {
                  eid: current.id,
                  enabled: !current.active,
                });
              })
            }
          >
            {current.active
              ? "Pause live tracking"
              : "Start live tracking for ready phones"}
          </button>
          <button
            disabled={busy || Boolean(current.endedAt)}
            onClick={() =>
              void run(async () => {
                if (
                  window.confirm(
                    "Finish tracking for this race? All ready phones will stop when they next connect.",
                  )
                )
                  await rpc("finish_race_tracking", { eid: current.id });
              })
            }
          >
            Finish race tracking
          </button>
          <p>
            Pause between heats and start again when needed. Sailors stay ready
            until they leave or this race expires. A recent check-in confirms
            contact, not guaranteed GPS reception.
          </p>
          <label>
            Boat
            <select
              value={boat}
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
          <button
            disabled={busy || !boat}
            onClick={() =>
              void run(async () => {
                if (
                  current.phones.some((p) => p.boatId === boat) &&
                  !window.confirm(
                    "Replace this boat’s invitation? Its previous phone will lose tracking access.",
                  )
                )
                  return;
                const result = await rpc<{ token: string }>(
                  "create_race_tracking_link",
                  { eid: current.id, bid: boat },
                );
                setLink(`${location.origin}/join/${result.token}/`);
                setCopied(false);
              })
            }
          >
            {current.phones.some((p) => p.boatId === boat)
              ? "Replace phone link"
              : "Create phone link"}
          </button>
          {link && (
            <div>
              <p>
                Send this private link through WhatsApp or email. It connects
                one phone to this boat for this race.
              </p>
              <input
                aria-label="Private race invitation"
                readOnly
                value={link}
              />
              <button
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  })
                }
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              {typeof navigator !== "undefined" && Boolean(navigator.share) && (
                <button
                  onClick={() =>
                    void run(async () => {
                      await navigator.share({
                        title: "Track your boat with Veetr",
                        url: link,
                      });
                    })
                  }
                >
                  Share link
                </button>
              )}
            </div>
          )}
          <ul>
            {current.phones.map((p) => (
              <li key={p.id}>
                {series.boats.find((b) => b.id === p.boatId)?.name}:{" "}
                {!p.connected
                  ? "Invitation not opened"
                  : !p.ready
                    ? "Connected · not ready"
                    : !p.lastSeen || Date.now() - Date.parse(p.lastSeen) > 60000
                      ? "Ready · phone not recently reachable"
                      : current.active && p.eligible
                        ? "Ready · live sharing enabled"
                        : "Ready · waiting"}
                {!p.eligible && " · add boat to a published heat"}{" "}
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await rpc("revoke_race_tracking_link", { lid: p.id });
                    })
                  }
                >
                  Revoke phone access
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
