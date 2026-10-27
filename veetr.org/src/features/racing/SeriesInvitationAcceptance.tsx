import {formatDateTime} from "./timezone";
import React, { useEffect, useState } from "react";
import {
  acceptTeamInvitation,
  previewTeamInvitation,
  pendingTeamToken,
  teamInviteStorage,
  type TeamInvitationPreview,
} from "./seriesInvitations";
import { t } from "./i18n";
import { appHref } from "./routes";
import { requestErrorMessage } from "./request";
export function SeriesInvitationAcceptance({
  userId,
  email,
  onAuthenticate,
  onAccepted,
}: {
  onAccepted: () => void;
  userId: string;
  email: string;
  onAuthenticate: (mode: "signin" | "signup") => void;
}) {
  const [token] = useState(pendingTeamToken),
    [preview, setPreview] = useState<TeamInvitationPreview | null>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [seriesId, setSeriesId] = useState("");
  useEffect(() => {
    if (!token) return;
    let live = true;
    void previewTeamInvitation(token)
      .then((p) => {
        if (live) setPreview(p);
      })
      .catch((e) => {
        if (live) setError(requestErrorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [token]);
  if (!token) return null;
  return (
    <section
      className="notice series-invitation"
      aria-labelledby="series-invite-title"
    >
      <h2 id="series-invite-title">{t("Series team invitation")}</h2>
      {seriesId ? (
        <>
          <p role="status">{t("Invitation accepted. Your access is ready.")}</p>
          <a href={appHref(`?series=${seriesId}`)}>{t("Open series")}</a>
        </>
      ) : preview ? (
        <>
          <p>
            {t("You are invited to {series} as {role}.", {
              series: preview.series,
              role: t(preview.role === "admin" ? "Series manager" : "Referee"),
            })}
          </p>
          {preview.message && (
            <>
              <p>
                <strong>{t("Message from the organiser")}</strong>
              </p>
              <blockquote style={{ whiteSpace: "pre-wrap" }}>
                {preview.message}
              </blockquote>
            </>
          )}
          {preview.status === "pending" ? (
            <>
              <p>
                {t(
                  "Sign in or create an account, then accept. You can use an account with a different email address from the invitation.",
                )}
              </p>
              <p>
                {t("Expires")}:{" "}
                {formatDateTime(preview.expiresAt, "date")}
              </p>
              {userId ? (
                <>
                  <p>
                    {t(
                      "Access will be linked to {email}. To use another account, sign out above first.",
                      { email },
                    )}
                  </p>
                  <button
                    className="primary"
                    disabled={busy || !email}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const id = await acceptTeamInvitation(token);
                        setSeriesId(id);
                      onAccepted();
                        try {
                          sessionStorage.removeItem(teamInviteStorage);
                        } catch {}
                        const url = new URL(location.href);
                        url.searchParams.delete("series-invite");
                        history.replaceState(history.state, "", url);
                      } catch (e) {
                        setError(requestErrorMessage(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t(busy ? "Please wait…" : "Accept invitation")}
                  </button>
                </>
              ) : (
                <div className="actions">
                  <button onClick={() => onAuthenticate("signin")}>
                    {t("Sign in")}
                  </button>
                  <button onClick={() => onAuthenticate("signup")}>
                    {t("Create account")}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p role="status">
              {t(
                preview.status === "accepted"
                  ? "This invitation has already been accepted."
                  : "This invitation has expired or been cancelled. Ask a series manager for a new one.",
              )}
            </p>
          )}
        </>
      ) : (
        <p>
          {t(
            preview === undefined && !error
              ? "Loading invitation…"
              : "Invitation unavailable",
          )}
        </p>
      )}
      {error && <p role="alert">{t(error)}</p>}
    </section>
  );
}
