import { MySeries } from "./MySeries";
import { InvitationAcceptance, MyBoats } from "./BoatAccess";
import { CreationAccess } from "./CreationAccess";
import { PasswordAuth } from "./PasswordAuth";
import { appHref } from "./routes";
import { t } from "./i18n";
import { useEffect, useState } from "react";
import { signOutAccount, supabase } from "./api";
interface Props {
  recovery?: boolean;
  onRecovered: () => void;
  userId: string;
  seriesId?: string;
}
export function AccountPanel({
  userId,
  recovery,
  onRecovered,
  seriesId,
}: Props) {
  const [boatRefresh, setBoatRefresh] = useState(0);
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    void supabase?.auth
      .getSession()
      .then(({ data }) => setEmail(data.session?.user.email ?? ""));
  }, [userId]);
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
    <section
      className={`account-page ${!userId || recovery ? "account-page-auth" : ""}`}
      aria-labelledby="account-title"
    >
      <a
        className="account-back"
        href={seriesId ? appHref(`?series=${seriesId}`) : appHref("/")}
      >
        {t("All series")}
      </a>
      <h1 id="account-title">{t("Account")}</h1>
      {supabase && !recovery && (
        <InvitationAcceptance
          key={userId}
          userId={userId}
          onAccepted={() => setBoatRefresh((n) => n + 1)}
        />
      )}
      {!supabase ? (
        <p>
          {t(
            "Cloud sign-in is not configured for this installation. Add the Supabase settings to enable sign-in and the committee workspace.",
          )}
        </p>
      ) : !userId || recovery ? (
        <PasswordAuth recovery={recovery} onRecovered={onRecovered} />
      ) : (
        <>
          <MySeries key={`series-${userId}`} userId={userId} />
          <MyBoats key={userId} refreshKey={boatRefresh} />
          <CreationAccess key={userId} />
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
