import { PasswordAuth } from "./PasswordAuth";
import { appHref } from "./routes";
import { t } from "./i18n";
import { useEffect, useRef, useState } from "react";
import {
  getTeam,
  updateTeamMember,
  signOutAccount,
  supabase,
  type TeamMember,
} from "./api";
interface Props {
  recovery?: boolean;
  onRecovered: () => void;
  userId: string;
  seriesId?: string;
  seriesName?: string;
  cloudSaved: boolean;
  localSeries: boolean;
  onAttach: () => Promise<void>;
  onClose: () => void;
}
export function AccountPanel({
  userId,
  recovery,
  onRecovered,
  seriesId,
  seriesName,
  cloudSaved,
  localSeries,
  onAttach,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [team, setTeam] = useState<TeamMember[] | null>(null),
    [teamError, setTeamError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    void supabase?.auth
      .getSession()
      .then(({ data }) => setEmail(data.session?.user.email ?? ""));
  }, [userId]);
  const refresh = async () => {
    if (!seriesId) return;
    setTeam(await getTeam(seriesId));
  };
  useEffect(() => {
    let cancelled = false;
    setTeam(null);
    setTeamError("");
    if (userId && cloudSaved && seriesId)
      void getTeam(seriesId)
        .then((rows) => {
          if (!cancelled) setTeam(rows);
        })
        .catch((e) => {
          if (!cancelled) setTeamError(e.message);
        });
    return () => {
      cancelled = true;
    };
  }, [userId, seriesId, cloudSaved]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : String((e as { message?: string }).message ?? e),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="account-dialog"
      aria-labelledby="account-title"
      onCancel={onClose}
    >
      <div className="section-title">
        <h2 id="account-title">
          {userId ? t("Account & team") : t("Sign in to Race Control")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close account panel")}
        >
          {t("×")}
        </button>
      </div>
      {!supabase ? (
        <p>
          {t(
            "Cloud sign-in is not configured for this installation. Add the Supabase settings to enable sign-in and the committee workspace.",
          )}
        </p>
      ) : !userId || recovery ? (
        <PasswordAuth recovery={recovery} onRecovered={onRecovered}/>
      ) : (
        <>
          <p><a href={appHref("/")}>{t("All series")}</a></p>
          <div className="account-identity">
            <div>
              <strong>{email || "Signed-in account"}</strong>
              <small>{t("Signed in")}</small>
            </div>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await signOutAccount();
                })
              }
            >
              {t("Sign out")}
            </button>
          </div>
          <h3>
            {t("Series team")}
            {seriesName ? ` · ${seriesName}` : ""}
          </h3>
          {!seriesId ? (
            <p>{t("Select or create a series to manage its team.")}</p>
          ) : localSeries ? (
            <>
              <p>
                {t(
                  "This series is saved only on this device. Attach it to your account and sync it to enable team access.",
                )}
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void run(onAttach)}
              >
                {t("Attach and sync this series")}
              </button>
            </>
          ) : !cloudSaved ? (
            <p>{t("Sync this series before managing its team.")}</p>
          ) : teamError ? (
            <p role="status">{teamError}</p>
          ) : team === null ? (
            <p>{t("Loading team…")}</p>
          ) : (
            <>
              <p>
                {t(
                  "Admins manage access. Race officials manage entries and results. The owner always retains access.",
                )}
              </p>
              <ul className="team-list">
                {team.map((member) => (
                  <li key={member.id}>
                    <div>
                      <strong>{member.email}</strong>
                      <small>
                        {member.role === "owner"
                          ? t("Series owner")
                          : member.role === "admin"
                            ? t("Series admin")
                            : t("Race official")}
                        {member.id === userId ? t(" · You") : ""}
                      </small>
                    </div>
                    {member.role !== "owner" && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              t("Remove {name} from this series?", {
                                name: member.email,
                              }),
                            )
                          )
                            void run(async () => {
                              await updateTeamMember(
                                seriesId,
                                member.email,
                                "remove",
                              );
                              await refresh();
                              setMessage("Team access removed");
                            });
                        }}
                      >
                        {t("Remove")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  void run(async () => {
                    await updateTeamMember(
                      seriesId,
                      String(data.get("email")),
                      String(data.get("role")) as "official" | "admin",
                    );
                    await refresh();
                    setMessage("Team access saved");
                  });
                }}
              >
                <h3>{t("Add a teammate or change their role")}</h3>
                <label>
                  {t("Teammate’s email")}
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="off"
                  />
                </label>
                <label>
                  {t("Role")}
                  <select name="role">
                    <option value="official">{t("Race official")}</option>
                    <option value="admin">{t("Series admin")}</option>
                  </select>
                </label>
                <p className="help">
                  {t(
                    "Teammates must sign in once before you can add them. This saves access immediately; it does not send an invitation email.",
                  )}
                </p>
                <button className="primary" disabled={busy}>
                  {t("Save team access")}
                </button>
              </form>
            </>
          )}
        </>
      )}
      {message && (
        <p className="notice" role="status">
          {t(message)}
        </p>
      )}
    </dialog>
  );
}
