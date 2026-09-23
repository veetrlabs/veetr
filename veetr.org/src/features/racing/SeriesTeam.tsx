import React, { useEffect, useState } from "react";
import { getTeam, updateTeamMember, type TeamMember } from "./api";
import { t } from "./i18n";

export function SeriesTeam({
  userId,
  seriesId,
  seriesName,
  cloudSaved,
  localSeries,
  onAttach,
}: {
  userId: string;
  seriesId: string;
  seriesName: string;
  cloudSaved: boolean;
  localSeries: boolean;
  onAttach: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [team, setTeam] = useState<TeamMember[] | null>(null),
    [teamError, setTeamError] = useState("");
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
    <section className="series-team-editor" aria-labelledby="series-team-title">
      <h2 id="series-team-title">
        {t("Series team")}
        {seriesName ? ` · ${seriesName}` : ""}
      </h2>
      {localSeries ? (
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
        <p role="status">{t(teamError)}</p>
      ) : team === null ? (
        <p>{t("Loading team…")}</p>
      ) : (
        <>
          <p>
            {t(
              "Series managers manage access. Referees manage entries and results. The owner always retains access.",
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
                        ? t("Series manager")
                        : t("Referee")}
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
              <input type="email" name="email" required autoComplete="off" />
            </label>
            <label>
              {t("Role")}
              <select name="role">
                <option value="official">{t("Referee")}</option>
                <option value="admin">{t("Series manager")}</option>
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
      {message && (
        <p className="notice" role="status">
          {t(message)}
        </p>
      )}
    </section>
  );
}
