import React, { useEffect, useState } from "react";
import { supabase } from "./api";
import { t } from "./i18n";
import { appHref } from "./routes";
type Access = {
  admin: boolean;
  allowed: boolean;
  status: string | null;
  requestId?: string;
  emailSent?: boolean;
};
export function CreationAccess({ children }: { children?: React.ReactNode }) {
  const [access, setAccess] = useState<Access | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function notify() {
    const access = await supabase!.rpc("creation_access");
    if (access.error) throw access.error;
    const requestId = (access.data as unknown as Access).requestId;
    const result = await supabase!.functions.invoke("creation-request-email", {
      body: { requestId },
    });
    if (result.error)
      throw new Error(
        result.error.context instanceof Response &&
          result.error.context.status === 429
          ? "Email retry limit reached. Wait five minutes between attempts; at most five attempts are allowed within 23 hours. Your request is still awaiting admin review."
          : "Request saved, but email delivery failed. Please retry.",
      );
  }
  const [requests, setRequests] = useState<
    { id: string; email: string; note: string; status: string }[]
  >([]);
  async function refresh() {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("creation_access");
    if (error) throw error;
    const next = data as unknown as Access;
    setAccess(next);
    if (!children && next.admin) {
      const result = await supabase.rpc("list_creation_requests");
      if (result.error) throw result.error;
      setRequests(result.data as unknown as typeof requests);
    }
  }
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (alive) void refresh().catch((e) => setError(e.message));
    };
    load();
    const timer = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
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
    <div className="creation-access">
      {error && <p role="alert">{t(error)}</p>}
      {children && !access && (
        <>
          <h1>{t("New series")}</h1>
          {!error && <p role="status">{t("Loading…")}</p>}
          {error && (
            <button disabled={busy} onClick={() => void run(refresh)}>
              {t("Retry")}
            </button>
          )}
        </>
      )}
      {children && access?.allowed && children}
      {children && access && !access.allowed && (
        <>
          <h1>{t("Request permission to create series")}</h1>
          {access.status ? (
            <p role="status">
              {t(
                access.status === "pending"
                  ? "Your request is awaiting approval."
                  : access.status === "declined"
                    ? "Your request was declined."
                    : "Permission to create series has been revoked.",
              )}
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const reason = String(
                  new FormData(e.currentTarget).get("reason"),
                ).trim();
                if (reason.length < 10) {
                  setError(
                    "Please explain your request in at least 10 characters.",
                  );
                  return;
                }
                void run(async () => {
                  const result = await supabase!.rpc(
                    "request_creation_access",
                    { reason },
                  );
                  if (result.error) throw result.error;
                  setAccess({...access, status: "pending", emailSent: false});
                  await notify();
                });
              }}
            >
              <label>
                {t("Why do you need to create series?")}
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  maxLength={2000}
                  autoFocus
                  disabled={busy}
                  rows={5}
                />
              </label>
              <div className="form-actions">
                <button className="primary" disabled={busy}>
                  {t("Send request")}
                </button>
                {!busy && <a href={appHref("/")}>{t("Cancel")}</a>}
              </div>
            </form>
          )}
          {access.status === "pending" && !access.emailSent && (
            <button disabled={busy} onClick={() => void run(notify)}>
              {t("Retry email notification")}
            </button>
          )}
          {access.status && <a href={appHref("/")}>{t("Back to series")}</a>}
        </>
      )}
      {!children && access?.admin && (
        <section>
          <h2>{t("Series creation requests")}</h2>
          {!requests.length && <p>{t("No pending requests.")}</p>}
          {requests.map((r) => (
            <article key={r.id}>
              <h3>
                <a href={`mailto:${r.email}`}>{r.email}</a>
              </h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{r.note}</p>
              <div className="form-actions">
                {[true, false].map((approve) => (
                  <button
                    key={String(approve)}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const result = await supabase!.rpc(
                          "review_creation_access",
                          { request_id: r.id, approve },
                        );
                        if (result.error) throw result.error;
                      })
                    }
                  >
                    {t(approve ? "Approve" : "Decline")}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
