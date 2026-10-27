import React, { useEffect, useState } from "react";
import { getTeam, updateTeamMember, type TeamMember } from "./api";
import { SeriesInviteForm } from "./SeriesInviteForm";
import {
  getTeamInvitations,
  revokeTeamInvitation,
  sendTeamInvitation,
  type TeamInvitation,
} from "./seriesInvitations";
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
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const refresh = async () => {
    if (!seriesId) return;
    const [members, invites] = await Promise.all([
      getTeam(seriesId),
      getTeamInvitations(seriesId),
    ]);
    setTeam(members);
    setInvitations(invites);
  };
  useEffect(() => {
    let cancelled = false;
    setTeam(null);
    setTeamError("");
    if (userId && cloudSaved && seriesId)
      void Promise.all([getTeam(seriesId), getTeamInvitations(seriesId)])
        .then(([rows, invites]) => {
          if (!cancelled) {
            setTeam(rows);
            setInvitations(invites);
          }
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
          <SeriesInviteForm seriesId={seriesId} onChanged={refresh} />
          {invitations.length > 0 && (
            <section aria-label={t("Invitations")}>
              <h3>{t("Invitations")}</h3>
              <ul className="team-list">
                {invitations.map((invite) => (
                  <li key={invite.id}>
                    <div>
                      <strong>{invite.email}</strong>
                      <small>
                        {t(
                          invite.role === "admin"
                            ? "Series manager"
                            : "Referee",
                        )}{" "}
                        ·{" "}
                        {t(
                          invite.status === "pending"
                            ? invite.sent
                              ? "Invitation sent"
                              : "Email not sent"
                            : invite.status === "accepted"
                              ? "Accepted"
                              : invite.status === "expired"
                                ? "Expired"
                                : "Cancelled",
                        )}
                        {invite.status === "accepted" &&
                          invite.acceptedEmail &&
                          ` · ${invite.acceptedEmail}`}
                      </small>
                    </div>
                    {invite.status === "pending" && (
                      <div className="actions">
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await sendTeamInvitation(invite.id);
                              await refresh();
                              setMessage("Invitation sent");
                            })
                          }
                        >
                          {t(invite.sent ? "Resend email" : "Retry email")}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await revokeTeamInvitation(invite.id);
                              await refresh();
                              setMessage("Invitation cancelled");
                            })
                          }
                        >
                          {t("Cancel invitation")}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
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
