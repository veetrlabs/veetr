import React, { useState } from "react";
import { t } from "./i18n";
import { updateTeamMember } from "./api";
import {
  checkTeammate,
  createTeamInvitation,
  sendTeamInvitation,
} from "./seriesInvitations";
import { requestErrorMessage } from "./request";

export function SeriesInviteForm({
  seriesId,
  onChanged,
}: {
  seriesId: string;
  onChanged: () => Promise<void>;
}) {
  const [email, setEmail] = useState(""),
    [role, setRole] = useState<"official" | "admin">("official");
  const [known, setKnown] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [emailLanguage, setEmailLanguage] = useState<"en" | "cs">("en"),
    [message, setMessage] = useState("");
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setNotice("");
        try {
          if (known === null) {
            setKnown(await checkTeammate(seriesId, email));
            return;
          }
          if (known) {
            await updateTeamMember(seriesId, email, role);
            setNotice("Team access saved");
          } else {
            const id = await createTeamInvitation(
              seriesId,
              email,
              role,
              emailLanguage,
              message,
            );
            // The persisted pending row supplies a retry action if delivery fails.
            setKnown(null);
            setEmail("");
            setMessage("");
            try {
              await sendTeamInvitation(id);
              setNotice("Invitation sent");
            } finally {
              await onChanged();
            }
            return;
          }
          setKnown(null);
          setEmail("");
          await onChanged();
        } catch (error) {
          setNotice(requestErrorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{t("Add a teammate or change their role")}</h3>
      <fieldset disabled={busy}>
        <label>
          {t("Teammate’s email")}
          <input
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setKnown(null);
              setNotice("");
            }}
          />
        </label>
        <label>
          {t("Role")}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="official">{t("Referee")}</option>
            <option value="admin">{t("Series manager")}</option>
          </select>
        </label>
        {known === true && (
          <p className="help">
            {t(
              "Account found. Add access directly; no invitation email is needed.",
            )}
          </p>
        )}
        {known === false && (
          <>
            <p role="status">
              {t(
                "No account found. Send an invitation they can accept with any Veetr account.",
              )}
            </p>
            <label>
              {t("Personal message (optional)")}
              <textarea
                rows={4}
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <label>
              {t("Email language")}
              <select
                value={emailLanguage}
                onChange={(e) =>
                  setEmailLanguage(e.target.value as "en" | "cs")
                }
              >
                <option value="en">English</option>
                <option value="cs">Čeština</option>
              </select>
            </label>
            <p className="help">
              {t(
                "The invitation expires in 7 days. Access starts only after they sign in and accept.",
              )}
            </p>
          </>
        )}
        <button className="primary" disabled={busy}>
          {t(
            busy
              ? "Please wait…"
              : known === null
                ? "Check email"
                : known
                  ? "Save team access"
                  : "Send invitation",
          )}
        </button>
      </fieldset>
      {notice && (
        <p className="notice" role="status">
          {t(notice)}
        </p>
      )}
    </form>
  );
}
